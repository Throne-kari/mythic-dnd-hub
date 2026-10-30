import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createSessionController, describeSocialRequest, extractBattleReport, eventText, mountSocialUI } from '../server/social-ui.js';

const origin = 'https://table.example';
const games = ['fengshen','japan','india','jaffa','acre','qchina','qjapan','qindia','mesopotamia','aztec','greek','norse','celtic'];
const group = id => ['mesopotamia','aztec','greek'].includes(id);
const table = id => ['norse','celtic'].includes(id);
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
const sampleReport = () => ({ schema: 1, currentBattleId: 'battle-1', events: [{ id: 'event-1', seq: 1, battleId: 'battle-1', kind: 'damage', actorId: 'p1', actorName: '持剑者', targetId: 'e1', targetName: '公开敌人', method: '长剑', amount: 6, text: '持剑者使用长剑，对公开敌人造成 6 点实际伤害。' }], summaries: [] });
function establish(controller, gameId, { serial = 1, roomId = 'room-a', token = 'synthetic-player-a', seatId = 'seat-a', name = '同行甲', kind = 'human', report = sampleReport() } = {}) {
  const prefix = `/play/${gameId}`;
  const path = table(gameId) ? '/api/start' : '/api/rooms';
  const request = describeSocialRequest(origin + prefix + path, { method: 'POST' }, { prefix, origin, serial });
  const value = { roomId, room: { id: roomId, invite: 'must-not-reach-ui' }, token, seatToken: token, managementToken: 'must-not-reach-ui', seat: { id: seatId, name, kind }, state: { battleReport: report, gmOnly: 'must-not-reach-ui' } };
  controller.observe({ phase: 'request', request }); controller.observe({ phase: 'response', request, ok: true, status: 201, value });
  return request;
}

for (const gameId of games) test(`${gameId}: verified player session, native auth, correct room paths and no credential exposure`, async () => {
  const calls = [], events = [];
  const c = createSessionController({ gameId, prefix: `/play/${gameId}`, origin, nativeFetch: async (url, init) => { calls.push({ url, init }); return json(url.includes('/hub/chat') ? { ok: true, roomId: table(gameId) ? 'table-isolated-opaque' : 'room-a', seat: { id: 'seat-a', name: '同行甲', kind: 'human' }, messages: [], cursor: 0 } : { seat: { id: 'seat-a' }, state: { battleReport: sampleReport(), token: 'must-not-reach-ui', gmOnly: 'must-not-reach-ui' } }); } });
  c.subscribe(event => events.push(event)); establish(c, gameId);
  assert.equal(c.snapshot().seat.id, 'seat-a');
  await c.request('chat', { cursor: 0 }); const state = await c.request('state');
  const expected = group(gameId) ? `/play/${gameId}/api/rooms/room-a/` : `/play/${gameId}/api/`;
  assert.ok(calls.every(call => new URL(call.url).pathname.startsWith(expected)));
  const headers = calls[0].init.headers;
  assert.equal(group(gameId) ? headers.Authorization : headers['X-Seat-Token'], group(gameId) ? 'Bearer synthetic-player-a' : 'synthetic-player-a');
  assert.ok(!JSON.stringify(events).includes('must-not-reach-ui')); assert.ok(!JSON.stringify(c.snapshot()).includes('synthetic-player-a')); assert.ok(!JSON.stringify(state).includes('must-not-reach-ui'));
  if (table(gameId)) assert.equal(c.snapshot().roomId, 'table-isolated-opaque');
  c.dispose();
});

