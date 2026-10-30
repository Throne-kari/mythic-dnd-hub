import './hub-environment.mjs';
import {RoomChat} from '../../server/room-chat.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {createHash, randomBytes, randomUUID, timingSafeEqual} from 'node:crypto';
import {FolderBridge, PROTOCOL_VERSION, atomicJson, atomicWrite, parseProposal, requestIdPattern} from './bridge.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BODY = 2 * 1024 * 1024;
const ACTION_FIELDS = {
  move: ['actorId', 'x', 'y'], attack: ['actorId', 'targetId'], ability: ['actorId', 'targetId', 'abilityId'],
  defend: ['actorId'], endTurn: ['actorId'], choose: ['actorId', 'choiceId'], explore: ['actorId', 'poiId'], travel: ['sceneId'],
  rest: [], retreat: [], 'map.replace': ['mapId', 'map'], 'map.load': ['mapId'], 'map.encounter': ['mapId'], 'actor.place': ['actorId', 'x', 'y'],
};
const PLAYER_ACTIONS = new Set(['move', 'attack', 'ability', 'defend', 'endTurn', 'choose', 'explore']);
const TEAM_ACTIONS = new Set(['travel', 'rest', 'retreat']);
const MANAGEMENT_ACTIONS = new Set(['map.replace', 'map.load', 'map.encounter', 'actor.place']);
const json = value => JSON.parse(JSON.stringify(value));
const safeName = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value);
const canonical = value => value && typeof value === 'object' ? Array.isArray(value)
  ? `[${value.map(canonical).join(',')}]` : `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}` : JSON.stringify(value);
const hash = value => createHash('sha256').update(canonical(value)).digest('hex');
const token = () => randomBytes(32).toString('base64url');
class Problem extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const problem = (status, code, message) => { throw new Problem(status, code, message); };
const errorBody = error => ({ok: false, error: {code: error.code || 'INTERNAL_ERROR', message: error.status ? error.message : '本地服务处理失败，请检查服务日志。'}});

function assertJson(value, depth = 0, nodes = {count: 0}) {
  if (++nodes.count > 100000 || depth > 32) problem(400, 'JSON_LIMIT', 'JSON 结构过深或过大。');
  if (typeof value === 'number' && !Number.isFinite(value)) problem(400, 'JSON_INVALID', '数值必须有限。');
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) problem(400, 'JSON_INVALID', 'JSON 含禁止键。');
    assertJson(child, depth + 1, nodes);
  }
}
function validateState(state) {
  assertJson(state);
  if (!state || typeof state !== 'object' || Array.isArray(state) || !Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.actors)) problem(422, 'STATE_INVALID', '状态格式或版本无效。');
  const ids = state.actors.map(a => a?.id);
  if (ids.some(id => !safeName(id)) || new Set(ids).size !== ids.length) problem(422, 'STATE_INVALID', '状态角色 ID 必须有效且唯一。');
  return state;
}
function validateAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action) || !Object.hasOwn(ACTION_FIELDS, action.type)) problem(400, 'ACTION_INVALID', '未知行动类型。');
  const allowed = ['type', ...ACTION_FIELDS[action.type]];
  if (Object.keys(action).some(key => !allowed.includes(key))) problem(400, 'ACTION_INVALID', '行动含未允许字段。');
  for (const field of ACTION_FIELDS[action.type]) {
    // An ability may target its user or have no target; the engine resolves it.
    if (field === 'targetId' && action.type === 'ability' && action[field] == null) continue;
    if (['x', 'y'].includes(field)) {
      if (!Number.isFinite(action[field])) problem(400, 'ACTION_INVALID', '坐标必须是有限数值。');
    } else if (field === 'map') {
      if (!action.map || typeof action.map !== 'object' || Array.isArray(action.map)) problem(400, 'ACTION_INVALID', '地图必须是对象。');
    } else if (!safeName(action[field])) problem(400, 'ACTION_INVALID', `${field} 无效。`);
  }
  assertJson(action);
  return json(action);
}
async function bodyOf(req) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) problem(415, 'JSON_REQUIRED', '请使用 application/json。');
  const chunks = []; let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > MAX_BODY) problem(413, 'BODY_LIMIT', '请求超过 2 MiB。');
    chunks.push(chunk);
  }
  let body;
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { problem(400, 'JSON_INVALID', '请求不是有效 JSON。'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) problem(400, 'JSON_INVALID', '请求必须是 JSON 对象。');
  assertJson(body);
  return body;
}
const send = (res, status, body) => {
  res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'});
  res.end(JSON.stringify(body));
};

