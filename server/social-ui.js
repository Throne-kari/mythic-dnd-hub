/* Shared, same-room social UI. Credentials remain inside createSessionController. */
const ROOM_IDS = new Set(['fengshen','japan','india','jaffa','acre','qchina','qjapan','qindia']);
const GROUP_IDS = new Set(['mesopotamia','aztec','greek']);
const TABLE_IDS = new Set(['norse','celtic']);
const ROOM_ID = /^[A-Za-z0-9_-]{1,128}$/;
const TEXT_LIMIT = 1000;
const bounded = (value, limit = 1000) => typeof value === 'string' ? value.slice(0, limit) : '';
const validToken = value => typeof value === 'string' && value.length > 0 && value.length <= 512;
const kindLabel = kind => kind === 'agent' ? 'AI' : '真人';
const publicSeat = seat => seat && typeof seat === 'object' ? { id: bounded(seat.id, 128), name: bounded(seat.name || seat.displayName, 100) || '当前席位', kind: seat.kind === 'agent' ? 'agent' : 'human' } : { id: '', name: '当前席位', kind: 'human' };
const emptyReport = () => ({ schema: 1, currentBattleId: null, events: [], summaries: [] });
const statePacket = value => ({ state: { battleReport: extractBattleReport(value) || emptyReport() } });
const extractState = value => value?.state && typeof value.state === 'object' ? value.state : value;
export function extractBattleReport(value) {
  const report = extractState(value)?.battleReport;
  if (!report || report.schema !== 1) return null;
  return { schema: 1, currentBattleId: report.currentBattleId ?? null, events: Array.isArray(report.events) ? report.events.slice(-200) : [], summaries: Array.isArray(report.summaries) ? report.summaries.slice(-20) : [] };
}

