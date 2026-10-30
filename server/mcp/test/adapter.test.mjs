import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeAdapter, GAME_IDS, ROOM_GAMES, GROUP_GAMES} from '../native-adapter.mjs';

const token = 'player_'.padEnd(48, 'a');
function fixture(gameId, options = {}) {
  const group = GROUP_GAMES.has(gameId), rooms = ROOM_GAMES.has(gameId);
  const roomId = group || rooms ? 'room_a' : 'table';
  let revision = 2, writes = 0;
  const calls = [];
  const action = rooms ? {type: 'feature', actor: 'p1', option: 'hide', text: 'bonus', label: 'Hide'} : {type: 'rest'};
  const state = () => ({revision, actors: [{id: 'p1', side: 'party'}, {id: 'p2', side: 'party'}], legalActions: [action, {type: 'gm', text: 'forbidden'}], secret: token, note: token});
  const seat = {id: 'seat_a', name: 'Player', role: options.role || 'player', actors: ['p1']};
  async function nativeRequest(call) {
    calls.push(call);
    assert.equal(call.headers[group ? 'Authorization' : 'X-Seat-Token'], group ? `Bearer ${token}` : token);
    if (rooms) assert.equal(call.headers['X-Room-Id'], roomId);
    if (call.path.endsWith('/state')) return {status: 200, body: {state: state(), seat, ...(rooms ? {room: {id: options.wrongRoom ? 'room_b' : roomId, invite: token}} : group ? {roomId: options.wrongRoom ? 'room_b' : roomId} : {})}};
    if (call.path.startsWith('/api/actions?')) {
      if (call.path.endsWith('p2')) return {status: 403, body: {error: 'Not your actor'}};
      return {status: 200, body: [action, {type: 'gm', text: 'forbidden'}]};
    }
    if (call.path.endsWith('/actions')) return {status: 200, body: {revision, actions: [action]}};
    if (call.path.includes('/hub/chat')) return {status: 200, body: {roomId: options.wrongChat ? 'room_b' : roomId, seat, messages: [{text: call.body?.text || token}]}};
    if (call.path.endsWith('/command') || call.path.endsWith('/action')) {
      if (gameId === 'greek') assert.deepEqual(Object.keys(call.body).sort(), ['action', 'revision'], 'Greek rejects unknown envelope properties');
      if ((call.body.expectedRevision ?? call.body.revision) !== revision) return {status: 409, body: {error: 'State changed'}};
      writes++; revision++; return {status: 200, body: {ok: true}};
    }
    throw Error('Unexpected fixture path');
  }
  return {adapter: createNativeAdapter({gameId, roomId, token, nativeRequest}), calls, get writes() { return writes; }};
}

test('all 13 adapters use only native scope, projected player state and enumerated actions', async t => {
  for (const gameId of GAME_IDS) await t.test(gameId, async () => {
    const f = fixture(gameId), state = await f.adapter.getState();
    assert.equal(state.revision, 2); assert.ok(!JSON.stringify(state).includes(token)); assert.equal(state.state.secret, undefined);
    const listed = await f.adapter.catalogue();
    assert.equal(listed.actions.length, 1); assert.equal(listed.actions[0].action.type, ROOM_GAMES.has(gameId) ? 'feature' : 'rest');
    if (ROOM_GAMES.has(gameId)) assert.equal(listed.actions[0].action.text, 'bonus', 'native text parameters must not be dropped');
    assert.equal(f.writes, 0);
    const after = await f.adapter.submit({actionId: listed.actions[0].actionId, revision: 2, requestId: 'request_123456'});
    assert.equal(after.revision, 3); assert.equal(f.writes, 1);
    const write = f.calls.find(call => call.method === 'POST');
    if (ROOM_GAMES.has(gameId)) assert.equal(write.body.commandId, 'mcp:request_123456');
    else if (['mesopotamia', 'aztec'].includes(gameId)) assert.equal(write.body.expectedRevision, 2);
    else assert.equal(write.body.revision, 2);
    await assert.rejects(f.adapter.submit({actionId: listed.actions[0].actionId, revision: 2, requestId: 'request_123456'}), {status: 409});
    assert.equal(f.writes, 1, 'a retried stale mutation must not execute twice');
  });
});

