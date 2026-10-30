import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import { GameProcesses } from './processes.mjs';
import { handleGame, handleUpgrade } from './proxy.mjs';
import { createMcpNativeRequest } from './mcp-native-transport.mjs';
import { HttpError, json, body, errorResponse, serveStatic, safeFile, requireSameOrigin } from './util.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const PUBLIC_KEYS = ['id', 'pantheon', 'title', 'subtitle', 'version', 'status', 'players', 'tags', 'description', 'cover', 'chapters', 'setting', 'mode', 'features', 'contentRating', 'engine', 'series'];
const DOCUMENT_TYPES = new Set(['.md', '.txt', '.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg']);

function port(value, fallback) {
  const result = Number(value || fallback);
  if (!Number.isInteger(result) || result < 1024 || result > 65535) throw Error('端口必须为 1024–65535 的整数。');
  return result;
}

function publicGame(game, processes) {
  const value = Object.fromEntries(PUBLIC_KEYS.filter(key => game[key] !== undefined).map(key => [key, game[key]]));
  return { ...value, playUrl: `/play/${game.id}/`, running: processes.status(game.id).state === 'running', docs: documents(game) };
}

function documents(game) {
  return (game.docs || []).map(doc => ({ title: doc.title, path: doc.path, url: `/docs/${game.id}/${doc.path.split(/[\\/]/).map(encodeURIComponent).join('/')}` }));
}

async function listSaves(runtimeDir, gameId) {
  const root = path.join(runtimeDir, gameId), files = [];
  const walk = async (directory, relative = '') => {
    let entries;
    try { entries = await fs.readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return; throw error; }
    for (const entry of entries) {
      if (entry.isSymbolicLink() || entry.name.startsWith('.')) continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (!/^(?:agent|bridge|requests|responses|logs|tunnel)$/i.test(entry.name)) await walk(path.join(directory, entry.name), name);
      } else if (entry.isFile() && /\.json$/i.test(entry.name) && !/^runtime(?:[-_.]|$)/i.test(entry.name)) {
        const stat = await fs.stat(path.join(directory, entry.name));
        files.push({ path: name, bytes: stat.size, modifiedAt: stat.mtime.toISOString(), downloadUrl: `/api/manage/games/${gameId}/save?path=${encodeURIComponent(name)}` });
      }
      if (files.length > 10000) throw new HttpError(413, '存档数量过多，请从本机运行目录读取。');
    }
  };
  await walk(root);
  return files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

async function readSources(root) {
  try {
    const value = JSON.parse(await fs.readFile(path.join(root, 'author-sources.local.json'), 'utf8'));
    return value && value.games && typeof value.games === 'object' && !Array.isArray(value.games) ? value : { version: 1, games: {} };
  } catch (error) { if (error.code === 'ENOENT') return { version: 1, games: {} }; throw error; }
}

function requireManager(req, token, managerPort, write = false) {
  if (!LOOPBACK.has(req.socket.remoteAddress) || req.headers.forwarded || Object.keys(req.headers).some(key => key.startsWith('x-forwarded-'))) throw new HttpError(403, '作者台仅允许本机直接访问。');
  let host;
  try { host = new URL(`http://${req.headers.host || ''}`); } catch { throw new HttpError(403, '主机地址无效。'); }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname) || host.port !== String(managerPort)) throw new HttpError(403, '请通过本机地址访问作者台。');
  requireSameOrigin(req);
  if (write) {
    const supplied = req.headers['x-manager-token'];
    if (typeof supplied !== 'string' || Buffer.byteLength(supplied) !== Buffer.byteLength(token) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(token))) throw new HttpError(403, '作者台会话已失效，请刷新页面。');
  }
}

function maintain(processes, operation) {
  const next = (processes.maintenanceQueue || Promise.resolve()).then(operation);
  processes.maintenanceQueue = next.catch(() => {});
  return next;
}

async function synchronize(game, processes, root) {
  return maintain(processes, () => synchronizeNow(game, processes, root));
}

