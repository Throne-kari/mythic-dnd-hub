import fs from 'node:fs';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';

// Chat accepts an already-authenticated native game seat, never a client identity.
// No game state, invitations, credentials, or private GM material enter this store.
const fail = (status, code, message) => { throw Object.assign(new Error(message), {status, code}); };
const digest = value => createHash('sha256').update(value).digest('hex');
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const controls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const safeLabel = value => [...String(value || '同行者').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')].slice(0, 80).join('');
const messageKeys = new Set(['id', 'at', 'seatId', 'name', 'kind', 'text']);
const receiptKeys = new Set(['key', 'fingerprint', 'messageId']);
const validMessage = value => plain(value) && Object.keys(value).every(key => messageKeys.has(key)) && Number.isSafeInteger(value.id) && value.id > 0
  && typeof value.at === 'string' && Number.isFinite(Date.parse(value.at)) && typeof value.seatId === 'string' && value.seatId.length > 0 && value.seatId.length <= 200
  && typeof value.name === 'string' && value.name === safeLabel(value.name) && ['human', 'agent'].includes(value.kind)
  && typeof value.text === 'string' && value.text.length > 0 && [...value.text].length <= 1000 && !controls.test(value.text);
const validReceipt = value => plain(value) && Object.keys(value).every(key => receiptKeys.has(key)) && typeof value.key === 'string' && value.key.length <= 300
  && /^[a-f0-9]{64}$/.test(value.fingerprint) && Number.isSafeInteger(value.messageId) && value.messageId > 0;

export function chatIdentity(seat) {
  if (!seat || typeof seat.id !== 'string' || !seat.id || seat.id.length > 200) fail(401, 'CHAT_AUTH_REQUIRED', '需要有效的游戏席位。');
  return {id: seat.id, name: safeLabel(seat.name), kind: seat.agent === true || ['agent', 'api', 'workspace'].includes(seat.kind) ? 'agent' : 'human'};
}

function integer(value, fallback, min, max, label) {
  if (value === undefined || value === null) return fallback;
  if ((typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) fail(400, 'CHAT_QUERY_INVALID', `${label}无效。`);
  return Number(value);
}

export class RoomChat {
  constructor({directory = null, now = Date.now, historyLimit = 100, receiptLimit = 256, cacheLimit = 16, rateLimit = 5, rateWindowMs = 10000} = {}) {
    this.now = now; this.historyLimit = historyLimit; this.receiptLimit = receiptLimit; this.cacheLimit = cacheLimit;
    this.rateLimit = rateLimit; this.rateWindowMs = rateWindowMs; this.rooms = new Map(); this.rates = new Map();
    this.directory = directory && path.resolve(directory);
    if (this.directory) {
      fs.mkdirSync(this.directory, {recursive: true, mode: 0o700});
      if (fs.lstatSync(this.directory).isSymbolicLink() || !fs.lstatSync(this.directory).isDirectory()) fail(500, 'CHAT_STORAGE_INVALID', '聊天记录目录无效。');
    }
  }

  key(roomId) {
    if (typeof roomId !== 'string' || !roomId || roomId.length > 200) fail(400, 'CHAT_ROOM_INVALID', '聊天房间无效。');
    return digest(roomId);
  }

  load(roomId) {
    const key = this.key(roomId);
    let room = this.rooms.get(key);
    if (!room) {
      room = {schema: 1, roomId, sequence: 0, messages: [], receipts: []};
      if (this.directory) {
        const file = path.join(this.directory, `${key}.json`);
        if (fs.existsSync(file)) {
          const stat = fs.lstatSync(file);
          if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 2 * 1024 * 1024) fail(500, 'CHAT_STORAGE_INVALID', '聊天记录文件无效。');
          let saved;
          try { saved = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail(500, 'CHAT_STORAGE_INVALID', '聊天记录暂时无法读取。'); }
          if (!plain(saved) || Object.keys(saved).some(key => !['schema', 'roomId', 'sequence', 'messages', 'receipts'].includes(key)) || saved.schema !== 1 || saved.roomId !== roomId || !Number.isSafeInteger(saved.sequence) || saved.sequence < 0 || !Array.isArray(saved.messages) || !Array.isArray(saved.receipts)
            || saved.messages.length > this.historyLimit || saved.receipts.length > this.receiptLimit || saved.messages.some(message => !validMessage(message) || message.id > saved.sequence) || saved.receipts.some(receipt => !validReceipt(receipt) || receipt.messageId > saved.sequence)
            || saved.messages.some((message, index) => index > 0 && message.id <= saved.messages[index - 1].id)) fail(500, 'CHAT_STORAGE_INVALID', '聊天记录格式无效。');
          room = {schema: 1, roomId, sequence: saved.sequence, messages: saved.messages, receipts: saved.receipts};
        }
      }
    }
    this.rooms.delete(key); this.rooms.set(key, room);
    while (this.rooms.size > this.cacheLimit) this.rooms.delete(this.rooms.keys().next().value);
    return room;
  }

  persist(room) {
    if (!this.directory) return;
    const file = path.join(this.directory, `${this.key(room.roomId)}.json`);
    if (fs.existsSync(file) && fs.lstatSync(file).isSymbolicLink()) fail(500, 'CHAT_STORAGE_INVALID', '聊天记录文件无效。');
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify(room), {encoding: 'utf8', flag: 'wx', mode: 0o600});
      fs.renameSync(temp, file);
    } catch {
      try { fs.unlinkSync(temp); } catch {}
      fail(500, 'CHAT_STORAGE_FAILED', '聊天记录暂时无法保存，请稍后重试。');
    }
  }

  read(roomId, seat, query = {}) {
    const identity = chatIdentity(seat), room = this.load(roomId);
    const cursor = integer(query.cursor, null, 0, Number.MAX_SAFE_INTEGER, '消息游标');
    const limit = integer(query.limit, 50, 1, 100, '消息数量');
    const first = room.messages[0]?.id ?? room.sequence + 1;
    const reset = cursor !== null && (cursor > room.sequence || cursor < first - 1);
    const messages = cursor === null || reset ? room.messages.slice(-limit) : room.messages.filter(message => message.id > cursor).slice(0, limit);
    const nextCursor = messages.at(-1)?.id ?? room.sequence;
    return {ok: true, roomId, seat: identity, messages: messages.map(message => ({...message})), cursor: nextCursor, hasMore: room.sequence > nextCursor, reset};
  }

  send(roomId, seat, body) {
    const identity = chatIdentity(seat);
    if (!plain(body) || Object.keys(body).some(key => !['text', 'requestId'].includes(key))) fail(400, 'CHAT_BODY_INVALID', '聊天请求只能包含 text 与 requestId。');
    if (typeof body.requestId !== 'string' || !/^[A-Za-z0-9_-]{16,96}$/.test(body.requestId)) fail(400, 'CHAT_REQUEST_ID_INVALID', '请提供16至96位的随机消息标识。');
    if (typeof body.text !== 'string' || controls.test(body.text)) fail(400, 'CHAT_TEXT_INVALID', '聊天内容必须为安全的纯文本。');
    const text = body.text.normalize('NFC').replace(/\r\n?/g, '\n').trim();
    if (!text) fail(400, 'CHAT_TEXT_EMPTY', '请输入聊天内容。');
    if ([...text].length > 1000) fail(413, 'CHAT_TEXT_LIMIT', '每条消息最多1000字。');
    const room = this.load(roomId), requestKey = `${identity.id}:${body.requestId}`, fingerprint = digest(text);
    const previous = room.receipts.find(receipt => receipt.key === requestKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) fail(409, 'CHAT_REQUEST_CONFLICT', '此消息标识已用于不同内容。');
      return {...this.read(roomId, seat), message: room.messages.find(message => message.id === previous.messageId) || null, duplicate: true};
    }
    const now = this.now(), rateKey = `${this.key(roomId)}:${identity.id}`;
    const timestamps = (this.rates.get(rateKey) || []).filter(at => now - at < this.rateWindowMs);
    if (timestamps.length >= this.rateLimit) fail(429, 'CHAT_RATE_LIMIT', '发送过快，请稍等几秒再发送。');
    const message = {id: room.sequence + 1, at: new Date(now).toISOString(), seatId: identity.id, name: identity.name, kind: identity.kind, text};
    const next = {...room, sequence: message.id, messages: [...room.messages, message].slice(-this.historyLimit), receipts: [...room.receipts, {key: requestKey, fingerprint, messageId: message.id}].slice(-this.receiptLimit)};
    this.persist(next); this.rooms.set(this.key(roomId), next); this.rates.delete(rateKey); this.rates.set(rateKey, [...timestamps, now]);
    // Rate history has no credentials and expires; keep it bounded under churn.
    if (this.rates.size > 4096) for (const [key, times] of this.rates) if (now - times.at(-1) >= this.rateWindowMs) this.rates.delete(key);
    if (this.rates.size > 4096) this.rates.delete(this.rates.keys().next().value);
    return {...this.read(roomId, seat), message: {...message}, duplicate: false};
  }
}
