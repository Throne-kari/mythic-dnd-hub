import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createMcpNativeRequest} from '../server/mcp-native-transport.mjs';

test('MCP native transport stays on the selected loopback game and strips untrusted headers', async () => {
  const received = [], server = http.createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    received.push({url: req.url, method: req.method, headers: req.headers, body});
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/redirect') { res.writeHead(302, {Location: 'https://untrusted.invalid/'}); res.end('{}'); }
    else if (req.url === '/api/invalid') res.end('not json');
    else if (req.url === '/api/large') res.end(JSON.stringify({value: 'x'.repeat(2 * 1024 * 1024)}));
    else res.end(JSON.stringify({ok: true}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const request = createMcpNativeRequest({game(id) { assert.equal(id, 'norse'); }, async start() { return {port}; }});
  try {
    const result = await request({gameId: 'norse', path: '/api/state', headers: {'X-Seat-Token': 'fixture-player', Host: 'untrusted.invalid', Origin: 'https://untrusted.invalid', Cookie: 'private', 'X-Forwarded-For': 'untrusted'}});
    assert.deepEqual(result, {status: 200, body: {ok: true}});
    assert.equal(received[0].headers.host, `127.0.0.1:${port}`);
    assert.equal(received[0].headers.origin, `http://127.0.0.1:${port}`);
    assert.equal(received[0].headers['x-seat-token'], 'fixture-player');
    assert.equal(received[0].headers.cookie, undefined);
    assert.equal(received[0].headers['x-forwarded-for'], undefined);
    await request({gameId: 'norse', path: '/api/action', method: 'POST', body: {action: {type: 'move'}}});
    assert.deepEqual(JSON.parse(received[1].body), {action: {type: 'move'}});
    assert.equal((await request({gameId: 'norse', path: '/api/redirect'})).status, 302);
    await assert.rejects(request({gameId: 'norse', path: '/api/invalid'}), /JSON/);
    await assert.rejects(request({gameId: 'norse', path: '/api/large'}));
    for (const path of ['https://untrusted.invalid/api/state', '//untrusted.invalid/api/state', '/manage/', '/api/state\r\nInjected: x']) await assert.rejects(request({gameId: 'norse', path}));
    await assert.rejects(request({gameId: 'norse', path: '/api/state', method: 'DELETE'}));
    await assert.rejects(request({gameId: 'norse', path: '/api/state', body: {bad: true}}));
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