async function synchronizeNow(game, processes, root) {
  const entry = processes.entry(game.id);
  if (entry.syncing) throw new HttpError(409, '这款游戏正在更新。');
  const sources = await readSources(root);
  if (!sources.games[game.id]?.source) throw new HttpError(409, '请先保存本机源目录。');
  entry.syncing = true;
  try {
    await processes.stop(game.id);
    processes.log(game.id, 'info', '开始从本机源目录导入通用版本。');
    await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [path.join(root, 'scripts', 'import-games.mjs'), '--game', game.id, '--update'], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
      child.stdout.on('data', chunk => processes.log(game.id, 'info', chunk));
      child.stderr.on('data', chunk => processes.log(game.id, 'error', chunk));
      child.once('error', reject);
      child.once('exit', code => code === 0 ? resolve() : reject(new Error(`源目录导入失败（${code}），详情见运行日志。`)));
    });
    const updated = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));
    const replacement = (Array.isArray(updated) ? updated : updated.games).find(item => item.id === game.id);
    if (replacement) Object.assign(game, replacement);
    processes.log(game.id, 'info', '源目录导入完成；存档保持不变。');
  } catch (error) {
    processes.log(game.id, 'error', error.message);
    throw new HttpError(500, error.message);
  } finally { entry.syncing = false; }
}

