import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { HttpError, errorResponse, requireSameOrigin } from './util.mjs';

const HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer', 'transfer-encoding', 'upgrade']);
const ASSET_ROOT = /(["'`])(\/(?:api(?:\/|[?#])|assets\/|maps\/|images\/|fonts\/|audio\/|[A-Za-z0-9_-]+\.(?:html?|m?js|css|svg|png|jpe?g|webp|avif|json)(?:[?#/]|(?=["'`]))))/g;

function prefixPath(value, prefix) {
  return value.startsWith('/') && !value.startsWith('//') && value !== prefix && !value.startsWith(prefix + '/') ? prefix + value : value;
}

export function rewriteText(source, contentType, prefix) {
  let output = source;
  if (/html/i.test(contentType)) {
    output = output.replace(/\b(src|href|action|poster)\s*=\s*(["'])(\/[^"']*)\2/gi,
      (all, attribute, quote, value) => `${attribute}=${quote}${prefixPath(value, prefix)}${quote}`);
    const script = `<script src="${prefix}/__hub__/bridge.js"></script>`;
    output = /<head(?:\s[^>]*)?>/i.test(output) ? output.replace(/(<head(?:\s[^>]*)?>)/i, `$1${script}`) : script + output;
  }
  if (/css|html/i.test(contentType)) output = output.replace(/url\(\s*(["']?)(\/[^)"']+)\1\s*\)/gi,
    (all, quote, value) => `url(${quote}${prefixPath(value, prefix)}${quote})`);
  if (/javascript|html/i.test(contentType)) {
    output = output.replace(ASSET_ROOT, (all, quote, value) => quote + prefixPath(value, prefix));
    output = output.replace(/\$\{(?:window\.)?location\.origin\}\/(?!play\/)/g, '${location.origin}' + prefix + '/');
    output = output.replace(/((?:(?:window\.)?location(?:\.href)?\s*=|(?:window\.)?location\.(?:assign|replace)\s*\()\s*)(["'])\/(?!\/)([^"']*)\2/g,
      (all, before, quote, rest) => `${before}${quote}${prefixPath('/' + rest, prefix)}${quote}`);
  }
  return output;
}

function proxyHeaders(req, port) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP.has(key) && key !== 'host' && key !== 'origin' && key !== 'referer' && key !== 'forwarded' && !key.startsWith('x-forwarded-') && key !== 'accept-encoding' && key !== 'content-length' && value != null) headers[key] = value;
  }
  headers.host = `127.0.0.1:${port}`;
  headers['accept-encoding'] = 'identity';
  if (req.headers['content-length']) headers['content-length'] = req.headers['content-length'];
  if (req.headers.origin) headers.origin = `http://127.0.0.1:${port}`;
  return headers;
}

function responseHeaders(response, prefix, port) {
  const headers = {};
  for (const [key, value] of Object.entries(response.headers)) if (!HOP.has(key) && value != null) headers[key] = value;
  if (headers.location) {
    const location = headers.location;
    if (location.startsWith('/')) headers.location = prefixPath(location, prefix);
    else {
      try { const url = new URL(location); if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.port === String(port)) headers.location = prefix + url.pathname + url.search + url.hash; } catch {}
    }
  }
  if (headers['set-cookie']) headers['set-cookie'] = headers['set-cookie'].map(cookie => {
    const clean = cookie.replace(/;\s*Domain=[^;]+/gi, '');
    return /;\s*Path=/i.test(clean) ? clean.replace(/(;\s*Path=)([^;]*)/i, (_, lead, value) => lead + prefixPath(value || '/', prefix)) : clean + `; Path=${prefix}/`;
  });
  headers['x-content-type-options'] = 'nosniff';
  return headers;
}

export async function handleGame(req, res, { url, processes, root }) {
  const match = url.pathname.match(/^\/play\/([a-z0-9-]+)(\/.*)?$/);
  if (!match) throw new HttpError(404, '游戏入口不存在。');
  const [, id, pathname] = match, prefix = `/play/${id}`;
  processes.game(id);
  if (!pathname) { res.writeHead(308, { Location: prefix + '/' + url.search }); res.end(); return; }
  if (pathname === '/__hub__/bridge.js') {
    const script = await fs.readFile(path.join(root, 'server', 'browser-bridge.js'));
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' }); res.end(script); return;
  }
  if (pathname === '/api/stop' || pathname.startsWith('/api/manage/')) throw new HttpError(403, '此操作仅在本机作者台提供。');
  requireSameOrigin(req, true);
  const entry = await processes.start(id), port = entry.port;
  const upstream = http.request({ hostname: '127.0.0.1', port, path: pathname + url.search, method: req.method, headers: proxyHeaders(req, port) });
  upstream.on('response', response => {
    const headers = responseHeaders(response, prefix, port), type = String(headers['content-type'] || '');
    const networkInfo = pathname === '/api/network' && response.statusCode === 200 && /application\/json/i.test(type);
    const transform = networkInfo || /(?:text\/html|(?:text|application)\/(?:javascript|x-javascript)|text\/css)/i.test(type);
    if (transform && req.method !== 'HEAD') {
      const chunks = []; let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > 24 * 1024 * 1024) { upstream.destroy(); errorResponse(res, new HttpError(502, '游戏页面过大。')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => {
        if (res.destroyed) return;
        let text = Buffer.concat(chunks).toString('utf8');
        if (networkInfo) {
          try {
            const info = JSON.parse(text);
            const https = req.socket.encrypted || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
            const origin = process.env.PUBLIC_URL || (req.headers.origin || `${https ? 'https' : 'http'}://${req.headers.host}`);
            const entryUrl = new URL(prefix, origin).href;
            text = JSON.stringify({ ...info, scope: 'GATEWAY', loopbackOnly: false, addresses: [entryUrl], message: '使用当前游戏地址邀请同行者，房间邀请码由游戏内创建。' });
          } catch {}
        } else text = rewriteText(text, type, prefix);
        const output = Buffer.from(text);
        delete headers['content-encoding']; delete headers.etag; delete headers['content-md5'];
        headers['content-length'] = output.length; headers['cache-control'] = 'no-cache';
        res.writeHead(response.statusCode, headers); res.end(output);
      });
      response.on('error', () => errorResponse(res, new HttpError(502, '游戏页面读取中断。')));
    } else {
      if (type.startsWith('text/event-stream')) { delete headers['content-length']; headers['x-accel-buffering'] = 'no'; headers['cache-control'] = 'no-cache, no-store'; }
      res.writeHead(response.statusCode, headers);
      if (type.startsWith('text/event-stream')) res.flushHeaders();
      response.pipe(res);
      response.on('error', () => res.destroy());
    }
  });
  upstream.on('error', error => { processes.log(id, 'error', `网关连接失败：${error.message}`); errorResponse(res, new HttpError(502, '游戏服务连接中断，请刷新页面。')); });
  req.on('aborted', () => upstream.destroy());
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
}

export async function handleUpgrade(req, socket, head, processes) {
  try {
    requireSameOrigin(req);
    const url = new URL(req.url, 'http://hub.local'), match = url.pathname.match(/^\/play\/([a-z0-9-]+)(\/.*)$/);
    if (!match) throw new HttpError(404, '未找到 WebSocket 路由。');
    const [, id, pathname] = match, entry = await processes.start(id);
    const headers = { ...proxyHeaders(req, entry.port), connection: 'Upgrade', upgrade: req.headers.upgrade || 'websocket' };
    const upstream = http.request({ hostname: '127.0.0.1', port: entry.port, path: pathname + url.search, method: req.method, headers });
    upstream.on('upgrade', (response, remote, remoteHead) => {
      const lines = [`HTTP/1.1 ${response.statusCode} ${response.statusMessage}`, ...Object.entries(response.headers).flatMap(([key, value]) => Array.isArray(value) ? value.map(v => `${key}: ${v}`) : [`${key}: ${value}`]), '', ''];
      socket.write(lines.join('\r\n')); if (remoteHead.length) socket.write(remoteHead); if (head.length) remote.write(head);
      remote.pipe(socket); socket.pipe(remote);
      socket.on('error', () => remote.destroy()); remote.on('error', () => socket.destroy()); socket.on('close', () => remote.destroy());
    });
    upstream.on('response', response => { socket.end(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\nConnection: close\r\n\r\n`); response.resume(); });
    upstream.on('error', () => socket.destroy());
    socket.on('error', () => upstream.destroy());
    upstream.end();
  } catch (error) { socket.end(`HTTP/1.1 ${error.status || 500} Request Failed\r\nConnection: close\r\n\r\n`); }
}