test('simultaneous submissions leave final authority with native revision checking: at most one write', async () => {
  const f = fixture('norse'), listed = await f.adapter.catalogue();
  const body = {actionId: listed.actions[0].actionId, revision: listed.revision, requestId: 'concurrent_request_123'};
  const outcomes = await Promise.allSettled([f.adapter.submit(body), f.adapter.submit(body)]);
  assert.equal(f.writes, 1); assert.equal(outcomes.filter(outcome => outcome.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(outcome => outcome.status === 'rejected').reason.status, 409);
});

test('role, cross-room and forged action boundaries fail closed', async () => {
  for (const role of ['dm','host','manager','admin']) await assert.rejects(fixture('fengshen', {role}).adapter.getState(), {status: 403, code: 'PLAYER_SEAT_REQUIRED'});
  for (const gameId of ['fengshen','greek']) await assert.rejects(fixture(gameId, {wrongRoom: true}).adapter.getState(), {status: 403, code: 'ROOM_SCOPE_MISMATCH'});
  const f = fixture('norse');
  await assert.rejects(f.adapter.submit({actionId: 'a'.repeat(64), revision: 2, requestId: 'request_123456'}), {status: 409});
  assert.equal(f.writes, 0);
  assert.throws(() => createNativeAdapter({gameId: 'other', roomId: 'table', token, nativeRequest() {}}));
  assert.throws(() => createNativeAdapter({gameId: 'norse', roomId: 'other_table', token, nativeRequest() {}}));
  await assert.rejects(fixture('greek', {wrongChat: true}).adapter.readChat(), {code: 'ROOM_SCOPE_MISMATCH'});
});

test('chat stays independent of rules revisions and credentials are never returned', async () => {
  const f = fixture('japan');
  const messages = await f.adapter.readChat(); assert.ok(!JSON.stringify(messages).includes(token));
  const sent = await f.adapter.sendChat({text: '<img src=x> hello', requestId: 'chat_request_123456'});
  assert.equal(sent.messages[0].text, '<img src=x> hello'); assert.equal(f.writes, 0);
  await assert.rejects(f.adapter.sendChat({text: '', requestId: 'chat_request_123456'}));
  await assert.rejects(f.adapter.sendChat({text: token, requestId: 'chat_request_123456'}), {code: 'CREDENTIAL_IN_CHAT'});
  assert.equal((await f.adapter.sendChat({text: '🙂'.repeat(1000), requestId: 'chat_request_123457'})).messages[0].text, '🙂'.repeat(1000));
  await assert.rejects(f.adapter.sendChat({text: '🙂'.repeat(1001), requestId: 'chat_request_123458'}));
  await assert.rejects(f.adapter.readChat({cursor: -1}));
});

test('public action labels/text redact credentials without changing the internally submitted command', async () => {
  let submitted;
  const adapter = createNativeAdapter({gameId: 'norse', roomId: 'table', token, nativeRequest: async call => {
    if (call.path === '/api/state') return {status: 200, body: {seat: {id: 'seat', role: 'player'}, state: {revision: submitted ? 2 : 1, legalActions: [{type: 'choose', actorId: 'p1', choiceId: 'authored', text: token, label: token}]}}};
    if (call.path === '/api/action') {submitted = call.body.action; return {status: 200, body: {ok: true}};}
    throw Error('Unexpected fixture path');
  }});
  const listed = await adapter.catalogue(); assert.ok(!JSON.stringify(listed).includes(token));
  await adapter.submit({actionId: listed.actions[0].actionId, revision: 1, requestId: 'request_123456'});
  assert.equal(submitted.text, token, 'public redaction must not rewrite authoritative action semantics');
});
