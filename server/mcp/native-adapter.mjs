import {createHash} from 'node:crypto';

export const ROOM_GAMES = new Set(['fengshen','japan','india','jaffa','acre','qchina','qjapan','qindia']);
export const GROUP_GAMES = new Set(['greek','mesopotamia','aztec']);
export const TABLE_GAMES = new Set(['norse','celtic']);
export const GAME_IDS = new Set([...ROOM_GAMES, ...GROUP_GAMES, ...TABLE_GAMES]);
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const TOKEN = /^[A-Za-z0-9_-]{20,512}$/;
const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;
const CHAT_REQUEST_ID = /^[A-Za-z0-9_-]{16,64}$/;
const PRESENTATION = new Set(['label','costSummary','restWarning','index','description']);
const BLOCKED = new Set(['gm','chat','note','map.replace','loadMap','saveMap','startEncounter','handover','takeover','setTableMode','import','restore','new','undo','handout']);
const error = (message, status = 400, code = 'MCP_REQUEST_INVALID') => Object.assign(new Error(message), {status, code});
const clone = value => structuredClone(value);
const stateOf = packet => packet?.state && typeof packet.state === 'object' ? packet.state : packet;
const revisionOf = packet => stateOf(packet)?.revision;
function clean(value, token) {
  if (Array.isArray(value)) return value.map(item => clean(item, token));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !/token|password|secret|invite|config|settings|dmText|gmNotes/i.test(key)).map(([key, item]) => [key, clean(item, token)]));
  return typeof value === 'string' && token ? value.replaceAll(token, '[credential redacted]') : value;
}
function canonical(value) {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
  return JSON.stringify(value);
}
function normalizeAction(entry, family) {
  const raw = entry?.action || entry?.command || entry;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || typeof raw.type !== 'string' || BLOCKED.has(raw.type)) return null;
  const action = Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('_') && !(family === 'rooms' && PRESENTATION.has(key))));
  return {action, label: String(entry.label || raw.label || raw.type).slice(0, 200)};
}

