import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

export const PROTOCOL_VERSION = 1;
export const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9_-]{7,95}$/;
const directories = ['inbox', 'snapshots', 'receipts', 'logs'];
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function parseProposal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('回复必须是 JSON 对象。');
  const allowed = ['protocolVersion', 'requestId', 'revision', 'actionIndex', 'narration'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw Error('回复含未允许字段；只能选择快照中的行动索引。');
  if (value.protocolVersion !== PROTOCOL_VERSION || !requestIdPattern.test(value.requestId || '')) throw Error('协议版本或 requestId 无效。');
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) throw Error('revision 无效。');
  if (value.actionIndex !== null && (!Number.isSafeInteger(value.actionIndex) || value.actionIndex < 0)) throw Error('actionIndex 必须是非负整数或 null。');
  if (value.narration !== undefined && (typeof value.narration !== 'string' || value.narration.length > 4000)) throw Error('narration 过长或格式无效。');
  return {...value, narration: value.narration || ''};
}

export async function atomicWrite(file, content) {
  const temp = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await fs.open(temp, 'wx', 0o600);
    await handle.writeFile(content, typeof content === 'string' ? {encoding: 'utf8'} : undefined);
    await handle.sync();
    await handle.close(); handle = null;
    await fs.rename(temp, file);
  } finally { await handle?.close().catch(() => {}); await fs.unlink(temp).catch(() => {}); }
}

export async function atomicJson(file, value) {
  await atomicWrite(file, JSON.stringify(value, null, 2) + '\n');
}

// This bridge reads only regular JSON files in its own inbox. Its protocol has no
// paths, shell commands, tools, credentials, or user-defined executable code.
export class FolderBridge {
  constructor(root, submit, {now = Date.now, timeoutMs = 120000} = {}) {
    this.root = path.resolve(root); this.submit = submit; this.now = now;
    this.timeoutMs = timeoutMs; this.running = false;
  }
  async initialize() {
    await fs.mkdir(this.root, {recursive: true, mode: 0o700});
    if ((await fs.lstat(this.root)).isSymbolicLink()) throw Error('桥目录不能是符号链接。');
    for (const dir of directories) {
      const target = path.join(this.root, dir);
      await fs.mkdir(target, {recursive: true, mode: 0o700});
      if ((await fs.lstat(target)).isSymbolicLink()) throw Error('桥目录不能是符号链接。');
    }
  }
  async publish(snapshot) {
    if (!requestIdPattern.test(snapshot.requestId)) throw Error('requestId 无效。');
    await atomicJson(path.join(this.root, 'snapshots', `${snapshot.requestId}.json`), snapshot);
  }
  async recordReceipt(requestId, value) {
    if (!requestIdPattern.test(requestId)) throw Error('requestId 无效。');
    await atomicJson(path.join(this.root, 'receipts', `${requestId}.json`), value);
  }
  async pump() {
    if (this.running) return;
    this.running = true;
    const results = [];
    try {
      const names = (await fs.readdir(path.join(this.root, 'inbox'))).sort().slice(0, 100);
      for (const name of names) {
        if (!/^[A-Za-z0-9][A-Za-z0-9_-]{7,95}\.json$/.test(name)) continue;
        const file = path.join(this.root, 'inbox', name);
        const stat = await fs.lstat(file).catch(() => null);
        if (!stat?.isFile() || stat.isSymbolicLink()) continue;
        let payload, receipt;
        const id = name.slice(0, -5);
        try {
          if (stat.size > 65536) throw Error('回复文件超过 64 KiB。');
          const handle = await fs.open(file, 'r');
          try {
            const opened = await handle.stat();
            if (opened.ino !== stat.ino || opened.size > 65536) throw Error('回复文件在读取前已更换。');
            const buffer = Buffer.alloc(65537);
            const {bytesRead} = await handle.read(buffer, 0, buffer.length, 0);
            if (bytesRead > 65536) throw Error('回复文件超过 64 KiB。');
            payload = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
          } finally { await handle.close(); }
          payload = parseProposal(payload);
          if (payload.requestId !== id) throw Error('文件名与 requestId 不一致。');
          receipt = await this.submit(payload);
        } catch (error) {
          receipt = {ok: false, status: 'rejected', requestId: id, error: {code: 'BRIDGE_REJECTED', message: error.message}};
        }
        const record = {...receipt, requestId: id, receivedAt: new Date(this.now()).toISOString(), ...(payload ? {payloadHash: digest(payload)} : {})};
        await this.recordReceipt(id, record);
        await atomicJson(path.join(this.root, 'logs', `${id}-${randomUUID()}.json`), record);
        await fs.unlink(file).catch(() => {});
        results.push(record);
      }
      return results;
    } finally { this.running = false; }
  }
}

// A mock or a future provider adapter may implement this pure boundary. There is
// deliberately no fetch, environment lookup, key loading or implicit execution.
export function providerInput(snapshot) {
  return {protocolVersion: PROTOCOL_VERSION, requestId: snapshot.requestId, revision: snapshot.revision,
    situation: snapshot.state, actions: snapshot.actions, responseFields: ['protocolVersion', 'requestId', 'revision', 'actionIndex', 'narration']};
}
