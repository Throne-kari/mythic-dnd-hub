import './hub-environment.mjs';
import {networkInfo} from './network.mjs';
import {mapWorkspace,mapMutation,mapSvg,publicMap} from './cartography.mjs';
import {ferry} from './content.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes, createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createGame, apply, reachable, actor, legalActions, log} from './engine.mjs';
import {makeRoomRequest, callAI, parseRoomResult} from './ai.mjs';
import {handouts, publishHandout} from './handouts.mjs';
import {rawStatBlocks} from './bestiary.mjs';
import {RoomStore, validateState, projectState, authorizeCommand, requireDm, requireOwner, isDm, isOwner, problem} from './rooms.mjs';

const root = path.dirname(fileURLToPath(import.meta.url)), pub = path.join(root, 'public'), data = path.join(root, 'data');
// Independent opt-in configuration. Never reads the original game .env.
const envFile = path.join(root, '.env.v03');
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) { const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim()); if (m && m[1].startsWith('FENGSHEN_V03_') && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, ''); }
const port = Number(process.env.FENGSHEN_V03_PORT || 8811), host = process.env.FENGSHEN_V03_HOST || '127.0.0.1';
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('PORT must be 1024–65535');
if (![...['127.0.0.1','localhost','::1'],...(process.argv.includes('--lan')?['0.0.0.0']:[])].includes(host) || port === 8787) throw Error('v0.3默认仅本机；局域网须使用专用启动入口，且不使用原版8787。');
const base = `http://127.0.0.1:${port}`;
const campaign = JSON.parse(fs.readFileSync(path.join(data, 'campaign.json'), 'utf8'));
const mapCatalog={FERRY:ferry,...campaign.scenes};
const directory = path.resolve(process.env.FENGSHEN_V03_ROOMS_DIR || path.join(data, 'rooms-v03'));
const store = new RoomStore(directory, campaign, {model: process.env.FENGSHEN_V03_AI_MODEL, baseUrl: process.env.FENGSHEN_V03_AI_BASE_URL, protocol: process.env.FENGSHEN_V03_AI_PROTOCOL});
const requests = new Map();
const uid = () => randomBytes(18).toString('base64url');
const hash = value => createHash('sha256').update(value).digest('hex');
const processToken = uid();
const local = req => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !req.headers['x-forwarded-for'] && ['127.0.0.1', 'localhost', '[::1]'].includes(new URL('http://' + req.headers.host).hostname);
const send = (res, status, value) => { res.writeHead(status, {'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}); res.end(JSON.stringify(value)); };
async function readBody(req) { let size = 0; const chunks = []; for await (const chunk of req) { size += chunk.length; if (size > 3 * 1024 * 1024) throw problem('请求超过 3 MB。', 413); chunks.push(chunk); } try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw problem('请求不是有效 JSON。'); } }
function auth(req, url) { return url.pathname === '/api/events' && url.searchParams.has('session') ? store.eventAuth(url.searchParams.get('session')) : store.auth(req.headers['x-seat-token'] || req.headers['x-game-token'] || req.headers.authorization?.replace(/^Bearer /i, ''), req.headers['x-room-id']); }
function response(room, seat, extra = {}) { return {...store.view(room, room.seats.find(s => s.id === seat.id) || seat), ...extra}; }
function mutate(room, seat, body, type, fn, options) { const r = store.transact(room, seat, body, type, fn, options); return response(r.room, seat, {duplicate: r.duplicate, ...(r.result || {})}); }
function slotPath(room, slot) { if (![1, 2, 3].includes(Number(slot))) throw problem('只有三个手动存档槽。'); const dir = path.join(directory, room.id); fs.mkdirSync(dir, {recursive: true, mode: 0o700}); return path.join(dir, `slot-${Number(slot)}.json`); }
function atomic(file, value) { fs.writeFileSync(file + '.tmp', JSON.stringify(value), {encoding: 'utf8', mode: 0o600}); fs.renameSync(file + '.tmp', file); }
function refresh(room) { store.persist(room); store.publish(room); }
function aiSeat(room, seat, body) {
  const target = body.seatId ? room.seats.find(s => s.id === body.seatId && !s.disabled) : seat;
  if (!target || (target.id !== seat.id && !isDm(room, seat) && !isOwner(room, seat))) throw problem('不能替这个席位发起 AI 行动。', 403);
  return {...target, role: room.dmSeatId === target.id || room.ownerId === target.id ? 'dm' : 'player', actors: Object.keys(room.owners).filter(id => room.owners[id] === target.id)};
}
function buildRequest(room, seat, body, id) {
  const target = aiSeat(room, seat, body);
  if (target.role === 'player' && body.actor && !target.actors.includes(body.actor)) throw problem('AI 只能操作其席位拥有的角色。', 403);
  return {seat: target, request: makeRoomRequest(room.state, campaign, target, {roomId: room.id, seq: room.seq, requestId: id, prompt: String(body.text || '').slice(0, 5000), actor: body.actor, view: projectState(room, target, campaign), dmSource: target.role === 'dm' ? campaign.chapters[room.state.chapter - 1].text : undefined, handouts: target.role === 'dm' ? handouts.filter(h=>h.act===Math.ceil(room.state.chapter/2)) : [], events: store.updates(room, target, Math.max(0, room.seq - 12)).events})};
}
function applyAi(room, seat, body) {
  return mutate(room, seat, body, 'ai-applied', (r, s) => {
    const pending = r.pending;
    if (!pending || pending.id !== body.id || !pending.result) throw problem('没有这条待采用的 AI 回复。');
    if (pending.seatId !== s.id && !isDm(r, s) && !isOwner(r, s)) throw problem('不能采用别的席位的 AI 回复。', 403);
    if (pending.request.revision !== r.state.revision || pending.stale) throw problem('AI 思考期间局面已改变，请按当前局面重新请求。', 409, 'STALE_AI');
    const target = r.seats.find(v => v.id === pending.seatId && !v.disabled);
    if (!target) throw problem('AI 席位已离开。');
    if (target.kind !== 'human' && r.aiPaused) throw problem('房主已暂停 AI，请恢复后采用回复。', 403, 'AI_PAUSED');
    let command = pending.result.command || (pending.result.actionIndex != null ? pending.request.actions[pending.result.actionIndex] : null);
    if (command) { command = {...command}; delete command.label; delete command.index; command = authorizeCommand(r, target, command); if(command.type==='handout'){requireDm(r,target);publishHandout(r.state,command.option);}else apply(r.state, command, campaign); }
    if (pending.result.narration) log(r.state, 'ai', `${target.name}：${pending.result.narration}`);
    if (pending.result.reason) log(r.state, 'ai-note', pending.result.reason);
    r.pending = null;
    return {eventText: `${target.name}的 AI 回复已采用。`};
  });
}
async function generateAi(roomId, id, config) {
  const controller = new AbortController(); requests.set(roomId, controller);
  let room = store.rooms.get(roomId); room.aiBusy = true; refresh(room);
  try {
    const result = await callAI({...config, signal: controller.signal}, room.pending.request, {signal: controller.signal});
    room = store.rooms.get(roomId);
    if (!room.pending || room.pending.id !== id || controller.signal.aborted) return;
    room.pending.result = parseRoomResult(result, room.pending.request);
    room.pending.stale = room.pending.request.revision !== room.state.revision;
    store.record(room, 'ai-ready', 'AI 回复已到达。', room.pending.seatId);
    if (room.pending.automated && room.aiAutomation?.autoApply && room.aiAutomation.seatId === room.pending.seatId && !room.aiPaused && !room.pending.stale) {
      const command = room.pending.result.command, target = room.seats.find(s => s.id === room.pending.seatId);
      store.persist(room);
      applyAi(room, target, {id, revision: room.state.revision, commandId: 'auto:' + id});
      room = store.rooms.get(roomId);
      if (!command) room.aiAutomation.lastRevision = room.state.revision;
    }
  } catch (error) {
    room = store.rooms.get(roomId);
    if (room.pending?.id === id && !controller.signal.aborted) { room.pending.error = error.message; store.record(room, 'ai-error', error.message, room.pending.seatId, 'dm'); }
    if (room.aiAutomation) room.aiAutomation.enabled = false;
  } finally {
    room = store.rooms.get(roomId); if (requests.get(roomId) === controller) { room.aiBusy = false; requests.delete(roomId); } refresh(room);
  }
}
function scheduleAi(room) {
  const run = room.aiAutomation;
  if (!run?.enabled || room.aiPaused || room.aiBusy || room.pending || run.remaining <= 0 || Date.now() < (run.nextAt || 0) || run.lastRevision === room.state.revision) return;
  const seat = room.seats.find(s => s.id === run.seatId && !s.disabled);
  if (!seat || seat.kind !== 'api') { run.enabled = false; return; }
  const currentId = room.state.combat?.order[room.state.combat.index], currentActor = room.state.actors.find(a => a.id === currentId);
  const dm = room.dmSeatId === seat.id;
  if (currentId && (dm ? currentActor?.side === 'party' : room.owners[currentId] !== seat.id)) return;
  if (!dm && !currentId) return;
  const id = uid();
  try {
    const built = buildRequest(room, seat, {actor: currentId, text: dm ? '继续主持当前局面，回应公开记录与玩家提议；只执行 NPC 和主持职责。需要玩家作决定时只叙事，等待玩家。' : '根据真实局面选择本角色下一步合法行动。'}, id);
    room.pending = {id, seatId: seat.id, requestedBy: room.ownerId, request: built.request, result: null, stale: false, automated: true, mode:'api'};
    run.lastRevision = room.state.revision; run.remaining--; run.nextAt = Date.now() + 1500;
    if (!run.remaining) run.enabled = false;
    store.record(room, 'ai-requested', `${seat.name}正在处理当前局面。`, seat.id, dm ? 'dm' : 'all');
    store.persist(room); void generateAi(room.id, id, {...room.config});
  } catch (error) { run.enabled = false; store.record(room, 'ai-error', error.message, seat.id, 'dm'); refresh(room); }
}

const mime = {'.wav':'audio/wav','.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon'};
const server = http.createServer(async (req, res) => {
  let context;
  try {
    const url = new URL(req.url, 'http://localhost');
    if (req.headers.origin) {
      const origin = new URL(req.headers.origin), publicOrigin = new URL(base).origin;
      if (origin.host !== req.headers.host && origin.origin !== publicOrigin) throw problem('来源不允许。', 403);
    }
    if (req.method === 'GET' && url.pathname === '/api/health') { send(res, 200, {ok: true, multiplayer: true, version: 2, edition: 'worldly-v03', port}); return; }
    if (req.method === 'POST' && url.pathname === '/api/stop' && local(req) && req.headers['x-process-token'] === processToken) { send(res, 200, {message: '所有房间已保存，服务即将停止。'}); setTimeout(shutdown, 100); return; }
    if (req.method === 'GET' && url.pathname === '/api/bootstrap' && !(req.headers['x-seat-token'] || req.headers['x-game-token'])) { send(res, 200, {multiplayer: true, version: 2,campaignId:campaign.id,title:campaign.title,subtitle:campaign.subtitle}); return; }
    if (req.method === 'POST' && ['/api/rooms', '/api/join'].includes(url.pathname)) {
      const b = await readBody(req), result = url.pathname === '/api/rooms' ? store.create(b) : store.join(b);
      send(res, 200, response(result.room, result.seat, {token: result.token, roomId: result.room.id, seatId: result.seat.id})); return;
    }
    if (url.pathname.startsWith('/api/')) {
      context = auth(req, url); let {room, seat} = context;
      if (req.method === 'GET') {
        if(url.pathname === '/api/network'){requireOwner(room,seat);send(res,200,networkInfo(port,host));return;}
        if(url.pathname==='/api/maps'){requireDm(room,seat);const w=mapWorkspace(room.state,mapCatalog,url.searchParams.get('scene')||room.state.scene);if(url.searchParams.has('original'))w.originalMap=mapCatalog[w.scene];send(res,200,w);return;}
        if(url.pathname==='/api/maps/export'){requireDm(room,seat);const w=mapWorkspace(room.state,mapCatalog,url.searchParams.get('scene')||room.state.scene),gm=url.searchParams.get('role')==='gm';if(url.searchParams.get('format')==='svg'){res.writeHead(200,{'Content-Type':'image/svg+xml; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'"});res.end(mapSvg(w.map,{gm}));}else send(res,200,gm?w.map:publicMap(w.map));return;}
        if (url.pathname === '/api/state' || url.pathname === '/api/bootstrap') { send(res, 200, response(room, seat)); return; }
        if (url.pathname === '/api/updates') { send(res, 200, store.updates(room, seat, Number(url.searchParams.get('since')) || 0)); return; }
        if (url.pathname === '/api/bridge/request') { const p = room.pending; if (p && p.seatId !== seat.id && !isDm(room, seat) && !isOwner(room, seat)) throw problem('没有分配给本席位的 AI 请求。', 403); send(res, 200, {request: p ? {id: p.id, ...p.request} : null, stale: !!p && p.request.revision !== room.state.revision, eventSeq: room.seq}); return; }
        if (url.pathname === '/api/events') { res.writeHead(200, {'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no'}); store.subscribe(room, seat, res, Number(url.searchParams.get('since') || req.headers['last-event-id']) || 0); return; }
        if (url.pathname === '/api/reachable' || url.pathname === '/api/actions') {
          const id = url.searchParams.get('actor'); authorizeCommand(room, seat, {type: 'move', actor: id}); const a = actor(room.state, id);
          const visible = new Set(projectState(room, seat, campaign).actors.map(a => a.id));
          send(res, 200, url.pathname === '/api/actions' ? legalActions(room.state, campaign, id).filter(v => (!v.target || visible.has(v.target)) && (!v.targets || v.targets.every(t => visible.has(t)))) : reachable(room.state, campaign, a, room.state.combat ? a.move || 0 : a.speed).map(({path, ...n}) => n)); return;
        }
        if (url.pathname === '/api/chapter') { requireDm(room, seat); send(res, 200, campaign.chapters[Number(url.searchParams.get('id') || room.state.chapter) - 1] || {}); return; }
        if (url.pathname === '/api/handouts') { requireDm(room,seat); send(res,200,handouts);return; }
        if (url.pathname === '/api/statblock') { requireDm(room,seat);const block=rawStatBlocks.blocks[url.searchParams.get('type')];if(!block)throw problem('没有这张原始怪物卡。',404);send(res,200,{...block,source:rawStatBlocks.source,license:rawStatBlocks.license,attribution:rawStatBlocks.attribution});return; }
        if (url.pathname === '/api/save') { requireDm(room, seat); send(res, 200, room.state); return; }
        if (url.pathname === '/api/slots') { requireDm(room, seat); send(res, 200, [1, 2, 3].map(slot => { const file = slotPath(room, slot); return {slot, exists: fs.existsSync(file), saved: fs.existsSync(file) ? fs.statSync(file).mtime.toISOString() : null}; })); return; }
        throw problem('接口不存在。', 404);
      }
      if (req.method !== 'POST') throw problem('不支持的方法。', 405);
      const b = await readBody(req);
      // Body streaming can yield while another client commits. Always authorize and
      // compare revisions against the latest room, never the pre-body snapshot.
      context = auth(req, url); ({room, seat} = context);
      if(['/api/maps/save','/api/maps/publish'].includes(url.pathname)){requireDm(room,seat);const action=url.pathname.endsWith('/save')?'save':'publish';const value=mutate(room,seat,b,'map-'+action,r=>mapMutation(r.state,{...b,action},mapCatalog));send(res,200,{...value,cartography:mapWorkspace(store.rooms.get(room.id).state,mapCatalog,b.scene)});return;}
      if (url.pathname === '/api/command') { const r = store.command(room, seat, b); send(res, 200, response(r.room, seat, {duplicate: r.duplicate})); return; }
      if (url.pathname === '/api/seat') {
        send(res, 200, mutate(room, seat, b, 'seat-assigned', (r, s) => {
          const target = b.seatId ? r.seats.find(v => v.id === b.seatId && !v.disabled) : s;
          if (!target) throw problem('席位不存在。'); if (target.id !== s.id) requireDm(r, s);
          const a = actor(r.state, b.actor); if (a.side !== 'party') throw problem('这里只能分配队伍角色。');
          if (r.owners[a.id] && r.owners[a.id] !== s.id && !isDm(r, s) && !isOwner(r, s)) throw problem('这个角色已由另一位朋友控制。', 409, 'CHARACTER_TAKEN');
          if (b.release) { if (r.owners[a.id] !== s.id) requireDm(r, s); delete r.owners[a.id]; a.controller = 'human'; }
          else { r.owners[a.id] = target.id; a.controller = target.kind === 'api' ? 'api' : 'human'; }
          return {eventText: b.release ? `${a.name}的席位已释放。` : `${target.name}将控制${a.name}。`};
        }, {history: false})); return;
      }
      if (url.pathname === '/api/seats') {
        requireOwner(room, seat); let createdToken;
        const value = mutate(room, seat, b, 'seat-created', r => {
          const id = uid(); createdToken = uid();
          const next = {id, name: String(b.name || 'AI 同行').slice(0, 40), kind: ['human', 'workspace', 'api'].includes(b.kind) ? b.kind : 'workspace', role: b.role === 'dm' ? 'dm' : 'player', tokenHash: hash(createdToken), online: false};
          r.seats.push(next); if (b.role === 'dm') r.dmSeatId = id;
          for (const id of b.actors || []) { if (actor(r.state, id).side !== 'party') throw problem('AI 玩家只能领取队伍角色。'); r.owners[id] = next.id; }
          return {receipt: {createdSeatId: id}, eventText: `${next.name}的席位已准备。`};
        }, {history: false});
        if (createdToken) value.createdSeatToken = createdToken;
        send(res, 200, value); return;
      }
      if (url.pathname === '/api/room') {
        requireOwner(room, seat);
        send(res, 200, mutate(room, seat, b, 'room-updated', r => {
          if (typeof b.rename === 'string') r.name = b.rename.trim().slice(0, 60) || r.name;
          if (typeof b.autoNpc === 'boolean') r.autoNpc = b.autoNpc;
          if (b.rotateInvite) r.invite = uid();
          if (b.dmSeatId) { if (!r.seats.some(s => s.id === b.dmSeatId && !s.disabled)) throw problem('主持席位不存在。'); r.dmSeatId = b.dmSeatId; r.aiPaused = true; }
          if (b.removeSeatId) { if (b.removeSeatId === r.ownerId) throw problem('不能移除房主席位。'); const target = r.seats.find(s => s.id === b.removeSeatId); if (!target) throw problem('席位不存在。'); target.disabled = true; for (const [id, owner] of Object.entries(r.owners)) if (owner === target.id) delete r.owners[id]; if (r.dmSeatId === target.id) r.dmSeatId = r.ownerId; }
        }, {history: false})); return;
      }
      if (url.pathname === '/api/config') {
        requireOwner(room, seat);
        send(res, 200, mutate(room, seat, b, 'config-updated', r => {
          if (b.baseUrl) { const u = new URL(b.baseUrl); if (u.username || u.password || u.search || u.hash || !['https:', 'http:'].includes(u.protocol)) throw problem('服务地址须为无凭据和参数的 HTTP(S) 地址。'); r.config.baseUrl = b.baseUrl.replace(/\/$/, ''); }
          if (typeof b.model === 'string') r.config.model = b.model.slice(0, 150);
          if (['chat', 'responses'].includes(b.protocol)) r.config.protocol = b.protocol;
          if (typeof b.key === 'string' && b.key) r.config.key = b.key;
          if (b.clearKey) r.config.key = '';
          return {visibility: 'dm', eventText: '房主已更新 AI 服务配置。'};
        }, {history: false, bump: false})); return;
      }
      if (['/api/new', '/api/import', '/api/migrate-local', '/api/undo', '/api/slot'].includes(url.pathname)) {
        requireDm(room, seat);
        if (url.pathname === '/api/migrate-local') throw problem('v0.3 不读取旧存档路径；如需迁入，请由主持明确选择导出文件再导入。', 403);
        send(res, 200, mutate(room, seat, b, url.pathname.slice(5), r => {
          const revision = r.state.revision + 1;
          if (url.pathname === '/api/undo') { if (!r.history.length) throw problem('没有可撤销的行动。'); r.state = r.history.pop(); }
          if (url.pathname === '/api/new') r.state = createGame(campaign);
          if (url.pathname === '/api/import') r.state = validateState(b.save, campaign);
          
          if (url.pathname === '/api/slot') { const file = slotPath(r, b.slot); if (b.load) { if (!fs.existsSync(file)) throw problem('这个手动槽还没有存档。'); r.state = validateState(JSON.parse(fs.readFileSync(file, 'utf8')), campaign); } else atomic(file, r.state); }
          r.state.revision = revision; r.pending = null;
          for (const id of Object.keys(r.owners)) if (!r.state.actors.some(a => a.id === id)) delete r.owners[id];
          return {eventText: url.pathname === '/api/slot' ? `手动槽 ${b.slot} 已${b.load ? '恢复' : '保存'}。` : '主持人已恢复或更新本桌进度。'};
        }, {history: url.pathname !== '/api/undo'})); return;
      }
      if (url.pathname === '/api/ai/request') {
        const value = mutate(room, seat, b, 'ai-requested', (r, s) => {
          if (r.aiBusy) throw problem('上一条 AI 请求仍在处理。', 409);
          if (r.pending && r.pending.seatId !== s.id && !isDm(r, s) && !isOwner(r, s)) throw problem('另一位席位正在处理本轮提议，请等待主持人处理。', 409);
          const id = uid(), built = buildRequest(r, s, b, id);
          r.pending = {id, seatId: built.seat.id, requestedBy: s.id, request: built.request, result: null, stale: false, mode:b.mode==='api'?'api':'bridge'};
          return {receipt: {requestId: id}, eventText: `${built.seat.name}正在准备 AI 回复。`, visibility: built.seat.role === 'dm' ? 'dm' : 'all'};
        }, {history: false, bump: false});
        if (b.mode === 'api' && !value.duplicate) { room = store.rooms.get(room.id); void generateAi(room.id, room.pending.id, {...room.config}); }
        room = store.rooms.get(room.id);
        send(res, 200, {...value, request: room.pending?.id === value.requestId ? {id: room.pending.id, ...room.pending.request} : null, aiBusy: room.aiBusy}); return;
      }
      if (['/api/ai/response', '/api/bridge/submit'].includes(url.pathname)) {
        send(res, 200, mutate(room, seat, b, 'ai-submitted', (r, s) => {
          if (!r.pending || r.pending.id !== b.id) throw problem('此 AI 请求已失效。');
          if (r.pending.seatId !== s.id && !isDm(r, s) && !isOwner(r, s)) throw problem('不能向别的席位提交 AI 回复。', 403);
          if (r.pending.request.revision !== r.state.revision) throw problem('局面已改变，请先重新读取局面。', 409, 'STALE_AI');
          r.pending.result = parseRoomResult(b.response, r.pending.request);
        }, {history: false, bump: false})); return;
      }
      if (url.pathname === '/api/ai/apply') { send(res, 200, applyAi(room, seat, b)); return; }
      if (url.pathname === '/api/ai/control') {
        requireOwner(room, seat);
        const value = mutate(room, seat, b, 'ai-control', r => {
          if (['pause', 'cancel', 'takeover'].includes(b.action)) { r.aiPaused = true; r.pending = null; r.aiBusy = false; if (r.aiAutomation) r.aiAutomation.enabled = false; }
          else if (b.action === 'resume') { r.aiPaused = false; if (b.seatId && (b.autoApply || b.steps)) { const target = r.seats.find(s => s.id === b.seatId && !s.disabled); if (!target || target.kind !== 'api') throw problem('请选择 API 席位启动自动参与。'); r.aiAutomation = {seatId: target.id, enabled: true, remaining: Math.max(1, Math.min(100, Number(b.steps) || 10)), autoApply: !!b.autoApply, lastRevision: -1, nextAt: 0}; } }
          else throw problem('未知 AI 控制操作。');
          if (b.action === 'takeover') { const target = b.seatId && r.seats.find(s => s.id === b.seatId); if (target) { for (const [id, owner] of Object.entries(r.owners)) if (owner === target.id) r.owners[id] = seat.id; if (r.dmSeatId === target.id) r.dmSeatId = r.ownerId; } }
          return {eventText: b.action === 'resume' ? 'AI 已恢复，可继续提交本轮操作。' : 'AI 已暂停；真人可以接管。'};
        }, {history: false});
        if (b.action !== 'resume') requests.get(room.id)?.abort();
        send(res, 200, value); return;
      }
      if (url.pathname === '/api/bridge/presence') { const changed = seat.presence !== (b.status === 'connected' ? 'connected' : 'disconnected'); send(res, 200, mutate(room, seat, b, 'bridge-presence', (r, s) => { s.presence = b.status === 'connected' ? 'connected' : 'disconnected'; s.cursor = Number(b.cursor) || 0; s.lastSeen = new Date().toISOString(); return {eventText: `${s.name}${s.presence === 'connected' ? '已连接' : '已断开'}工作区。`}; }, {history: false, bump: false, revision: false, record: changed})); return; }
      if (url.pathname === '/api/local') throw problem('NPC 已由服务端统一调度，不再由浏览器重复执行。', 409, 'SERVER_SCHEDULED');
      if (url.pathname === '/api/stop') throw problem('使用服务器本机的停止工具关闭服务；房主席位只管理当前房间。', 403);
      throw problem('接口不存在。', 404);
    }
    if (!['GET', 'HEAD'].includes(req.method)) throw problem('只允许读取。', 405);
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname), file = path.resolve(pub, '.' + relative);
    if (!file.startsWith(pub + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': ['.png', '.webp', '.jpg'].includes(path.extname(file)) ? 'public,max-age=86400' : 'no-cache', 'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'"});
    if (req.method === 'HEAD') res.end(); else fs.createReadStream(file).pipe(res);
  } catch (error) { if (!res.headersSent) { const current = context && store.rooms.get(context.room.id); send(res, error.status || 400, {error: error.message, code: error.code || 'INVALID_REQUEST', ...(error.status === 409 && current ? response(current, context.seat) : {})}); } else res.end(); }
});
const scheduler = setInterval(() => { for (const room of store.rooms.values()) { store.expirePresence(room); scheduleAi(room); store.npcTick(store.rooms.get(room.id)); } }, 850);
server.requestTimeout = 120000; server.headersTimeout = 30000;
function shutdown() { clearInterval(scheduler); for (const request of requests.values()) request.abort(); store.close(); server.closeAllConnections(); server.close(() => process.exit(0)); }
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
server.on('error', error => { clearInterval(scheduler); console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用；请使用现有服务或修改 PORT。` : error.message); process.exitCode = 1; });
server.listen(port, host, () => { atomic(path.resolve(process.env.FENGSHEN_V03_RUNTIME_FILE || path.join(data, 'runtime-v03.json')), {url: base, localUrl: `http://127.0.0.1:${port}`, pid: process.pid, processToken, multiplayer: true, version: 2}); console.log(`封神·岐路 v0.3 世路人情本机服务：${base}\n房间将保存至配置的持久目录。`); if (process.argv.includes('--open') && process.platform === 'win32') openBrowserSafely(base); });

function openBrowserSafely(url){const manual=()=>console.log('浏览器未能自动打开；服务继续运行，请手动打开：'+url);try{const browser=spawn('explorer.exe',[url],{detached:true,stdio:'ignore',windowsHide:true});browser.once('error',manual);browser.unref();}catch{manual();}}
