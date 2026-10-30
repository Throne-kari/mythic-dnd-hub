export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
}

export async function request(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) throw new Error(payload.error?.message || payload.error || payload.message || `请求失败（${response.status}）`);
  return payload;
}

const RECENT_KEY = 'mythic-dnd-hub:recent:v1';
export function readRecent() {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(list) ? list.filter(item => typeof item?.id === 'string' && Number.isFinite(item?.time)).slice(0, 20) : [];
  } catch { return []; }
}
export function rememberGame(id) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([{id, time:Date.now()}, ...readRecent().filter(item => item.id !== id)].slice(0, 20))); } catch {}
}
export function forgetGame(id) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(readRecent().filter(item => item.id !== id))); } catch {}
}
export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN', {month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'});
}
export function formatBytes(value = 0) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}
export function safeUrl(value, fallback = '#') {
  try {
    const url = new URL(value, location.origin);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : fallback;
  } catch { return fallback; }
}

export function documentUrl(gameId, path) {
  return new URL(`./docs/${encodeURIComponent(gameId)}/${String(path).split('/').map(encodeURIComponent).join('/')}`, import.meta.url).href;
}

export const coverFiles = { fengshen:'fengshen.png', qchina:'fengshen.png', japan:'japan.png', qjapan:'japan.png', india:'india.png', qindia:'india.png', norse:'norse-landscape.png', mesopotamia:'mesopotamia.png', greek:'greek.png', celtic:'celtic.png', aztec:'aztec.png', jaffa:'jaffa.png', acre:'jaffa.png' };
export function coverUrl(id) { return new URL(`./assets/covers/${coverFiles[id] || 'celtic.png'}`, import.meta.url).href; }
export function shortPantheon(value = '') { return value === '美索不达米亚' ? '两河' : value.replace('神话', ''); }
export function icon(name, size = 20) {
  const paths = {
    arrow:'<path d="M4 12h15M13 6l6 6-6 6"/>',
    external:'<path d="M6 18 18 6M6 6h12v12"/>',
    back:'<path d="M20 12H5m6-6-6 6 6 6"/>',
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    book:'<path d="M12 5v16M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2Z"/>',
    people:'<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6m2 4a6 6 0 0 1 3 5v2"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 3"/>',
    grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    home:'<path d="m3 10 9-7 9 7v11h-6v-7H9v7H3Z"/>',
    play:'<path d="m8 4 12 8-12 8Z"/>',
    stop:'<rect x="5" y="5" width="14" height="14" rx="1"/>',
    refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 3M4 16l2 3a8 8 0 0 0 13-2"/>',
    download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
    folder:'<path d="M3 6h7l2 3h9v12H3Z"/>',
    log:'<path d="M5 3h14v18H5Zm4 5h6M9 12h6m-6 4h4"/>',
    check:'<path d="m5 12 4 4L20 5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
}

export function renderMarkdown(source, baseUrl = location.href) {
  const inline = value => {
    const images = [];
    const rendered = escapeHtml(value)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, label, path) => {
      try {
        const url = new URL(path.replace(/&amp;/g, '&'), baseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) return label;
        const index = images.push(`<img src="${escapeHtml(url.href)}" alt="${label}" loading="lazy">`) - 1;
        return `\u0000IMG${index}\u0000`;
      } catch { return label; }
    })
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, path) => {
      try {
        const url = new URL(path.replace(/&amp;/g, '&'), baseUrl);
        return ['http:', 'https:'].includes(url.protocol) ? `<a href="${escapeHtml(url.href)}" target="_blank" rel="noopener">${label}</a>` : label;
      } catch { return label; }
    });
    return rendered.replace(/\u0000IMG(\d+)\u0000/g, (_, index) => images[Number(index)]);
  };
  const lines = String(source).replace(/\r/g, '').split('\n');
  const out = [];
  let code = null, list = null, paragraph = [], table = false;
  const flushParagraph = () => { if (paragraph.length) out.push(`<p>${inline(paragraph.join(' '))}</p>`); paragraph = []; };
  const closeList = () => { if (list) out.push(`</${list}>`); list = null; };
  const closeTable = () => { if (table) out.push('</tbody></table></div>'); table = false; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(```|~~~)/.test(line)) {
      flushParagraph(); closeList(); closeTable();
      if (code) { out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null; }
      else code = [];
      continue;
    }
    if (code) { code.push(line); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flushParagraph(); closeList(); closeTable(); const level = Math.min(heading[1].length + 1, 6); out.push(`<h${level}>${inline(heading[2])}</h${level}>`); continue; }
    if (/^\s*[-*_]{3,}\s*$/.test(line)) { flushParagraph(); closeList(); closeTable(); out.push('<hr>'); continue; }
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-+:?\s*\|/.test(lines[i + 1])) {
      flushParagraph(); closeList(); closeTable();
      const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
      out.push(`<div class="table-scroll"><table><thead><tr>${cells.map(cell => `<th>${inline(cell.trim())}</th>`).join('')}</tr></thead><tbody>`); table = true; i++; continue;
    }
    if (table && line.includes('|')) { const cells = line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|'); out.push(`<tr>${cells.map(cell => `<td>${inline(cell.trim())}</td>`).join('')}</tr>`); continue; }
    closeTable();
    const item = line.match(/^\s*([-*+] |\d+\. )(.+)$/);
    if (item) { flushParagraph(); const type = /^\d/.test(item[1]) ? 'ol' : 'ul'; if (list !== type) { closeList(); list = type; out.push(`<${type}>`); } out.push(`<li>${inline(item[2])}</li>`); continue; }
    closeList();
    if (/^>\s?/.test(line)) { flushParagraph(); out.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); continue; }
    if (!line.trim()) flushParagraph(); else paragraph.push(line);
  }
  flushParagraph(); closeList(); closeTable();
  if (code) out.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return out.join('\n');
}
