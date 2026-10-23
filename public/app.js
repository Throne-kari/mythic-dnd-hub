import {escapeHtml as esc, request, readRecent, rememberGame, forgetGame, formatDate, coverUrl, shortPantheon, icon, documentUrl, renderMarkdown} from './shared.js';

const main = document.querySelector('#main');
const search = document.querySelector('#search');
const reader = document.querySelector('#document-reader');
let games = [], currentPantheon = '全部', hostless = false, query = '', documentRequest = 0;
const numeral = value => ({0:'零',1:'一',2:'二',3:'三',4:'四',5:'五',6:'六',7:'七',8:'八',9:'九',10:'十',11:'十一',12:'十二',13:'十三',14:'十四',15:'十五'}[value] || value);
const gameById = id => games.find(game => game.id === id);
const gameHref = game => `/play/${encodeURIComponent(game.id)}/`;
const statusBadge = game => game.status === 'development' ? '<span class="status-badge development">制作中</span>' : '';
const enterText = game => game.status === 'development' ? '体验开发版' : '进入游戏';
const picture = (game, className = '', loading = 'lazy') => `<img class="game-image ${className} art-${esc(game.id)}" src="${coverUrl(game.id)}" alt="" loading="${loading}" decoding="async">`;

function card(game, recent) {
  return `<article class="game-card">
    <a href="#game/${esc(game.id)}" class="card-picture" aria-label="查看${esc(game.title)}">${picture(game)}<span class="card-pantheon">${esc(shortPantheon(game.pantheon))}</span>${statusBadge(game)}</a>
    <div class="card-copy"><p class="card-subtitle">${esc(game.subtitle)}</p><h2><a href="#game/${esc(game.id)}">${esc(game.title)}</a></h2>
      <p class="card-description">${esc(game.description)}</p>
      <div class="card-meta"><span>${icon('people',15)} ${esc(game.players)}</span><span>${esc(game.mode)}</span></div>
      ${recent ? `<div class="recent-time">${icon('clock',14)} ${formatDate(recent.time)} 进入过</div>` : ''}
      <div class="card-actions"><a href="#game/${esc(game.id)}">查看冒险 ${icon('arrow',16)}</a><a class="card-play" href="${gameHref(game)}" data-play="${esc(game.id)}">${recent ? '继续' : game.status === 'development' ? '体验' : '进入'} ${icon('external',14)}</a></div>
      ${recent ? `<button class="remove-recent" data-forget="${esc(game.id)}">移除记录</button>` : ''}
    </div>
  </article>`;
}

function filteredGames() {
  const term = query.trim().toLocaleLowerCase();
  return games.filter(game => (currentPantheon === '全部' || game.pantheon === currentPantheon) && (!hostless || game.mode === '无需主持') && (!term || [game.title,game.subtitle,game.pantheon,game.description,...game.tags].join(' ').toLocaleLowerCase().includes(term)));
}

function library() {
  document.title = '万神之书 · 全部冒险';
  const pantheons = [...new Set(games.map(game => game.pantheon))];
  const mythCount = pantheons.filter(name => name !== '历史虚构').length;
  main.innerHTML = `<section class="library-hero" aria-labelledby="library-title"><div class="hero-art"></div><div class="hero-content"><span class="eyebrow hero-kicker">MYTHIC DND</span><h1 id="library-title">万神之书</h1><p class="hero-count">${numeral(mythCount)}大神系 <span>·</span> ${numeral(games.length)}部冒险</p><div class="hero-actions"><a class="button gold" href="#collection">浏览冒险 ${icon('arrow')}</a><button class="button glass ${hostless ? 'active' : ''}" type="button" data-hostless aria-pressed="${hostless}">${icon('people')} 无需主持</button></div></div><a class="hero-feature" href="#game/fengshen"><span>封神·岐路</span> ${icon('external',16)}</a></section>
    <section class="collection section-shell" id="collection" aria-labelledby="collection-title"><div class="filter-row"><div class="pantheon-tabs" role="group" aria-label="按神系筛选">${['全部',...pantheons].map(name => `<button type="button" class="pantheon-tab ${currentPantheon === name ? 'selected' : ''}" data-pantheon="${esc(name)}" aria-pressed="${currentPantheon === name}">${esc(shortPantheon(name))}</button>`).join('')}</div></div><div class="collection-heading"><h2 id="collection-title">${query ? `搜索「${esc(query)}」` : currentPantheon === '全部' ? '全部冒险' : esc(currentPantheon)}</h2><div class="collection-options"><button class="filter-chip ${hostless ? 'active' : ''}" type="button" data-hostless aria-pressed="${hostless}">${hostless ? icon('check',14) : ''}无需主持</button><span id="result-count"></span></div></div><div class="game-grid" id="game-grid"></div></section>`;
  refreshCards();
}
function refreshCards() {
  const matches = filteredGames();
  const grid = document.querySelector('#game-grid');
  if (!grid) return;
  grid.innerHTML = matches.length ? matches.map(game => card(game)).join('') : `<div class="empty-state"><span class="empty-symbol">${icon('search',40)}</span><h2>没有找到这场冒险</h2><button class="button subtle" data-reset-filters>清除筛选</button></div>`;
  document.querySelector('#result-count').textContent = `${matches.length} 部作品`;
  document.querySelector('#collection-title').textContent = query ? `搜索「${query}」` : currentPantheon === '全部' ? '全部冒险' : currentPantheon;
}