export function createSessionController({ gameId, prefix, nativeFetch, origin, onError = () => {} }) {
  const family = ROOM_IDS.has(gameId) ? 'rooms' : GROUP_IDS.has(gameId) ? 'group' : TABLE_IDS.has(gameId) ? 'table' : null;
  let current = null, generation = 0, latestIntent = 0, lifecycle = 0, disposed = false;
  const transitions = new Map(), requestEpochs = new Map(), listeners = new Set();
  const safeSnapshot = () => current ? { gameId, roomId: current.chatRoomId || current.roomId, seat: { ...current.seat }, generation: current.generation } : null;
  const notify = (type, value) => { const event = { type, session: safeSnapshot(), ...(value === undefined ? {} : { value }) }; for (const listener of listeners) { try { listener(event); } catch { /* Observers must never interrupt the original game. */ } } };
  const paths = roomId => family === 'group' ? { state: `/api/rooms/${encodeURIComponent(roomId)}/state`, chat: `/api/rooms/${encodeURIComponent(roomId)}/hub/chat` } : { state: '/api/state', chat: '/api/hub/chat' };
  const authKey = candidate => candidate ? `${candidate.roomId}\u0000${candidate.token}` : '';
  function deactivate(reason = 'leave') { current?.abort.abort(); current = null; generation++; notify('session', { reason }); }
  function candidateFor(request, value) {
    if (!family) return null;
    const grouped = request.path.match(/^\/api\/rooms\/([^/]+)\/(?:state|join)$/);
    let roomId = family === 'table' ? 'table' : family === 'group' ? grouped?.[1] || value?.roomId : value?.room?.id || request.roomId;
    if (!ROOM_ID.test(roomId || '')) return null;
    if (family === 'group' && value?.roomId && value.roomId !== roomId) return null;
    let token = request.token;
    if (request.bootstrap) token = family === 'table' ? value?.seatToken : value?.token;
    if (!validToken(token)) return null;
    const seat = value?.seat || value?.state?.seat;
    return { roomId, token, seat: publicSeat(seat), initial: statePacket(value) };
  }
  function activate(candidate) {
    if (disposed || !candidate) return;
    if (current && authKey(current) === authKey(candidate)) {
      if (candidate.seat.id) current.seat = candidate.seat;
      current.lastState = candidate.initial;
      notify('identity'); notify('state', candidate.initial); return;
    }
    current?.abort.abort();
    current = { ...candidate, lastState: candidate.initial, abort: new AbortController(), generation: ++generation, paths: paths(candidate.roomId) };
    notify('session'); notify('state', candidate.initial);
  }
  function isRelevant(request) {
    return request && typeof request.serial === 'number' && (request.bootstrap || request.canonical);
  }
  function observe(event) {
    if (disposed || !event) return;
    if (['leave', 'storage-clear'].includes(event.phase)) { lifecycle++; requestEpochs.clear(); transitions.clear(); deactivate(event.phase); return; }
    const request = event.request;
    if (!isRelevant(request)) return;
    if (event.phase === 'request') {
      latestIntent = Math.max(latestIntent, request.serial); requestEpochs.set(request.serial, lifecycle);
      while (requestEpochs.size > 32) requestEpochs.delete(requestEpochs.keys().next().value);
      const nextKey = request.bootstrap ? '' : authKey(candidateFor(request, {}));
      const switching = request.bootstrap || (nextKey && nextKey !== authKey(current));
      if (switching) {
        transitions.set(request.serial, current ? { roomId: current.roomId, token: current.token, seat: current.seat, initial: current.lastState } : null);
        while (transitions.size > 8) transitions.delete(transitions.keys().next().value);
        deactivate('switching');
      }
      return;
    }
    if (event.phase !== 'response' || request.serial !== latestIntent || requestEpochs.get(request.serial) !== lifecycle) return;
    requestEpochs.delete(request.serial);
    const previous = transitions.get(request.serial); transitions.delete(request.serial);
    if (!event.ok) {
      if (previous) activate(previous);
      else if (request.canonical && [401, 403, 404].includes(event.status)) deactivate('expired');
      return;
    }
    const candidate = candidateFor(request, event.value);
    if (candidate) activate(candidate);
  }
  async function request(kind, { body, cursor, signal } = {}) {
    const session = current;
    if (!session || disposed || !['state', 'chat'].includes(kind)) throw Object.assign(new Error('请先在游戏中创建、加入或恢复席位。'), { status: 401 });
    let route = session.paths[kind];
    if (kind === 'chat' && body === undefined) route += `?limit=100${Number.isSafeInteger(cursor) && cursor >= 0 ? `&cursor=${cursor}` : ''}`;
    const headers = family === 'group' ? { Authorization: `Bearer ${session.token}` } : { 'X-Seat-Token': session.token, ...(family === 'rooms' ? { 'X-Room-Id': session.roomId } : {}) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controllerSignal = AbortSignal.any([session.abort.signal, ...(signal ? [signal] : []), AbortSignal.timeout(12000)]);
    const response = await nativeFetch(new URL(prefix + route, origin).href, { method: body === undefined ? 'GET' : 'POST', headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }), credentials: 'same-origin', cache: 'no-store', signal: controllerSignal });
    const data = await response.json().catch(() => ({}));
    if (current !== session) throw new DOMException('席位已切换', 'AbortError');
    if (!response.ok || data.ok === false) {
      if ([401, 403].includes(response.status)) { lifecycle++; requestEpochs.clear(); deactivate('expired'); }
      const message = typeof data.error === 'string' ? data.error : data.error?.message || data.message;
      throw Object.assign(new Error(bounded(message, 250) || `连接未能完成（${response.status}）`), { status: response.status });
    }
    if (kind === 'chat') {
      if (family !== 'table' && data.roomId !== session.roomId) throw new Error('房间响应不匹配，已停止显示此数据。');
      if (family === 'table' && typeof data.roomId === 'string') {
        const changed = current.chatRoomId && current.chatRoomId !== data.roomId;
        current.chatRoomId = data.roomId;
        if (changed) { current.generation = ++generation; current.lastState = null; notify('session'); }
      }
      if (data.seat) { current.seat = publicSeat(data.seat); notify('identity'); }
    }
    if (kind === 'state') { const packet = statePacket(data); current.lastState = packet; notify('state', packet); return packet; }
    return data;
  }
  return {
    observe, request, snapshot: safeSnapshot,
    subscribe(listener) { listeners.add(listener); listener({ type: 'session', session: safeSnapshot() }); if (current?.lastState) listener({ type: 'state', session: safeSnapshot(), value: current.lastState }); return () => listeners.delete(listener); },
    leave() { lifecycle++; requestEpochs.clear(); transitions.clear(); deactivate(); },
    dispose() { disposed = true; current?.abort.abort(); current = null; listeners.clear(); transitions.clear(); requestEpochs.clear(); },
  };
}

