const KEY=`celtic-thorn-tide-v1-seats:${location.origin}`;
export class GameApi {
  constructor(onState,onConnection,onPresence=()=>{}){
    Object.assign(this,{onState,onConnection,onPresence,revision:0,seq:0,sessions:[],activeId:null,lastPlayerId:null,bootstrapRequest:null,tableMode:'cooperative',abort:null,retry:null,presenceTimer:null});
    try{const saved=JSON.parse(sessionStorage.getItem(KEY)||'{}');this.sessions=Array.isArray(saved.sessions)?saved.sessions:[];this.activeId=saved.activeId;this.lastPlayerId=saved.lastPlayerId;this.bootstrapRequest=saved.bootstrapRequest||null;if(this.session?.role==='manager')this.activeId=this.sessions.find(s=>s.id===this.lastPlayerId&&s.role==='player')?.id||this.sessions.find(s=>s.role==='player')?.id||null;}catch{sessionStorage.removeItem(KEY);}
  }
  get session(){return this.sessions.find(s=>s.id===this.activeId);}
  persist(){sessionStorage.setItem(KEY,JSON.stringify({sessions:this.sessions,activeId:this.activeId,lastPlayerId:this.lastPlayerId,bootstrapRequest:this.bootstrapRequest}));}
  async request(path,body,token=this.session?.token){const response=await fetch(path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{'x-seat-token':token}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});const data=await response.json();if(!response.ok||data.ok===false){const error=Error(data.error?.message||`请求失败 (${response.status})`);error.status=response.status;error.code=data.error?.code;throw error;}return data;}
  accept(data){if(data.seat&&data.seat.id!==this.activeId)return data;if(data.tableMode)this.tableMode=data.tableMode;if(data.state){this.revision=data.revision??data.state.revision??0;this.seq=data.seq??this.seq;const local=this.sessions.find(s=>s.id===data.seat?.id);if(local){local.actorIds=data.seat.actorIds||[];local.name=data.seat.name;local.role=data.seat.role;this.persist();}this.onState(data);}return data;}
  remember(seat,token){if(!seat||!token)return;this.sessions=this.sessions.filter(s=>s.id!==seat.id);this.sessions.push({id:seat.id,name:seat.name,role:seat.role,actorIds:seat.actorIds||[],token});}
  async connect(){
    this.onConnection('connecting');const health=await this.request('/api/health',null,null);this.tableMode=health.tableMode||'cooperative';
    if(this.session){try{this.accept(await this.request('/api/state'));this.stream();return;}catch(e){if(e.status!==401)throw e;this.sessions=[];this.activeId=null;this.lastPlayerId=null;this.persist();}}
    const hosted=this.tableMode==='hosted';if((health.initialized??health.hostCreated)&&!(!hosted&&this.bootstrapRequest)){const error=Error(hosted?'主持桌已开启，请使用本进程签发的席位令牌接续。':'合作冒险已开启，请使用本进程签发的玩家席位令牌接续。');error.code='TABLE_EXISTS';throw error;}
    const bootstrap=hosted?{name:'本地主持',requestId:crypto.randomUUID()}:this.bootstrapRequest||{name:'合作冒险者',requestId:crypto.randomUUID()};if(!hosted){this.bootstrapRequest=bootstrap;this.persist();}
    let data;try{data=await this.request(hosted?'/api/host':'/api/start',bootstrap,null);}catch(error){if(['TABLE_EXISTS','MODE_MISMATCH','REQUEST_ID_CONFLICT'].includes(error.code)){this.bootstrapRequest=null;this.persist();}throw error;}
    this.remember(data.seat,data.seatToken);this.remember(data.managementSeat,data.managementToken);this.activeId=data.seat.id;if(data.seat.role==='player')this.lastPlayerId=data.seat.id;this.bootstrapRequest=null;this.persist();this.accept(data);this.stream();
  }
  async join(token){const data=await this.request('/api/state',null,token);this.remember(data.seat,token);this.activeId=data.seat.id;if(data.seat.role==='player')this.lastPlayerId=data.seat.id;this.persist();this.accept(data);this.stream();}
  async switchSeat(id){if(!this.sessions.some(s=>s.id===id))throw Error('当前标签页没有此席位凭证。');this.abort?.abort();clearTimeout(this.retry);clearInterval(this.presenceTimer);const previous=this.activeId;this.activeId=id;try{const data=await this.request('/api/state');this.revision=0;this.accept(data);if(data.seat.role==='player')this.lastPlayerId=id;this.persist();this.stream();}catch(e){this.activeId=previous;this.stream();throw e;}}
  async mutate(path,payload={}){const data=await this.request(path,{requestId:crypto.randomUUID(),revision:this.revision,...payload});this.accept(data);return data;}
  action(action){return this.mutate('/api/action',{action});}
  async refresh(){return this.accept(await this.request('/api/state'));}
  saves(){return this.request('/api/saves');}
  async presence(){const active=this.activeId;const data=await this.request('/api/presence');if(active===this.activeId){for(const remote of data.seats||[]){const local=this.sessions.find(s=>s.id===remote.id);if(local)local.actorIds=remote.actorIds||[];}this.persist();this.onPresence(data);}return data;}
  async takeover(actorId){const data=await this.mutate('/api/takeover',{actorId});await this.presence();return data;}
  heartbeat(){clearInterval(this.presenceTimer);void this.presence().catch(()=>{});this.presenceTimer=setInterval(()=>{void this.presence().catch(()=>{});},15000);}
  async createSeat(name,actorIds){const data=await this.mutate('/api/seats',{name,actorIds});this.remember(data.createdSeat,data.seatToken);this.persist();return data;}
  createFolderPlayer(actorId,name){return this.mutate('/api/folder-player',{actorId,...(name?{name}:{})});}
  stopFolderPlayer(seatId){return this.mutate('/api/folder-player/stop',{seatId});}
  stream(){this.abort?.abort();clearTimeout(this.retry);this.heartbeat();const controller=new AbortController();this.abort=controller;const run=async()=>{try{const response=await fetch(`/api/events?since=${this.seq}`,{headers:{'x-seat-token':this.session.token},signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('同步连接中断');this.onConnection('online');const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';while(true){const {value,done}=await reader.read();if(done)throw Error('同步连接中断');pending+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');let end;while((end=pending.indexOf('\n\n'))>=0){const block=pending.slice(0,end);pending=pending.slice(end+2);const raw=block.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(raw){const data=JSON.parse(raw);if(!controller.signal.aborted&&data.revision>=this.revision)this.accept(data);}}}}catch(e){if(controller.signal.aborted)return;this.onConnection('reconnecting');this.retry=setTimeout(run,2500);}};void run();}
}
