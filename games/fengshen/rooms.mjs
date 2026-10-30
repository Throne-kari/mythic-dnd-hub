import {validateMapState} from './cartography.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes, createHash} from 'node:crypto';
import {createGame, apply, publicState, actor, log, localStep} from './engine.mjs';
import {publishHandout} from './handouts.mjs';
import {spells} from './abilities.mjs';
import {battleSnapshot, beginBattleCapture, recordBattleEffect, captureBattleTransition, publicBattleReport} from '../../server/combat-ledger.mjs';

const secret = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const copy = value => structuredClone(value);

// Only authored rules labels are used here; client narration/labels never become combat evidence.
function battleActionMethod(state, command = {}) {
  const acting = state.actors?.find(a => a.id === command.actor);
  if (command.type === 'attack') return acting?.weapons?.[Number(command.option) || 0]?.name || '武器攻击';
  if (['spell', 'cast'].includes(command.type)) return spells[command.option]?.name || '施法';
  return ({start:'进入先攻',end:'回合结束',move:'移动',potion:'治疗药水',wind:'回气',stand:'起身',dash:'疾走',disengage:'撤离',dodge:'闪避',rest:'休整',retreat:'撤退',gm:'主持规则调整',feature:'职业或怪物能力',item:'物品使用'})[command.type] || '规则行动';
}

export const problem = (message, status = 400, code = 'INVALID_REQUEST') => Object.assign(new Error(message), {status, code});
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, copy(obj[k])]));
export const isCooperative = room => room.mode === 'cooperative';
export const isDm = (room, seat) => !isCooperative(room) && room.dmSeatId === seat.id;
export const isOwner = (room, seat) => room.ownerId === seat.id;
export const isPrivileged = (room, seat) => isDm(room, seat) || !isCooperative(room) && isOwner(room, seat);
export const seatActive = seat => !!seat && !seat.disabled && (seat.online === true || Date.now() - Date.parse(seat.lastSeen || '') < 45000);
export function canControlActor(room, seat, id) {
  if (isPrivileged(room, seat)) return true;
  const unit = room.state.actors.find(a => a.id === id);
  if (!unit || unit.side !== 'party') return false;
  const holder = room.owners[id];
  return holder === seat.id || isCooperative(room) && (!holder || !seatActive(room.seats.find(s => s.id === holder)));
}
export const controlledActors = (room, seat) => room.state.actors.filter(a => a.side === 'party' && canControlActor(room, seat, a.id)).map(a => a.id);
export function requireDm(room, seat) { if (!isPrivileged(room, seat)) throw problem('此入口属于可选主持模式；合作冒险按公开选择与规则自动推进。', 403, 'FORBIDDEN'); }
export function requireOwner(room, seat) { if (!isOwner(room, seat)) throw problem('这项操作需要房主权限。', 403, 'FORBIDDEN'); }

