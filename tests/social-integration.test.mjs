import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { startHub } from '../server/hub.mjs';
import { createSessionController, describeSocialRequest } from '../server/social-ui.js';

const games = ['fengshen','japan','india','jaffa','acre','qchina','qjapan','qindia','mesopotamia','aztec','greek','norse','celtic'];
const partyGames = new Set(['mesopotamia','aztec']), tableGames = new Set(['norse','celtic']);
const roomGames = new Set(games.filter(id => !partyGames.has(id) && !tableGames.has(id) && id !== 'greek'));

test('13 games: shared UI adapter uses actual authenticated room chat and exposes no native credentials', async t => {
  const runtime = await fs.mkdtemp('/tmp/mythic-social-adapter-');
  const port = await new Promise(resolve => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => resolve(p)); }); });
  const origin = `http://127.0.0.1:${port}`;
  Object.assign(process.env, { HOST: '127.0.0.1', PORT: String(port), HUB_RUNTIME_DIR: runtime, HUB_MANAGER: '0' });
  const hub = await startHub({ management: false });
  const controllers = [];
  async function post(path, body, headers = {}) { const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, ...headers }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) }); const data = await response.json(); assert.ok(response.ok, `test setup endpoint failed (${response.status})`); return data; }
  const nativeFetch = (url, init) => fetch(url, { ...init, headers: { ...init.headers, ...(init.method === 'POST' ? { Origin: origin } : {}) } });
  try {
    for (const gameId of games) await t.test(gameId, async () => {
      const prefix = `/play/${gameId}`; let a, b, roomId, aPath, bPath;
      if (roomGames.has(gameId)) { aPath = '/api/rooms'; bPath = '/api/join'; a = await post(prefix + aPath, { name: 'UI adapter QA', displayName: 'Adapter A' }); b = await post(prefix + bPath, { invite: a.room.invite, displayName: 'Adapter B' }); roomId = a.room.id; }
      else if (partyGames.has(gameId)) { aPath = '/api/rooms'; a = await post(prefix + aPath, { name: 'Adapter A', roomName: 'UI adapter QA', mode: 'party' }); roomId = a.roomId; bPath = `/api/rooms/${roomId}/join`; b = await post(prefix + bPath, { name: 'Adapter B', characterId: a.state.party[1].id }); }
      else if (gameId === 'greek') { aPath = '/api/rooms'; a = await post(prefix + aPath, { name: 'Adapter A' }); roomId = a.roomId; bPath = `/api/rooms/${roomId}/join`; b = await post(prefix + bPath, { name: 'Adapter B', heroId: a.state.heroes[0].id }); }
      else { aPath = '/api/start'; a = await post(prefix + aPath, { requestId: randomUUID(), name: 'Adapter A' }); const actor = a.state.actors.filter(actor => actor.side === 'party').at(-1); b = await post(prefix + '/api/seats', { requestId: randomUUID(), name: 'Adapter B', actorIds: [actor.id] }, { 'X-Seat-Token': a.managementToken }); roomId = 'table'; bPath = '/api/state'; }
      const events = [];
      function controllerFor(data, path, serial) {
        const c = createSessionController({ gameId, prefix, origin, nativeFetch }); c.subscribe(event => events.push(event)); controllers.push(c);
        const token = data.token || data.seatToken;
        const isState = path === '/api/state';
        const request = describeSocialRequest(origin + prefix + path, { method: isState ? 'GET' : 'POST', ...(isState ? { headers: { 'X-Seat-Token': token } } : {}) }, { prefix, origin, serial });
        c.observe({ phase: 'request', request }); c.observe({ phase: 'response', request, ok: true, status: 200, value: data }); assert.ok(c.snapshot(), 'adapter must detect the accepted native session'); return c;
      }
      const ca = controllerFor(a, aPath, 1);
      let cb;
      if (tableGames.has(gameId)) { const response = await fetch(origin + prefix + '/api/state', { headers: { 'X-Seat-Token': b.seatToken } }); const packet = await response.json(); cb = controllerFor({ ...packet, seatToken: b.seatToken }, bPath, 2); }
      else cb = controllerFor(b, bPath, 2);
      const text = `UI adapter ${gameId} <img src=x onerror=alert(1)>`;
      const sent = await ca.request('chat', { body: { requestId: randomUUID(), text } });
      const read = await cb.request('chat', { cursor: 0 }); assert.ok(read.messages.some(message => message.text === text)); assert.ok(sent.messages.some(message => message.text === text)); assert.equal(read.roomId, sent.roomId);
      const state = await cb.request('state'); assert.deepEqual(Object.keys(state), ['state']); assert.deepEqual(Object.keys(state.state), ['battleReport']);
      for (const token of [a.token, a.seatToken, a.managementToken, b.token, b.seatToken].filter(Boolean)) assert.ok(!JSON.stringify(events).includes(token), 'public adapter observers must omit all native credentials');
      if (tableGames.has(gameId)) assert.ok(ca.snapshot().roomId.startsWith('table-')); else assert.equal(ca.snapshot().roomId, roomId);
      ca.dispose(); cb.dispose();
    });
  } finally { for (const controller of controllers) controller.dispose(); await hub.close(); await fs.rm(runtime, { recursive: true, force: true }); }
});