test('only supported same-origin game-session paths are observed; creating another seat never captures its token', () => {
  const options = { prefix: '/play/norse', origin, serial: 1 };
  assert.equal(describeSocialRequest('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: 'Bearer unrelated-synthetic' } }, options), null);
  assert.equal(describeSocialRequest(origin + '/play/norse/api/seats', { method: 'POST' }, options), null);
  assert.equal(describeSocialRequest(origin + '/play/norse/api/agent/request', { method: 'POST' }, options), null);
  const request = new Request(origin + '/play/norse/api/state', { headers: { 'X-Seat-Token': 'old' } });
  assert.equal(describeSocialRequest(request, { headers: { 'X-Seat-Token': 'new' } }, options).token, 'new');
});

test('switching rooms immediately clears scope; stale replies and repeated leave events cannot restore it', async () => {
  const events = [], c = createSessionController({ gameId: 'fengshen', prefix: '/play/fengshen', origin, nativeFetch: async () => json({}) });
  c.subscribe(event => events.push(event)); establish(c, 'fengshen');
  const request = describeSocialRequest(origin + '/play/fengshen/api/join', { method: 'POST' }, { prefix: '/play/fengshen', origin, serial: 2 });
  c.observe({ phase: 'request', request }); assert.equal(c.snapshot(), null);
  const older = describeSocialRequest(origin + '/play/fengshen/api/state', { headers: { 'X-Seat-Token': 'synthetic-player-a', 'X-Room-Id': 'room-a' } }, { prefix: '/play/fengshen', origin, serial: 1 });
  c.observe({ phase: 'response', request: older, ok: true, value: { room: { id: 'room-a' }, seat: { id: 'seat-a' } } }); assert.equal(c.snapshot(), null);
  c.observe({ phase: 'response', request, ok: true, value: { token: 'synthetic-player-b', room: { id: 'room-b' }, seat: { id: 'seat-b', name: '同行乙' }, state: { battleReport: sampleReport() } } }); assert.equal(c.snapshot().roomId, 'room-b');
  for (let i = 0; i < 5; i++) c.observe({ phase: 'leave' }); assert.equal(c.snapshot(), null);
  establish(c, 'fengshen', { serial: 3, roomId: 'room-c' }); assert.equal(c.snapshot().roomId, 'room-c');
  assert.ok(events.some(event => event.type === 'session' && event.session === null)); c.dispose();
});

test('failed seat switch restores the previously accepted room, but a successful expiry clears credentials', async () => {
  let status = 200;
  const c = createSessionController({ gameId: 'norse', prefix: '/play/norse', origin, nativeFetch: async () => json({ error: { message: '会话过期' } }, status) }); establish(c, 'norse');
  const request = describeSocialRequest(origin + '/play/norse/api/state', { headers: { 'X-Seat-Token': 'invalid-candidate' } }, { prefix: '/play/norse', origin, serial: 2 });
  c.observe({ phase: 'request', request }); assert.equal(c.snapshot(), null); c.observe({ phase: 'response', request, ok: false, status: 401 }); assert.equal(c.snapshot().seat.id, 'seat-a');
  status = 401; await assert.rejects(c.request('state'), { status: 401 }); assert.equal(c.snapshot(), null); c.dispose();
});

test('room mismatch is rejected rather than rendering a different room chat', async () => {
  const c = createSessionController({ gameId: 'aztec', prefix: '/play/aztec', origin, nativeFetch: async () => json({ ok: true, roomId: 'different-room', messages: [{ id: 1, text: 'must-not-display' }] }) }); establish(c, 'aztec');
  await assert.rejects(c.request('chat'), /房间响应不匹配/); c.dispose();
});

test('battle extraction only accepts normalized reports and preserves actual server text', () => {
  assert.equal(extractBattleReport({ log: [{ text: 'GM-only clue' }] }), null);
  assert.equal(extractBattleReport({ battleReport: { schema: 9 } }), null);
  assert.equal(extractBattleReport({ state: { battleReport: sampleReport() } }).events[0].amount, 6);
  assert.equal(eventText({ text: '<script>not executed</script>' }), '<script>not executed</script>');
  assert.match(eventText({ kind: 'damage', actorName: 'A', targetName: 'B', amount: 3 }), /实际损失 3/);
});

class Element {
  constructor(document, tag = '') { this.ownerDocument = document; this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null; this.attributes = new Map(); this.dataset = {}; this.events = new Map(); this._text = ''; this.value = ''; this.hidden = false; this.disabled = false; this.className = ''; this.scrollTop = 0; this.clientHeight = 240; this.style = { cssText: '', setProperty(name, value) { this[name] = value; } }; }
  set textContent(text) { this._text = String(text); for (const child of this.children) child.parentNode = null; this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw new Error('Untrusted HTML insertion is forbidden'); }
  append(...children) { for (const child of children) { child.remove(); child.parentNode = this; this.children.push(child); } }
  replaceChildren(...children) { for (const child of this.children) child.parentNode = null; this.children = []; this._text = ''; this.append(...children); }
  remove() { if (this.parentNode) { const i = this.parentNode.children.indexOf(this); if (i >= 0) this.parentNode.children.splice(i, 1); this.parentNode = null; } }
  get isConnected() { return this === this.ownerDocument.body || Boolean((this.parentNode || this.host)?.isConnected); }
  get scrollHeight() { return this.children.length * 60; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); if (name === 'id') this.id = String(value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  addEventListener(name, fn) { const listeners = this.events.get(name) || []; listeners.push(fn); this.events.set(name, listeners); }
  removeEventListener(name, fn) { this.events.set(name, (this.events.get(name) || []).filter(x => x !== fn)); }
  async emit(name, detail = {}) { const event = { type: name, target: this, preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, ...detail }; await Promise.all((this.events.get(name) || []).map(fn => fn(event))); return event; }
  focus() { this.ownerDocument.activeElement = this; }
  matches(selector) { return selector.startsWith('.') ? this.className.split(/\s+/).includes(selector.slice(1)) : selector.startsWith('#') ? this.id === selector.slice(1) : this.tagName.toLowerCase() === selector.toLowerCase(); }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  querySelectorAll(selector) { const result = []; for (const child of this.children) { if (child.matches(selector)) result.push(child); result.push(...child.querySelectorAll(selector)); } return result; }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  attachShadow() { this.shadowRoot = new Element(this.ownerDocument, '#shadow-root'); this.shadowRoot.host = this; return this.shadowRoot; }
}
function documentMock() {
  const doc = { readyState: 'complete', visibilityState: 'visible', events: new Map(), createElement(tag) { return new Element(this, tag); }, createTextNode(text) { const node = new Element(this, '#text'); node.textContent = text; return node; }, addEventListener(name, fn) { const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list); }, querySelector(selector) { return this.body.querySelector(selector); }, getElementById(id) { return this.querySelector('#' + id); } };
  doc.body = doc.createElement('body'); doc.body.classList = { contains() { return false; } }; doc.documentElement = doc.createElement('html'); return doc;
}
function uiServer() {
  let report = sampleReport(), posts = 0, pendingPost = null;
  const chat = new Map([['room-a', [{ id: 1, at: '2026-10-30T12:00:00Z', seatId: 'other', name: '<b>同行者</b>', kind: 'agent', text: '<img src=x onerror=alert(1)>纯文本' }]], ['room-b', []]]);
  return { get posts() { return posts; }, setReport(next) { report = next; }, deferPost() { pendingPost = {}; pendingPost.promise = new Promise(resolve => { pendingPost.resolve = resolve; }); }, releasePost() { pendingPost?.resolve(); pendingPost = null; }, calls: [], async fetch(url, init) { this.calls.push({ url, init }); const roomId = init.headers['X-Room-Id'] || 'room-a'; if (url.includes('/hub/chat')) { if (init.method === 'POST') { posts++; const body = JSON.parse(init.body); assert.deepEqual(Object.keys(body).sort(), ['requestId','text']); if (pendingPost) await pendingPost.promise; const list = chat.get(roomId) || []; list.push({ id: list.length + 1, at: '2026-10-30T12:00:01Z', seatId: 'seat-a', name: '同行甲', kind: 'human', text: body.text }); chat.set(roomId, list); } const messages = chat.get(roomId) || []; return json({ ok: true, roomId, seat: { id: 'seat-a', name: '同行甲', kind: 'human' }, messages, cursor: messages.length, reset: false }); } return json({ state: { battleReport: report } }); } };
}

test('inline drawer: repeated open/close, keyboard tabs, text-only messages, duplicate-send guard and room clearing', async t => {
  const doc = documentMock(), server = uiServer(); const ui = mountSocialUI({ gameId: 'fengshen', prefix: '/play/fengshen', origin, nativeFetch: server.fetch.bind(server), document: doc }); t.after(() => ui.dispose());
  establish(ui.controller, 'fengshen'); await pause(); await pause();
  const host = doc.getElementById('mythic-social-ui'), shadow = host.shadowRoot, launcher = shadow.querySelector('.social-launcher'), panel = shadow.querySelector('.social-panel'), close = shadow.querySelector('.social-close');
  assert.ok(host); assert.equal(panel.hidden, true); assert.equal(shadow.querySelector('textarea').disabled, false);
  assert.match(shadow.querySelector('.message-text').textContent, /<img src=x/); assert.equal(shadow.querySelector('img'), null); assert.equal(shadow.querySelector('script'), null); assert.ok(shadow.textContent.includes('AI'));
  for (let i = 0; i < 5; i++) { await launcher.emit('click'); assert.equal(panel.hidden, false); assert.equal(launcher.getAttribute('aria-expanded'), 'true'); await close.emit('click'); assert.equal(panel.hidden, true); assert.equal(doc.activeElement, launcher); }
  assert.equal(doc.body.children.filter(x => x.id === 'mythic-social-ui').length, 1);
  for (const key of [' ', '1', '2', '3', '4', 'm', 'a', 'h', 'g', 'Tab', 'ArrowUp']) { const event = await shadow.emit('keydown', { key, code: key === ' ' ? 'Space' : key }); assert.equal(event.stopped, true, 'original game keyboard shortcuts must not see composer keys'); assert.notEqual(event.prevented, true, 'ordinary typing and Tab retain native behavior'); }
  for (const name of ['keyup', 'keypress', 'click', 'pointerdown', 'wheel', 'touchmove']) assert.equal((await shadow.emit(name)).stopped, true);
  await launcher.emit('click'); const tabs = shadow.querySelectorAll('.social-tab'); await tabs[0].emit('keydown', { key: 'ArrowRight' }); assert.equal(tabs[1].getAttribute('aria-selected'), 'true'); assert.equal(doc.activeElement, tabs[1]); await tabs[1].emit('keydown', { key: 'End' }); assert.equal(tabs[2].getAttribute('aria-selected'), 'true'); await shadow.emit('keydown', { key: 'Escape' }); assert.equal(panel.hidden, true);
  await launcher.emit('click'); await tabs[0].emit('click'); const textarea = shadow.querySelector('textarea'), form = shadow.querySelector('form'); textarea.value = '你好，<script>纯文本</script>'; await textarea.emit('input'); server.deferPost(); const first = form.emit('submit'); const second = form.emit('submit'); assert.equal(server.posts, 1); server.releasePost(); await Promise.all([first, second]); assert.equal(server.posts, 1); assert.equal(textarea.value, ''); assert.equal(shadow.querySelector('script'), null);
  const request = describeSocialRequest(origin + '/play/fengshen/api/join', { method: 'POST' }, { prefix: '/play/fengshen', origin, serial: 2 }); ui.observe({ phase: 'request', request }); assert.equal(shadow.querySelector('.message-text'), null); assert.equal(textarea.disabled, true); server.setReport({ schema: 1, events: [], summaries: [], currentBattleId: null }); ui.observe({ phase: 'response', request, ok: true, value: { token: 'synthetic-player-b', room: { id: 'room-b' }, seat: { id: 'seat-b', name: '同行乙' }, state: { battleReport: { schema: 1, events: [], summaries: [], currentBattleId: null } } } }); await pause(); await pause(); assert.ok(!shadow.textContent.includes('<img src=x')); assert.ok(!shadow.textContent.includes('公开敌人'));
});

test('Unicode count and limit match server code points, including 1000 emoji and Chinese', async t => {
  const doc = documentMock(), server = uiServer(), ui = mountSocialUI({ gameId: 'fengshen', prefix: '/play/fengshen', origin, nativeFetch: server.fetch.bind(server), document: doc }); t.after(() => ui.dispose()); establish(ui.controller, 'fengshen'); await pause();
  const shadow = doc.getElementById('mythic-social-ui').shadowRoot, textarea = shadow.querySelector('textarea'), send = shadow.querySelector('.chat-send'); assert.equal(textarea.maxLength, 2000);
  textarea.value = '😀'.repeat(1000); await textarea.emit('input'); assert.equal(shadow.querySelector('.social-counter').textContent, '1000 / 1000'); assert.equal(send.disabled, false);
  textarea.value = '中'.repeat(1001); await textarea.emit('input'); assert.equal(send.disabled, true); await shadow.querySelector('form').emit('submit'); assert.equal(server.posts, 0); assert.match(shadow.querySelector('.chat-error').textContent, /最多 1000/);
});

test('ambiguous send retries reuse the same idempotency key, while 429 preserves draft with a friendly limit notice', async t => {
  const doc = documentMock(), server = uiServer(), posted = []; let mode = 'network';
  const nativeFetch = async (url, init) => { if (init.method === 'POST') { posted.push(JSON.parse(init.body)); if (mode === 'network') { mode = 'ok'; throw new TypeError('synthetic network interruption'); } if (mode === 'rate') return json({ ok: false, error: { message: 'Rate limited' } }, 429); } return server.fetch(url, init); };
  const ui = mountSocialUI({ gameId: 'fengshen', prefix: '/play/fengshen', origin, nativeFetch, document: doc }); t.after(() => ui.dispose()); establish(ui.controller, 'fengshen'); await pause();
  const shadow = doc.getElementById('mythic-social-ui').shadowRoot, textarea = shadow.querySelector('textarea'), form = shadow.querySelector('form');
  textarea.value = '保留草稿'; await textarea.emit('input'); await form.emit('submit'); assert.equal(textarea.value, '保留草稿'); assert.match(shadow.querySelector('.chat-error').textContent, /草稿已保留/); await form.emit('submit'); assert.equal(posted[0].requestId, posted[1].requestId); assert.equal(textarea.value, '');
  mode = 'rate'; textarea.value = '稍后再发'; await textarea.emit('input'); await form.emit('submit'); assert.equal(textarea.value, '稍后再发'); assert.match(shadow.querySelector('.chat-error').textContent, /十秒/); assert.equal(shadow.querySelector('.chat-send').disabled, true);
});

test('live authoritative report updates and combat-end summaries do not open or block the game', async t => {
  const doc = documentMock(), server = uiServer(), ui = mountSocialUI({ gameId: 'fengshen', prefix: '/play/fengshen', origin, nativeFetch: server.fetch.bind(server), document: doc }); t.after(() => ui.dispose()); establish(ui.controller, 'fengshen'); await pause();
  const shadow = doc.getElementById('mythic-social-ui').shadowRoot; assert.match(shadow.querySelector('.event-text').textContent, /6 点实际伤害/);
  const next = sampleReport(); next.events[0].text = '已投影的可见事件（不含旧隐藏名称）'; next.summaries.push({ id: 'summary-1', battleId: 'battle-1', result: 'victory', actions: 3, text: '真实结算：战斗胜利', damageByActor: [{ actorId: 'p1', actorName: '持剑者', amount: 6 }], damageTakenByActor: [], healingByActor: [{ actorId: 'p2', actorName: '医者', amount: 2 }], statusChanges: ['解除：束缚'] }); server.setReport(next); await ui.controller.request('state');
  assert.equal(shadow.querySelector('.event-text').textContent, next.events[0].text); assert.ok(!shadow.querySelector('.battle-events').textContent.includes('公开敌人')); assert.match(shadow.querySelector('.battle-summary').textContent, /战斗胜利/); assert.match(shadow.querySelector('.battle-summary').textContent, /解除：束缚/); assert.equal(shadow.querySelector('.social-panel').hidden, true);
});

test('mobile visual-viewport handling is bounded, pauses/resumes, and removes listeners on dispose', async () => {
  const doc = documentMock(), viewport = { height: 330, offsetTop: 0, listeners: new Map(), addEventListener(name, fn) { this.listeners.set(name, fn); }, removeEventListener(name) { this.listeners.delete(name); } }; doc.defaultView = { innerHeight: 844, visualViewport: viewport };
  const server = uiServer(), ui = mountSocialUI({ gameId: 'fengshen', prefix: '/play/fengshen', origin, nativeFetch: server.fetch.bind(server), document: doc });
  const host = doc.getElementById('mythic-social-ui'); assert.equal(host.getAttribute('data-keyboard'), 'open'); assert.equal(host.style['--social-keyboard-bottom'], '522px'); assert.equal(host.style['--social-available-height'], '240px'); establish(ui.controller, 'fengshen'); await pause(); ui.pause(); const calls = server.calls.length; await pause(); assert.equal(server.calls.length, calls); ui.resume(); await pause(); assert.ok(server.calls.length > calls); ui.dispose(); assert.equal(viewport.listeners.size, 0); assert.equal(doc.getElementById('mythic-social-ui'), null);
});

test('responsive CSS stays inline, leaves the game interactive and has mobile/keyboard/reduced-motion constraints', async () => {
  const css = await fs.readFile(new URL('../server/social-ui.css', import.meta.url), 'utf8'); assert.match(css, /@media \(max-width: 680px\)/); assert.match(css, /pointer-events: none/); assert.match(css, /pointer-events: auto/); assert.match(css, /aria-selected="true"/); assert.match(css, /data-keyboard="open"/); assert.match(css, /prefers-reduced-motion/); assert.match(css, /100dvh/);
});

test('original bridge keeps requests/storage scoped, captures only current player token, and warning can close before opening social UI', async () => {
  const doc = documentMock(); doc.readyState = 'loading'; const gameShell = doc.createElement('main'); gameShell.id = 'gameShell'; gameShell.hidden = true; doc.body.append(gameShell); const actualQuery = doc.querySelector.bind(doc); doc.querySelector = selector => selector.startsWith('meta[name="mythic-storage"]') ? {} : actualQuery(selector);
  const seen = [], nativeCalls = [], windowEvents = new Map(), observers = [];
  const storage = () => { const values = new Map(); return { get length() { return values.size; }, key(i) { return [...values.keys()][i] ?? null; }, getItem(k) { return values.get(k) ?? null; }, setItem(k, v) { values.set(k, String(v)); }, removeItem(k) { values.delete(k); } }; };
  const location = { pathname: '/play/norse/', origin, host: 'table.example', href: origin + '/play/norse/' };
  const win = { location, localStorage: storage(), sessionStorage: storage(), open() {}, addEventListener(name, fn) { windowEvents.set(name, fn); }, fetch: async (input, init) => { nativeCalls.push({ input, init }); return json({ seatToken: 'synthetic-player-a', managementToken: 'admin-must-not-reach-observer', seat: { id: 'seat-a', name: '甲' }, state: { battleReport: sampleReport(), gmOnly: 'gm-must-not-reach-observer' } }); } };
  const harness = { mountSocialUI() { return { observe(event) { seen.push(event); }, pause() {}, resume() {}, dispose() {} }; } };
  let source = await fs.readFile(new URL('../server/browser-bridge.js', import.meta.url), 'utf8'); source = source.replace("import(prefix + '/__hub__/social-ui.js')", 'Promise.resolve({ mountSocialUI: harness.mountSocialUI })');
  vm.runInNewContext(source, { window: win, document: doc, location, URL, Request, Headers, Element, AbortController, navigator: {}, XMLHttpRequest: class { open() {} }, MutationObserver: class { constructor(callback) { observers.push(callback); } observe() {} }, history: { pushState() {}, replaceState() {} }, console: { warn() {} }, harness }); await pause();
  const response = await win.fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); const original = await response.json(); assert.equal(original.managementToken, 'admin-must-not-reach-observer'); await pause();
  assert.equal(String(nativeCalls[0].input), '/play/norse/api/start'); const recorded = seen.find(event => event.phase === 'response'); assert.equal(recorded.value.seatToken, 'synthetic-player-a'); assert.ok(!JSON.stringify(recorded).includes('admin-must-not-reach-observer')); assert.ok(!JSON.stringify(recorded).includes('gm-must-not-reach-observer'));
  win.localStorage.setItem('seat-record', 'saved'); assert.equal(win.localStorage.getItem('seat-record'), 'saved'); win.localStorage.removeItem('seat-record'); assert.ok(seen.some(event => event.phase === 'storage-clear'));
  for (const callback of doc.events.get('DOMContentLoaded') || []) callback(); const warning = doc.getElementById('mythic-storage-warning'); assert.ok(warning); assert.equal((await warning.emit('keydown', { key: ' ', code: 'Space' })).stopped, true); await warning.querySelector('button').emit('click'); assert.equal(doc.getElementById('mythic-storage-warning'), null);
  gameShell.hidden = false; observers[0](); gameShell.hidden = true; observers[0](); assert.ok(seen.some(event => event.phase === 'leave'));
});