export function validateState(s, campaign) {
  if (!s || ![1, 2].includes(s.version) || !Array.isArray(s.actors) || s.actors.length > 100 || !Array.isArray(s.log) || s.log.length > 500 || !Array.isArray(s.journal) || !s.locations || !Array.isArray(s.inventory) || !s.flags || !s.doors || !Number.isInteger(s.revision) || !Number.isInteger(s.chapter) || s.chapter < 1 || s.chapter > 12 || !(s.scene === 'FERRY' || campaign.scenes[s.scene])) throw problem('存档结构不兼容。');
  const ids = new Set();
  for (const a of s.actors) {
    if (!a.id || ids.has(a.id) || ![a.hp, a.maxHp, a.x, a.y, a.ac, a.speed].every(Number.isFinite) || !Array.isArray(a.weapons) || !Array.isArray(a.conditions)) throw problem('存档中的角色数据无效。');
    ids.add(a.id);
  }
  if (s.combat && (!Array.isArray(s.combat.order) || s.combat.order.some(id => !ids.has(id)) || s.combat.index < 0 || s.combat.index >= s.combat.order.length)) throw problem('存档中的先攻数据无效。');
  if(s.passages!==undefined&&(!Array.isArray(s.passages)||s.passages.length>100||s.passages.some(p=>!p||!(p.scene==='FERRY'||campaign.scenes[p.scene])||![p.x,p.y,p.w,p.h,p.expiresAt].every(Number.isFinite)||p.w<=0||p.h<=0)))throw problem('临时通道数据无效。');
  if (s.campaign !== undefined) {
    const value = s.campaign, plain = o => !!o && typeof o === 'object' && !Array.isArray(o);
    if (!plain(value) || ['facts', 'chapters', 'nodes', 'npcs', 'items', 'rewards', 'endings'].some(k => !plain(value[k])) || !Array.isArray(value.promises) || !Number.isInteger(value.milestoneLevel) || value.milestoneLevel < 3 || value.milestoneLevel > 12) throw problem('战役进度结构无效。');
    if (value.gate && (!plain(value.gate) || !['locked', 'unbarred', 'open'].includes(value.gate.door) || !['raised', 'half', 'lowered'].includes(value.gate.bridge) || !Number.isInteger(value.gate.bridgeWork) || value.gate.bridgeWork < 0 || value.gate.bridgeWork > 2 || typeof value.gate.southRoad !== 'boolean')) throw problem('关门与吊桥进度无效。');
    if (Object.values(value.chapters).some(v => !plain(v) || typeof v.completed !== 'boolean' || typeof v.outcome !== 'string')) throw problem('章节收束数据无效。');
    if (Object.values(value.items).some(v => !plain(v) || typeof v.id !== 'string' || typeof v.name !== 'string' || !(v.holder === null || typeof v.holder === 'string'))) throw problem('战役物件归属数据无效。');
  }
  validateMapState(s,{FERRY:{},...campaign.scenes});
  return s;
}

export function projectState(room, seat, campaign) {
  const s = publicState(room.state, campaign);
  if (isPrivileged(room, seat)) return {...s, battleReport: publicBattleReport(room.state, {privileged: true})};
  const out = pick(s, ['version', 'revision', 'chapter', 'scene', 'journal', 'inventory', 'gold', 'time', 'combat', 'doors', 'created', 'choices', 'current', 'chapters', 'campaignView', 'partyDefeated', 'passages']);
  out.battleReport = publicBattleReport(room.state, {privileged: false, canViewActor: record => !record.hidden && !record.secret && !['dm', 'gm', 'owner'].includes(record.visibility)});
  out.log = s.log.filter(l => !['gm', 'ai-note', 'secret', 'dm'].includes(l.kind) && l.visibility !== 'dm').map(l => pick(l, ['id', 'kind', 'text', 'time']));
  out.journal = (out.journal || []).filter(j => j.visibility !== 'dm' && !j.secret);
  out.actors = s.actors.filter(a => !a.hidden && !a.secret && !['owner', 'dm', 'gm'].includes(a.visibility)).map(a => {
    if (a.side === 'party') return {...pick(a, ['id', 'name', 'side', 'role', 'source', 'manual', 'class', 'subclass', 'build', 'level', 'race', 'background', 'bio', 'portrait', 'color', 'ac', 'hp', 'maxHp', 'tempHp', 'speed', 'x', 'y', 'weapons', 'attacks', 'abilities', 'skills', 'proficiency', 'saveProficiencies', 'spellDC', 'spellAttack', 'spellAbility', 'spells', 'knownSpells', 'domainSpells', 'cantrips', 'preparedLimit', 'customPrepared', 'customBuild', 'preset', 'climb', 'inspiration', 'initiative', 'initiativeAdv', 'conditions', 'death', 'dead', 'stable', 'prone', 'action', 'bonus', 'move', 'reaction', 'attackLeft', 'slots', 'maxSlots', 'wind', 'maxWind', 'surge', 'maxSurge', 'channel', 'maxChannel', 'arcane', 'maxArcane', 'indomitable', 'maxIndomitable', 'intervention', 'maxIntervention', 'hd', 'maxHd', 'hitDie', 'potions', 'controller', 'features', 'resources', 'spellbook', 'prepared', 'dodge', 'disengaged', 'masteries', 'critical', 'sneakDice', 'uncanny', 'evasion', 'reliable']), ...((room.owners[a.id] === seat.id) ? pick(a, ['effects', 'concentration', 'reactionPolicy']) : {effects: (a.effects || []).map(e => pick(e, ['condition', 'spell', 'expiresAt'])), concentration: a.concentration ? {spell: a.concentration.spell} : null})};
    return {...pick(a, ['id', 'name', 'side', 'color', 'x', 'y', 'conditions', 'dead', 'prone']), effects: (a.effects || []).map(e => pick(e, ['condition', 'spell', 'expiresAt'])), concentration: a.concentration ? {spell: a.concentration.spell} : null, bloodied: a.hp > 0 && a.hp <= a.maxHp / 2, down: a.hp === 0};
  });
  out.actors = out.actors.map(a => ({...a, effects: (a.effects || []).filter(e => !e.hidden && !e.secret && !['owner', 'dm', 'gm'].includes(e.visibility))}));
  const visibleIds = new Set(out.actors.map(a => a.id));
  if (out.combat) { out.combat.order = out.combat.order.filter(id => visibleIds.has(id)); out.combat.index = visibleIds.has(out.current) ? out.combat.order.indexOf(out.current) : -1; delete out.combat.scores; if (!visibleIds.has(out.current)) out.current = null; }
  out.areas = (s.areas || []).filter(area => !area.hidden && !area.secret && !['owner', 'dm', 'gm'].includes(area.visibility)).map(area => ({...pick(area, ['id', 'spell', 'level', 'x', 'y', 'radius', 'expiresAt']), caster: visibleIds.has(area.caster) ? area.caster : null}));
  // Map geometry is public. Authored GM markers, route solutions and source notes are not.
  out.sceneData = pick(s.sceneData, ['schema_version', 'map_id', 'mapRevision', 'name', 'width_ft', 'height_ft', 'origin', 'grid_ft', 'rooms', 'walls', 'openings', 'features', 'art', 'image', 'asset']);
  for (const key of ['rooms', 'walls', 'openings', 'features']) if (out.sceneData[key]) out.sceneData[key] = out.sceneData[key].filter(v => !v.hidden && !v.secret && v.visibility !== 'dm').map(v => pick(v, ['id', 'label', 'name', 'kind', 'x', 'y', 'w', 'h', 'a', 'b', 'state', 'height_ft', 'height_start_ft', 'height_end_ft', 'height_start', 'height_end', 'raises', 'rise_ft', 'floor_ft', 'sill_ft', 'color']));
  return out;
}