/** Uses only the same authenticated, projected native APIs as the browser. */
export function createNativeAdapter({gameId, roomId, token, nativeRequest}) {
  if (!GAME_IDS.has(gameId) || !ID.test(roomId || '') || !TOKEN.test(token || '') || typeof nativeRequest !== 'function') throw error('需要有效游戏、房间和原玩家席位凭据。', 401, 'MCP_AUTH_REQUIRED');
  const family = ROOM_GAMES.has(gameId) ? 'rooms' : TABLE_GAMES.has(gameId) ? 'table' : 'group';
  if (family === 'table' && roomId !== 'table') throw error('合作桌的MCP房间标识必须为table。', 404);
  const base = family === 'group' ? `/api/rooms/${roomId}` : '/api';
  const auth = family === 'group' ? {Authorization: `Bearer ${token}`} : {'X-Seat-Token': token, ...(family === 'rooms' ? {'X-Room-Id': roomId} : {})};
  async function request(path, body) {
    let result;
    try { result = await nativeRequest({gameId, path, method: body === undefined ? 'GET' : 'POST', headers: {...auth}, ...(body === undefined ? {} : {body})}); }
    catch { throw error('游戏服务暂不可用，请稍后重新连接。', 502, 'NATIVE_UNAVAILABLE'); }
    if (!result || !Number.isInteger(result.status)) throw error('游戏服务返回无效响应。', 502);
    if (result.status < 200 || result.status >= 300 || result.body?.ok === false) {
      const source = result.body?.error;
      const message = typeof source === 'string' ? source : source?.message || result.body?.message;
      throw error(result.status >= 500 ? '游戏服务暂不可用，请稍后重新连接。' : clean(String(message || '原生游戏拒绝了这项操作。').slice(0, 300), token), result.status >= 400 ? result.status : 400, typeof source?.code === 'string' && /^[A-Z0-9_-]{1,80}$/.test(source.code) ? source.code : 'NATIVE_REJECTED');
    }
    return result.body;
  }
  async function connect() {
    const packet = await request(base + '/state');
    const state = stateOf(packet), seat = packet?.seat || state?.seat;
    if (!state || !Number.isSafeInteger(state.revision) || !seat || seat.role !== 'player') throw error('MCP仅接受原生玩家席位，不接受主持或管理令牌。', 403, 'PLAYER_SEAT_REQUIRED');
    if (family === 'rooms' && packet.room?.id !== roomId || family === 'group' && packet.roomId && packet.roomId !== roomId) throw error('凭据与指定房间不匹配。', 403, 'ROOM_SCOPE_MISMATCH');
    return {packet, state, seat};
  }
  async function getState() {
    const {state, seat} = await connect();
    return clean({gameId, roomId, revision: state.revision, seat: {id: seat.id, name: seat.name || seat.displayName, role: 'player', actors: seat.actors || seat.actorIds || seat.heroIds || (seat.characterId ? [seat.characterId] : [])}, state}, token);
  }
  async function buildCatalogue(actorId) {
    if (actorId !== undefined && !ID.test(actorId)) throw error('角色标识无效。');
    const {packet, state, seat} = await connect();
    let entries = [];
    if (family === 'rooms') {
      const currentParty = state.actors?.find(actor => actor.id === state.current && actor.side === 'party');
      const actors = actorId ? [actorId] : currentParty ? [currentParty.id] : (state.actors || []).filter(actor => actor.side === 'party').map(actor => actor.id);
      if (!actors.length) throw error('请先在游戏界面领取角色。', 403, 'NO_CHARACTER');
      for (const actor of actors) {
        let values;
        try { values = await request('/api/actions?actor=' + encodeURIComponent(actor)); }
        catch (cause) { if (!actorId && cause.status === 403) continue; throw cause; }
        if (!Array.isArray(values)) throw error('游戏未返回合法行动列表。', 502);
        entries.push(...values);
      }
    } else if (gameId === 'mesopotamia' || gameId === 'aztec') {
      const values = await request(base + '/actions');
      if (revisionOf(values) !== state.revision && values.revision !== state.revision) throw error('局面已改变，请刷新合法行动。', 409, 'REVISION_CONFLICT');
      if (!Array.isArray(values.actions)) throw error('游戏未返回合法行动列表。', 502);
      entries = values.actions;
    } else entries = state.legalActions || state.actions || [];
    const actions = [], seen = new Set();
    for (const entry of entries) {
      const normalized = normalizeAction(entry, family); if (!normalized) continue;
      const {action, label} = normalized;
      if (actorId && (action.actor || action.actorId || action.heroId) && (action.actor || action.actorId || action.heroId) !== actorId) continue;
      const id = createHash('sha256').update(canonical({gameId, roomId, revision: state.revision, action})).digest('hex');
      if (seen.has(id)) continue; seen.add(id);
      actions.push({actionId: id, label, action});
    }
    if ((await connect()).state.revision !== state.revision) throw error('读取行动期间局面已改变，请重新读取合法行动。', 409, 'REVISION_CONFLICT');
    return {gameId, roomId, revision: state.revision, actions};
  }
  async function submit({actionId, revision, requestId}) {
    if (!/^[a-f0-9]{64}$/.test(actionId || '') || !Number.isSafeInteger(revision) || revision < 0 || !REQUEST_ID.test(requestId || '')) throw error('需要合法actionId、revision和唯一requestId。');
    const listed = await buildCatalogue();
    if (listed.revision !== revision) throw error('局面已改变，请刷新合法行动后重新选择；未执行行动。', 409, 'REVISION_CONFLICT');
    const entry = listed.actions.find(item => item.actionId === actionId);
    if (!entry) throw error('这项行动已不可用，请重新读取合法行动；未执行行动。', 409, 'ACTION_UNAVAILABLE');
    const action = clone(entry.action);
    const body = family === 'rooms' ? {revision, commandId: 'mcp:' + requestId, command: action} : gameId === 'mesopotamia' || gameId === 'aztec' ? {expectedRevision: revision, requestId, action} : gameId === 'greek' ? {revision, action} : {revision, requestId, action};
    await request(base + (family === 'rooms' ? '/command' : '/action'), body);
    return getState();
  }
  async function readChat({cursor = 0, limit = 50} = {}) {
    await connect();
    if (!Number.isSafeInteger(cursor) || cursor < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw error('聊天游标或数量无效。');
    const result = await request(base + `/hub/chat?cursor=${cursor}&limit=${limit}`);
    if (family !== 'table' && result.roomId !== roomId) throw error('聊天响应房间不匹配。', 502, 'ROOM_SCOPE_MISMATCH');
    return clean(result, token);
  }
  async function sendChat({text, requestId}) {
    await connect();
    if (typeof text !== 'string' || !text.trim() || [...text.trim()].length > 1000 || !CHAT_REQUEST_ID.test(requestId || '')) throw error('消息需1–1000个Unicode字符，并提供16–64位唯一requestId。');
    if (text.includes(token)) throw error('不能把当前席位凭据发送到房聊。', 400, 'CREDENTIAL_IN_CHAT');
    const result = await request(base + '/hub/chat', {text, requestId});
    if (family !== 'table' && result.roomId !== roomId) throw error('聊天响应房间不匹配。', 502, 'ROOM_SCOPE_MISMATCH');
    return clean(result, token);
  }
  const catalogue = async actorId => clean(await buildCatalogue(actorId), token);
  return {connect, getState, catalogue, submit, readChat, sendChat};
}
