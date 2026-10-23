export class GameConnection extends EventTarget {
  constructor() {
    super(); this.session = null; this.state = null; this.events = null; this.pending = false;
    try { this.session = JSON.parse(globalThis.sessionStorage?.getItem('unburied.session') || localStorage.getItem('unburied.session') || 'null'); } catch {}
  }
  emit(name, detail) { this.dispatchEvent(new CustomEvent(name, { detail })); }
  async request(path, body, authenticated = true, token = this.session?.token) {
    const headers = { 'Content-Type': 'application/json' };
    if (authenticated && token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) }); }
    catch (cause) { throw new Error('连接暂时中断，请重试。已有席位会保留。', { cause }); }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(typeof data.error === 'string' ? data.error : data.message || '城邦信使未能送达，请重试。'); error.status = response.status; throw error; }
    return data;
  }
  async catalog() { return this.request('/api/catalog', undefined, false); }
  async refresh() { const data = await this.request(`/api/rooms/${encodeURIComponent(this.session.roomId)}/state`); this.setState(data); return this.state; }
  attach(data) {
    this.events?.close(); this.state = null; this.session = { roomId: data.roomId, token: data.token, seat: data.seat };
    localStorage.setItem('unburied.session', JSON.stringify(this.session));
    globalThis.sessionStorage?.setItem('unburied.session', JSON.stringify(this.session));
    if(this.session.seat?.role==='dm')localStorage.setItem(`unburied.host.${this.session.roomId}`,JSON.stringify(this.session));
    this.setState(data.state); this.connectEvents(); return data;
  }
  async create(name = '无葬之城') { return this.attach(await this.request('/api/rooms', { name }, false)); }
  async join(roomId, name, heroId) { return this.attach(await this.request(`/api/rooms/${encodeURIComponent(roomId)}/join`, { name, heroId }, false)); }
  savedHost(roomId=this.session?.roomId) {
    try { const saved=JSON.parse(localStorage.getItem(`unburied.host.${roomId}`)||'null'); return saved?.roomId===roomId&&saved.seat?.role==='dm'&&typeof saved.token==='string'&&saved.token?saved:null; } catch { return null; }
  }
  hasHostBackup(roomId=this.session?.roomId) { return !!this.savedHost(roomId); }
  async restoreHost(roomId=this.session?.roomId) {
    const saved=this.savedHost(roomId); if(!saved)throw new Error('本浏览器没有保存这个房间的主持席。');
    try {
      const data=await this.request(`/api/rooms/${encodeURIComponent(roomId)}/state`,undefined,true,saved.token),next=data.state||data;
      if(next.seat?.role!=='dm')throw new Error('服务器未确认此令牌具有主持权限。');
      return this.attach({...saved,seat:next.seat,state:next});
    } catch(error) { if([401,404].includes(error.status))localStorage.removeItem(`unburied.host.${roomId}`); throw error; }
  }
  async restore() {
    if (!this.session) return false;
    try { this.setState(await this.request(`/api/rooms/${encodeURIComponent(this.session.roomId)}/state`)); this.connectEvents(); return true; }
    catch (error) { if ([401,404].includes(error.status)) { this.session = null; localStorage.removeItem('unburied.session'); globalThis.sessionStorage?.removeItem('unburied.session'); return false; } throw error; }
  }
  setState(data) {
    const next = data?.state || data;
    if (!next || !Array.isArray(next.heroes)) return;
    if (this.state && next.revision < this.state.revision) return;
    this.state = next; if (next.seat && this.session) this.session.seat = next.seat;
    this.emit('state', next);
  }
  connectEvents() {
    this.events?.close();
    this.events = new EventSource(`/api/rooms/${encodeURIComponent(this.session.roomId)}/events?token=${encodeURIComponent(this.session.token)}`);
    const receive = event => { try { this.setState(JSON.parse(event.data)); } catch {} };
    this.events.onmessage = receive; this.events.addEventListener('state', receive);
    this.events.onopen = () => this.emit('connection', '已同步');
    this.events.onerror = () => this.emit('connection', '正在重连');
  }
  async act(action) {
    if (!this.session || !this.state) throw new Error('请先创建或加入房间。');
    if (this.pending) return;
    this.pending = true; this.emit('pending', true);
    try { const data = await this.request(`/api/rooms/${encodeURIComponent(this.session.roomId)}/action`, { revision: this.state.revision, action }); this.setState(data); return data; }
    catch (error) { await this.request(`/api/rooms/${encodeURIComponent(this.session.roomId)}/state`).then(data => this.setState(data)).catch(() => {}); throw error; }
    finally { this.pending = false; this.emit('pending', false); }
  }
  async save(slot = 'quick') { return this.request(`/api/rooms/${encodeURIComponent(this.session.roomId)}/save`, { slot }); }
  async load(slot = 'quick') { const data = await this.request(`/api/rooms/${encodeURIComponent(this.session.roomId)}/load`, { slot }); this.setState(data); return data; }
}
