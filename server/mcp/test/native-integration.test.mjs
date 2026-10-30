import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {Client, StreamableHTTPClientTransport} from '@modelcontextprotocol/client';
import {startHub} from '../../hub.mjs';
import {GAME_IDS, ROOM_GAMES} from '../native-adapter.mjs';

async function freePort() { const server = net.createServer(); server.listen(0, '127.0.0.1'); await once(server, 'listening'); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }

test('isolated native games: real MCP client connects and plays/chat in all 13 engines', {timeout: 180000}, async t => {
  const runtime = await fs.mkdtemp('/tmp/mythic-mcp-native-');
  const port = await freePort(), origin = `http://127.0.0.1:${port}`;
  Object.assign(process.env, {HOST: '127.0.0.1', PORT: String(port), PUBLIC_URL: origin, HUB_RUNTIME_DIR: runtime, HUB_MANAGER: '0'});
  const hub = await startHub({management: false});
  async function post(gameId, path, body, headers = {}) {
    const response = await fetch(origin + `/play/${gameId}` + path, {method: 'POST', headers: {'Content-Type': 'application/json', Origin: origin, ...headers}, body: JSON.stringify(body), signal: AbortSignal.timeout(15000)});
    const data = await response.json(); assert.ok(response.ok, `native ${gameId} ${path} setup rejected (${response.status}): ${JSON.stringify(data.error || data.message || '').slice(0,150)}`); return data;
  }
  try {
    for (const gameId of GAME_IDS) await t.test(gameId, async () => {
      let native, roomId, token;
      if (ROOM_GAMES.has(gameId)) {
        native = await post(gameId, '/api/rooms', {name: 'Isolated MCP QA', displayName: 'MCP player'});
        roomId = native.room.id;
        if (native.seat.role !== 'player') native = await post(gameId, '/api/join', {invite: native.room.invite, displayName: 'MCP player'});
        token = native.token;
        if (!native.seat.actors?.length) {
          native = await post(gameId, '/api/seat', {revision: native.state.revision, commandId: randomUUID(), actor: 'p1'}, {'X-Seat-Token': token, 'X-Room-Id': roomId});
        }
      } else if (gameId === 'greek') {
        native = await post(gameId, '/api/rooms', {name: 'MCP player'}); roomId = native.roomId;
        if (native.seat.role !== 'player') native = await post(gameId, `/api/rooms/${roomId}/join`, {name: 'MCP player', heroId: native.state.heroes[0].id});
        token = native.token;
      } else if (gameId === 'mesopotamia' || gameId === 'aztec') {
        native = await post(gameId, '/api/rooms', {name: 'MCP player', roomName: 'Isolated MCP QA', mode: 'party'});
        roomId = native.roomId; token = native.token;
      } else {
        native = await post(gameId, '/api/start', {requestId: randomUUID(), name: 'MCP player'});
        roomId = 'table'; token = native.seatToken;
      }
      assert.ok(token && roomId);
      const client = new Client({name: 'mythic-native-mcp-qa', version: '1.0.0'});
      try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`${origin}/mcp/${gameId}/${roomId}`), {requestInit: {headers: {Authorization: `Bearer ${token}`}}}));
        const joined = await client.callTool({name: 'join_room', arguments: {}});
        assert.notEqual(joined.isError, true, `MCP join failed: ${JSON.stringify(joined.structuredContent)}`);
        assert.equal(joined.structuredContent.seat.role, 'player'); assert.ok(!JSON.stringify(joined).includes(token));
        const listed = await client.callTool({name: 'get_legal_actions', arguments: {}});
        assert.notEqual(listed.isError, true, `MCP catalogue failed: ${JSON.stringify(listed.structuredContent)}`);
        const action = listed.structuredContent.actions.find(entry => entry.action.type === 'move') || listed.structuredContent.actions.find(entry => ['choice','choose','rest','travel'].includes(entry.action.type));
        assert.ok(action, 'native engine must expose at least one player action');
        const submitted = await client.callTool({name: 'submit_action', arguments: {actionId: action.actionId, revision: listed.structuredContent.revision, requestId: randomUUID()}});
        assert.notEqual(submitted.isError, true, `MCP submit failed: ${JSON.stringify(submitted.structuredContent)}`);
        assert.ok(submitted.structuredContent.revision > listed.structuredContent.revision);
        const text = `Isolated MCP QA ${gameId}`;
        const sent = await client.callTool({name: 'send_chat', arguments: {text, requestId: randomUUID()}});
        assert.notEqual(sent.isError, true, `MCP chat failed: ${JSON.stringify(sent.structuredContent)}`);
        const read = await client.callTool({name: 'read_chat', arguments: {}});
        assert.ok(read.structuredContent.messages.some(message => message.text === text));
        assert.ok(!JSON.stringify([listed, submitted, sent, read]).includes(token));
        let otherRoom = 'other_table';
        if (ROOM_GAMES.has(gameId)) otherRoom = (await post(gameId, '/api/rooms', {name: 'Isolated other room', displayName: 'Other room player'})).room.id;
        else if (gameId === 'greek') otherRoom = (await post(gameId, '/api/rooms', {name: 'Other room player'})).roomId;
        else if (gameId === 'mesopotamia' || gameId === 'aztec') otherRoom = (await post(gameId, '/api/rooms', {name: 'Other room player', mode: 'party'})).roomId;
        const crossRoom = await fetch(`${origin}/mcp/${gameId}/${otherRoom}`, {method: 'POST', headers: {Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json'}, body: JSON.stringify({jsonrpc: '2.0', id: 1, method: 'initialize', params: {protocolVersion: '2025-11-25', capabilities: {}, clientInfo: {name: 'cross-room-test', version: '1'}}})});
        assert.ok([401,403,404].includes(crossRoom.status), 'a real token must not enter a different native room');
        assert.ok(!(await crossRoom.text()).includes(token));
        if (native.managementToken) {
          const manager = await fetch(`${origin}/mcp/${gameId}/${roomId}`, {method: 'POST', headers: {Authorization: `Bearer ${native.managementToken}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json'}, body: '{}'});
          assert.equal(manager.status, 403, 'real table management credential cannot become an MCP player');
        }
      } finally {await client.close();}
    });
  } finally {
    await hub.close(); await fs.rm(runtime, {recursive: true, force: true});
  }
});
