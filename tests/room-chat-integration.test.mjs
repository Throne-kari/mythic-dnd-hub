import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {randomUUID} from 'node:crypto';
import {startHub} from '../server/hub.mjs';

const roomStoreGames = ['fengshen', 'japan', 'india', 'jaffa', 'acre', 'qchina', 'qjapan', 'qindia'];
const games = [...roomStoreGames, 'mesopotamia', 'aztec', 'greek', 'norse', 'celtic'];
const secrets = new Set();
const remember = value => {
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) {
    if (/token|invite/i.test(key) && typeof child === 'string' && child) secrets.add(child);
    else remember(child);
  }
  return value;
};
const redact = value => {
  let text = String(value);
  for (const secret of secrets) text = text.split(secret).join('[redacted]');
  return text.replace(/[A-Za-z0-9_-]{30,}/g, '[redacted]').slice(0, 300);
};
const revision = value => value.state?.revision ?? value.revision;
const randomPort = () => new Promise((resolve, reject) => {
  const socket = net.createServer(); socket.on('error', reject);
  socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => resolve(port)); });
});

test('13 native game protocols enforce room-scoped chat and server-verified identities', {timeout: 120000}, async t => {
  const runtime = await fs.mkdtemp('/tmp/mythic-chat-integration-'), port = await randomPort(), origin = `http://127.0.0.1:${port}`;
  Object.assign(process.env, {HOST: '127.0.0.1', PORT: String(port), HUB_MANAGER: '0', HUB_RUNTIME_DIR: runtime});
  let hub = await startHub({management: false});
  const sessions = new Map();
  async function request(url, body, headers = {}, expected = 200) {
    const response = await fetch(url, {method: body === undefined ? 'GET' : 'POST', headers: {Origin: origin, ...(body === undefined ? {} : {'Content-Type': 'application/json'}), ...headers}, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000)});
    const value = remember(await response.json().catch(() => ({})));
    if (response.status !== expected) throw Error(`Expected HTTP ${expected}; got ${response.status}: ${redact(value.error?.message || value.error || value.message || 'request failed')}`);
    return value;
  }
  async function setup(game) {
    const api = `${origin}/play/${game}/api`;
    if (roomStoreGames.includes(game)) {
      const a = await request(api + '/rooms', {name: 'Chat QA A', displayName: '真人甲'});
      // Public join ignores attempted identity elevation; only the owner can register AI seats.
      const b = await request(api + '/join', {invite: a.room.invite, displayName: '真人乙', kind: 'api', role: 'dm'});
      assert.equal(b.seat.kind, 'human'); assert.equal(b.seat.role, 'player');
      const other = await request(api + '/rooms', {name: 'Chat QA isolated', displayName: '别房玩家'});
      return {api, chat: api + '/hub/chat', state: api + '/state', a, b, other,
        ah: {'X-Seat-Token': a.token, 'X-Room-Id': a.room.id}, bh: {'X-Seat-Token': b.token, 'X-Room-Id': b.room.id}, oh: {'X-Seat-Token': other.token, 'X-Room-Id': other.room.id}, otherChat: api + '/hub/chat'};
    }
    if (['mesopotamia', 'aztec'].includes(game)) {
      const a = await request(api + '/rooms', {name: '真人甲', roomName: 'Chat QA A', mode: 'party'}, {}, 201);
      const hero = a.state.party.find(character => character.id !== a.characterId);
      const b = await request(`${api}/rooms/${a.roomId}/join`, {name: '真人乙', characterId: hero.id}, {}, 201);
      const other = await request(api + '/rooms', {name: '别房玩家', roomName: 'Chat QA isolated', mode: 'party'}, {}, 201);
      return {api, chat: `${api}/rooms/${a.roomId}/hub/chat`, state: `${api}/rooms/${a.roomId}/state`, a, b, other,
        ah: {Authorization: `Bearer ${a.token}`}, bh: {Authorization: `Bearer ${b.token}`}, oh: {Authorization: `Bearer ${other.token}`}, otherChat: `${api}/rooms/${other.roomId}/hub/chat`};
    }
    if (game === 'greek') {
      const a = await request(api + '/rooms', {name: '真人甲'}, {}, 201);
      const b = await request(`${api}/rooms/${a.roomId}/join`, {name: '真人乙', heroId: a.state.heroes[0].id}, {}, 201);
      const other = await request(api + '/rooms', {name: '别房玩家'}, {}, 201);
      return {api, chat: `${api}/rooms/${a.roomId}/hub/chat`, state: `${api}/rooms/${a.roomId}/state`, a, b, other,
        ah: {Authorization: `Bearer ${a.token}`}, bh: {Authorization: `Bearer ${b.token}`}, oh: {Authorization: `Bearer ${other.token}`}, otherChat: `${api}/rooms/${other.roomId}/hub/chat`};
    }
    const a = await request(api + '/start', {requestId: randomUUID(), name: '真人甲'}, {}, 201);
    const actor = a.state.actors.filter(character => character.side === 'party').at(-1);
    const b = await request(api + '/seats', {requestId: randomUUID(), name: '真人乙', actorIds: [actor.id]}, {'X-Seat-Token': a.managementToken});
    return {api, chat: api + '/hub/chat', state: api + '/state', a, b,
      ah: {'X-Seat-Token': a.seatToken}, bh: {'X-Seat-Token': b.seatToken}};
  }
  try {
    for (const game of games) await t.test(game, async () => {
      const session = await setup(game); sessions.set(game, session);
      const {api, chat, state, ah, bh, oh, otherChat} = session;
      const before = await request(state, undefined, ah);
      assert.deepEqual((await request(chat, undefined, ah)).messages, []);
      await request(chat, undefined, {}, 401);
      const body = {requestId: randomUUID(), text: `<script>not executable</script> ${game} 公开消息`};
      const sent = await request(chat, body, ah);
      assert.equal(sent.message.name, '真人甲'); assert.equal(sent.message.kind, 'human');
      assert.equal(sent.message.text, body.text);
      const otherSeat = await request(chat, undefined, bh);
      assert.equal(otherSeat.messages[0].text, body.text); assert.notEqual(otherSeat.seat.id, sent.seat.id);
      const reply = await request(chat, {requestId: randomUUID(), text: '真人乙回复'}, bh);
      assert.equal(reply.message.seatId, otherSeat.seat.id);
      const repeat = await request(chat, body, ah); assert.equal(repeat.duplicate, true); assert.equal(repeat.message.id, sent.message.id);
      const conflict = await request(chat, {...body, text: 'conflicting retry'}, ah, 409);
      assert.ok(Object.keys(conflict).every(key => ['error', 'ok', 'revision'].includes(key)), 'chat errors must not append a native game view');
      if (roomStoreGames.includes(game)) assert.deepEqual(Object.keys(conflict).sort(), ['error', 'ok']);
      for (const secret of secrets) assert.ok(!JSON.stringify(conflict).includes(secret), 'chat conflicts must not include native credentials');
      await request(chat, {requestId: randomUUID(), text: 'forged', name: 'GM', kind: 'agent', seatId: 'other'}, ah, 400);
      await request(chat, {requestId: randomUUID(), text: 'wrong room', roomId: 'other'}, ah, 400);
      await request(chat, {requestId: randomUUID(), text: '字'.repeat(1001)}, ah, 413);
      await request(chat, {requestId: 'x'.repeat(97), text: 'oversized id'}, ah, 400);
      await request(chat, {requestId: randomUUID(), text: '\0control'}, ah, 400);
      await request(chat + '?cursor=-1', undefined, ah, 400);
      await request(chat + '?limit=101', undefined, ah, 400);
      await request(chat, {requestId: randomUUID(), text: 'cross origin'}, {...ah, Origin: 'https://unrelated.example'}, 403);
      if (otherChat) {
        assert.deepEqual((await request(otherChat, undefined, oh)).messages, []);
        if (otherChat !== chat) await request(otherChat, undefined, ah, 401);
        if (roomStoreGames.includes(game)) await request(chat, undefined, {...ah, 'X-Room-Id': session.other.room.id}, 401);
      }
      for (let i = 0; i < 4; i++) await request(chat, {requestId: randomUUID(), text: `rate ${i}`}, ah);
      await request(chat, {requestId: randomUUID(), text: 'sixth'}, ah, 429);
      assert.equal(revision(await request(state, undefined, ah)), revision(before), 'chat must not mutate game revision');
      const serialized = JSON.stringify(await request(chat, undefined, bh));
      for (const secret of secrets) assert.ok(!serialized.includes(secret), 'chat response must not contain credentials');
      if (roomStoreGames.includes(game)) {
        const current = await request(state, undefined, ah);
        const registered = await request(api + '/seats', {commandId: randomUUID(), revision: revision(current), name: '受权AI席位', kind: 'workspace', role: 'player', actors: []}, ah);
        const ai = await request(chat, {requestId: randomUUID(), text: '受权agent的公开发言'}, {'X-Seat-Token': registered.createdSeatToken});
        assert.equal(ai.message.kind, 'agent'); assert.equal(ai.message.name, '受权AI席位');
      }
    });
    await t.test('browser engine imports expose only the pure combat helper allowlist', async () => {
      for (const game of ['mesopotamia', 'aztec']) {
        const native = `http://127.0.0.1:${hub.processes.entry(game).port}`;
        for (const base of [native, `${origin}/play/${game}`]) {
          const response = await fetch(base + '/server/combat-ledger.mjs', {signal: AbortSignal.timeout(10000)});
          assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /javascript/);
          const source = await response.text(); assert.match(source, /export function captureBattleTransition/); assert.ok(!source.includes("from 'node:"));
          const head = await fetch(base + '/server/combat-ledger.mjs', {method: 'HEAD', signal: AbortSignal.timeout(10000)}); assert.equal(head.status, 200);
          assert.equal((await fetch(base + '/server/room-chat.mjs', {signal: AbortSignal.timeout(10000)})).status, 404);
          assert.equal((await fetch(base + '/server/hub.mjs', {signal: AbortSignal.timeout(10000)})).status, 404);
          assert.equal((await fetch(base + '/server/combat-ledger.mjs', {method: 'POST', signal: AbortSignal.timeout(10000)})).status, 405);
        }
      }
    });
    await t.test('game namespaces reject other-game seats', async () => {
      const source = sessions.get('fengshen'), target = sessions.get('japan');
      await request(target.chat, undefined, source.ah, 401);
      await request(sessions.get('celtic').chat, undefined, sessions.get('norse').ah, 401);
    });
    await t.test('private sidecars contain no native credentials and survive a gateway restart', async () => {
      async function check(directory) {
        for (const entry of await fs.readdir(directory, {withFileTypes: true})) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) await check(file);
          else if (path.basename(path.dirname(file)) === '.hub-chat') {
            const content = await fs.readFile(file, 'utf8');
            for (const secret of secrets) assert.ok(!content.includes(secret), 'chat sidecar must not persist native credentials');
          }
        }
      }
      await check(runtime); await hub.close(); hub = await startHub({management: false});
      for (const game of ['fengshen', 'mesopotamia', 'aztec', 'greek']) {
        const session = sessions.get(game), restored = await request(session.chat, undefined, session.ah);
        assert.ok(restored.messages.some(value => value.text.includes(game + ' 公开消息')), `${game} chat history should restore`);
      }
      const old = sessions.get('norse'); await request(old.chat, undefined, old.ah, 401);
      const newSeat = await request(old.api + '/start', {requestId: randomUUID(), name: '新桌玩家'}, {}, 201);
      assert.deepEqual((await request(old.chat, undefined, {'X-Seat-Token': newSeat.seatToken})).messages, []);
    });
  } finally {
    await hub.close(); await fs.rm(runtime, {recursive: true, force: true});
  }
});
