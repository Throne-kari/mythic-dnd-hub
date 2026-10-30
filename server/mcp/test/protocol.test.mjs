import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {Client, StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {createMcpHttpHandler} from '../index.mjs';

const token = 'player_'.padEnd(48, 'z');
async function setup() {
  let gateway, revision = 1, writes = 0;
  const seen = [];
  const server = http.createServer((req, res) => gateway.handle(req, res));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  gateway = createMcpHttpHandler({origin, nativeRequest: async call => {
    seen.push(call);
    if (call.headers['X-Seat-Token'] !== token) return {status: 401, body: {error: 'Invalid seat'}};
    if (call.path === '/api/state') return {status: 200, body: {seat: {id: 'p1_seat', name: 'Test player', role: 'player'}, state: {revision, legalActions: [{type: 'rest'}]}, secret: token}};
    if (call.path === '/api/action') {writes++; revision++; return {status: 200, body: {ok: true}};}
    if (call.path.startsWith('/api/hub/chat')) return {status: 200, body: {roomId: 'table_test', messages: [{text: call.body?.text || 'Hi'}]}};
    return {status: 404, body: {error: 'Unknown fixture path'}};
  }});
  return {origin, seen, get writes() {return writes;}, async close() {await gateway.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}};
}

test('official SDK client: discover, initialize compatibility, list and call six player tools', async () => {
  const f = await setup();
  const client = new Client({name: 'mythic-mcp-test', version: '1.0.0'});
  try {
    const transport = new StreamableHTTPClientTransport(new URL(f.origin + '/mcp/norse/table'), {requestInit: {headers: {Authorization: `Bearer ${token}`}}});
    await client.connect(transport);
    const list = await client.listTools();
    assert.deepEqual(list.tools.map(tool => tool.name).sort(), ['join_room','get_state','get_legal_actions','submit_action','read_chat','send_chat'].sort());
    for (const value of [list, await client.callTool({name: 'join_room', arguments: {}}), await client.callTool({name: 'get_state', arguments: {}})]) assert.ok(!JSON.stringify(value).includes(token));
    const listed = await client.callTool({name: 'get_legal_actions', arguments: {}});
    assert.equal(listed.structuredContent.revision, 1);
    const payload = {actionId: listed.structuredContent.actions[0].actionId, revision: 1, requestId: 'protocol_request_123'};
    const applied = await client.callTool({name: 'submit_action', arguments: payload});
    assert.equal(applied.structuredContent.revision, 2); assert.equal(f.writes, 1);
    const stale = await client.callTool({name: 'submit_action', arguments: payload});
    assert.equal(stale.isError, true); assert.equal(stale.structuredContent.status, 409); assert.equal(f.writes, 1);
    const chat = await client.callTool({name: 'send_chat', arguments: {text: 'hello room', requestId: 'protocol_chat_123'}});
    assert.equal(chat.structuredContent.messages[0].text, 'hello room');
    const forbidden = await client.callTool({name: 'get_state', arguments: {roomId: 'other'}});
    assert.equal(forbidden.isError, true, 'strict tool schema rejects cross-room arguments');
  } finally {await client.close(); await f.close();}
});

test('HTTP transport validates Origin, Host, credentials, path scope and legacy initialization', async () => {
  const f = await setup();
  const url = f.origin + '/mcp/norse/table';
  const base = {method: 'POST', headers: {Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc:'2.0', id:1, method:'initialize', params:{protocolVersion:'2025-11-25', capabilities:{}, clientInfo:{name:'legacy-test',version:'1'}}})};
  try {
    assert.equal((await fetch(url, base)).status, 401);
    const headers = {...base.headers, Authorization: `Bearer ${token}`};
    assert.equal((await fetch(url, {...base, headers: {...headers, Origin: 'https://attacker.invalid'}})).status, 403);
    const wrongHostStatus = await new Promise((resolve, reject) => {
      const request = http.request(url, {method: 'POST', headers: {...headers, Host: 'attacker.invalid'}}, response => {response.resume(); resolve(response.statusCode);});
      request.on('error', reject); request.end(base.body);
    });
    assert.equal(wrongHostStatus, 403);
    assert.equal((await fetch(url + '?token=' + token, {...base, headers})).status, 404);
    assert.equal((await fetch(f.origin + '/mcp/unknown/table', {...base, headers})).status, 404);
    const response = await fetch(url, {...base, headers}); assert.equal(response.status, 200);
    const responseText = await response.text();
    const packet = JSON.parse(response.headers.get('content-type').includes('text/event-stream') ? responseText.split('\n').find(line => line.startsWith('data: ')).slice(6) : responseText);
    assert.equal(packet.result.protocolVersion, '2025-11-25');
    assert.ok(!JSON.stringify(packet).includes(token));
    const method = await fetch(url, {method: 'GET', headers: {Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'MCP-Protocol-Version':'2025-11-25'}});
    assert.equal(method.status, 405, 'stateless legacy endpoint does not invent an SSE session');
  } finally {await f.close();}
});