export function describeSocialRequest(input, init, { prefix, origin, serial }) {
  try {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, origin);
    if (url.origin !== origin || !url.pathname.startsWith(prefix + '/api/')) return null;
    const path = url.pathname.slice(prefix.length), method = String(init?.method || input?.method || 'GET').toUpperCase();
    const canonical = method === 'GET' && (path === '/api/state' || /^\/api\/rooms\/[^/]+\/state$/.test(path));
    const bootstrap = method === 'POST' && (['/api/rooms', '/api/join', '/api/start', '/api/host'].includes(path) || /^\/api\/rooms\/[^/]+\/join$/.test(path));
    if (!canonical && !bootstrap) return null;
    const headers = new Headers(init?.headers ?? input?.headers ?? {}), authorization = headers.get('authorization');
    const token = headers.get('x-seat-token') || headers.get('x-game-token') || (/^Bearer\s+/i.test(authorization || '') ? authorization.replace(/^Bearer\s+/i, '') : '');
    return { serial, path, method, canonical, bootstrap, token, roomId: headers.get('x-room-id') || '' };
  } catch { return null; }
}

function el(document, tag, className, text) {
  const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node;
}
const eventKey = (event, index) => String(event?.id ?? event?.seq ?? `${event?.battleId || ''}:${index}:${event?.text || ''}`);
export function eventText(event) {
  if (typeof event?.text === 'string' && event.text.trim()) return event.text.slice(0, 2000);
  const actor = bounded(event?.actorName, 100) || '行动者', target = bounded(event?.targetName, 100) || '目标', method = bounded(event?.method, 120) || '行动';
  if (event?.kind === 'damage' && Number.isFinite(event.amount)) return `${actor} · ${method} → ${target}：实际损失 ${event.amount} 生命`;
  if (event?.kind === 'healing' && Number.isFinite(event.amount)) return `${actor} · ${method} → ${target}：实际恢复 ${event.amount} 生命`;
  if (event?.kind === 'status') return `${actor} · ${method} → ${target}${event.statusesAdded?.length ? `；施加 ${event.statusesAdded.map(String).join('、')}` : ''}${event.statusesRemoved?.length ? `；解除 ${event.statusesRemoved.map(String).join('、')}` : ''}`;
  return `${actor} · ${method}${event?.targetName ? ` → ${target}` : ''}`;
}
function amounts(value) {
  if (Array.isArray(value)) return value.slice(0, 60).map(item => ({ name: bounded(item.actorName || item.name || item.actorId, 100) || '行动者', amount: Number(item.amount ?? item.total ?? item.damage ?? 0) })).filter(item => Number.isFinite(item.amount));
  if (value && typeof value === 'object') return Object.entries(value).slice(0, 60).map(([name, item]) => ({ name: typeof item === 'object' ? bounded(item.actorName || item.name || name, 100) : bounded(name, 100), amount: Number(typeof item === 'object' ? item.amount ?? item.total ?? 0 : item) })).filter(item => Number.isFinite(item.amount));
  return [];
}

