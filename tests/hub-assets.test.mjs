import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import {startHub} from '../server/hub.mjs';

test('shared UI and browser engine dependencies are explicitly served, not the server directory', async () => {
  const runtime = await fs.mkdtemp('/tmp/mythic-hub-assets-');
  const port = await new Promise(resolve => {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1', () => { const value = socket.address().port; socket.close(() => resolve(value)); });
  });
  Object.assign(process.env, {HOST: '127.0.0.1', PORT: String(port), HUB_RUNTIME_DIR: runtime, HUB_MANAGER: '0'});
  const hub = await startHub({management: false}), origin = `http://127.0.0.1:${port}`;
  const get = relative => fetch(new URL(relative, origin), {signal: AbortSignal.timeout(15000)});
  try {
    const catalog = await (await get('/api/catalog')).json();
    for (const {id} of catalog.games) {
      for (const [asset, type] of [['bridge.js', 'javascript'], ['social-ui.js', 'javascript'], ['social-ui.css', 'css']]) {
        const response = await get(`/play/${id}/__hub__/${asset}`);
        assert.equal(response.status, 200, `${id}: ${asset}`);
        assert.ok(response.headers.get('content-type').includes(type));
      }
    }
    for (const id of ['mesopotamia', 'aztec']) {
      const url = new URL(`/play/${id}/engine.mjs`, origin), response = await get(url);
      assert.equal(response.status, 200);
      const source = await response.text();
      const dependency = source.match(/from\s+['"]([^'"]*combat-ledger\.mjs)['"]/);
      assert.ok(dependency, `${id}: browser engine must retain its ledger dependency`);
      const moduleURL = new URL(dependency[1], url);
      assert.equal(moduleURL.pathname, '/server/combat-ledger.mjs');
      const module = await get(moduleURL);
      assert.equal(module.status, 200, `${id}: browser dependency must not 404`);
      assert.ok(module.headers.get('content-type').includes('javascript'));
      assert.doesNotMatch(await module.text(), /(?:from\s+|import\s*)['"]node:/, 'browser helper must not import Node-only modules');
    }
    for (const path of ['/server/hub.mjs', '/server/proxy.mjs', '/server/room-chat.mjs', '/api/manage/status']) {
      assert.equal((await get(path)).status, 404, `${path} must remain private`);
    }
  } finally {
    await hub.close(); await fs.rm(runtime, {recursive: true, force: true});
  }
});
