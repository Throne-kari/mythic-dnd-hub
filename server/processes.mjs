import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { HttpError, contained, sleep } from './util.mjs';

async function availablePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function portReady(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const done = value => { socket.destroy(); resolve(value); };
    socket.setTimeout(250);
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
    socket.once('timeout', () => done(false));
  });
}

function redact(message) {
  return String(message).replace(/\bsk-[A-Za-z0-9_-]{12,}/g, '[已隐藏密钥]')
    .replace(/(Bearer\s+)[^\s"']+/gi, '$1[已隐藏]')
    .replace(/((?:api[_-]?key|processToken|managementToken|seatToken|accessToken)["']?\s*[:=]\s*["']?)[^\s,"'}]+/gi, '$1[已隐藏]');
}

export class GameProcesses {
  constructor({ root, runtimeDir, catalog }) {
    this.root = root; this.runtimeDir = runtimeDir; this.catalog = catalog; this.entries = new Map(); this.closing = false;
  }

  game(id) {
    const game = this.catalog.find(item => item.id === id);
    if (!game) throw new HttpError(404, '未找到这款游戏。');
    return game;
  }

  entry(id) {
    this.game(id);
    if (!this.entries.has(id)) this.entries.set(id, { state: 'stopped', child: null, port: null, startedAt: null, lastError: null, logs: [], starting: null, stopping: null, syncing: false });
    return this.entries.get(id);
  }

  status(id) {
    const entry = this.entry(id);
    return { state: entry.state, pid: entry.child?.pid || null, port: entry.port, startedAt: entry.startedAt, lastError: entry.lastError, syncing: entry.syncing };
  }

  log(id, level, message) {
    const entry = this.entry(id);
    for (const line of String(message).split(/\r?\n/).filter(Boolean)) entry.logs.push({ time: new Date().toISOString(), level, message: redact(line).slice(0, 16384) });
    if (entry.logs.length > 400) entry.logs.splice(0, entry.logs.length - 400);
  }

  async start(id) {
    if (this.closing) throw new HttpError(503, '集合服务正在关闭。');
    const game = this.game(id), entry = this.entry(id);
    if (entry.syncing) throw new HttpError(409, '游戏正在从源目录更新。');
    if (entry.stopping) await entry.stopping;
    if (entry.state === 'running' && entry.child) return entry;
    if (entry.starting) return entry.starting;
    entry.starting = this.launch(game, entry).finally(() => { entry.starting = null; });
    return entry.starting;
  }

  async launch(game, entry) {
    entry.state = 'starting'; entry.lastError = null;
    try {
      const gameRoot = path.resolve(this.root, game.directory), executable = path.resolve(gameRoot, game.entry || 'server.mjs');
      if (!contained(path.join(this.root, 'games'), gameRoot) || !contained(gameRoot, executable)) throw new HttpError(400, '游戏目录配置无效。');
      await fs.access(executable);
      const dataDir = path.join(this.runtimeDir, game.id);
      await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
      entry.port = await availablePort();
      const environment = {
        ...process.env, PORT: String(entry.port), HOST: '127.0.0.1', HUB_DATA_DIR: dataDir,
        [game.portEnv || 'PORT']: String(entry.port), [game.hostEnv || 'HOST']: '127.0.0.1',
      };
      if (game.dataEnv) environment[game.dataEnv] = dataDir;
      const child = spawn(process.execPath, [executable, `--port=${entry.port}`], {
        cwd: gameRoot, env: environment, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      entry.child = child; entry.startedAt = new Date().toISOString();
      const collect = (stream, level) => {
        let pending = '';
        stream.setEncoding('utf8');
        stream.on('data', chunk => { pending += chunk; const pieces = pending.split(/\r?\n/); pending = pieces.pop(); for (const line of pieces) this.log(game.id, level, line); if (pending.length > 32768) { this.log(game.id, level, pending); pending = ''; } });
        stream.on('end', () => { if (pending) this.log(game.id, level, pending); });
      };
      collect(child.stdout, 'info'); collect(child.stderr, 'error');
      child.on('error', error => { entry.lastError = error.message; entry.state = 'error'; this.log(game.id, 'error', error.message); });
      child.on('exit', (code, signal) => {
        if (entry.child !== child) return;
        entry.child = null;
        const expected = Boolean(entry.stopping) || this.closing;
        entry.state = expected || code === 0 ? 'stopped' : 'error';
        if (!expected && code !== 0) entry.lastError = `游戏进程已退出（${signal || code}）`;
        this.log(game.id, expected || code === 0 ? 'info' : 'error', `游戏进程结束（${signal || code}）`);
      });
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline && entry.child === child && entry.state !== 'error') {
        if (await portReady(entry.port)) {
          entry.state = 'running'; this.log(game.id, 'info', `游戏已就绪，内部端口 ${entry.port}`); return entry;
        }
        await sleep(100);
      }
      throw new HttpError(503, entry.lastError || '游戏启动未完成，请查看作者台日志。');
    } catch (error) {
      if (entry.child) entry.child.kill();
      entry.state = 'error'; entry.lastError = error.message; this.log(game.id, 'error', error.message);
      throw error.status ? error : new HttpError(503, '游戏启动失败，请查看作者台日志。');
    }
  }

  async stop(id) {
    const entry = this.entry(id);
    if (entry.stopping) return entry.stopping;
    entry.stopping = (async () => {
      if (entry.starting) await entry.starting.catch(() => {});
      const child = entry.child;
      if (!child) { entry.state = 'stopped'; return; }
      this.log(id, 'info', '正在停止游戏。');
      child.kill('SIGTERM');
      const deadline = Date.now() + 4000;
      while (entry.child === child && Date.now() < deadline) await sleep(100);
      if (entry.child === child) { child.kill('SIGKILL'); await sleep(100); }
      entry.state = 'stopped';
    })().finally(() => { entry.stopping = null; });
    return entry.stopping;
  }

  async close() {
    this.closing = true;
    await Promise.allSettled([...this.entries.keys()].map(id => this.stop(id)));
  }
}