function recentView() {
  document.title = '继续冒险 · 万神之书';
  const records = readRecent().filter(record => gameById(record.id));
  main.innerHTML = `<section class="section-shell inner-page"><div class="page-heading"><span class="eyebrow">${icon('clock',18)} 最近进入</span><h1>继续冒险</h1><p>在同一浏览器进入游戏，接续游戏中保存的房间与席位。</p></div>${records.length ? `<div class="game-grid">${records.map(record => card(gameById(record.id), record)).join('')}</div>` : `<div class="empty-state"><span class="empty-symbol">${icon('book',46)}</span><h2>还没有开启的冒险</h2><a class="button gold" href="#library">挑选一部冒险 ${icon('arrow')}</a></div>`}</section>`;
}

function docLinks(game, limit = Infinity) {
  return (game.docs || []).slice(0, limit).map((doc, index) => `<button class="document-link" type="button" data-doc-game="${esc(game.id)}" data-doc-index="${index}"><span>${icon('book',20)}${esc(doc.title)}</span>${icon('arrow',17)}</button>`).join('');
}
function rulesView() {
  document.title = '规则资料 · 万神之书';
  main.innerHTML = `<section class="section-shell inner-page"><div class="page-heading"><span class="eyebrow">${icon('book',18)} 书库</span><h1>规则与资料</h1></div><div class="rules-grid">${games.map(game => `<section class="rule-volume"><a class="rule-volume-header" href="#game/${esc(game.id)}">${picture(game)}<div><span class="eyebrow">${esc(shortPantheon(game.pantheon))}</span><h2>${esc(game.title)}</h2></div>${statusBadge(game)}</a><div class="rule-links">${docLinks(game)}</div></section>`).join('')}</div></section>`;
}

function detailView(id) {
  const game = gameById(id);
  if (!game) { main.innerHTML = '<section class="empty-state"><h1>未找到这部冒险</h1><a class="button gold" href="#library">返回书库</a></section>'; return; }
  document.title = `${game.title} · 万神之书`;
  const related = games.filter(item => item.id !== id && item.pantheon === game.pantheon);
  const playerDoc = game.docs.findIndex(doc => /玩家|合作|游玩/.test(doc.title));
  main.innerHTML = `<div class="detail-back section-shell"><a href="#library">${icon('back',18)} 返回全部冒险</a><span>${esc(game.pantheon)} <span>/</span> v${esc(game.version)}</span></div><article>
    <section class="detail-hero"><div class="detail-art">${picture(game,'','eager')}</div><div class="detail-copy"><div class="detail-eyebrow"><span class="eyebrow">${esc(game.pantheon)}</span>${statusBadge(game)}</div><h1>${esc(game.title)}</h1><p class="detail-subtitle">${esc(game.subtitle)}</p><div class="detail-facts"><span>${icon('book',18)}${esc(game.chapters)}</span><span>${icon('people',18)}${esc(game.players)}</span></div><p class="detail-description">${esc(game.description)}</p><div class="detail-actions"><a class="button gold large" href="${gameHref(game)}" data-play="${esc(game.id)}">${enterText(game)} ${icon('external',21)}</a>${playerDoc >= 0 ? `<button class="button glass large" type="button" data-doc-game="${esc(game.id)}" data-doc-index="${playerDoc}">${icon('book',20)} 玩家指南</button>` : ''}</div></div></section>
    <section class="section-shell detail-body"><div class="detail-columns"><section class="adventure-overview"><h2>冒险概览</h2><dl class="overview-facts"><div><dt>游玩方式</dt><dd>${esc(game.mode)}</dd></div><div><dt>玩家人数</dt><dd>${esc(game.players)}</dd></div><div><dt>故事篇章</dt><dd>${esc(game.chapters)}</dd></div><div><dt>当前版本</dt><dd>v${esc(game.version)}</dd></div></dl><div class="tag-list">${game.tags.map(tag => `<span>${esc(tag)}</span>`).join('')}</div></section><section class="detail-docs"><h2>规则与资料</h2>${docLinks(game)}</section>${related.length ? `<section class="related-games"><h2>同一神系</h2>${related.map(item => `<a class="related-card" href="#game/${esc(item.id)}">${picture(item)}<div><h3>${esc(item.title)}</h3><span>${esc(item.subtitle)}</span></div>${icon('arrow')}</a>`).join('')}</section>` : `<section class="related-games"><h2>继续探索</h2>${games.filter(item => item.id !== id && item.mode === game.mode).slice(0,2).map(item => `<a class="related-card" href="#game/${esc(item.id)}">${picture(item)}<div><h3>${esc(item.title)}</h3><span>${esc(item.pantheon)}</span></div>${icon('arrow')}</a>`).join('')}</section>`}</div></section></article>`;
}

