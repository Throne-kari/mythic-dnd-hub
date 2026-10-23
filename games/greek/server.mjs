import './hub-environment.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { createGame, act, view, normalizeMaps, validateState } from './engine.mjs';
import { atomicJSON, directory, agentFolder, publishSnapshot, tick, isId } from './tools/agent-bridge.mjs';

const root=path.dirname(fileURLToPath(import.meta.url));
const readJSON=target=>JSON.parse(fs.readFileSync(target,'utf8').replace(/^\uFEFF/,''));
const hash=token=>createHash('sha256').update(token).digest('hex');
const id=()=>randomBytes(12).toString('hex');
function error(message,status=400) {throw Object.assign(new Error(message),{status});}
function object(value,allowed) {if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!allowed.includes(k))) error('请求字段无效');}
const seatView=member=>member.seat;
const ownedRuntimes=new Set();
function acquireRuntime(runtimeDir,probe) {
  const identity=process.platform==='win32'?fs.realpathSync(runtimeDir).toLowerCase():fs.realpathSync(runtimeDir);
  if(ownedRuntimes.has(identity)) throw new Error('该runtime已被本进程中的另一个权威服务占用');
  ownedRuntimes.add(identity);
  const target=path.join(runtimeDir,'.host.lock'),recover=path.join(runtimeDir,'.host.recover.lock');
  const metadata={version:1,pid:process.pid,nonce:id(),createdAt:new Date().toISOString()};
  function writeExclusive(file) {
    const fd=fs.openSync(file,'wx',0o600);try {fs.writeFileSync(fd,JSON.stringify(metadata),'utf8');fs.fsyncSync(fd);} finally {fs.closeSync(fd);}
  }
  function readLock(file) {
    const stat=fs.lstatSync(file);if(stat.isSymbolicLink() || !stat.isFile() || stat.size>4096) throw new Error('runtime锁文件无效，请保留并人工确认');
    let value;try {value=JSON.parse(fs.readFileSync(file,'utf8'));} catch {throw new Error('runtime锁元数据损坏，请保留并人工确认');}
    if(!value || value.version!==1 || !Number.isSafeInteger(value.pid) || value.pid<1 || typeof value.nonce!=='string' || !/^[a-f0-9]{24}$/.test(value.nonce)) throw new Error('runtime锁身份不明，请保留并人工确认');
    return value;
  }
  function status(pid) {
    if(probe) {try {const result=probe(pid);return ['alive','dead','unknown'].includes(result)?result:'unknown';} catch {return 'unknown';}}
    try {process.kill(pid,0);return 'alive';} catch(e) {return e.code==='ESRCH'?'dead':'unknown';}
  }
  function removeIfOwned(file) {
    if(!fs.existsSync(file)) return;
    const value=readLock(file);if(value.pid===metadata.pid && value.nonce===metadata.nonce) fs.unlinkSync(file);
  }
  try {
    if(fs.existsSync(recover)) throw new Error('runtime存在未完成的锁恢复；请确认旧主机已停止后人工检查，未自动移除');
    try {writeExclusive(target);} catch(e) {
      if(e.code!=='EEXIST') throw e;
      const previous=readLock(target),live=status(previous.pid);
      if(live==='alive') throw new Error('该runtime已有存活的权威主机，请关闭旧主机或使用独立RUNTIME_DIR');
      if(live!=='dead') throw new Error('无法确认runtime锁进程已退出，保留锁并拒绝启动；请人工确认');
      // A separate exclusive recovery marker serializes stale-lock reclamation.
      // An interrupted recovery is deliberately left for human inspection.
      writeExclusive(recover);
      try {
        const current=readLock(target);
        if(current.pid!==previous.pid || current.nonce!==previous.nonce || status(current.pid)!=='dead') throw new Error('runtime锁在恢复时发生变化，未移除');
        fs.unlinkSync(target);writeExclusive(target);
      } finally {removeIfOwned(recover);}
    }
  } catch(e) {ownedRuntimes.delete(identity);throw e;}
  let released=false;
  return ()=>{
    if(released) return;released=true;
    try {removeIfOwned(target);} finally {ownedRuntimes.delete(identity);}
  };
}
export function createServer(options={}) {
  const campaign=options.campaign || readJSON(path.join(root,'data/campaign.json'));
  const maps=normalizeMaps(options.maps || readJSON(path.join(root,'data/maps.json')),campaign);
  createGame(campaign,maps); // Fail before listening if authored data is invalid.
  const runtimeDir=path.resolve(options.runtimeDir || process.env.RUNTIME_DIR || path.join(root,'runtime'));
  directory(runtimeDir);const roomDir=directory(path.join(runtimeDir,'rooms')),saveDir=directory(path.join(runtimeDir,'saves'));
  const releaseRuntime=acquireRuntime(runtimeDir,options.lockProbe);
  const rooms=new Map(),streams=new Map();
  try {for(const name of fs.readdirSync(roomDir).filter(n=>/^[a-f0-9]{24}\.json$/.test(n))) {
    const target=path.join(roomDir,name);if(fs.lstatSync(target).isSymbolicLink()) continue;
    const room=readJSON(target);
    if(room.version!==1 || !isId(room.id) || room.id+'.json'!==name || !room.state || !Number.isSafeInteger(room.state.revision) || !Array.isArray(room.seats)) throw new Error('房间存档损坏，请保留文件后人工检查');
    if(room.campaignId!==campaign.id || room.contentVersion!==(campaign.contentVersion ?? 1)) throw new Error('房间属于不同战役或内容版本；保留旧运行目录，使用独立RUNTIME_DIR启动新版');
    validateState(room.state,campaign,maps);rooms.set(room.id,room);
  }} catch(e) {releaseRuntime();throw e;}
  const persist=room=>atomicJSON(path.join(roomDir,`${room.id}.json`),room);
  function broadcast(room) {
    for(const client of streams.get(room.id) || []) {
      try {client.response.write(`id: ${room.state.revision}\nevent: state\ndata: ${JSON.stringify(view(room.state,client.seat,campaign,maps))}\n\n`);} catch {client.response.destroy();}
    }
    for(const member of room.seats.filter(s=>s.agent)) {
      try {publishSnapshot({runtimeDir,roomId:room.id,seat:member.seat,state:room.state,campaign,maps});} catch { /* The committed state remains authoritative; the next queue tick retries. */ }
    }
  }
  function commit(room,next,processed) {
    const changed=next!==room.state;
    const updated={...room,state:next,processed:{...(room.processed || {})}};
    if(processed) updated.processed[processed.key]=processed.receipt;
    persist(updated);Object.assign(room,updated);if(changed) broadcast(room);
  }
  function authenticate(req,url,room) {
    const bearer=req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{20,200})$/)?.[1];
    const token=bearer || (url.pathname.endsWith('/events')?url.searchParams.get('token'):null);
    if(!token || token.length>200) error('需要有效房间令牌',401);
    const digest=hash(token),member=room.seats.find(s=>s.tokenHash && s.tokenHash.length===digest.length && timingSafeEqual(Buffer.from(s.tokenHash),Buffer.from(digest)));
    if(!member) error('房间令牌无效',401);return member;
  }
  function addSeat(room,{name,heroId,agent=false,dm=false}) {
    if(typeof name!=='string' || !name.trim() || name.length>40) error('名字需1至40字');
    if(!dm && (!campaign.heroes.some(h=>h.id===heroId) || room.seats.some(m=>m.seat.role==='player' && m.seat.heroIds.includes(heroId)))) error('英雄不存在或已被认领',409);
    if(room.seats.length>=16) error('房间席位已满');
    const token=agent?null:randomBytes(24).toString('base64url');
    const seat={id:id(),name:name.trim(),role:dm?'dm':'player',heroIds:dm?campaign.heroes.map(h=>h.id):[heroId]};
    const member={seat,agent,...(token?{tokenHash:hash(token)}:{})};room.seats.push(member);
    try {persist(room);} catch(e) {room.seats.pop();throw e;}
    return {token,seat};
  }
  async function body(req) {
    const chunks=[];let length=0;
    for await(const chunk of req) {length+=chunk.length;if(length>131072) error('请求体过大',413);chunks.push(chunk);}
    try {return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');} catch {error('JSON无效');}
  }
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const server=http.createServer(async(req,res)=>{
    try {
      const url=new URL(req.url,'http://localhost'),method=req.method;
      // Browser pages may only mutate the host they were loaded from.
      if(req.headers.origin) {const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host || !['http:','https:'].includes(origin.protocol)) error('跨来源请求被拒绝',403);}
      if(url.pathname==='/api/health' && method==='GET') return json(res,200,{ok:true,service:'the-unburied-city',title:campaign.title,protocol:1,rooms:rooms.size});
      if(url.pathname==='/api/catalog' && method==='GET') return json(res,200,{campaign,maps});
      if(url.pathname==='/api/rooms' && method==='POST') {
        const data=await body(req);object(data,['name']);const room={version:1,campaignId:campaign.id,contentVersion:campaign.contentVersion ?? 1,id:id(),state:createGame(campaign,maps),seats:[],processed:{}};
        const auth=addSeat(room,{name:data.name,dm:true});rooms.set(room.id,room);return json(res,201,{roomId:room.id,...auth,state:view(room.state,auth.seat,campaign,maps)});
      }
      const match=url.pathname.match(/^\/api\/rooms\/([a-f0-9]{24})\/(join|state|action|save|load|events|agents)$/);
      if(match) {
        const room=rooms.get(match[1]);if(!room) error('房间不存在',404);const route=match[2];
        if(route==='join' && method==='POST') {const data=await body(req);object(data,['name','heroId']);const auth=addSeat(room,data);broadcast(room);return json(res,201,{roomId:room.id,...auth,state:view(room.state,auth.seat,campaign,maps)});}
        const member=authenticate(req,url,room),seat=seatView(member);
        if(route==='state' && method==='GET') return json(res,200,{roomId:room.id,seat,state:view(room.state,seat,campaign,maps)});
        if(route==='events' && method==='GET') {
          res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});
          const clients=streams.get(room.id) || new Set();if(clients.size>=32) {res.end();return;}streams.set(room.id,clients);const client={response:res,seat};clients.add(client);
          res.write(`id: ${room.state.revision}\nevent: state\ndata: ${JSON.stringify(view(room.state,seat,campaign,maps))}\n\n`);
          const heartbeat=setInterval(()=>res.write(': heartbeat\n\n'),15000);heartbeat.unref();req.on('close',()=>{clearInterval(heartbeat);clients.delete(client);});return;
        }
        if(route==='action' && method==='POST') {
          const data=await body(req);object(data,['revision','action']);if(!Number.isSafeInteger(data.revision) || data.revision!==room.state.revision) error('状态修订冲突，请刷新重试',409);
          const next=act(room.state,data.action,seat,campaign,maps);commit(room,next);return json(res,200,{state:view(room.state,seat,campaign,maps)});
        }
        if(['save','load','agents'].includes(route) && seat.role!=='dm') error('仅主持人可执行此操作',403);
        if(route==='save' || route==='load') {
          if(method!=='POST') error('方法不允许',405);const data=await body(req);object(data,['slot']);if(!isId(data.slot)) error('存档槽标识无效');
          const folder=directory(path.join(saveDir,room.id)),target=path.join(folder,`${data.slot}.json`);
          if(route==='save') atomicJSON(target,{version:1,campaignId:campaign.id,contentVersion:campaign.contentVersion ?? 1,state:room.state});
          else {
            if(!fs.existsSync(target)) error('存档槽不存在',404);if(fs.lstatSync(target).isSymbolicLink()) error('存档文件无效');const saved=readJSON(target);
            if(saved.version!==1 || saved.campaignId!==campaign.id || saved.contentVersion!==(campaign.contentVersion ?? 1) || !saved.state || saved.state.version!==1) error('存档内容版本或战役不匹配');
            validateState(saved.state,campaign,maps);
            const next=structuredClone(saved.state);next.revision=room.state.revision+1;commit(room,next);
          }
          return json(res,200,{slot:data.slot,state:view(room.state,seat,campaign,maps)});
        }
        if(route==='agents' && method==='GET') return json(res,200,{agents:room.seats.filter(s=>s.agent).map(s=>({seat:s.seat,folder:agentFolder(runtimeDir,room.id,s.seat.id)}))});
        if(route==='agents' && method==='POST') {
          const data=await body(req);object(data,['name','heroId','role']);
          if(data.role!==undefined && !['dm','player'].includes(data.role)) error('智能体角色无效');
          if(data.role==='dm' && data.heroId!==undefined) error('主持智能体无需heroId');
          const auth=addSeat(room,{name:data.name,heroId:data.heroId,agent:true,dm:data.role==='dm'});const folder=agentFolder(runtimeDir,room.id,auth.seat.id);
          publishSnapshot({runtimeDir,roomId:room.id,seat:auth.seat,state:room.state,campaign,maps});broadcast(room);return json(res,201,{roomId:room.id,seat:auth.seat,folder});
        }
        error('方法不允许',405);
      }
      if(url.pathname.startsWith('/api/')) error('接口不存在',404);
      if(method!=='GET' && method!=='HEAD') error('方法不允许',405);
      let pathname;try {pathname=decodeURIComponent(url.pathname);} catch {error('路径无效');}
      if(pathname.includes('\\') || pathname.includes('\0')) error('路径无效');
      const publicDir=path.join(root,'public'),target=path.resolve(publicDir,'.'+(pathname==='/'?'/index.html':pathname));
      if(!target.startsWith(publicDir+path.sep)) error('路径禁止',403);
      if(!fs.existsSync(target) || !fs.statSync(target).isFile() || fs.lstatSync(target).isSymbolicLink() || !fs.realpathSync(target).startsWith(fs.realpathSync(publicDir)+path.sep)) error('文件不存在',404);
      const ext=path.extname(target),types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp'};
      res.writeHead(200,{'Content-Type':types[ext] || 'application/octet-stream','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"});
      if(method==='HEAD') res.end();else fs.createReadStream(target).pipe(res);
    } catch(e) {if(!res.headersSent) json(res,e.status || 400,{error:e.message});else res.end();}
  });
  const timer=setInterval(()=>{try {tick({runtimeDir,rooms,campaign,maps,commit});} catch(e) {console.error('文件智能体队列暂不可用：'+e.message);}},options.agentInterval ?? 1000);timer.unref();
  server.on('close',()=>{clearInterval(timer);for(const clients of streams.values()) for(const c of clients) c.response.end();releaseRuntime();});
  server.rooms=rooms;server.runtimeDir=runtimeDir;server.agentTick=()=>tick({runtimeDir,rooms,campaign,maps,commit});
  server.shutdown=()=>{for(const clients of streams.values()) for(const c of clients) c.response.end();server.close(error=>{if(error?.code==='ERR_SERVER_NOT_RUNNING') releaseRuntime();});};
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.PORT || 8841),host='127.0.0.1';
  if(!Number.isInteger(port) || port<1 || port>65535) throw new Error('PORT无效');
  const server=createServer();server.listen(port,host,()=>console.log(`《无葬之城》 http://${host}:${port} — 仅本机监听`));
  for(const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.shutdown());
}
