import http from 'node:http';
import {HttpError} from './util.mjs';

// Only the selected game's loopback process is reachable. MCP never supplies a URL.
export function createMcpNativeRequest(processes) {
  return async ({gameId, path, method = 'GET', headers = {}, body}) => {
    if (typeof path !== 'string' || !path.startsWith('/api/') || path.length > 4096 || /[\r\n\0]/.test(path) || !['GET', 'POST'].includes(method)) throw new HttpError(400, 'MCP原生请求无效。');
    if (method === 'GET' && body !== undefined) throw new HttpError(400, '读取请求不能包含正文。');
    processes.game(gameId);
    const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
    if (payload?.length > 128 * 1024) throw new HttpError(413, 'MCP行动正文过大。');
    const entry = await processes.start(gameId), origin = `http://127.0.0.1:${entry.port}`;
    const outgoing = {Host: `127.0.0.1:${entry.port}`, Origin: origin, Accept: 'application/json'};
    for (const [key, value] of Object.entries(headers)) {
      if (['authorization', 'x-seat-token', 'x-room-id'].includes(key.toLowerCase()) && typeof value === 'string' && value.length <= 1024 && !/[\r\n]/.test(value)) outgoing[key] = value;
    }
    if (payload) { outgoing['Content-Type'] = 'application/json'; outgoing['Content-Length'] = payload.length; }
    return new Promise((resolve, reject) => {
      const request = http.request({hostname: '127.0.0.1', port: entry.port, method, path, headers: outgoing}, response => {
        const chunks = []; let bytes = 0;
        response.on('data', chunk => {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) { response.destroy(); request.destroy(new HttpError(502, '游戏返回内容过大。')); }
          else chunks.push(chunk);
        });
        response.on('error', reject);
        response.on('end', () => {
          try { resolve({status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8'))}); }
          catch { reject(new HttpError(502, '游戏未返回有效JSON。')); }
        });
      });
      request.setTimeout(20000, () => request.destroy(new HttpError(504, '游戏请求超时。')));
      request.on('error', reject);
      request.end(payload);
    });
  };
}