function route() {
  const hash = location.hash.slice(1) || 'library';
  if (hash === 'collection' || hash === 'main') { if (!document.querySelector('#collection')) library(); document.querySelector('#collection')?.scrollIntoView({behavior:'smooth'}); return; }
  document.querySelectorAll('[data-nav]').forEach(link => link.classList.toggle('current', link.dataset.nav === hash || (hash.startsWith('game/') && link.dataset.nav === 'library')));
  if (hash.startsWith('game/')) detailView(decodeURIComponent(hash.slice(5)));
  else if (hash === 'continue') recentView();
  else if (hash === 'rules') rulesView();
  else library();
  main.setAttribute('aria-busy','false');
  window.scrollTo({top:0,behavior:'instant'});
}

async function openDocument(id, index) {
  const game = gameById(id), doc = game?.docs?.[index];
  if (!doc) return;
  const url = documentUrl(id,doc.path), requestId = ++documentRequest;
  document.querySelector('#document-game').textContent = game.title;
  document.querySelector('#document-title').textContent = doc.title;
  document.querySelector('#document-original').href = url;
  const content = document.querySelector('#document-content');
  content.innerHTML = '<p class="document-loading">正在打开文档…</p>';
  reader.showModal();
  content.scrollTop = 0;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`文档暂时无法读取（${response.status}）`);
    const source = await response.text();
    if (requestId === documentRequest) content.innerHTML = renderMarkdown(source, new URL(url, location.origin).href);
  } catch (error) { if (requestId === documentRequest) content.innerHTML = `<div class="inline-error">${esc(error.message)}</div>`; }
}

document.addEventListener('click', event => {
  const play = event.target.closest('[data-play]');
  if (play) rememberGame(play.dataset.play);
  const pantheon = event.target.closest('[data-pantheon]');
  if (pantheon) { currentPantheon = pantheon.dataset.pantheon; document.querySelectorAll('[data-pantheon]').forEach(button => { const selected = button.dataset.pantheon === currentPantheon; button.classList.toggle('selected',selected); button.setAttribute('aria-pressed',selected); }); refreshCards(); }
  if (event.target.closest('[data-hostless]')) { hostless = !hostless; document.querySelectorAll('[data-hostless]').forEach(button => { button.classList.toggle('active',hostless); button.setAttribute('aria-pressed',hostless); }); refreshCards(); document.querySelector('#collection')?.scrollIntoView({behavior:'smooth',block:'start'}); }
  if (event.target.closest('[data-reset-filters]')) { query=''; search.value=''; currentPantheon='全部'; hostless=false; library(); }
  const doc = event.target.closest('[data-doc-game]');
  if (doc) openDocument(doc.dataset.docGame,Number(doc.dataset.docIndex));
  if (event.target.closest('[data-close-reader]')) reader.close();
  const forget = event.target.closest('[data-forget]');
  if (forget) { forgetGame(forget.dataset.forget); recentView(); }
});
reader.addEventListener('click', event => { if (event.target === reader) reader.close(); });
search.addEventListener('input', () => { query = search.value; if (!document.querySelector('#game-grid')) { location.hash='library'; } else refreshCards(); });
document.querySelector('#global-search').addEventListener('submit', event => { event.preventDefault(); query=search.value; if (!document.querySelector('#game-grid')) location.hash='library'; else document.querySelector('#collection')?.scrollIntoView({behavior:'smooth'}); });
window.addEventListener('hashchange', route);
window.addEventListener('storage', event => { if (event.key === 'mythic-dnd-hub:recent:v1' && location.hash === '#continue') recentView(); });
async function initialize() {
  try { const data=await request('/api/catalog'); games=Array.isArray(data) ? data : data.games; if (!Array.isArray(games)) throw new Error('书库目录格式有误'); route(); }
  catch(error) { main.setAttribute('aria-busy','false'); main.innerHTML=`<section class="empty-state"><h1>书库暂时无法打开</h1><p>${esc(error.message)}</p><button class="button gold" id="retry-load">重新连接</button></section>`; document.querySelector('#retry-load').onclick=initialize; }
}
initialize();