export async function startHub({ management = true } = {}) {
  try { process.loadEnvFile(path.join(ROOT, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (process.env.HUB_MANAGER === '0') management = false;
  const root = ROOT, runtimeDir = path.resolve(root, process.env.HUB_RUNTIME_DIR || 'runtime');
  const host = process.env.HOST || '0.0.0.0', publicPort = port(process.env.PORT, 4780), managerPort = port(process.env.MANAGER_PORT, 4781);
  if (management && publicPort === managerPort) throw Error('网站和作者台须使用不同端口。');
  const rawCatalog = JSON.parse(await fs.readFile(path.join(root, 'catalog.json'), 'utf8'));
  const catalog = Array.isArray(rawCatalog) ? rawCatalog : rawCatalog.games;
  if (!Array.isArray(catalog) || !catalog.length || catalog.some(game => !/^[a-z0-9-]+$/.test(game.id) || !game.directory) || new Set(catalog.map(game => game.id)).size !== catalog.length) throw Error('catalog.json 游戏目录格式无效。');
  await fs.mkdir(runtimeDir, { recursive: true, mode: 0o700 });
  const processes = new GameProcesses({ root, runtimeDir, catalog }), csrfToken = randomBytes(32).toString('base64url');
  const startedAt = Date.now(), publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || `http://${['0.0.0.0', '::'].includes(host) ? 'localhost' : host}:${publicPort}`, managerUrl = `http://127.0.0.1:${managerPort}/manage/`;
  const counts = () => ({ total: catalog.length, ready: catalog.filter(game => game.status === 'ready').length, development: catalog.filter(game => game.status === 'development').length });
  let closing = false, mcpInstance = null, mcpPromise = null;
  const mcp = () => {
    if (closing) throw new HttpError(503, '服务正在关闭。');
    return mcpPromise ||= import('./mcp/index.mjs').then(({createMcpHttpHandler}) => {
      mcpInstance = createMcpHttpHandler({origin: new URL(publicUrl).origin, nativeRequest: createMcpNativeRequest(processes)});
      return mcpInstance;
    }).catch(() => { mcpPromise = null; throw new HttpError(503, 'MCP组件未就绪，请确认已安装server/mcp依赖。'); });
  };

  async function publicRequest(req, res) {
    try {
      const url = new URL(req.url, 'http://hub.local');
      if (url.pathname.startsWith('/mcp/')) return await (await mcp()).handle(req, res);
      if (url.pathname.startsWith('/play/')) return await handleGame(req, res, { url, processes, root });
      // Two existing browser rule modules import this pure, data-free helper.
      // Keep an exact allowlist; the remainder of server/ is never public.
      if (url.pathname === '/server/combat-ledger.mjs' && ['GET', 'HEAD'].includes(req.method)) return await serveStatic(req, res, path.join(root, 'server'), 'combat-ledger.mjs');
      if (url.pathname === '/api/catalog' && req.method === 'GET') return json(res, 200, { games: catalog.map(game => publicGame(game, processes)), counts: counts(), ephemeralStorage: process.env.HUB_EPHEMERAL_STORAGE === '1' });
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, games: catalog.length });
      const launch = url.pathname.match(/^\/api\/games\/([a-z0-9-]+)\/launch$/);
      if (launch && req.method === 'POST') { requireSameOrigin(req); await body(req); await processes.start(launch[1]); return json(res, 200, { ok: true, url: `/play/${launch[1]}/` }); }
      const docs = url.pathname.match(/^\/api\/games\/([a-z0-9-]+)\/docs$/);
      if (docs && req.method === 'GET') return json(res, 200, { docs: documents(processes.game(docs[1])) });
      const doc = url.pathname.match(/^\/docs\/([a-z0-9-]+)\/(.+)$/);
      if (doc && ['GET', 'HEAD'].includes(req.method)) {
        const game = processes.game(doc[1]); let requested;
        try { requested = decodeURIComponent(doc[2]); } catch { throw new HttpError(400, '路径无效。'); }
        const segments = requested.split('/');
        if (!DOCUMENT_TYPES.has(path.extname(requested).toLowerCase()) || segments.some(segment => segment.startsWith('.') || /^(?:runtime|rooms|saves|credentials|secrets)(?:$|[-_.])/i.test(segment))) throw new HttpError(404, '资料不存在。');
        return await serveStatic(req, res, path.resolve(root, game.directory), requested);
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/manage')) throw new HttpError(404, '页面不存在。');
      if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, '不支持此请求方式。');
      let relative;
      try { relative = decodeURIComponent(url.pathname); } catch { throw new HttpError(400, '路径无效。'); }
      return await serveStatic(req, res, path.join(root, 'public'), relative === '/' ? 'index.html' : relative);
    } catch (error) { errorResponse(res, error); }
  }

  async function managerRequest(req, res) {
    try {
      requireManager(req, csrfToken, managerPort, !['GET', 'HEAD'].includes(req.method));
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Frame-Options', 'DENY');
      const url = new URL(req.url, managerUrl);
      if (url.pathname === '/') { res.writeHead(302, { Location: '/manage/' }); res.end(); return; }
      if (url.pathname === '/api/manage/status' && req.method === 'GET') {
        const sources = await readSources(root);
        const games = await Promise.all(catalog.map(async game => ({ ...publicGame(game, processes), process: processes.status(game.id), saveCount: (await listSaves(runtimeDir, game.id)).length, sourcePath: sources.games[game.id]?.source || '', sourceConfigured: Boolean(sources.games[game.id]?.source) })));
        return json(res, 200, { ok: true, csrfToken, hub: { publicUrl, managerUrl, uptime: Math.floor((Date.now() - startedAt) / 1000), runtimeDir, startedAt: new Date(startedAt).toISOString() }, games, totals: { ...counts(), running: games.filter(game => game.process.state === 'running').length, saves: games.reduce((sum, game) => sum + game.saveCount, 0) } });
      }
      if (url.pathname === '/api/manage/sources' && req.method === 'GET') {
        const sources = await readSources(root);
        return json(res, 200, { games: catalog.map(game => ({ id: game.id, title: game.title, sourcePath: sources.games[game.id]?.source || '', configured: Boolean(sources.games[game.id]?.source) })) });
      }
      const source = url.pathname.match(/^\/api\/manage\/sources\/([a-z0-9-]+)$/);
      if (source && req.method === 'PUT') {
        processes.game(source[1]);
        const value = await body(req), sourcePath = String(value.sourcePath || '').trim();
        if (sourcePath && (!path.isAbsolute(sourcePath) || !(await fs.stat(sourcePath).catch(() => null))?.isDirectory())) throw new HttpError(400, '请填写存在的绝对目录路径。');
        await maintain(processes, async () => {
          const sources = await readSources(root);
          if (sourcePath) sources.games[source[1]] = { source: path.resolve(sourcePath) }; else delete sources.games[source[1]];
          const destination = path.join(root, 'author-sources.local.json');
          await fs.writeFile(destination + '.tmp', JSON.stringify(sources, null, 2) + '\n', { mode: 0o600 });
          await fs.rename(destination + '.tmp', destination);
        });
        return json(res, 200, { ok: true, sourcePath });
      }
      if (url.pathname === '/api/manage/backups' && req.method === 'GET') {
        const games = await Promise.all(catalog.map(async game => {
          const files = await listSaves(runtimeDir, game.id);
          return { id: game.id, title: game.title, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), lastModified: files[0]?.modifiedAt || null, downloadUrl: `/api/manage/games/${game.id}/backup` };
        }));
        return json(res, 200, { games });
      }
      const action = url.pathname.match(/^\/api\/manage\/games\/([a-z0-9-]+)\/([a-z-]+)$/);
      if (action) {
        const [, id, operation] = action, game = processes.game(id);
        if (req.method === 'POST' && ['start', 'stop', 'restart', 'sync', 'import'].includes(operation)) {
          await body(req);
          if (operation === 'start') await processes.start(id);
          if (operation === 'stop') await processes.stop(id);
          if (operation === 'restart') { await processes.stop(id); await processes.start(id); }
          if (['sync', 'import'].includes(operation)) await synchronize(game, processes, root);
          return json(res, 200, { ok: true, game: { ...publicGame(game, processes), process: processes.status(id) }, message: ['sync', 'import'].includes(operation) ? '已从源目录更新，存档保持不变。' : '操作完成。' });
        }
        if (req.method === 'GET' && operation === 'logs') return json(res, 200, { lines: processes.entry(id).logs });
        if (req.method === 'GET' && operation === 'saves') return json(res, 200, { files: await listSaves(runtimeDir, id) });
        if (req.method === 'GET' && operation === 'save') {
          const relative = url.searchParams.get('path'), files = await listSaves(runtimeDir, id);
          if (!files.some(file => file.path === relative)) throw new HttpError(404, '存档不存在。');
          const file = await safeFile(path.join(runtimeDir, id), relative);
          const content = await fs.readFile(file);
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Disposition': `attachment; filename="${id}-save.json"; filename*=UTF-8''${encodeURIComponent(path.basename(relative))}`, 'Content-Length': content.length }); res.end(content); return;
        }
        if (operation === 'backup' && req.method === 'POST') { await body(req); return json(res, 200, { ok: true, url: `/api/manage/games/${id}/backup` }); }
        if (operation === 'backup' && req.method === 'GET') {
          const metadata = await listSaves(runtimeDir, id);
          if (metadata.reduce((sum, file) => sum + file.bytes, 0) > 128 * 1024 * 1024) throw new HttpError(413, '存档超过 128 MiB，请直接复制本机运行目录。');
          const files = await Promise.all(metadata.map(async file => ({ path: file.path, encoding: 'utf8', content: await fs.readFile(await safeFile(path.join(runtimeDir, id), file.path), 'utf8') })));
          return json(res, 200, { format: 'mythic-dnd-save-backup', version: 1, game: { id, title: game.title, version: game.version }, createdAt: new Date().toISOString(), files }, { 'Content-Disposition': `attachment; filename="${id}-backup-${new Date().toISOString().slice(0, 10)}.json"` });
        }
      }
      if (url.pathname.startsWith('/api/')) throw new HttpError(404, '管理接口不存在。');
      if (!['GET', 'HEAD'].includes(req.method)) throw new HttpError(405, '不支持此请求方式。');
      if (url.pathname === '/manage') { res.writeHead(308, { Location: '/manage/' }); res.end(); return; }
      if (url.pathname.startsWith('/manage/')) return await serveStatic(req, res, path.join(root, 'manager-ui'), decodeURIComponent(url.pathname.slice('/manage/'.length)) || 'index.html');
      return await serveStatic(req, res, path.join(root, 'public'), decodeURIComponent(url.pathname));
    } catch (error) { errorResponse(res, error); }
  }

  const server = http.createServer(publicRequest), manager = management ? http.createServer(managerRequest) : null;
  server.requestTimeout = 0;
  server.on('upgrade', (req, socket, head) => { void handleUpgrade(req, socket, head, processes); });
  const listen = (service, targetPort, targetHost) => new Promise((resolve, reject) => { service.once('error', reject); service.listen(targetPort, targetHost, () => { service.off('error', reject); resolve(); }); });
  try {
    await listen(server, publicPort, host);
    if (manager) await listen(manager, managerPort, '127.0.0.1');
  } catch (error) {
    server.close(); manager?.close(); await processes.close();
    throw new Error(error.code === 'EADDRINUSE' ? '启动端口已被占用。请关闭旧的集合服务，或设置 PORT 和 MANAGER_PORT。' : error.message);
  }
  console.log(`神话 DND 集合：${publicUrl}/`);
  if (manager) console.log(`作者本机工作台：${managerUrl}`);
  console.log(`运行数据：${runtimeDir}`);
  const close = async () => {
    if (closing) return; closing = true;
    server.close(); manager?.close();
    if (mcpPromise) await mcpPromise.catch(() => {});
    if (mcpInstance) await mcpInstance.close();
    await processes.close();
    server.closeAllConnections(); manager?.closeAllConnections();
  };
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await close(); process.exit(0); });
  return { server, manager, processes, close, publicUrl, managerUrl: manager ? managerUrl : null };
}
