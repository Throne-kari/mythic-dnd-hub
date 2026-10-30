import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {RoomChat, chatIdentity} from '../server/room-chat.mjs';

const a = {id: 'seat-a', name: '同伴甲', kind: 'human', token: 'dummy-private-token', managementToken: 'dummy-private-manager'};
const b = {id: 'seat-b', name: '同行乙', kind: 'human'};
const message = text => ({requestId: randomUUID(), text});
const status = expected => error => error.status === expected;
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'mythic-chat-unit-'));

test('authenticated seat determines public identity; hidden fields never enter a message', () => {
  const chat = new RoomChat(), sent = chat.send('one', a, message('<img src=x onerror=alert(1)>'));
  assert.deepEqual(sent.seat, {id: a.id, name: a.name, kind: 'human'});
  assert.equal(sent.message.text, '<img src=x onerror=alert(1)>');
  assert.deepEqual(Object.keys(sent.message).sort(), ['at', 'id', 'kind', 'name', 'seatId', 'text']);
  assert.ok(!JSON.stringify(sent).includes('dummy-private'));
  assert.throws(() => chat.send('one', a, {...message('forged'), name: 'GM', kind: 'agent', sender: 'other'}), status(400));
  assert.equal(chatIdentity({...b, kind: 'workspace'}).kind, 'agent');
  assert.equal(chatIdentity({...b, agent: true}).kind, 'agent');
  assert.equal(chatIdentity({...b, name: '甲\n乙'}).name, '甲 乙');
});

test('same room shares messages, other rooms are isolated, and reads cannot edit stored text', () => {
  const chat = new RoomChat(); chat.send('one', a, message('room one'));
  const read = chat.read('one', b); assert.equal(read.messages[0].seatId, a.id);
  read.messages[0].text = 'mutated'; assert.equal(chat.read('one', b).messages[0].text, 'room one');
  assert.deepEqual(chat.read('two', b).messages, []);
});

test('request IDs deduplicate before rate limiting and conflict on changed content', () => {
  const chat = new RoomChat({rateLimit: 1}), body = message('once');
  const sent = chat.send('one', a, body), again = chat.send('one', a, body);
  assert.equal(again.duplicate, true); assert.equal(again.message.id, sent.message.id);
  assert.equal(again.messages.length, 1);
  assert.throws(() => chat.send('one', a, {...body, text: 'different'}), status(409));
  assert.throws(() => chat.send('one', a, message('too fast')), status(429));
});

test('text, identity, query and request-ID boundaries reject invalid requests', () => {
  const chat = new RoomChat({rateLimit: 20});
  for (const body of [[], null, {}, {text: 'x', requestId: 'x'}, {text: 'x', requestId: 'a'.repeat(97)}, {...message('x'), roomId: 'other'}, message(''), message('\0x')]) assert.throws(() => chat.send('one', a, body), status(400));
  assert.throws(() => chat.send('one', a, message('字'.repeat(1001))), status(413));
  assert.equal(chat.send('one', a, message('🦋'.repeat(1000))).message.text.length, 2000);
  assert.throws(() => chat.read('one', {}), status(401));
  for (const query of [{cursor: -1}, {cursor: 'NaN'}, {limit: 0}, {limit: 101}, {limit: []}]) assert.throws(() => chat.read('one', a, query), status(400));
});

test('rate limits are per verified seat and room, expire, and do not block safe retry', () => {
  let now = 100000; const chat = new RoomChat({now: () => now}); const first = message('first');
  chat.send('one', a, first); for (let i = 0; i < 4; i++) chat.send('one', a, message(String(i)));
  assert.throws(() => chat.send('one', a, message('six')), status(429));
  assert.equal(chat.send('one', a, first).duplicate, true);
  assert.equal(chat.send('one', b, message('other seat')).duplicate, false);
  assert.equal(chat.send('two', a, message('other room')).duplicate, false);
  now += 10001; assert.equal(chat.send('one', a, message('after wait')).duplicate, false);
});

test('history is bounded; pagination and reset report gaps without mixing rooms', () => {
  const chat = new RoomChat({historyLimit: 2});
  for (let i = 0; i < 3; i++) chat.send('one', a, message(`line ${i}`));
  const snapshot = chat.read('one', b, {cursor: 0, limit: 1});
  assert.equal(snapshot.reset, true); assert.equal(snapshot.messages.length, 1); assert.equal(snapshot.cursor, 3);
  const next = chat.read('one', b, {cursor: 2}); assert.equal(next.messages[0].id, 3);
  assert.equal(chat.read('one', b, {cursor: 3}).messages.length, 0);
  assert.equal(chat.read('one', b, {cursor: 99}).reset, true);
  assert.equal(chat.read('one', b).messages.length, 2);
});

test('LRU eviction reloads private, bounded atomic sidecars without tokens', () => {
  const directory = temp();
  try {
    const chat = new RoomChat({directory, cacheLimit: 2});
    for (const room of ['one', 'two', 'three']) chat.send(room, a, message(room));
    assert.equal(chat.rooms.size, 2); assert.equal(chat.read('one', b).messages[0].text, 'one');
    const files = fs.readdirSync(directory); assert.equal(files.length, 3);
    for (const name of files) {
      const file = path.join(directory, name); assert.equal(fs.statSync(file).mode & 0o777, 0o600);
      assert.ok(!fs.readFileSync(file, 'utf8').includes('dummy-private'));
    }
    const restored = new RoomChat({directory}); assert.equal(restored.read('one', b).messages[0].name, a.name);
  } finally { fs.rmSync(directory, {recursive: true, force: true}); }
});

test('oversized, symlink and unknown-field sidecars are rejected before content exposure', () => {
  const directory = temp(), external = temp(), file = path.join(directory, createHash('sha256').update('one').digest('hex') + '.json');
  try {
    fs.writeFileSync(file, ' '.repeat(2 * 1024 * 1024 + 1));
    assert.throws(() => new RoomChat({directory}).read('one', a), status(500)); fs.unlinkSync(file);
    const outside = path.join(external, 'private.json'); fs.writeFileSync(outside, 'private-content'); fs.symlinkSync(outside, file);
    assert.throws(() => new RoomChat({directory}).read('one', a), status(500)); fs.unlinkSync(file);
    const chat = new RoomChat({directory}); chat.send('one', a, message('safe'));
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')); saved.messages[0].token = 'must-not-return'; fs.writeFileSync(file, JSON.stringify(saved));
    assert.throws(() => new RoomChat({directory}).read('one', a), status(500));
  } finally { fs.rmSync(directory, {recursive: true, force: true}); fs.rmSync(external, {recursive: true, force: true}); }
});
