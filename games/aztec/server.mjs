import './hub-environment.mjs';
import {RoomChat, chatIdentity} from '../../server/room-chat.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {GAME_ID, createState, applyAction, publicState, getChapterProgress, legalChoices, legalActionsForState, mapForState, majorNpcForState, capabilitiesForActor} from './engine.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const SAFE = /^[a-zA-Z0-9_-]{1,64}$/;
const safeKey = value => typeof value==='string'&&SAFE.test(value)&&!['__proto__','prototype','constructor','toString','valueOf','hasOwnProperty'].includes(value);
const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon'};
const publicGuides=new Set(['docs/RULES.md','docs/COOP.md','docs/AGENT_PROTOCOL.md']);
const fail = (status,message) => Object.assign(new Error(message),{status});
const uuid = () => crypto.randomUUID();
const token = () => crypto.randomBytes(32).toString('hex');
const cleanName = (value,fallback) => typeof value === 'string' ? value.trim().slice(0,40) || fallback : fallback;
const readJSON = f => JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const atomicJSON = (file,value) => {fs.mkdirSync(path.dirname(file),{recursive:true}); const tmp=file+'.tmp-'+uuid();fs.writeFileSync(tmp,JSON.stringify(value,null,2),{encoding:'utf8',flag:'wx',mode:0o600});fs.renameSync(tmp,file);};
const plainObject = v => !!v && typeof v==='object' && !Array.isArray(v);
const validateRequestId = v => {if(typeof v!=='string'||!SAFE.test(v)) throw fail(400,'requestId must contain 1–64 letters, digits, _ or -');return v;};
const allowedTypes = new Set(['move','travel','choose','attack','guard','heal','skill','endTurn','retreat','rest','finale','saveMap','loadMap','startEncounter']);
const EDITION={gameId:GAME_ID,version:'3.0.0',title:'第五日之城 · 阿兹特克合作版',defaultRoomMode:'party',decisionPolicy:'first-valid-revision'};
const roomMode=r=>r.mode==='party'?'party':'hosted';
const decisionPolicy=r=>roomMode(r)==='party'?'first-valid-revision':'host';
const actorFor=(r,seat)=>({id:seat.id,role:seat.role,characterId:seat.characterId??null,roomMode:roomMode(r),canManage:seat.role==='host'||(roomMode(r)==='party'&&seat.canManage===true)});
function actionShape(action) {
  if(!plainObject(action)||!allowedTypes.has(action.type)) throw fail(400,'Unknown game action');
  const fields={move:['characterId','x','y'],travel:['mapId'],choose:['nodeId','choiceId'],attack:['characterId','targetId'],guard:['characterId'],heal:['characterId','targetId'],skill:['characterId','targetId'],endTurn:['characterId'],retreat:[],rest:[],finale:[],saveMap:['map'],loadMap:['mapId'],startEncounter:['templateId']}[action.type];
  if(Object.keys(action).some(k=>k!=='type'&&!fields.includes(k))) throw fail(400,'Unexpected action property');
  return action;
}
async function body(req) {
  let total=0, chunks=[];
  for await(const chunk of req){total+=chunk.length;if(total>131072)throw fail(413,'Request too large');chunks.push(chunk);}
  try {const v=JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');if(!plainObject(v))throw Error();return v;} catch {throw fail(400,'Expected JSON object');}
}

export function startServer(options={}) {
  const campaign=readJSON(path.join(ROOT,'content/campaign.json'));
  const maps=readJSON(path.join(ROOT,'content/maps.json'));
  if(campaign.id!==GAME_ID)throw Error('战役ID必须为 '+GAME_ID);
  if(!Array.isArray(campaign.companions)||campaign.companions.length!==4||['yaotl','itzel','nelli','xoco'].some(id=>!campaign.companions.some(c=>c.id===id)))throw Error('战役必须包含本作四位固定队员');
  if(!Array.isArray(maps)||!maps.length||!Array.isArray(campaign.nodes)||!Array.isArray(campaign.endings))throw Error('缺少战役节点、结局或地图');
  const mapIds=new Set(maps.map(m=>m.id)),routeIds=new Set((campaign.routes??[]).map(r=>r.id));
  for(const node of campaign.nodes)if(!mapIds.has(node.map)||!routeIds.has(node.route))throw Error('剧情节点引用了不存在的地图或路线：'+node.id);
  const dataDir=path.resolve(options.dataDir||process.env.AZTEC_DATA_DIR||path.join(ROOT,'data','aztec-v3'));
  const belongsToGame=state=>state?.schema===3&&state.gameId===GAME_ID&&state.campaignId===campaign.id;
  fs.mkdirSync(path.join(dataDir,'rooms'),{recursive:true});
  const rooms=new Map(), streams=new Map();
  const chat=new RoomChat({directory:path.join(dataDir,'.hub-chat')});
  for(const entry of fs.readdirSync(path.join(dataDir,'rooms'),{withFileTypes:true})) {
    if(entry.isFile()&&entry.name.endsWith('.json')&&SAFE.test(entry.name.slice(0,-5))){
      const file=path.join(dataDir,'rooms',entry.name);
      for(const candidate of [file,file+'.previous'])try{const r=readJSON(candidate);if(r.schema===1&&r.gameId===GAME_ID&&r.campaignId===campaign.id&&belongsToGame(r.state)&&safeKey(r.id)&&entry.name===r.id+'.json'&&Array.isArray(r.seats)){r.mode=roomMode(r);r.decisionPolicy=decisionPolicy(r);rooms.set(r.id,r);break;}}catch{}
    }
  }
  const roomFile=id=>path.join(dataDir,'rooms',id+'.json');
  const persist=r=>{const file=roomFile(r.id);if(fs.existsSync(file))fs.copyFileSync(file,file+'.previous');atomicJSON(file,r);};
  const getRoom=id=>{if(!SAFE.test(id)||!rooms.has(id))throw fail(404,'Room not found');return rooms.get(id);};
  const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
  const auth=(r,req,url)=>{const t=req.headers.authorization?.replace(/^Bearer /,'')||url.searchParams.get('token');const s=r.seats.find(s=>equal(s.token,t));if(!s)throw fail(401,'Seat authentication required');return s;};
  const manager=(r,s)=>{if(!capabilitiesForActor(actorFor(r,s)).canManage)throw fail(403,'Room manager or host required');};
  const visibleMajorNpcs=state=>(campaign.majorNpcs??[]).filter(npc=>!npc.knownFromFlag||state.flags.includes(npc.knownFromFlag)).map(npc=>majorNpcForState(state,npc));
  const view=(r,s)=>{const actor=actorFor(r,s);return {...publicState(r.state,actor),seat:{...chatIdentity({...s,agent:r.agents.some(a=>a.id===s.id)}),role:s.role},roomMode:roomMode(r),decisionPolicy:decisionPolicy(r),capabilities:capabilitiesForActor(actor),chapterProgress:getChapterProgress(r.state,campaign),majorNpcs:visibleMajorNpcs(r.state),legalActions:legalActionsForState(r.state,campaign,maps,actor)};};
  const bridgeDir=(r,a)=>path.join(dataDir,'bridge',r.id,a.id);
  function checkedBridgeDir(r,a){
    const levels=[path.join(dataDir,'bridge'),path.join(dataDir,'bridge',r.id),bridgeDir(r,a)];
    for(const dir of levels){if(fs.existsSync(dir)){if(fs.lstatSync(dir).isSymbolicLink()||!fs.statSync(dir).isDirectory())throw fail(400,'Invalid bridge directory');}else fs.mkdirSync(dir);}
    return levels[2];
  }
  function publish(r){
    for(const client of streams.get(r.id)||[])try{client.res.write(`event: state\ndata: ${JSON.stringify(view(r,client.seat))}\n\n`);}catch{}
    for(const a of r.agents||[]) {
      const seat={id:a.id,role:a.role==='dm'?'host':'player',characterId:a.characterId,canManage:false},actor=actorFor(r,seat);
      const snapshot={protocol:1,gameId:GAME_ID,roomId:r.id,agentId:a.id,role:a.role,characterId:a.characterId,roomMode:roomMode(r),decisionPolicy:decisionPolicy(r),generatedAt:new Date().toISOString(),revision:r.state.revision,phase:r.state.phase,turn:r.state.combat?{round:r.state.combat.round,characterId:r.state.combat.turn}:null,state:view(r,seat),currentMap:mapForState(r.state,maps),majorNpcs:visibleMajorNpcs(r.state),storyChoices:legalChoices(r.state,campaign),destinations:maps.map(({id,name})=>({id,name})),allowedActions:capabilitiesForActor(actor).allowedActions,legalActions:legalActionsForState(r.state,campaign,maps,actor),movementScope:'legalActions列出相邻合法步；也可提交规则允许的更远路径移动'};
      try{atomicJSON(path.join(checkedBridgeDir(r,a),'snapshot.json'),snapshot);}catch{}
    }
  }
  function execute(r,seat,envelope,keyPrefix='http'){
    const id=validateRequestId(envelope.requestId), key=`${keyPrefix}:${seat.id}:${id}`;
    r.requests ||= {};
    if(Object.hasOwn(r.requests,key)) return {ok:true,duplicate:true,state:view(r,seat)};
    if(!Number.isSafeInteger(envelope.expectedRevision)||envelope.expectedRevision!==r.state.revision)throw fail(409,'State changed; refresh and choose again');
    const action=actionShape(envelope.action);
    let next;
    try{next=applyAction(r.state,action,campaign,maps,actorFor(r,seat));}catch(e){throw fail(400,e.message);}
    if(!next||!Number.isSafeInteger(next.revision)||next.revision<=r.state.revision)throw fail(500,'Engine revision invariant failed');
    r.state=next;r.requests[key]={revision:next.revision,time:Date.now()};
    // Never evict request ids: a delayed duplicate must not apply twice after restart.
    persist(r);publish(r);return {ok:true,state:view(r,seat)};
  }
  function bridgeTick(){
    for(const r of rooms.values())for(const a of r.agents||[]){
      const dir=bridgeDir(r,a), inbox=path.join(dir,'inbox.json');
      if(!fs.existsSync(inbox))continue;
      let request, receipt;
      try {
        const stat=fs.lstatSync(inbox);
        if(!stat.isFile()||stat.isSymbolicLink()||stat.size>32768)throw Error('Only a regular inbox.json smaller than 32 KiB is accepted');
        const bridgeRoot=path.join(dataDir,'bridge');
        if([bridgeRoot,path.dirname(dir),dir].some(p=>fs.lstatSync(p).isSymbolicLink())||!fs.realpathSync(dir).startsWith(fs.realpathSync(dataDir)+path.sep))throw Error('Invalid bridge directory');
        request=readJSON(inbox);
        if(!plainObject(request)||Object.keys(request).some(k=>!['protocol','id','expectedRevision','expiresAt','action'].includes(k))||request.protocol!==1)throw Error('Unsupported request envelope');
        validateRequestId(request.id);
        const actor={id:a.id,role:a.role==='dm'?'host':'player',characterId:a.characterId};
        const alreadyApplied=Object.hasOwn(r.requests||{},`bridge:${a.id}:${request.id}`);
        const expiry=Date.parse(request.expiresAt);
        if(!alreadyApplied&&(!Number.isFinite(expiry)||expiry<Date.now()||expiry>Date.now()+300000))throw Error('Request expired or expiry exceeds five minutes');
        const result=execute(r,actor,{requestId:request.id,expectedRevision:request.expectedRevision,action:request.action},'bridge');
        receipt={protocol:1,id:request.id,ok:true,duplicate:!!result.duplicate,revision:r.state.revision,time:new Date().toISOString()};
      }catch(e){receipt={protocol:1,id:typeof request?.id==='string'?request.id.slice(0,64):null,ok:false,error:e.message,status:e.status||400,revision:r.state.revision,time:new Date().toISOString()};}
      try{atomicJSON(path.join(dir,'receipt.json'),receipt);const log=path.join(dir,'events.jsonl');fs.appendFileSync(log,JSON.stringify(receipt)+'\n');if(fs.statSync(log).size>1048576){fs.renameSync(log,path.join(dir,'events.previous.jsonl'));}fs.unlinkSync(inbox);}catch{}
    }
  }
  const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
  const server=http.createServer(async(req,res)=>{
    let url;
    try {
      url=new URL(req.url,'http://127.0.0.1');
      if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw fail(403,'Cross-origin requests are not permitted');
      const p=url.pathname.split('/').filter(Boolean);
      if(url.pathname==='/api/health')return json(res,200,{ok:true,gameId:GAME_ID,title:EDITION.title,version:EDITION.version,defaultRoomMode:EDITION.defaultRoomMode,rooms:rooms.size});
      if(url.pathname==='/api/content')return json(res,200,{campaign,maps,edition:EDITION});
      if(url.pathname==='/api/rooms'&&req.method==='POST'){
        const b=await body(req);if(Object.keys(b).some(k=>!['name','roomName','mode','characterId'].includes(k)))throw fail(400,'Unexpected room property');
        const mode=b.mode??'party';if(!['party','hosted'].includes(mode))throw fail(400,'Choose party or hosted mode');
        const state=createState(campaign,maps),character=mode==='party'?state.party.find(c=>c.id===(b.characterId??state.party[0].id)):null;
        if(mode==='party'&&!character)throw fail(400,'Select a valid character');
        const id=uuid(),s={id:uuid(),name:cleanName(b.name,mode==='party'?'同行者':'主持'),role:mode==='party'?'player':'host',characterId:character?.id??null,canManage:true,token:token()};
        const r={schema:1,gameId:GAME_ID,campaignId:campaign.id,id,name:cleanName(b.roomName,'第五日之城共游桌'),mode,decisionPolicy:mode==='party'?'first-valid-revision':'host',createdAt:new Date().toISOString(),state,seats:[s],agents:[],requests:{},saves:{}};
        rooms.set(id,r);persist(r);return json(res,201,{roomId:id,seatId:s.id,token:s.token,role:s.role,characterId:s.characterId,canManage:true,roomMode:roomMode(r),decisionPolicy:decisionPolicy(r),state:view(r,s)});
      }
      if(p[0]==='api'&&p[1]==='rooms'&&p[2]){
        const r=getRoom(p[2]);
        if(p[3]==='join'&&req.method==='POST'){
          const b=await body(req);if(Object.keys(b).some(k=>!['name','characterId'].includes(k)))throw fail(400,'Unexpected seat property');
          const character=r.state.party.find(c=>c.id===b.characterId);
          if(!character)throw fail(400,'Select a valid character');
          if(r.seats.some(s=>s.characterId===character.id)||r.agents.some(a=>a.characterId===character.id))throw fail(409,'Character already claimed');
          const s={id:uuid(),name:cleanName(b.name,character.name),role:'player',characterId:character.id,canManage:false,token:token()};
          r.seats.push(s);persist(r);return json(res,201,{roomId:r.id,seatId:s.id,token:s.token,role:s.role,characterId:s.characterId,canManage:false,roomMode:roomMode(r),decisionPolicy:decisionPolicy(r),state:view(r,s)});
        }
        const s=auth(r,req,url);
        if(p[3]==='actions'&&p.length===4){
          if(req.method!=='GET')throw fail(405,'Method not allowed');
          const actor=actorFor(r,s),visible=publicState(r.state,actor);
          // Validate bounded examples on cloned engine results; no state/RNG is committed.
          const actions=legalActionsForState(visible,campaign,maps,actor).slice(0,128).filter(action=>{
            try{actionShape(action);applyAction(r.state,action,campaign,maps,actor);return true;}catch{return false;}
          });
          return json(res,200,{revision:r.state.revision,actions,movementScope:'Adjacent legal steps are listed; normal move actions also accept rules-valid longer paths.'});
        }
        if(p[3]==='hub'&&p[4]==='chat'&&p.length===5){
          if(req.method==='GET')return json(res,200,chat.read(r.id,s,{cursor:url.searchParams.get('cursor')??url.searchParams.get('after'),limit:url.searchParams.get('limit')}));
          if(req.method!=='POST')throw fail(405,'Method not allowed');
          const message=await body(req),current=getRoom(p[2]),seat=auth(current,req,url);
          return json(res,200,chat.send(current.id,seat,message));
        }
        if(p[3]==='state'&&req.method==='GET')return json(res,200,view(r,s));
        if(p[3]==='seats'&&req.method==='GET')return json(res,200,{roomMode:roomMode(r),decisionPolicy:decisionPolicy(r),seats:r.seats.map(s=>({id:s.id,name:s.name,role:s.role,characterId:s.characterId,canManage:capabilitiesForActor(actorFor(r,s)).canManage})),agents:r.agents.map(({id,role,characterId})=>({id,role,characterId}))});
        if(p[3]==='events'&&req.method==='GET'){
          res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive','X-Accel-Buffering':'no'});res.write(`event: state\ndata: ${JSON.stringify(view(r,s))}\n\n`);
          const set=streams.get(r.id)||new Set();streams.set(r.id,set);const client={res,seat:s};set.add(client);req.on('close',()=>set.delete(client));return;
        }
        if(p[3]==='action'&&req.method==='POST')return json(res,200,execute(r,s,await body(req)));
        if(p[3]==='saves'&&req.method==='GET')return json(res,200,{saves:Object.entries(r.saves||{}).map(([slot,v])=>({slot,revision:v.state.revision,savedAt:v.savedAt}))});
        if(['save','load'].includes(p[3])&&req.method==='POST'){
          manager(r,s);const b=await body(req);if(Object.keys(b).some(k=>k!=='slot'))throw fail(400,'Unexpected save property');const slot=safeKey(b.slot)?b.slot:null;if(!slot)throw fail(400,'Invalid save slot');
          r.saves||={};if(p[3]==='save'){r.saves[slot]={gameId:GAME_ID,campaignId:campaign.id,savedAt:new Date().toISOString(),state:structuredClone(r.state)};}else{if(!Object.hasOwn(r.saves,slot))throw fail(404,'Save not found');const saved=r.saves[slot];if(saved.gameId!==GAME_ID||saved.campaignId!==campaign.id||!belongsToGame(saved.state))throw fail(400,'此存档不属于《第五日之城》');const revision=r.state.revision+1;r.state=structuredClone(saved.state);r.state.revision=revision;r.state.journal.push({type:'system',text:'读取存档：'+slot,clock:r.state.clock});}
          persist(r);publish(r);return json(res,200,{ok:true,state:view(r,s)});
        }
        if(p[3]==='export'&&req.method==='POST'){manager(r,s);return json(res,200,{schema:3,gameId:GAME_ID,campaign:campaign.id,roomMode:roomMode(r),exportedAt:new Date().toISOString(),state:structuredClone(r.state)});}
        if(p[3]==='agents'&&req.method==='POST'){
          manager(r,s);const b=await body(req);if(Object.keys(b).some(k=>!['role','characterId'].includes(k)))throw fail(400,'Unexpected agent property');if(!['dm','player'].includes(b.role))throw fail(400,'Choose dm or player');
          const char=b.role==='player'?r.state.party.find(c=>c.id===b.characterId):null;
          if(b.role==='player'&&!char)throw fail(400,'Player agent needs a valid character');
          if(char&&(r.seats.some(s=>s.characterId===char.id)||r.agents.some(a=>a.characterId===char.id)))throw fail(409,'Character already claimed');
          const a={id:uuid(),role:b.role,characterId:char?.id||null};r.agents.push(a);persist(r);publish(r);return json(res,201,{ok:true,gameId:GAME_ID,agentId:a.id,folder:bridgeDir(r,a),protocol:1});
        }
        throw fail(404,'Unknown room endpoint');
      }
      if(url.pathname.startsWith('/api/'))throw fail(404,'Unknown endpoint');
      if(!['GET','HEAD'].includes(req.method))throw fail(405,'Method not allowed');
      let relative=decodeURIComponent(url.pathname).replace(/^\/+/,''),file;
      if(relative==='engine.mjs')file=path.join(ROOT,'engine.mjs');else if(relative==='server/combat-ledger.mjs')file=path.resolve(ROOT,'../../server/combat-ledger.mjs');else if(publicGuides.has(relative))file=path.join(ROOT,relative);else{
        relative||='index.html';const publicRoot=path.join(ROOT,'public');file=path.resolve(publicRoot,relative);
        if(!file.startsWith(publicRoot+path.sep)||relative.includes('\0'))throw fail(403,'Invalid path');
      }
      if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw fail(404,'File not found');
      const real=fs.realpathSync(file);if(real!==path.resolve(file))throw fail(403,'Symbolic assets are not served');
      res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'"});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
    }catch(e){if(!res.headersSent)json(res,e.status||500,{ok:false,error:e.status?e.message:'Internal server error'});else res.end();}
  });
  for(const r of rooms.values())publish(r);
  const interval=setInterval(bridgeTick,options.bridgeInterval||500);interval.unref();
  const heartbeat=setInterval(()=>{for(const set of streams.values())for(const c of set)try{c.res.write(': heartbeat\n\n');}catch{}},15000);heartbeat.unref();
  server.on('close',()=>{clearInterval(interval);clearInterval(heartbeat);for(const set of streams.values())for(const c of set)c.res.end();});
  server.listen(options.port??Number(process.env.PORT||8856),options.host||process.env.HOST||'127.0.0.1');
  return {server,dataDir,rooms,close:()=>{for(const set of streams.values())for(const c of set)c.res.end();return new Promise(resolve=>server.close(resolve));}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){try{const app=startServer();app.server.on('listening',()=>{const address=app.server.address();console.log(EDITION.title+': http://127.0.0.1:'+address.port);if(!['127.0.0.1','::1'].includes(address.address))console.log('局域网监听 '+address.address+'；朋友使用本机局域网IP和相同端口。');});app.server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'端口已被占用；请修改 PORT 后重启。':e.message);process.exitCode=1;});}catch(e){console.error(e.message);process.exitCode=1;}}
