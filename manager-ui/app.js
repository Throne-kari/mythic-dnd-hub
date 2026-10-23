import {escapeHtml as esc, request, formatDate, formatBytes, coverUrl, shortPantheon, icon, safeUrl} from '/shared.js';

let snapshot = null, selectedId = 'fengshen', currentView = 'overview', inspectorTab = 'logs', tableQuery = '', stateFilter = 'all', busy = new Set(), timer, loading = false;
const main = document.querySelector('#manager-main');
const labels = {overview:'总览',games:'游戏管理',backups:'存档备份',logs:'运行日志'};
const gameById = id => snapshot?.games.find(game => game.id === id);
const stateText = game => game.process?.syncing ? '更新中' : ({running:'运行中',starting:'启动中',stopped:'未启动',error:'启动异常'}[game.process?.state] || '未启动');
const stateClass = game => game.process?.syncing ? 'starting' : (game.process?.state || 'stopped');
const isRunning = game => game.process?.state === 'running';
const gameUrl = game => new URL(`/play/${encodeURIComponent(game.id)}/`, snapshot.hub.publicUrl).href;
const stateBadge = game => `<span class="process-state ${stateClass(game)}"><i></i>${stateText(game)}</span>`;
const duration = seconds => { const days=Math.floor(seconds/86400),hours=Math.floor((seconds%86400)/3600),minutes=Math.floor((seconds%3600)/60); return days ? `${days}天 ${hours}时` : hours ? `${hours}时 ${minutes}分` : `${minutes}分`; };

document.querySelectorAll('[data-icon]').forEach(element => element.innerHTML=icon(element.dataset.icon,20));

function toast(message) {
  const element=document.querySelector('#manager-toast'); element.textContent=message; element.hidden=false;
  clearTimeout(timer); timer=setTimeout(()=>element.hidden=true,4500);
}
function showError(message='') { const element=document.querySelector('#manager-error'); element.textContent=message; element.hidden=!message; }

function updateMetrics() {
  const {games,totals,hub}=snapshot;
  const metricData=[['book',games.length,'部冒险'],['play',totals.running,'运行中'],['folder',totals.saves,'份存档'],['check',totals.ready,'正式版本']];
  document.querySelector('#metrics').innerHTML=metricData.map(([symbol,count,label])=>`<div class="metric">${icon(symbol,28)}<strong>${count}</strong><span>${label}</span></div>`).join('');
  document.querySelector('#hub-uptime').textContent=duration(hub.uptime);
  document.querySelector('#sidebar-processes').textContent=`${totals.running} / ${games.length}`;
  const connection=document.querySelector('#connection-state'); connection.textContent='已连接'; connection.classList.add('connected');
  document.querySelector('#open-library').href=safeUrl(hub.publicUrl);
}