const playerTypes = new Set(['move', 'attack', 'start', 'end', 'dash', 'disengage', 'dodge', 'stand', 'wind', 'surge', 'spell', 'potion', 'stabilize', 'door', 'choice', 'roll', 'note', 'rest', 'wait', 'feature', 'item', 'retreat', 'levelup', 'skill', 'save', 'cast', 'prepare']);
export function authorizeCommand(room, seat, command) {
  if (!command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string') throw problem('缺少有效行动。');
  if (seat.kind !== 'human' && room.aiPaused) throw problem('房主已暂停 AI，请恢复后继续。', 403, 'AI_PAUSED');
  const cmd = copy(command);
  if (isPrivileged(room, seat)) return cmd;
  if (!playerTypes.has(cmd.type)) throw problem('这项行动需要主持权限。', 403, 'FORBIDDEN');
  const owned = controlledActors(room, seat);
  if (!owned.length) throw problem('请先选择自己的角色。', 403, 'NO_CHARACTER');
  if (!cmd.actor) cmd.actor = owned[0];
  if (!owned.includes(cmd.actor) || actor(room.state, cmd.actor).side !== 'party') throw problem('只能操作分配给自己的角色。', 403, 'NOT_YOUR_CHARACTER');
  const visible = new Set(room.state.actors.filter(a => !a.hidden && a.visibility !== 'dm').map(a => a.id));
  if ((cmd.target && !visible.has(cmd.target)) || (cmd.targets && (!Array.isArray(cmd.targets) || cmd.targets.some(id => !visible.has(id))))) throw problem('目标尚未出现在当前可见局面中。', 403, 'HIDDEN_TARGET');
  if (cmd.type === 'note') cmd.text = `${seat.name}：${String(cmd.text || '').slice(0, 5000)}`;
  return cmd;
}

export class RoomStore {
  constructor(directory, campaign, defaults = {}) {
    this.directory = directory;
    this.campaign = campaign;
    this.defaults = {model: defaults.model || '', baseUrl: defaults.baseUrl || 'https://api.openai.com/v1', protocol: defaults.protocol || 'responses'};
    this.rooms = new Map(); this.tokens = new Map(); this.watchers = new Map(); this.eventTokens = new Map(); this.seatEventTokens = new Map(); this.presenceTimers = new Map();
    fs.mkdirSync(directory, {recursive: true, mode: 0o700});
    for (const file of fs.readdirSync(directory).filter(f => /^[a-zA-Z0-9_-]+\.json$/.test(f))) {
      try {
        const room = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
        if (room.schema !== 2 || room.id + '.json' !== file || !Array.isArray(room.seats) || !room.seats.some(s => s.id === room.ownerId)) continue;
        validateState(room.state, campaign);
        room.config = {...this.defaults, ...room.config, key: ''};
        room.aiBusy = false;
        room.aiPaused = true; // A restart never resumes paid calls without a host action.
        if(room.aiAutomation)room.aiAutomation.enabled=false;
        if(room.pending?.mode==='api'&&!room.pending.result)room.pending.error='服务已重启，上一次 API 请求未完成；请重新请求。';
        room.history ||= []; room.events ||= []; room.receipts ||= []; room.owners ||= {};
        room.seats.forEach(s => { s.online = false; s.presence = 'disconnected'; });
        this.rooms.set(room.id, room); this.index(room);
      } catch { console.warn(`房间文件 ${file} 未能读取，原文件已保留。`); }
    }
  }
  index(room) { for (const seat of room.seats) this.tokens.set(seat.tokenHash, {roomId: room.id, seatId: seat.id}); }
  persist(room) {
    const value = {...room, config: {...room.config, key: undefined}, aiBusy: false, seats: room.seats.map(s => ({...s, online: false}))};
    const file = path.join(this.directory, room.id + '.json'), temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value), {encoding: 'utf8', mode: 0o600});
    fs.renameSync(temp, file);
  }
  auth(raw, roomId) {
    const found = raw && this.tokens.get(hash(raw));
    const room = found && this.rooms.get(found.roomId), seat = room?.seats.find(s => s.id === found.seatId);
    if (!seat || seat.disabled || (roomId && roomId !== room.id)) throw problem('席位凭据无效，请从邀请重新加入或使用已保存的席位。', 401, 'INVALID_SEAT');
    seat.lastSeen = new Date().toISOString();
    return {room, seat};
  }
  eventAuth(value) {
    const record = this.eventTokens.get(value);
    if (!record || record.expires < Date.now()) throw problem('实时连接凭据已过期，请刷新局面后重连。', 401, 'EVENT_SESSION_EXPIRED');
    const room = this.rooms.get(record.roomId), seat = room?.seats.find(s => s.id === record.seatId && !s.disabled);
    if (!seat) throw problem('席位已离开。', 401);
    return {room, seat};
  }
  create({name, displayName, mode}) {
    const token = secret(), id = randomBytes(9).toString('base64url'), seatId = randomBytes(9).toString('base64url');
    const cooperative = mode !== 'hosted';
    const room = {schema: 2, id, name: String(name || '封神同行').trim().slice(0, 60), mode: cooperative ? 'cooperative' : 'hosted', ownerId: seatId, dmSeatId: cooperative ? null : seatId, invite: secret(), created: new Date().toISOString(), seq: 0, state: createGame(this.campaign), seats: [{id: seatId, name: String(displayName || '同行者').trim().slice(0, 40), role: cooperative ? 'player' : 'dm', kind: 'human', tokenHash: hash(token), online: false, lastSeen: new Date().toISOString()}], owners: {}, history: [], events: [], receipts: [], pending: null, aiBusy: false, aiPaused: true, autoNpc: true, config: {...this.defaults, key: ''}};
    if (cooperative) { const first = room.state.actors.find(a => a.side === 'party'); if (first) room.owners[first.id] = seatId; }
    this.record(room, 'room-created', '房间已建立。', seatId);
    this.persist(room); this.rooms.set(id, room); this.index(room);
    return {room, seat: room.seats[0], token};
  }
  join({invite, displayName}) {
    const room = [...this.rooms.values()].find(r => r.invite === invite);
    if (!room) throw problem('邀请无效或已被房主更换。', 404, 'INVITE_NOT_FOUND');
    const token = secret(), seat = {id: randomBytes(9).toString('base64url'), name: String(displayName || '同行者').trim().slice(0, 40), role: 'player', kind: 'human', tokenHash: hash(token), online: false};
    const next = copy(room); next.seats.push(seat); if (isCooperative(next)) { seat.lastSeen = new Date().toISOString(); const free = next.state.actors.find(a => a.side === 'party' && !next.owners[a.id]); if (free) next.owners[free.id] = seat.id; } this.record(next, 'seat-joined', `${seat.name}加入了房间。`, seat.id);
    this.commit(next); return {room: next, seat, token};
  }
  record(room, type, text, seatId, visibility = 'all') {
    const event = {seq: ++room.seq, revision: room.state.revision, type, text, seatId, visibility, time: new Date().toISOString()};
    room.events.push(event); if (room.events.length > 400) room.events.splice(0, room.events.length - 400);
  }
  commit(room) { this.persist(room); this.rooms.set(room.id, room); this.index(room); this.publish(room); }
  transact(room, seat, body, type, fn, {history = true, revision = true, bump = true, record = true} = {}) {
    const commandId = body.commandId;
    if (typeof commandId !== 'string' || !/^[a-zA-Z0-9:_-]{8,120}$/.test(commandId)) throw problem('每次操作需要唯一 commandId。', 400, 'COMMAND_ID_REQUIRED');
    const fingerprint = hash(JSON.stringify({...body, commandId: undefined}));
    const receipt = room.receipts.find(r => r.seatId === seat.id && r.id === commandId);
    if (receipt) {
      if (receipt.type !== type || receipt.fingerprint !== fingerprint) throw problem('同一 commandId 不能用于不同操作。', 409, 'COMMAND_ID_REUSED');
      return {room, duplicate: true, result: receipt.result};
    }
    if (revision && body.revision !== room.state.revision) throw problem('局面已更新，已为你取得最新状态；请重新选择这一步。', 409, 'REVISION_CONFLICT');
    const next = copy(room), nextSeat = next.seats.find(s => s.id === seat.id);
    if (history) { next.history.push(copy(room.state)); if (next.history.length > 30) next.history.shift(); }
    const battleCommand = type === 'command' ? body.command : type === 'ai-applied' ? (room.pending?.result?.command || (room.pending?.result?.actionIndex != null ? room.pending.request.actions[room.pending.result.actionIndex] : null)) : null;
    const battleBefore = battleCommand ? battleSnapshot(room.state) : null;
    if (battleCommand) beginBattleCapture(next.state);
    const result = fn(next, nextSeat);
    if (next.state.partyDefeated && next.state.actors.some(a => a.side === 'party' && a.hp > 0 && !a.dead)) delete next.state.partyDefeated;
    if (bump && next.state.revision === room.state.revision) next.state.revision++;
    const committedBattleCommand = result?.battleCommand || battleCommand;
    if (committedBattleCommand) captureBattleTransition(battleBefore, next.state, committedBattleCommand, {requestId: commandId, method: battleActionMethod(room.state, committedBattleCommand)});
    if (next.pending && next.pending.request.revision !== next.state.revision) next.pending.stale = true;
    if (record) this.record(next, type, result?.eventText || `${seat.name}更新了局面。`, seat.id, result?.visibility || 'all');
    next.receipts.push({id: commandId, seatId: seat.id, type, fingerprint, revision: next.state.revision, result: result?.receipt || null});
    if (next.receipts.length > 500) next.receipts.shift();
    this.commit(next); return {room: next, duplicate: false, result: result?.receipt || null};
  }
  command(room, seat, body) { return this.transact(room, seat, body, 'command', (r, s) => { const command=authorizeCommand(r,s,body.command);if(command.type==='handout'){requireDm(r,s);publishHandout(r.state,command.option);}else apply(r.state,command,this.campaign); return {battleCommand: command}; }); }
  view(room, seat) {
    const privileged = isPrivileged(room, seat);
    const pending = room.pending && (privileged || room.pending.seatId === seat.id) ? {id: room.pending.id, revision: room.pending.request.revision, role: room.pending.request.role, actor: room.pending.request.actor, seatId: room.pending.seatId, stale: room.pending.stale || room.pending.request.revision !== room.state.revision, error: room.pending.error || null, result: room.pending.result || null, action: room.pending.result?.command || (room.pending.result?.actionIndex != null ? room.pending.request.actions[room.pending.result.actionIndex] : null)} : null;
    const eventKey = room.id + ':' + seat.id, previous = this.seatEventTokens.get(eventKey);
    const eventToken = previous && this.eventTokens.get(previous)?.expires > Date.now() + 60000 ? previous : secret();
    if (eventToken !== previous) { this.eventTokens.set(eventToken, {roomId: room.id, seatId: seat.id, expires: Date.now() + 15 * 60 * 1000}); this.seatEventTokens.set(eventKey, eventToken); }
    if (this.eventTokens.size > 2000) for (const [k, v] of this.eventTokens) if (v.expires < Date.now()) this.eventTokens.delete(k);
    return {state: projectState(room, seat, this.campaign), room: {id: room.id, mode: room.mode || 'hosted', cooperative: isCooperative(room), recoveryAvailable: !!room.state.partyDefeated, name: room.name, ...(isOwner(room, seat) ? {invite: room.invite} : {}), ownerId: room.ownerId, dmSeatId: room.dmSeatId, owners: room.owners, seats: room.seats.filter(s => !s.disabled).map(s => ({...pick(s, ['id', 'name', 'kind', 'online', 'lastSeen', 'presence']), online: !!s.online || Date.now() - Date.parse(s.lastSeen || 0) < 12000, role: room.dmSeatId === s.id ? 'dm' : 'player', actors: Object.keys(room.owners).filter(id => room.owners[id] === s.id)})), autoNpc: room.autoNpc, aiPaused: room.aiPaused, aiAutomation: room.aiAutomation ? pick(room.aiAutomation, ['seatId', 'enabled', 'remaining', 'autoApply']) : null, seq: room.seq}, seat: {id: seat.id, name: seat.name, role: isDm(room, seat) ? 'dm' : 'player', isOwner: isOwner(room, seat), kind: seat.kind, controllableActors: controlledActors(room, seat), actors: Object.keys(room.owners).filter(id => room.owners[id] === seat.id)}, pending, settings: privileged || isOwner(room, seat) ? {...pick(room.config, ['model', 'baseUrl', 'protocol']), hasKey: !!room.config.key} : {}, aiBusy: room.aiBusy, eventSeq: room.seq, eventToken};
  }
  updates(room, seat, since = 0) {
    const privileged = isPrivileged(room, seat);
    return {events: room.events.filter(e => e.seq > since && (e.visibility === 'all' || privileged)).map(e => copy(e)), reset: since > room.seq || (since > 0 && since < (room.events[0]?.seq || 1) - 1), ...this.view(room, seat)};
  }
  subscribe(room, seat, response, since) {
    const set = this.watchers.get(room.id) || new Set(); this.watchers.set(room.id, set);
    const watcher = {seatId: seat.id, response}; set.add(watcher);
    seat.online = true;
    this.presence(room.id);
    response.write(`id: ${room.seq}\nevent: state\ndata: ${JSON.stringify(this.updates(room, seat, since))}\n\n`);
    const keepalive = setInterval(() => response.write(': heartbeat\n\n'), 25000);
    response.on('close', () => { clearInterval(keepalive); set.delete(watcher); const r = this.rooms.get(room.id), s = r?.seats.find(v => v.id === seat.id); if (s && ![...set].some(v => v.seatId === seat.id)) s.online = false; this.presence(room.id); });
  }
  presence(roomId) {
    clearTimeout(this.presenceTimers.get(roomId));
    this.presenceTimers.set(roomId, setTimeout(() => { this.presenceTimers.delete(roomId); const room = this.rooms.get(roomId); if (room) this.publish(room); }, 350));
  }
  expirePresence(room) {
    let changed = false;
    for (const seat of room.seats) if (seat.presence === 'connected' && Date.now() - Date.parse(seat.lastSeen || 0) > 15000) { seat.presence = 'disconnected'; changed = true; }
    if (changed) this.presence(room.id);
  }
  publish(room) {
    for (const watcher of this.watchers.get(room.id) || []) {
      const seat = room.seats.find(s => s.id === watcher.seatId && !s.disabled);
      if (!seat) { watcher.response.end(); continue; }
      seat.online = true;
      try { watcher.response.write(`id: ${room.seq}\nevent: state\ndata: ${JSON.stringify(this.view(room, seat))}\n\n`); } catch { watcher.response.end(); }
    }
  }
  npcTick(room) {
    if (!room.autoNpc || room.aiBusy || !room.state.combat) return;
    if (isCooperative(room)) {
      if (!room.seats.some(seatActive)) return; // An empty room waits; disconnected players do not lose rounds off-screen.
      const liveParty = room.state.actors.some(v => v.side === 'party' && v.hp > 0 && !v.dead && !v.departed);
      const activeId = room.state.combat.order[room.state.combat.index], currentActor = room.state.actors.find(v => v.id === activeId);
      const holder = currentActor && room.seats.find(v => v.id === room.owners[currentActor.id]);
      if (!liveParty || currentActor?.side === 'party' && !seatActive(holder)) {
        const next = copy(room), before = battleSnapshot(room.state); beginBattleCapture(next.state);
        next.history.push(copy(room.state)); if (next.history.length > 30) next.history.shift();
        if (!liveParty) {
          recordBattleEffect(next.state, {kind:'battle-end', result:'defeat'}); next.state.combat = null; next.state.partyDefeated = true; next.state.revision++;
          log(next.state, 'story', '队伍已失去继续交锋的能力，本场交锋结束。伤势和真实后果保留；可处理倒地角色，或重新开始本次冒险。');
        } else {
          if (currentActor.hp > 0 && !currentActor.dead && currentActor.action > 0) { try { apply(next.state, {type:'dodge', actor:activeId}, this.campaign); } catch {} }
          if (next.state.combat?.order[next.state.combat.index] === activeId) apply(next.state, {type:'end', actor:activeId}, this.campaign);
        }
        captureBattleTransition(before, next.state, {type:'end', actor:activeId}, {method:!liveParty ? '队伍失去战斗能力' : '未领取或离线队友 · 规则防御'});
        this.record(next, !liveParty ? 'party-defeat' : 'party-fallback', !liveParty ? '队伍败退，交锋已自动结束。' : `${currentActor.name}由规则托管防御并结束回合；入席者可领取空闲角色。`, 'server');
        this.commit(next); return;
      }
    }

    const id = room.state.combat.order[room.state.combat.index], a = room.state.actors.find(v => v.id === id);
    const dm = room.seats.find(s => s.id === room.dmSeatId && !s.disabled);
    const workspaceHosting = dm?.kind === 'workspace' && (dm.online || (dm.presence === 'connected' && Date.now() - Date.parse(dm.lastSeen || 0) < 15000));
    if (!a || a.side === 'party' || a.side === 'neutral' || (!room.aiPaused && (dm?.kind === 'api' || workspaceHosting))) return;
    const next = copy(room);
    try { next.history.push(copy(room.state)); if (next.history.length > 30) next.history.shift(); beginBattleCapture(next.state); const battleBefore = battleSnapshot(room.state); localStep(next.state, this.campaign); captureBattleTransition(battleBefore, next.state, {type: 'localStep', actor: a.id}, {method: 'NPC行动'}); this.record(next, 'npc-action', `${a.name}行动。`, 'server'); this.commit(next); }
    catch { next.autoNpc = false; log(next.state, 'rule', '自动 NPC 行动遇到规则限制，当前状态已保存；可选择公开退路或继续合法行动。'); next.state.revision++; this.record(next, 'npc-paused', 'NPC 自动行动已暂停。', 'server'); this.commit(next); }
  }
  close() { for (const timeout of this.presenceTimers.values()) clearTimeout(timeout); for (const set of this.watchers.values()) for (const w of set) w.response.end(); for (const room of this.rooms.values()) this.persist(room); }
}