export async function createGameServer({engine, seed = 1, port = 18846, host = '127.0.0.1', mode = 'cooperative',
  dataDir = process.env.HUB_DATA_DIR || path.join(ROOT, 'data', mode === 'hosted' ? 'hosted-celtic-v1' : 'cooperative-celtic-v1'), publicDir = path.join(ROOT, 'public'),
  now = Date.now, agentTimeoutMs = 120000, bridgeIntervalMs = 500, eventLimit = 256, receiptLimit = 1000, presenceTimeoutMs = 90000} = {}) {
  if (!engine) engine = await import('./engine.mjs');
  for (const key of ['createState', 'dispatch', 'publicState', 'validateMap']) if (typeof engine[key] !== 'function') throw Error(`引擎缺少 ${key}`);
  if (!['127.0.0.1', '::1'].includes(host)) throw Error('本版仅允许绑定 localhost。');
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw Error('端口无效。');
  if (!['cooperative', 'hosted'].includes(mode)) throw Error('Unknown table mode');
  const dataRoot = path.resolve(dataDir), staticRoot = path.resolve(publicDir);
  await fs.mkdir(path.join(dataRoot, 'saves'), {recursive: true, mode: 0o700});
  await fs.mkdir(path.join(dataRoot, 'maps'), {recursive: true, mode: 0o700});
  for (const dir of [dataRoot, path.join(dataRoot, 'saves'), path.join(dataRoot, 'maps')]) if ((await fs.lstat(dir)).isSymbolicLink()) throw Error('存盘目录不能是符号链接。');
  let state = validateState(json(engine.createState(seed)));
  state.tableMode = mode;
  let seq = 0, hostSeat = null, initialized = false, bootstrapReceipt = null, closed = false, queue = Promise.resolve();
  const seats = new Map(), tokens = new Map(), owners = new Map(), receipts = new Map(), events = [], streams = new Set(), pending = new Map(), folderPlayers = new Map();
  const chat = new RoomChat({now}), chatRoomId = 'table-' + randomUUID();
  const serial = fn => { const next = queue.then(fn); queue = next.catch(() => {}); return next; };
  const seatView = seat => ({id: seat.id, role: seat.role, name: seat.name, actorIds: [...owners].filter(([, id]) => id === seat.id).map(([id]) => id)});
  const isAdmin = seat => ['host', 'manager'].includes(seat.role);
  const hostOnly = seat => { if (!isAdmin(seat)) problem(403, 'HOST_REQUIRED', '此操作需要独立管理或主持权限。'); };
  const hasParty = seat => seatView(seat).actorIds.some(id => state.actors.some(a => a.id === id && a.side === 'party'));
  const presence = () => ({ok: true, timeoutMs: presenceTimeoutMs, seats: [...seats.values()].map(s => ({...seatView(s), online: now() - s.lastSeen < presenceTimeoutMs, lastSeenAgoMs: Math.max(0, now() - s.lastSeen)}))});
  const requireRevision = body => { if (body.revision !== state.revision) problem(409, 'STALE_REVISION', '局面已变化，请刷新后选择行动。'); };
  const auth = req => {
    const supplied = req.headers['x-seat-token'];
    if (typeof supplied !== 'string' || supplied.length > 200) problem(401, 'AUTH_REQUIRED', '需要本进程签发的席位令牌。');
    const id = tokens.get(createHash('sha256').update(supplied).digest('hex'));
    const seat = seats.get(id);
    if (!seat) problem(401, 'AUTH_INVALID', '席位令牌无效或服务已重启。');
    seat.lastSeen = now();
    return seat;
  };
  const view = seat => {
    const who = seatView(seat);
    const projected = json(engine.publicState(json(state), who));
    const ownPending = [...pending.values()].filter(p => p.seatId === seat.id || seat.role === 'host').map(p => ({requestId: p.requestId, seatId: p.seatId, revision: p.revision, status: p.status, expiresAt: p.expiresAt, ...(p.proposal ? {proposal: p.proposal} : {}), ...(p.error ? {error: p.error} : {})}));
    return {ok: true, protocolVersion: PROTOCOL_VERSION, tableMode: state.tableMode, seat: who, state: projected, revision: state.revision, seq,
      pending: ownPending, ...(isAdmin(seat) ? {seats: [...seats.values()].map(seatView), folderPlayers: [...folderPlayers.values()].map(p => ({seatId:p.seat.id,name:p.seat.name,actorIds:seatView(p.seat).actorIds,folderPath:p.root}))} : {})};
  };
  function emit(type, seatId = null) {
    events.push({seq: ++seq, type, revision: state.revision, time: new Date(now()).toISOString(), ...(seatId ? {seatId} : {})});
    if (events.length > eventLimit) events.splice(0, events.length - eventLimit);
    for (const client of streams) {
      if (seatId && seatId !== client.seat.id && client.seat.role !== 'host') continue;
      if (client.res.destroyed || client.res.writableEnded || client.res.writableLength > MAX_BODY) { client.res.end(); streams.delete(client); continue; }
      try { client.res.write(`id: ${seq}\nevent: state\ndata: ${JSON.stringify(view(client.seat))}\n\n`); }
      catch { streams.delete(client); client.res.destroy(); }
    }
  }
  const authorize = (seat, action) => {
    action = validateAction(action);
    const allowed = seat.role === 'host'
      || seat.role === 'manager' && MANAGEMENT_ACTIONS.has(action.type)
      || seat.role === 'player' && (PLAYER_ACTIONS.has(action.type) && owners.get(action.actorId) === seat.id
        || state.tableMode === 'cooperative' && TEAM_ACTIONS.has(action.type) && hasParty(seat));
    if (!allowed) problem(403, 'ACTOR_FORBIDDEN', '该席位没有此行动权限；合作队员可发起常规队伍行动，管理操作需单独权限。');
    return action;
  };
  function checkMap(map) {
    assertJson(map);
    let result;
    try { result = engine.validateMap(json(map)); } catch (error) { problem(422, 'MAP_INVALID', `地图校验失败：${error.message}`); }
    if (result !== true && !result?.ok) problem(422, 'MAP_INVALID', `地图校验失败：${(result?.errors || ['格式无效']).map(String).slice(0, 12).join('；')}`);
  }
  function dispatch(seat, action, requestId) {
    action = authorize(seat, action);
    if (action.type === 'map.replace') checkMap(action.map);
    let result;
    try { result = engine.dispatch(json(state), action, {seat: seatView(seat), requestId, now: now()}); }
    catch (error) { problem(422, 'RULE_REJECTED', error.message || '引擎拒绝行动。'); }
    if (!result?.ok) problem(422, 'RULE_REJECTED', typeof result?.error === 'string' ? result.error : result?.error?.message || '行动不满足当前规则。');
    const next = validateState(json(result.state));
    next.revision = state.revision + 1;
    return next;
  }
  async function commit(seat, action, requestId) {
    const next = dispatch(seat, action, requestId);
    if (TEAM_ACTIONS.has(action.type)) next.lastTeamAction = {type: action.type, seatId: seat.id, name: seat.name, revision: next.revision};
    await persistNext(next, action);
    state = next;
    await invalidatePending('局面已变化，请创建新快照。');
    emit('action');
    return {applied: true};
  }
  function envelope(kind, value) { return {format: 'celtic-thorn-tide-v1', version: 1, kind, checksum: hash(value), value: json(value)}; }
  async function persistNext(next, action) {
    let mapFile, previousMap, mapWritten = false;
    try {
      if (action.type === 'map.replace') {
        mapFile = path.join(dataRoot, 'maps', `${action.mapId}.json`);
        const stat = await fs.lstat(mapFile).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
        if (stat && (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BODY * 4)) throw Error('地图存盘目标不是有效普通文件。');
        previousMap = stat ? await fs.readFile(mapFile) : null;
        await atomicJson(mapFile, envelope('map', action.map)); mapWritten = true;
      }
      // The durable recovery point is written before exposing any new state,
      // revision, event, RNG result or adopted-agent status to callers.
      await atomicJson(path.join(dataRoot, 'saves', 'autosave.json'), envelope('state', next));
    } catch (error) {
      if (mapWritten) {
        try { if (previousMap) await atomicWrite(mapFile, previousMap); else await fs.unlink(mapFile); }
        catch {
          const failure = new Problem(503, 'MAP_ROLLBACK_FAILED', '本次行动未提交；地图缓存回滚失败，请修复存盘目录后从当前局面重新保存地图。');
          failure.retryable = true; throw failure;
        }
      }
      const failure = new Problem(503, 'AUTOSAVE_FAILED', '自动存档写入失败，本次行动未提交；检查磁盘后可原样重试。');
      failure.retryable = true; throw failure;
    }
  }
  async function readEnvelope(file, kind) {
    const stat = await fs.lstat(file).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > MAX_BODY * 4) problem(404, 'FILE_UNAVAILABLE', '指定的本版存盘不存在或不是有效普通文件。');
    let record;
    const handle = await fs.open(file, 'r');
    try {
      const opened = await handle.stat();
      if (opened.ino !== stat.ino || !opened.isFile() || opened.size > MAX_BODY * 4) problem(422, 'FILE_INVALID', '存盘文件在读取前已更换或过大。');
      const buffer = Buffer.alloc(opened.size + 1);
      const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > opened.size) problem(422, 'FILE_INVALID', '存盘在读取时改变。');
      try { record = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8')); } catch { problem(422, 'FILE_INVALID', '存盘不是有效 JSON。'); }
    } finally { await handle.close(); }
    assertJson(record);
    if (!record || record.format !== 'celtic-thorn-tide-v1' || record.version !== 1 || record.kind !== kind || !record.value || typeof record.value !== 'object' || typeof record.checksum !== 'string' || record.checksum.length !== 64 || !/^[a-f0-9]{64}$/.test(record.checksum)) problem(422, 'FILE_INVALID', '存盘格式不兼容。');
    const expected = Buffer.from(hash(record.value), 'hex'), actual = Buffer.from(record.checksum, 'hex');
    if (!timingSafeEqual(expected, actual)) problem(422, 'CHECKSUM_MISMATCH', '存盘校验和不符，未恢复任何状态。');
    return record.value;
  }
  async function once(seat, body, operation, fn) {
    if (!requestIdPattern.test(body.requestId || '')) problem(400, 'REQUEST_ID_INVALID', 'requestId 需为 8–96 位字母、数字、下划线或连字符。');
    const key = `${seat.id}:${body.requestId}`, fingerprint = hash({operation, body});
    const old = receipts.get(key);
    if (old) {
      if (old.fingerprint !== fingerprint) problem(409, 'REQUEST_ID_CONFLICT', '同一 requestId 不能更换操作或正文。');
      if (!old.retryable) return {status: old.status, body: {...(old.status < 400 ? view(seat) : {revision: state.revision}), ...json(old.result), duplicate: true}};
    }
    let result, status = 200, retryable = false;
    try { result = await fn(); }
    catch (error) {
      if (!error.status) throw error;
      status = error.status; result = errorBody(error); retryable = !!error.retryable;
    }
    receipts.set(key, {fingerprint, status, result: json(result || {}), retryable});
    while (receipts.size > receiptLimit) receipts.delete(receipts.keys().next().value);
    return {status, body: {...(status < 400 ? view(seat) : {revision: state.revision}), ...result, duplicate: false}};
  }
  function addSeat(role, name, actorIds = []) {
    const seat = {id: randomUUID(), role, name: String(name || (role === 'host' ? '主持' : role === 'manager' ? '本机管理' : '玩家')).slice(0, 80), lastSeen: now()};
    const seatToken = token(); seats.set(seat.id, seat); tokens.set(createHash('sha256').update(seatToken).digest('hex'), seat.id);
    for (const actorId of actorIds) owners.set(actorId, seat.id);
    return {seat, seatToken};
  }
  function actorList(ids) {
    if (!Array.isArray(ids) || new Set(ids).size !== ids.length || ids.some(id => !state.actors.some(a => a.id === id && a.side === 'party'))) problem(400, 'ACTORS_INVALID', '只能分配本局存在且不重复的队伍角色。');
    return ids;
  }
  async function invalidatePending(message) {
    for (const p of pending.values()) if (['pending', 'ready'].includes(p.status)) {
      p.status = 'stale'; p.error = message;
      await requestBridge(p).recordReceipt(p.requestId, {ok: false, requestId: p.requestId, status: 'stale', error: {code: 'STALE_REVISION', message}}).catch(() => {});
    }
  }
  function catalog(seat, projected) {
    const source = projected.legalActions || projected.actions || [];
    if (!Array.isArray(source)) return [];
    return source.flatMap(entry => {
      try {
        const raw = entry.action || entry.command || entry;
        const clean = Object.fromEntries(['type', ...(ACTION_FIELDS[raw.type] || [])].filter(key => raw[key] !== undefined).map(key => [key, raw[key]]));
        return [{label: String(entry.label || raw.type).slice(0, 180), action: authorize(seat, clean)}];
      } catch { return []; }
    }).slice(0, 500);
  }
  async function createRequest(seat, body) {
    requireRevision(body);
    const active = [...pending.values()].find(p => p.seatId === seat.id && ['pending', 'ready'].includes(p.status));
    if (active) problem(409, 'AGENT_BUSY', '本席已有待办；请采用、取消或等待超时。');
    const requestId = randomUUID(), projected = view(seat).state;
    const snapshot = {protocolVersion: PROTOCOL_VERSION, requestId, revision: state.revision, seat: seatView(seat), state: projected,
      actions: catalog(seat, projected), createdAt: new Date(now()).toISOString(), expiresAt: new Date(now() + agentTimeoutMs).toISOString(),
      responseSchema: {protocolVersion: 1, requestId, revision: state.revision, actionIndex: 'integer or null', narration: 'optional text, max 4000 characters'}};
    const folder = folderPlayers.get(seat.id), storage = folder?.bridge || bridge;
    await storage.publish(snapshot);
    if (folder) {
      await atomicJson(path.join(folder.root, 'snapshot.json'), {...snapshot, automatic:true, active:true, replyFile:`inbox/${requestId}.json`, receiptFile:`receipts/${requestId}.json`});
      folder.requestId = requestId;
    }
    pending.set(requestId, {requestId, seatId: seat.id, revision: state.revision, status: 'pending', expiresAt: snapshot.expiresAt, snapshot});
    emit('agent-request', seat.id);
    return {snapshot};
  }
  async function submitProposal(input, seat = null) {
    let proposal;
    try { proposal = parseProposal(input); } catch (error) { problem(400, 'PROPOSAL_INVALID', error.message); }
    const p = pending.get(proposal.requestId);
    if (!p) problem(404, 'REQUEST_UNKNOWN', '此请求不存在；服务重启后须创建新快照。');
    if (seat && seat.id !== p.seatId && seat.role !== 'host') problem(403, 'REQUEST_FORBIDDEN', '不能提交其他席位的回复。');
    const fingerprint = hash(proposal);
    if (p.proposalHash) {
      if (p.proposalHash !== fingerprint) problem(409, 'REQUEST_ID_CONFLICT', '此请求已收到不同回复。');
      return {ok: true, requestId: p.requestId, status: p.status, duplicate: true};
    }
    if (p.revision !== state.revision || proposal.revision !== p.revision || p.status === 'stale') problem(409, 'STALE_REVISION', '快照已过期，请按最新局面重试。');
    if (now() >= Date.parse(p.expiresAt)) { p.status = 'expired'; problem(408, 'AGENT_TIMEOUT', '请求已超时；可创建新快照。'); }
    if (p.status !== 'pending') problem(409, 'REQUEST_CLOSED', '请求已经关闭。');
    if (proposal.actionIndex !== null && !p.snapshot.actions[proposal.actionIndex]) problem(400, 'ACTION_INDEX_INVALID', '行动索引不在本请求允许列表中。');
    // Re-authorize even before preview, and once again when applying.
    if (proposal.actionIndex !== null) authorize(seats.get(p.seatId), p.snapshot.actions[proposal.actionIndex].action);
    p.proposal = proposal; p.proposalHash = fingerprint; p.status = 'ready';
    emit('agent-ready', p.seatId);
    return {ok: true, requestId: p.requestId, status: 'ready'};
  }
  const bridge = new FolderBridge(path.join(dataRoot, 'agent'), proposal => serial(async () => {
    try { return await submitProposal(proposal); } catch (error) { return {...errorBody(error), requestId: proposal.requestId, status: 'rejected'}; }
  }), {now, timeoutMs: agentTimeoutMs});
  await bridge.initialize();
  const requestBridge = p => folderPlayers.get(p.seatId)?.bridge || bridge;
  async function applyReady(p) {
    if (p.revision !== state.revision) problem(409, 'STALE_REVISION', '快照已过期。');
    if (now() >= Date.parse(p.expiresAt)) { p.status = 'expired'; problem(408, 'AGENT_TIMEOUT', '请求已超时。'); }
    if (p.status !== 'ready') problem(409, 'REQUEST_NOT_READY', '没有可执行的回复。');
    const target = seats.get(p.seatId);
    if (!target) problem(404, 'SEAT_UNKNOWN', '玩家席位已关闭。');
    if (p.proposal.actionIndex !== null) {
      const action = p.snapshot.actions[p.proposal.actionIndex].action;
      const next = dispatch(target, action, p.requestId);
      if (TEAM_ACTIONS.has(action.type)) next.lastTeamAction = {type:action.type,seatId:target.id,name:target.name,revision:next.revision};
      await persistNext(next, action);
      state = next;
    }
    p.status = 'applied';
    await invalidatePending('局面已变化，请创建新快照。');
    await requestBridge(p).recordReceipt(p.requestId, {ok:true,requestId:p.requestId,status:'applied',revision:state.revision}).catch(() => {});
    if (p.proposal.actionIndex !== null) emit('action');
    emit('agent-applied', p.seatId);
    return {ok:true,requestId:p.requestId,status:'applied',applied:true,agentRequestId:p.requestId,revision:state.revision,narration:p.proposal.narration};
  }
  async function createFolderPlayer(manager, body) {
    hostOnly(manager); requireRevision(body);
    if (state.tableMode !== 'cooperative') problem(409, 'MODE_MISMATCH', '文件夹玩家用于默认合作模式。');
    const ids = actorList([body.actorId]);
    if (seats.size >= 16) problem(409, 'SEAT_LIMIT', '最多 16 个席位。');
    if ([...folderPlayers.values()].some(p => seatView(p.seat).actorIds.includes(body.actorId))) problem(409, 'FOLDER_PLAYER_EXISTS', '这个角色已有文件夹玩家。');
    const returnSeatId = owners.get(body.actorId), created = addSeat('player',body.name || `文件夹玩家 · ${state.actors.find(a=>a.id===body.actorId).name}`,ids);
    const root = path.join(dataRoot,'players',created.seat.id);
    const folder = {seat:created.seat,root,returnSeatId,requestId:null,bridge:null};
    folder.bridge = new FolderBridge(root, proposal => serial(async () => {
      try {
        const p = pending.get(proposal.requestId);
        if (!folderPlayers.has(created.seat.id) || p?.seatId !== created.seat.id) problem(403,'REQUEST_FORBIDDEN','回复不属于此文件夹玩家。');
        const result = await submitProposal(proposal,created.seat);
        created.seat.lastSeen = now();
        return result.status === 'ready' ? await applyReady(p) : result;
      } catch (error) { return {...errorBody(error),requestId:proposal.requestId,status:'rejected'}; }
    }), {now,timeoutMs:agentTimeoutMs});
    await folder.bridge.initialize();
    folderPlayers.set(created.seat.id,folder);
    await invalidatePending('角色归属已变化，请创建新快照。');
    await createRequest(created.seat,{revision:state.revision});
    emit('seats-changed');
    return {createdSeat:seatView(created.seat),folderPath:root,automatic:true};
  }
  async function stopFolderPlayer(manager,body) {
    hostOnly(manager); requireRevision(body);
    const folder = folderPlayers.get(body.seatId);
    if (!folder) problem(404,'FOLDER_PLAYER_UNKNOWN','文件夹玩家不存在或已停用。');
    const target = seats.get(folder.returnSeatId) || [...seats.values()].find(s=>s.role==='player'&&s.id!==folder.seat.id&&!folderPlayers.has(s.id));
    for (const [actorId,owner] of owners) if (owner===folder.seat.id) {if(target)owners.set(actorId,target.id);else owners.delete(actorId);}
    for (const p of pending.values()) if (p.seatId===folder.seat.id&&['pending','ready'].includes(p.status)) {p.status='cancelled';await folder.bridge.recordReceipt(p.requestId,{ok:true,requestId:p.requestId,status:'cancelled'});}
    await atomicJson(path.join(folder.root,'snapshot.json'),{protocolVersion:PROTOCOL_VERSION,active:false,seat:seatView(folder.seat),revision:state.revision,stoppedAt:new Date(now()).toISOString(),actions:[]});
    folderPlayers.delete(folder.seat.id);seats.delete(folder.seat.id);
    for (const [digest,id] of tokens) if(id===folder.seat.id)tokens.delete(digest);
    await invalidatePending('角色归属已变化，请创建新快照。');emit('seats-changed');
    return {stopped:true,seatId:folder.seat.id,returnedTo:target?.id||null};
  }
  async function refreshFolderPlayers() {
    for (const folder of folderPlayers.values()) {
      const p = pending.get(folder.requestId);
      if (!p || p.revision!==state.revision || ['stale','expired','cancelled'].includes(p.status)) await createRequest(folder.seat,{revision:state.revision});
    }
  }
  async function expireRequests() {
    for (const p of pending.values()) if (['pending', 'ready'].includes(p.status) && now() >= Date.parse(p.expiresAt)) {
      p.status = 'expired'; p.error = '请求超时；可创建新快照。';
      await requestBridge(p).recordReceipt(p.requestId, {ok: false, requestId: p.requestId, status: 'expired', error: {code: 'AGENT_TIMEOUT', message: p.error}}).catch(() => {});
      emit('agent-expired', p.seatId);
    }
    while (pending.size > 200) { const id = [...pending].find(([, p]) => !['pending', 'ready'].includes(p.status))?.[0]; if (!id) break; pending.delete(id); }
  }
  async function post(req, url) {
    const body = await bodyOf(req);
    if (url.pathname === '/api/start') {
      if (!/^[A-Za-z0-9_-]{32,96}$/.test(body.requestId || '')) problem(400, 'REQUEST_ID_INVALID', '初始化需要至少32位随机请求标识。');
      const fingerprint = hash(body);
      if (bootstrapReceipt?.requestId === body.requestId) {
        if (bootstrapReceipt.fingerprint !== fingerprint) problem(409, 'REQUEST_ID_CONFLICT', '初始化标识已用于不同请求。');
        return {status: 200, body: {...view(bootstrapReceipt.player), seatToken: bootstrapReceipt.seatToken,
          managementSeat: seatView(bootstrapReceipt.manager), managementToken: bootstrapReceipt.managementToken, duplicate: true}};
      }
      if (initialized) problem(409, 'TABLE_EXISTS', '牌桌已经初始化；请恢复现有席位令牌。');
      if (mode !== 'cooperative') problem(409, 'MODE_MISMATCH', '此入口为主持模式，请使用显式主持初始化。');
      const player = addSeat('player', body.name, state.actors.filter(a => a.side === 'party').map(a => a.id));
      const manager = addSeat('manager', '本机牌桌管理');
      initialized = true;
      bootstrapReceipt = {requestId: body.requestId, fingerprint, player: player.seat, seatToken: player.seatToken, manager: manager.seat, managementToken: manager.seatToken};
      emit('table-created');
      return {status: 201, body: {...view(player.seat), seatToken: player.seatToken, managementSeat: seatView(manager.seat), managementToken: manager.seatToken}};
    }
    if (url.pathname === '/api/host') {
      if (initialized) problem(409, 'HOST_EXISTS', '牌桌已经初始化；合作玩家不能升级为主持。');
      // Explicit legacy/optional hosted bootstrap. Never switches an initialized table.
      state.tableMode = 'hosted';
      const created = addSeat('host', body.name, state.actors.filter(a => a.side === 'party').map(a => a.id));
      initialized = true; hostSeat = created.seat; emit('host-created');
      return {status: 201, body: {...view(hostSeat), seatToken: created.seatToken}};
    }
    const seat = auth(req);
    if (url.pathname === '/api/hub/chat') return {status: 200, body: chat.send(chatRoomId, {...seat, agent: folderPlayers.has(seat.id)}, body)};
    if (url.pathname === '/api/agent/submit') return {status: 200, body: {...view(seat), ...(await submitProposal(body, seat))}};
    return once(seat, body, url.pathname, async () => {
      if (url.pathname === '/api/folder-player') return createFolderPlayer(seat,body);
      if (url.pathname === '/api/folder-player/stop') return stopFolderPlayer(seat,body);
      if (url.pathname === '/api/seats') {
        hostOnly(seat); const ids = actorList(body.actorIds || []);
        if (seats.size >= 16) problem(409, 'SEAT_LIMIT', '最多 16 个席位。');
        const created = addSeat('player', body.name, ids);
        await invalidatePending('角色归属已变化，请创建新快照。'); emit('seats-changed');
        return {createdSeat: seatView(created.seat), seatToken: created.seatToken};
      }
      if (url.pathname === '/api/claim') {
        hostOnly(seat); const target = seats.get(body.seatId); if (!target) problem(404, 'SEAT_UNKNOWN', '席位不存在。');
        if (target.role === 'manager') problem(403, 'MANAGER_NO_ACTORS', '管理席不持有角色，请切回玩家席。');
        const ids = actorList(body.actorIds);
        for (const [id, owner] of owners) if (owner === target.id) owners.delete(id);
        for (const id of ids) owners.set(id, target.id);
        await invalidatePending('角色归属已变化，请创建新快照。'); emit('seats-changed'); return {assigned: true};
      }
      if (url.pathname === '/api/takeover') {
        requireRevision(body);
        if (state.tableMode !== 'cooperative' || seat.role !== 'player' || !hasParty(seat)) problem(403, 'TAKEOVER_FORBIDDEN', '只有合作模式中拥有角色的玩家可接管离线队友。');
        if (!safeName(body.actorId)) problem(400, 'ACTORS_INVALID', '角色标识无效。');
        const previous = seats.get(owners.get(body.actorId));
        if (!state.actors.some(a => a.id === body.actorId && a.side === 'party') || !previous || previous.role !== 'player' || previous.id === seat.id) problem(403, 'TAKEOVER_FORBIDDEN', '只能接管其他玩家的队伍角色。');
        if (now() - previous.lastSeen < presenceTimeoutMs) problem(409, 'OWNER_ONLINE', '该角色的玩家仍在线，请等待其离线90秒或由管理席重新分配。');
        const next = json(state); next.revision = state.revision + 1;
        next.lastHandover = {actorId: body.actorId, from: previous.id, to: seat.id, revision: next.revision};
        await persistNext(next, {type: 'seat.takeover'});
        state = next; owners.set(body.actorId, seat.id);
        await invalidatePending('角色已被接管，请刷新行动。'); emit('seats-changed');
        return {takenOver: body.actorId};
      }
      if (url.pathname === '/api/action') { requireRevision(body); return commit(seat, body.action, body.requestId); }
      if (url.pathname === '/api/map') {
        hostOnly(seat); requireRevision(body);
        if (!safeName(body.mapId)) problem(400, 'MAP_ID_INVALID', '地图 ID 无效。');
        return commit(seat, {type: 'map.replace', mapId: body.mapId, map: body.map}, body.requestId);
      }
      if (url.pathname === '/api/map/load') {
        hostOnly(seat); requireRevision(body);
        if (!safeName(body.mapId)) problem(400, 'MAP_ID_INVALID', '地图 ID 无效。');
        const map = await readEnvelope(path.join(dataRoot, 'maps', `${body.mapId}.json`), 'map'); checkMap(map);
        return commit(seat, {type: 'map.replace', mapId: body.mapId, map}, body.requestId);
      }
      if (url.pathname === '/api/save') {
        hostOnly(seat); requireRevision(body); if (!safeName(body.slot)) problem(400, 'SLOT_INVALID', '存档槽名称无效。');
        if (body.slot.toLowerCase() === 'autosave') problem(400, 'SLOT_RESERVED', 'autosave 是系统自动档；手动保存请选择其他槽位。');
        await atomicJson(path.join(dataRoot, 'saves', `${body.slot}.json`), envelope('state', state));
        emit('saved'); return {saved: body.slot};
      }
      if (url.pathname === '/api/restore') {
        hostOnly(seat); requireRevision(body); if (!safeName(body.slot)) problem(400, 'SLOT_INVALID', '存档槽名称无效。');
        const restored = validateState(await readEnvelope(path.join(dataRoot, 'saves', `${body.slot}.json`), 'state'));
        restored.tableMode = state.tableMode; // Save files cannot elevate current table policy.
        for (const map of Object.values(restored.maps || {})) checkMap(map);
        // Ask the projection boundary to reject incompatible state before commit.
        try { json(engine.publicState(json(restored), seatView(seat))); } catch { problem(422, 'STATE_INVALID', '引擎不能读取该存档。'); }
        // Restoring a manual slot must not overwrite an existing recovery autosave.
        // The next accepted gameplay action creates the next durable autosave.
        restored.revision = state.revision + 1; state = restored;
        for (const id of owners.keys()) if (!state.actors.some(a => a.id === id && a.side === 'party')) owners.delete(id);
        await invalidatePending('已恢复存档，请创建新快照。'); emit('restored'); return {restored: body.slot};
      }
      if (url.pathname === '/api/agent/request') return createRequest(seat, body);
      if (url.pathname === '/api/agent/cancel') {
        const p = pending.get(body.agentRequestId);
        if (!p) problem(404, 'REQUEST_UNKNOWN', '请求不存在。');
        if (p.seatId !== seat.id) hostOnly(seat);
        if (p.status === 'applied') problem(409, 'REQUEST_CLOSED', '已采用的行动不能撤销。');
        p.status = 'cancelled'; delete p.proposal;
        await requestBridge(p).recordReceipt(p.requestId, {ok: true, requestId: p.requestId, status: 'cancelled'}).catch(() => {});
        emit('agent-cancelled', p.seatId); return {cancelled: p.requestId};
      }
      if (url.pathname === '/api/agent/apply') {
        const p = pending.get(body.agentRequestId);
        if (!p) problem(404, 'REQUEST_UNKNOWN', '请求不存在。');
        if (p.seatId !== seat.id) hostOnly(seat);
        requireRevision(body);
        return applyReady(p);
      }
      problem(404, 'NOT_FOUND', '接口不存在。');
    });
  }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const requestHost = new URL(`http://${req.headers.host || ''}`);
      if (!['localhost', '127.0.0.1', '[::1]'].includes(requestHost.hostname) || req.headers['x-forwarded-for'] || req.headers['forwarded']) problem(403, 'LOCAL_ONLY', '本服务只接受 localhost 请求。');
      if (req.headers.origin) {
        let origin; try { origin = new URL(req.headers.origin); } catch { problem(403, 'ORIGIN_FORBIDDEN', '来源无效。'); }
        if (origin.origin !== requestHost.origin) problem(403, 'ORIGIN_FORBIDDEN', '只允许同源请求。');
      }
      if (req.method === 'POST') {
        const result = await serial(() => post(req, url)); return send(res, result.status, result.body);
      }
      if (req.method !== 'GET') problem(405, 'METHOD_NOT_ALLOWED', '只允许 GET 或 POST。');
      if (url.pathname === '/api/health') return send(res, 200, {ok: true, protocolVersion: 1, localOnly: true, tableMode: state.tableMode, initialized, hostCreated: initialized});
      if (url.pathname.startsWith('/api/')) {
        const seat = auth(req);
        if (url.pathname === '/api/hub/chat') return send(res, 200, chat.read(chatRoomId, {...seat, agent: folderPlayers.has(seat.id)}, {cursor: url.searchParams.get('cursor') ?? url.searchParams.get('after'), limit: url.searchParams.get('limit')}));
        if (url.pathname === '/api/presence') return send(res, 200, presence());
        if (url.pathname === '/api/state') return send(res, 200, view(seat));
        if (url.pathname === '/api/saves') {
          hostOnly(seat);
          const names = await fs.readdir(path.join(dataRoot, 'saves'));
          const slots = names.filter(n => /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.json$/.test(n)).map(n => n.slice(0, -5)).sort();
          const metadata = await Promise.all(slots.map(async slot => {
            const entry = {slot, kind: slot.toLowerCase() === 'autosave' ? 'autosave' : 'manual'};
            try {
              const file = path.join(dataRoot, 'saves', `${slot}.json`), stat = await fs.lstat(file);
              const saved = validateState(await readEnvelope(file, 'state'));
              for (const map of Object.values(saved.maps || {})) checkMap(map);
              try { json(engine.publicState(json(saved), seatView(seat))); } catch { problem(422, 'STATE_INVALID', '引擎不能读取该存档。'); }
              return {...entry, available: true, revision: saved.revision, savedAt: stat.mtime.toISOString(), bytes: stat.size};
            } catch (error) { return {...entry, available: false, error: {code: error.code || 'FILE_UNAVAILABLE', message: error.status ? error.message : '无法读取本版存档。'}}; }
          }));
          return send(res, 200, {ok: true, slots, metadata, availableSlots: metadata.filter(entry => entry.available).map(entry => entry.slot)});
        }
        if (url.pathname === '/api/agent/request') return send(res, 200, {...view(seat), snapshots: [...pending.values()].filter(p => p.seatId === seat.id || seat.role === 'host').map(p => ({...p.snapshot, status: p.status}))});
        if (['/api/updates', '/api/events'].includes(url.pathname)) {
          const since = Number(url.searchParams.get('since') ?? req.headers['last-event-id'] ?? 0);
          if (!Number.isSafeInteger(since) || since < 0) problem(400, 'CURSOR_INVALID', '事件游标无效。');
          const reset = since > seq || (events.length > 0 && since < events[0].seq - 1);
          const visible = events.filter(e => (reset || e.seq > since) && (!e.seatId || e.seatId === seat.id || seat.role === 'host'));
          if (url.pathname === '/api/updates') return send(res, 200, {...view(seat), reset, events: visible});
          res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'});
          res.write(`id: ${seq}\nevent: state\ndata: ${JSON.stringify({...view(seat), reset, events: visible})}\n\n`);
          const client = {seat, res}; streams.add(client); req.on('close', () => streams.delete(client)); res.on('error', () => streams.delete(client)); return;
        }
        problem(404, 'NOT_FOUND', '接口不存在。');
      }
      const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
      const candidate = path.resolve(staticRoot, `.${relative}`);
      if (candidate !== staticRoot && !candidate.startsWith(staticRoot + path.sep)) problem(403, 'PATH_FORBIDDEN', '禁止访问此路径。');
      let real;
      try { real = await fs.realpath(candidate); } catch { problem(404, 'NOT_FOUND', '文件不存在。'); }
      if (!real.startsWith(staticRoot + path.sep)) problem(403, 'PATH_FORBIDDEN', '禁止访问此路径。');
      const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.json': 'application/json; charset=utf-8'};
      if (!mime[path.extname(real)]) problem(403, 'PATH_FORBIDDEN', '不支持此静态文件类型。');
      const content = await fs.readFile(real);
      res.writeHead(200, {'Content-Type': mime[path.extname(real)], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache'}); res.end(content);
    } catch (error) {
      if (!res.headersSent) send(res, error.status || 500, {...errorBody(error), revision: state.revision});
      else res.end();
    }
  });
  const heartbeat = setInterval(() => { for (const client of streams) client.res.write(': heartbeat\n\n'); }, 15000); heartbeat.unref();
  const pumpBridges = async () => {await serial(async()=>{await expireRequests();await refreshFolderPlayers();});await bridge.pump();for(const folder of folderPlayers.values())await folder.bridge.pump();};
  const bridgeTimer = bridgeIntervalMs > 0 ? setInterval(() => { void pumpBridges().catch(() => {}); }, bridgeIntervalMs) : null;
  bridgeTimer?.unref();
  return {
    server, bridge, dataDir: dataRoot,
    async listen() {
      if (closed) throw Error('服务已关闭。');
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, () => { server.off('error', reject); resolve(); }); });
      const address = server.address(); return `http://${host === '::1' ? '[::1]' : host}:${address.port}`;
    },
    async tick() { return pumpBridges(); },
    async close() {
      if (closed) return; closed = true; clearInterval(heartbeat); if (bridgeTimer) clearInterval(bridgeTimer);
      for (const client of streams) client.res.end(); streams.clear();
      await queue; if (server.listening) await new Promise(resolve => { server.close(resolve); server.closeIdleConnections?.(); });
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const value = process.argv.find(arg => arg.startsWith('--port='));
  const mode = process.argv.includes('--mode=hosted') ? 'hosted' : 'cooperative';
  const port = value ? Number(value.slice(7)) : Number(process.env.PORT || (mode === 'hosted' ? 18847 : 18846));
  const app = await createGameServer({port, mode, host:process.env.HOST || '127.0.0.1'});
  const url = await app.listen();
  console.log(`荆冠与归潮 v1 ${mode === 'hosted' ? '可选真人主持' : '默认合作玩家'}：${url}\n默认由系统推进故事与敌方行动。`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await app.close(); process.exit(0); });
}