function actionButtons(game, compact=true) {
  const disabled=busy.has(game.id)||game.process?.syncing||game.process?.state==='starting';
  if (game.process?.syncing) return '<button class="table-action" disabled>更新中…</button>';
  if (isRunning(game)) return `<a class="table-action" href="${esc(gameUrl(game))}" target="_blank" rel="noopener">打开 ${icon('external',12)}</a><button class="table-action danger" type="button" data-action="stop" data-game="${esc(game.id)}" ${disabled?'disabled':''}>停止</button>`;
  return `<button class="table-action start" type="button" data-action="start" data-game="${esc(game.id)}" ${disabled?'disabled':''}>${disabled ? '启动中…' : `${icon('play',12)} 启动`}</button>`;
}
function visibleGames() {
  const term=tableQuery.toLocaleLowerCase();
  let list=snapshot.games.filter(game=>(stateFilter==='all'||stateClass(game)===stateFilter)&&(!term||[game.title,game.subtitle,game.pantheon].join(' ').toLocaleLowerCase().includes(term)));
  if (currentView==='overview') list=[...list].sort((a,b)=>Number(isRunning(b))-Number(isRunning(a))).slice(0,7);
  return list;
}
function tableRows() {
  const list=visibleGames();
  if (!list.length) return '<tr><td colspan="5" class="table-empty">没有符合条件的游戏</td></tr>';
  return list.map(game=>`<tr data-row="${esc(game.id)}" class="${game.id===selectedId?'selected':''}"><td><button type="button" class="game-row-select" data-select="${esc(game.id)}"><img src="${coverUrl(game.id)}" alt=""><span><strong>${esc(game.title)}</strong><small>${esc(game.subtitle)}</small></span></button></td><td class="pantheon-cell">${esc(shortPantheon(game.pantheon))}</td><td class="version-cell">v${esc(game.version)}</td><td data-state="${esc(game.id)}">${stateBadge(game)}</td><td><div class="row-actions" data-actions="${esc(game.id)}">${actionButtons(game)}</div></td></tr>`).join('');
}
function gamesView() {
  main.innerHTML=`<div class="management-grid"><section class="game-table-panel"><div class="panel-heading"><h2>${currentView==='overview'?'冒险书库':'全部游戏'}</h2>${currentView==='overview'?'<a href="#games" class="text-link">管理全部 →</a>':`<span class="quiet-count">${snapshot.games.length} 部作品</span>`}</div>${currentView==='games'?`<div class="management-filters"><label class="manager-search">${icon('search',17)}<input type="search" id="table-search" placeholder="搜索游戏或神系" aria-label="搜索游戏或神系" value="${esc(tableQuery)}"></label><select id="state-filter" aria-label="按运行状态筛选"><option value="all" ${stateFilter==='all'?'selected':''}>全部状态</option><option value="running" ${stateFilter==='running'?'selected':''}>运行中</option><option value="stopped" ${stateFilter==='stopped'?'selected':''}>未启动</option><option value="error" ${stateFilter==='error'?'selected':''}>启动异常</option></select></div>`:''}<div class="game-table-scroll"><table class="management-table"><thead><tr><th scope="col">冒险</th><th scope="col">神系</th><th scope="col">版本</th><th scope="col">运行状态</th><th scope="col">操作</th></tr></thead><tbody id="game-rows">${tableRows()}</tbody></table></div>${currentView==='overview'?`<div class="table-footer"><span>${snapshot.totals.running} 部游戏正在运行</span><a href="#games">查看全部 ${snapshot.games.length} 部 ${icon('arrow',15)}</a></div>`:''}</section><aside class="game-inspector" id="inspector" aria-label="所选游戏详情"></aside></div>`;
  renderInspector();
}
function renderInspector() {
  const game=gameById(selectedId)||snapshot.games[0];
  if (!game) return;
  selectedId=game.id;
  const inspector=document.querySelector('#inspector');
  if (!inspector) return;
  inspector.innerHTML=`<div class="inspector-title"><div><span class="eyebrow">${esc(game.pantheon)}</span><h2>${esc(game.title)}</h2></div><a href="${esc(new URL(`#game/${game.id}`,snapshot.hub.publicUrl).href)}" target="_blank" rel="noopener" aria-label="查看${esc(game.title)}详情">${icon('external',19)}</a></div><div class="inspector-image"><img class="art-${esc(game.id)}" src="${coverUrl(game.id)}" alt=""><span id="inspector-state">${stateBadge(game)}</span></div><div class="inspector-tabs" role="group" aria-label="游戏信息"><button data-inspector-tab="details" class="${inspectorTab==='details'?'active':''}" aria-pressed="${inspectorTab==='details'}">详情</button><button data-inspector-tab="logs" class="${inspectorTab==='logs'?'active':''}" aria-pressed="${inspectorTab==='logs'}">日志</button><button data-inspector-tab="saves" class="${inspectorTab==='saves'?'active':''}" aria-pressed="${inspectorTab==='saves'}">存档</button></div><div id="inspector-body"></div><div class="inspector-footer"><a class="button glass backup-action ${game.saveCount?'':'disabled-link'}" href="/api/manage/games/${game.id}/backup" ${game.saveCount?'':'aria-disabled="true" tabindex="-1"'}>${icon('download',18)} 下载存档备份</a></div>`;
  renderInspectorBody();
}
function renderInspectorBody() {
  const game=gameById(selectedId), body=document.querySelector('#inspector-body');
  if (!game||!body) return;
  document.querySelectorAll('[data-inspector-tab]').forEach(button=>{const active=button.dataset.inspectorTab===inspectorTab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',active);});
  if (inspectorTab==='logs') { body.innerHTML='<div class="log-output compact" id="inspector-log" aria-label="游戏运行日志">正在读取日志…</div>'; loadLogs('inspector-log',game.id); }
  else if (inspectorTab==='saves') { body.innerHTML='<div class="inspector-saves" id="inspector-saves">正在读取存档…</div>'; loadSaves(game.id); }
  else body.innerHTML=`<div class="inspector-details"><dl class="process-details"><div><dt>游玩方式</dt><dd>${esc(game.mode)}</dd></div><div><dt>故事篇章</dt><dd>${esc(game.chapters)}</dd></div><div><dt>服务端口</dt><dd id="inspector-port">${game.process?.port||'—'}</dd></div><div><dt>启动时间</dt><dd id="inspector-started">${formatDate(game.process?.startedAt)}</dd></div></dl>${game.process?.lastError?`<div class="inline-error">${esc(game.process.lastError)}</div>`:''}<form id="source-form" data-source-game="${esc(game.id)}"><label for="source-path">本机源目录</label><textarea id="source-path" name="sourcePath" rows="2" spellcheck="false" placeholder="粘贴此游戏的源文件夹绝对路径">${esc(game.sourcePath||'')}</textarea><div class="source-actions"><button class="button subtle" type="submit">保存目录</button><button class="button glass" type="button" data-action="sync" data-game="${esc(game.id)}" ${!game.sourceConfigured||busy.has(game.id)?'disabled':''}>${icon('refresh',15)} 从源目录更新</button></div></form><div class="inspector-process-actions"><button class="button subtle" type="button" data-action="restart" data-game="${esc(game.id)}" ${!isRunning(game)||busy.has(game.id)?'disabled':''}>${icon('refresh',15)} 重启游戏</button><a class="button subtle" href="${esc(gameUrl(game))}" target="_blank" rel="noopener">打开游戏 ${icon('external',15)}</a></div></div>`;
}

async function loadLogs(target,id) {
  const element=document.getElementById(target);
  if (!element) return;
  try {
    const data=await request(`/api/manage/games/${encodeURIComponent(id)}/logs`);
    if (!element.isConnected||id!==selectedId) return;
    const atBottom=element.scrollHeight-element.clientHeight-element.scrollTop<40;
    element.innerHTML=data.lines.length ? data.lines.map(line=>`<div class="log-line ${line.level==='error'?'error':''}"><time>${esc(formatDate(line.time))}</time><span>${esc(line.message)}</span></div>`).join('') : '<div class="log-empty">此游戏尚无运行日志</div>';
    if (atBottom) element.scrollTop=element.scrollHeight;
  } catch(error) { if(element.isConnected) element.innerHTML=`<div class="log-error">${esc(error.message)}</div>`; }
}
async function loadSaves(id) {
  const element=document.querySelector('#inspector-saves');
  try {
    const data=await request(`/api/manage/games/${encodeURIComponent(id)}/saves`);
    if (!element?.isConnected||selectedId!==id) return;
    element.innerHTML=data.files.length?data.files.map(file=>`<a class="save-file" href="${esc(file.downloadUrl)}" download><div><strong>${esc(file.path)}</strong><small>${formatDate(file.modifiedAt)} · ${formatBytes(file.bytes)}</small></div>${icon('download',17)}</a>`).join(''):'<div class="log-empty">此游戏尚无存档</div>';
  } catch(error) { if(element?.isConnected)element.innerHTML=`<div class="inline-error">${esc(error.message)}</div>`; }
}
async function backupsView() {
  main.innerHTML='<section class="backup-panel"><div class="panel-heading"><h2>存档备份</h2><span class="quiet-count">本机游戏数据</span></div><div id="backup-content" class="backup-content">正在读取存档…</div></section>';
  try {
    const data=await request('/api/manage/backups');
    const element=document.querySelector('#backup-content'); if (!element) return;
    element.innerHTML=`<div class="game-table-scroll"><table class="management-table backup-table"><thead><tr><th>冒险</th><th>存档文件</th><th>大小</th><th>最近更新</th><th>备份</th></tr></thead><tbody>${data.games.map(record=>{const game=gameById(record.id);return `<tr><td><div class="game-row-select"><img src="${coverUrl(record.id)}" alt=""><span><strong>${esc(record.title)}</strong><small>${esc(game?.pantheon||'')}</small></span></div></td><td>${record.files}</td><td>${formatBytes(record.bytes)}</td><td>${formatDate(record.lastModified)}</td><td>${record.files?`<a class="table-action" href="${esc(record.downloadUrl)}" download>${icon('download',15)} 下载备份</a>`:'<span class="no-data">尚无存档</span>'}</td></tr>`;}).join('')}</tbody></table></div><div class="runtime-location"><span>${icon('folder',17)} 本机运行目录</span><code>${esc(snapshot.hub.runtimeDir)}</code></div>`;
  }catch(error){const element=document.querySelector('#backup-content');if(element)element.innerHTML=`<div class="inline-error">${esc(error.message)}</div>`;}
}
function logsView() {
  main.innerHTML=`<section class="full-log-panel"><div class="panel-heading"><div class="log-selector"><label for="log-game">游戏</label><select id="log-game">${snapshot.games.map(game=>`<option value="${esc(game.id)}" ${game.id===selectedId?'selected':''}>${esc(game.title)}</option>`).join('')}</select><span id="full-log-state">${stateBadge(gameById(selectedId))}</span></div><button type="button" class="table-action" id="copy-logs">复制日志</button></div><div class="log-output full" id="full-log" aria-label="游戏运行日志">正在读取日志…</div></section>`;
  loadLogs('full-log',selectedId);
}
function renderView() {
  if (!snapshot) return;
  const hash=location.hash.slice(1); currentView=labels[hash]?hash:'overview';
  document.querySelector('#page-title').textContent=labels[currentView];document.title=`${labels[currentView]} · 作者工作台`;
  document.querySelectorAll('[data-view]').forEach(link=>link.classList.toggle('current',link.dataset.view===currentView));
  if (currentView==='backups') backupsView(); else if(currentView==='logs')logsView(); else gamesView();
  main.setAttribute('aria-busy','false');
}
function updateVisibleStates() {
  snapshot.games.forEach(game=>{
    const state=document.querySelector(`[data-state="${game.id}"]`); if(state)state.innerHTML=stateBadge(game);
    const actions=document.querySelector(`[data-actions="${game.id}"]`);if(actions)actions.innerHTML=actionButtons(game);
  });
  const game=gameById(selectedId);
  ['inspector-state','full-log-state'].forEach(id=>{const element=document.getElementById(id);if(element)element.innerHTML=stateBadge(game);});
  if(document.querySelector('#inspector-port'))document.querySelector('#inspector-port').textContent=game.process?.port||'—';
  if(document.querySelector('#inspector-started'))document.querySelector('#inspector-started').textContent=formatDate(game.process?.startedAt);
  if(document.querySelector('#inspector-log'))loadLogs('inspector-log',selectedId);
  if(document.querySelector('#full-log'))loadLogs('full-log',selectedId);
}
async function loadStatus(forceRender=false) {
  if (loading) return;
  loading=true;
  try {const data=await request('/api/manage/status');const first=!snapshot;snapshot=data;if(!gameById(selectedId))selectedId=snapshot.games[0]?.id;updateMetrics();showError();if(first||forceRender)renderView();else updateVisibleStates();}
  catch(error){showError(error.message);const connection=document.querySelector('#connection-state');connection.textContent='连接中断';connection.classList.remove('connected');if(!snapshot){main.setAttribute('aria-busy','false');main.innerHTML='<div class="empty-state"><h2>未连接到本机工作台</h2><button class="button gold" id="retry-manager">重新连接</button></div>';document.querySelector('#retry-manager').onclick=()=>loadStatus(true);}}
  finally{loading=false;}
}
async function operate(id,action) {
  const game=gameById(id); if(!game||busy.has(id))return;
  if(action==='sync'&&isRunning(game)&&!window.confirm(`更新《${game.title}》会先停止游戏，当前房间连接将中断。源目录内容会更新到通用版本，运行存档保持原位。现在停止并更新？`))return;
  busy.add(id);updateVisibleStates();
  const operationLabels={start:'游戏已启动',stop:'游戏已停止',restart:'游戏已重启',sync:'已从源目录更新'};
  try {const result=await request(`/api/manage/games/${encodeURIComponent(id)}/${action}`,{method:'POST',headers:{'Content-Type':'application/json','x-manager-token':snapshot.csrfToken},body:'{}'});toast(result.message&&action==='sync'?result.message:`《${game.title}》${operationLabels[action]}`);await loadStatus(true);}
  catch(error){toast(error.message);showError(error.message);await loadStatus(false);}
  finally{busy.delete(id);updateVisibleStates();}
}

document.addEventListener('click',async event=>{
  const disabledLink=event.target.closest('.disabled-link');if(disabledLink){event.preventDefault();return;}
  const action=event.target.closest('[data-action]');if(action){operate(action.dataset.game,action.dataset.action);return;}
  const select=event.target.closest('[data-select]');if(select){selectedId=select.dataset.select;document.querySelectorAll('[data-row]').forEach(row=>row.classList.toggle('selected',row.dataset.row===selectedId));renderInspector();return;}
  const tab=event.target.closest('[data-inspector-tab]');if(tab){inspectorTab=tab.dataset.inspectorTab;renderInspectorBody();return;}
  if(event.target.closest('#refresh')){await loadStatus(true);toast('状态已刷新');}
  if(event.target.closest('#copy-logs')){try{await navigator.clipboard.writeText(document.querySelector('#full-log').innerText);toast('日志已复制');}catch{toast('无法访问剪贴板，请选择日志文字复制');}}
});
document.addEventListener('input',event=>{if(event.target.id==='table-search'){tableQuery=event.target.value;document.querySelector('#game-rows').innerHTML=tableRows();}});
document.addEventListener('change',event=>{if(event.target.id==='state-filter'){stateFilter=event.target.value;document.querySelector('#game-rows').innerHTML=tableRows();}if(event.target.id==='log-game'){selectedId=event.target.value;logsView();}});
document.addEventListener('submit',async event=>{
  if(event.target.id!=='source-form')return;event.preventDefault();
  const id=event.target.dataset.sourceGame,sourcePath=new FormData(event.target).get('sourcePath').trim(),button=event.target.querySelector('[type=submit]');button.disabled=true;
  try{await request(`/api/manage/sources/${encodeURIComponent(id)}`,{method:'PUT',headers:{'Content-Type':'application/json','x-manager-token':snapshot.csrfToken},body:JSON.stringify({sourcePath})});toast('本机源目录已保存');await loadStatus(true);}catch(error){toast(error.message);}finally{if(button.isConnected)button.disabled=false;}
});
window.addEventListener('hashchange',renderView);
loadStatus(true);
setInterval(()=>{if(!document.hidden)loadStatus(false);},6000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadStatus(false);});