export function mountSocialUI({ gameId, prefix, nativeFetch, origin = location.origin, document: doc = document }) {
  const controller = createSessionController({ gameId, prefix, nativeFetch, origin });
  let mounted = false, destroyed = false, paused = false, viewportCleanup = () => {}, host, shadow, launcher, panel, closeButton, connection, identity, tabs = [], panes = [], chatList, form, textarea, send, counter, chatError, eventList, summaryList, emptyChat, emptyEvents, emptySummary;
  let activeTab = 0, open = false, session = null, epoch = 0, pollTimer = null, retryTimer = null, pollAbort = null, cursor = 0, failures = 0, sending = false, outbox = null, retryUntil = 0, unread = 0, report = null, lastReportKey = '', summarySeen = new Set();
  let chatLoaded = false;
  const messages = new Map(), eventNodes = new Map();
  function updateLauncher() { if (launcher) launcher.textContent = `${open ? '收起' : '同桌聊天 · 结算'}${!open && unread ? ` · ${Math.min(unread, 99)}` : ''}`; }
  function setOpen(next) {
    if (!mounted || open === next) return;
    open = next; panel.hidden = !next; launcher.setAttribute('aria-expanded', String(next));
    if (next) { unread = 0; updateLauncher(); (session && activeTab === 0 ? textarea : closeButton).focus(); if (activeTab === 0) chatList.scrollTop = chatList.scrollHeight; }
    else { updateLauncher(); launcher.focus(); }
  }
  function selectTab(index, focus = false) {
    activeTab = index;
    tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', String(i === index)); tab.tabIndex = i === index ? 0 : -1; panes[i].hidden = i !== index; });
    if (focus) tabs[index].focus();
  }
  function announce(text, error = false) { if (connection) { connection.textContent = text; connection.dataset.state = error ? 'error' : 'ready'; } }
  function clearCollections() {
    clearTimeout(retryTimer); retryTimer = null; messages.clear(); chatLoaded = false; eventNodes.clear(); summarySeen = new Set(); cursor = 0; report = null; lastReportKey = ''; unread = 0; outbox = null; retryUntil = 0;
    if (!mounted) return;
    chatList.replaceChildren(emptyChat); eventList.replaceChildren(emptyEvents); summaryList.replaceChildren(emptySummary); chatError.textContent = ''; textarea.value = ''; counter.textContent = `0 / ${TEXT_LIMIT}`;
  }
  function updateIdentity() {
    if (!mounted) return;
    identity.textContent = session ? `${session.seat.name} · ${kindLabel(session.seat.kind)} · 本房公开` : '请先在游戏中创建、加入或恢复席位';
    textarea.disabled = !session; send.disabled = !session || sending || Date.now() < retryUntil || [...textarea.value].length > TEXT_LIMIT; form.hidden = !session;
  }
  function appendMessages(payload) {
    if (!mounted || !session) return;
    if (payload.reset) { messages.clear(); chatList.replaceChildren(); }
    const wasLoaded = chatLoaded; chatLoaded = true;
    const atBottom = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 70;
    let added = 0;
    for (const item of Array.isArray(payload.messages) ? payload.messages.slice(0, 100) : []) {
      if (!Number.isSafeInteger(item.id) || typeof item.text !== 'string' || messages.has(item.id)) continue;
      emptyChat.remove(); const row = el(doc, 'article', `message ${item.seatId === session.seat.id ? 'mine' : ''}`);
      const meta = el(doc, 'div', 'message-meta'); meta.append(el(doc, 'strong', '', bounded(item.name, 100) || '同行者'), el(doc, 'span', `identity-kind ${item.kind === 'agent' ? 'agent' : ''}`, kindLabel(item.kind)));
      const date = new Date(item.at); if (Number.isFinite(date.getTime())) { const time = el(doc, 'time', '', date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })); time.dateTime = date.toISOString(); meta.append(time); }
      row.append(meta, el(doc, 'p', 'message-text', item.text.slice(0, 1200))); chatList.append(row); messages.set(item.id, row); added++;
    }
    while (messages.size > 100) { const key = messages.keys().next().value; messages.get(key).remove(); messages.delete(key); }
    if (!messages.size && !emptyChat.isConnected) chatList.append(emptyChat);
    if (Number.isSafeInteger(payload.cursor)) cursor = payload.reset ? payload.cursor : Math.max(cursor, payload.cursor);
    if (added && atBottom && open && activeTab === 0) chatList.scrollTop = chatList.scrollHeight;
    else if (added && wasLoaded && (!open || activeTab !== 0)) { unread += added; updateLauncher(); }
  }
  function renderReport(next) {
    if (!mounted || !next) return;
    report = next;
    const key = JSON.stringify(next);
    if (key === lastReportKey) return; const hadReport = Boolean(lastReportKey); lastReportKey = key;
    const events = next.events.slice(-200), keep = new Set();
    for (const [index, item] of events.entries()) {
      const key = eventKey(item, index); keep.add(key); if (eventNodes.has(key)) { eventNodes.get(key).querySelector('.event-text').textContent = eventText(item); continue; }
      emptyEvents.remove(); const row = el(doc, 'li', `battle-event ${bounded(item.kind, 30)}`);
      const label = { damage: '伤害', healing: '治疗', status: '状态', miss: '未命中', action: '行动', battle_start: '开战', battle_end: '结束' }[item.kind] || '结算';
      row.append(el(doc, 'span', 'event-kind', label), el(doc, 'span', 'event-text', eventText(item))); eventList.append(row); eventNodes.set(key, row);
    }
    for (const [key, row] of eventNodes) if (!keep.has(key)) { row.remove(); eventNodes.delete(key); }
    if (!eventNodes.size && !emptyEvents.isConnected) eventList.append(emptyEvents);
    summaryList.replaceChildren();
    for (const [index, summary] of next.summaries.slice(-20).reverse().entries()) {
      const summaryKey = String(summary.id ?? summary.battleId ?? index), card = el(doc, 'article', 'battle-summary');
      card.append(el(doc, 'h3', '', { victory: '战斗胜利', defeat: '战斗失利', ended: '战斗结束', retreat: '撤退结算' }[summary.result] || '战斗结算'));
      if (summary.text) card.append(el(doc, 'p', '', bounded(summary.text, 3000)));
      if (Number.isFinite(summary.actions)) card.append(el(doc, 'p', 'summary-actions', `${summary.actions} 次已结算行动`));
      for (const [field, label] of [['damageByActor', '造成实际伤害'], ['damageTakenByActor', '承受实际伤害'], ['healingByActor', '实际治疗']]) {
        const rows = amounts(summary[field]); if (!rows.length) continue;
        const group = el(doc, 'section', 'summary-group'); group.append(el(doc, 'h4', '', label)); const list = el(doc, 'dl'); for (const row of rows) list.append(el(doc, 'dt', '', row.name), el(doc, 'dd', '', String(row.amount))); group.append(list); card.append(group);
      }
      if (Array.isArray(summary.statusChanges) && summary.statusChanges.length) { const list = el(doc, 'ul', 'summary-statuses'); for (const status of summary.statusChanges.slice(0, 60)) list.append(el(doc, 'li', '', typeof status === 'string' ? status.slice(0, 1000) : eventText({ ...status, kind: 'status' }))); card.append(list); }
      summaryList.append(card);
      if (!summarySeen.has(summaryKey)) { if (hadReport && (!open || activeTab !== 2)) { unread++; announce('战斗已结算，可在「战斗汇总」查看。'); } summarySeen.add(summaryKey); }
    }
    if (!next.summaries.length) summaryList.append(emptySummary);
    updateLauncher();
  }
  async function poll() {
    if (!session || destroyed || paused) return;
    const currentEpoch = epoch; pollAbort?.abort(); pollAbort = new AbortController(); let okay = false;
    const results = await Promise.allSettled([controller.request('chat', { cursor, signal: pollAbort.signal }), controller.request('state', { signal: pollAbort.signal })]);
    if (currentEpoch !== epoch || !session || destroyed || paused) return;
    if (results[0].status === 'fulfilled') { appendMessages(results[0].value); okay = true; } else if (results[0].reason?.name !== 'AbortError') announce(results[0].reason.status === 404 ? '同桌服务暂不可用，请稍后重试。' : '连接中断，正在重试；草稿会保留。', true);
    if (results[1].status === 'fulfilled') { const next = extractBattleReport(results[1].value); if (next) renderReport(next); okay = true; }
    if (okay) { failures = 0; if (results[0].status === 'fulfilled') announce('本房已同步 · 仅本房成员可见'); } else failures++;
    updateIdentity(); pollTimer = setTimeout(poll, Math.min((doc.visibilityState === 'hidden' ? 10000 : 2800) * 2 ** Math.min(failures, 2), 15000));
  }
  async function submit(event) {
    event.preventDefault(); if (!session || sending || Date.now() < retryUntil) return;
    const text = textarea.value.trim(); if (!text) { chatError.textContent = '先写一点想说的话。'; textarea.focus(); return; }
    if ([...text].length > TEXT_LIMIT) { chatError.textContent = `每条发言最多 ${TEXT_LIMIT} 字。`; return; }
    const currentEpoch = epoch; if (!outbox || outbox.text !== text || outbox.epoch !== currentEpoch) outbox = { text, epoch: currentEpoch, requestId: crypto.randomUUID() };
    sending = true; chatError.textContent = ''; updateIdentity();
    try {
      const result = await controller.request('chat', { body: { text: outbox.text, requestId: outbox.requestId } });
      if (epoch !== currentEpoch) return;
      appendMessages(result); if (textarea.value.trim() === text) textarea.value = ''; counter.textContent = `${[...textarea.value].length} / ${TEXT_LIMIT}`; outbox = null; announce('发言已送达本房成员。');
    } catch (error) {
      if (epoch !== currentEpoch || error.name === 'AbortError') return;
      if (error.status === 429) { retryUntil = Date.now() + 10000; chatError.textContent = '发言有些快，请稍等十秒再发送。草稿已保留。'; retryTimer = setTimeout(() => { retryTimer = null; if (epoch === currentEpoch) updateIdentity(); }, 10010); }
      else chatError.textContent = '发言未确认送达，草稿已保留；可重试，不会重复发出。';
    } finally { if (epoch === currentEpoch) { sending = false; updateIdentity(); } }
  }
  function mount() {
    if (mounted || destroyed || !doc.body) return; mounted = true;
    host = el(doc, 'div'); host.id = 'mythic-social-ui'; host.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;z-index:2147483000;pointer-events:none;'; host.setAttribute('data-hub-link', ''); shadow = host.attachShadow({ mode: 'open' });
    const win = doc.defaultView || globalThis.window;
    if (win?.visualViewport) {
      const viewport = win.visualViewport;
      const adjustViewport = () => {
        const keyboardBottom = Math.max(0, win.innerHeight - viewport.height - viewport.offsetTop);
        host.style.setProperty('--social-keyboard-bottom', `${keyboardBottom > 100 ? keyboardBottom + 8 : 0}px`);
        host.style.setProperty('--social-available-height', `${Math.max(120, viewport.height - 90)}px`);
        host.setAttribute('data-keyboard', keyboardBottom > 100 ? 'open' : 'closed');
      };
      viewport.addEventListener('resize', adjustViewport); viewport.addEventListener('scroll', adjustViewport); adjustViewport();
      viewportCleanup = () => { viewport.removeEventListener('resize', adjustViewport); viewport.removeEventListener('scroll', adjustViewport); };
    }
    const stylesheet = el(doc, 'link'); stylesheet.rel = 'stylesheet'; stylesheet.href = prefix + '/__hub__/social-ui.css'; shadow.append(stylesheet);
    const wrap = el(doc, 'div', 'social-shell'); launcher = el(doc, 'button', 'social-launcher', '同桌聊天 · 结算'); launcher.type = 'button'; launcher.setAttribute('aria-controls', 'mythic-social-panel'); launcher.setAttribute('aria-expanded', 'false'); launcher.addEventListener('click', () => setOpen(!open));
    panel = el(doc, 'section', 'social-panel'); panel.id = 'mythic-social-panel'; panel.hidden = true; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'false'); panel.setAttribute('aria-labelledby', 'social-title');
    const header = el(doc, 'header', 'social-header'); const heading = el(doc, 'div'); const title = el(doc, 'h2', '', '同桌信使'); title.id = 'social-title'; heading.append(title); identity = el(doc, 'p', 'social-identity'); heading.append(identity); closeButton = el(doc, 'button', 'social-close', '×'); closeButton.type = 'button'; closeButton.setAttribute('aria-label', '收起同桌聊天与结算'); closeButton.addEventListener('click', () => setOpen(false)); header.append(heading, closeButton);
    const tablist = el(doc, 'div', 'social-tabs'); tablist.setAttribute('role', 'tablist'); tablist.setAttribute('aria-label', '同桌内容');
    const content = el(doc, 'div', 'social-content');
    for (const [i, name] of ['聊天室', '行动结算', '战斗汇总'].entries()) { const button = el(doc, 'button', 'social-tab', name); button.type = 'button'; button.id = `social-tab-${i}`; button.setAttribute('role', 'tab'); button.setAttribute('aria-controls', `social-pane-${i}`); button.addEventListener('click', () => selectTab(i)); button.addEventListener('keydown', event => { const next = { ArrowRight: (i + 1) % 3, ArrowLeft: (i + 2) % 3, Home: 0, End: 2 }[event.key]; if (next !== undefined) { event.preventDefault(); selectTab(next, true); } }); const pane = el(doc, 'section', 'social-pane'); pane.id = `social-pane-${i}`; pane.setAttribute('role', 'tabpanel'); pane.setAttribute('aria-labelledby', button.id); pane.tabIndex = 0; tablist.append(button); content.append(pane); tabs.push(button); panes.push(pane); }
    chatList = el(doc, 'div', 'chat-messages'); chatList.setAttribute('role', 'log'); chatList.setAttribute('aria-label', '本房公开聊天记录'); chatList.setAttribute('aria-live', 'polite'); chatList.setAttribute('aria-relevant', 'additions'); emptyChat = el(doc, 'p', 'social-empty', '这里只向同一房间的成员公开。入席后，说声你好吧。'); chatList.append(emptyChat);
    form = el(doc, 'form', 'chat-composer'); const label = el(doc, 'label', '', '同房公开发言'); label.htmlFor = 'social-message'; textarea = el(doc, 'textarea'); textarea.id = 'social-message'; textarea.rows = 3; textarea.maxLength = TEXT_LIMIT * 2; textarea.placeholder = '讨论战术，回应同行者…'; textarea.setAttribute('aria-describedby', 'social-counter social-chat-error');
    textarea.addEventListener('input', () => { const count = [...textarea.value].length; counter.textContent = `${count} / ${TEXT_LIMIT}`; counter.dataset.overlimit = String(count > TEXT_LIMIT); chatError.textContent = count > TEXT_LIMIT ? `每条发言最多 ${TEXT_LIMIT} 字。` : ''; if (outbox && outbox.text !== textarea.value.trim()) outbox = null; updateIdentity(); });
    const actions = el(doc, 'div', 'composer-actions'); counter = el(doc, 'span', 'social-counter', `0 / ${TEXT_LIMIT}`); counter.id = 'social-counter'; send = el(doc, 'button', 'chat-send', '发送'); send.type = 'submit'; actions.append(counter, send); chatError = el(doc, 'p', 'chat-error'); chatError.id = 'social-chat-error'; chatError.setAttribute('role', 'status'); form.append(label, textarea, actions, chatError); form.addEventListener('submit', submit); panes[0].append(chatList, form);
    const eventNote = el(doc, 'p', 'pane-note', '仅展示游戏引擎已结算、且当前席位可见的事件，不由 AI 推测。'); eventList = el(doc, 'ol', 'battle-events'); emptyEvents = el(doc, 'li', 'social-empty', '尚无可见的行动结算。真实行动发生后将在这里记录。'); eventList.append(emptyEvents); panes[1].append(eventNote, eventList);
    summaryList = el(doc, 'div', 'battle-summaries'); emptySummary = el(doc, 'p', 'social-empty', '一场战斗结束后，汇总会保留在这里。不会自动打断当前操作。'); summaryList.append(emptySummary); panes[2].append(summaryList);
    connection = el(doc, 'p', 'social-connection', '请先入席，聊天室与结算会随当前房间连接。'); connection.setAttribute('role', 'status'); panel.append(header, tablist, content, connection); wrap.append(panel, launcher); shadow.append(wrap); doc.body.append(host);
    // Shadow DOM retargets the textarea as a DIV outside this root. Keep all
    // composer keys from the original games' Space/1–4/m/a/h/g shortcuts.
    shadow.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); } });
    for (const name of ['keyup', 'keypress', 'click', 'dblclick', 'pointerdown', 'pointerup', 'contextmenu']) shadow.addEventListener(name, event => event.stopPropagation());
    for (const name of ['wheel', 'touchstart', 'touchmove', 'touchend']) shadow.addEventListener(name, event => event.stopPropagation(), { passive: true });
    selectTab(0); updateIdentity(); updateLauncher(); if (report) renderReport(report);
  }
  const unsubscribe = controller.subscribe(event => {
    if (event.type === 'session') {
      epoch++; clearTimeout(pollTimer); pollAbort?.abort(); sending = false; session = event.session; clearCollections(); updateIdentity(); updateLauncher();
      if (session) { announce('正在连接本房…'); void poll(); } else announce('尚未入席；不会读取其他房间的聊天。');
    } else if (event.type === 'identity') { session = event.session; updateIdentity(); }
    else if (event.type === 'state') { const next = extractBattleReport(event.value); if (next) { report = next; renderReport(next); } }
  });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
  return { observe: controller.observe, pause() { paused = true; clearTimeout(pollTimer); pollAbort?.abort(); }, resume() { if (!paused || destroyed) return; paused = false; if (session) void poll(); }, dispose() { destroyed = true; clearTimeout(pollTimer); clearTimeout(retryTimer); pollAbort?.abort(); unsubscribe(); controller.dispose(); viewportCleanup(); host?.remove(); }, controller };
}
