import fs from 'node:fs/promises';
import path from 'node:path';
import { createReadStream } from 'node:fs';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function json(res, status, value, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(value));
}

export function errorResponse(res, error) {
  if (res.headersSent) { res.destroy(); return; }
  json(res, error.status || 500, { ok: false, error: error.status ? error.message : '服务处理失败，请查看作者台运行日志。' });
}

export async function body(req, limit = 64 * 1024) {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] || '')) throw new HttpError(415, '请使用 JSON 请求。');
  let size = 0; const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, '请求过大。');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value;
  } catch { throw new HttpError(400, 'JSON 格式无效。'); }
}

export function contained(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

export async function safeFile(root, relative) {
  if (relative.includes('\0') || relative.includes('\\')) throw new HttpError(400, '路径无效。');
  const absolute = path.resolve(root, relative.replace(/^\/+/, ''));
  if (!contained(root, absolute)) throw new HttpError(403, '禁止访问此路径。');
  let real, base;
  try { [real, base] = await Promise.all([fs.realpath(absolute), fs.realpath(root)]); }
  catch { throw new HttpError(404, '文件不存在。'); }
  if (!contained(base, real) || !(await fs.stat(real)).isFile()) throw new HttpError(404, '文件不存在。');
  return real;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};

export async function serveStatic(req, res, root, relative) {
  const file = await safeFile(root, relative || 'index.html');
  const type = MIME[path.extname(file).toLowerCase()];
  if (!type) throw new HttpError(404, '文件类型不公开提供。');
  const stat = await fs.stat(file);
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': stat.size, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
  if (req.method === 'HEAD') return res.end();
  const stream = createReadStream(file);
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

export function requireSameOrigin(req, allowNavigation = false) {
  const navigation = allowNavigation && ['GET', 'HEAD'].includes(req.method) && req.headers['sec-fetch-mode'] === 'navigate' && req.headers['sec-fetch-dest'] === 'document';
  if (req.headers['sec-fetch-site'] === 'cross-site' && !navigation) throw new HttpError(403, '不接受跨站请求。');
  if (req.headers.origin) {
    let origin;
    try { origin = new URL(req.headers.origin); } catch { throw new HttpError(403, '来源无效。'); }
    if (!['http:', 'https:'].includes(origin.protocol) || origin.host !== req.headers.host) throw new HttpError(403, '只允许同站请求。');
  }
}

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
