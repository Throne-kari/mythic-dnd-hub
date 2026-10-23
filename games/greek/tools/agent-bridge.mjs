import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { act, view } from '../engine.mjs';

export const isId = value => typeof value==='string' && /^[A-Za-z0-9_-]{1,64}$/.test(value);
export function directory(target) {
  fs.mkdirSync(target,{recursive:true});
  if(fs.lstatSync(target).isSymbolicLink() || !fs.statSync(target).isDirectory()) throw new Error('协议目录不得是链接');
  return target;
}
export function atomicJSON(target,value) {
  directory(path.dirname(target));
  if(fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('目标不得是链接');
  const temp=`${target}.${randomBytes(6).toString('hex')}.tmp`;
  let fd;
  try {fd=fs.openSync(temp,'wx',0o600);fs.writeFileSync(fd,JSON.stringify(value,null,2),'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;fs.renameSync(temp,target);}
  finally {if(fd!==undefined) fs.closeSync(fd);if(fs.existsSync(temp)) fs.unlinkSync(temp);}
}
export function agentFolder(runtimeDir,roomId,seatId) {
  if(!isId(roomId) || !isId(seatId)) throw new Error('无效的房间或席位标识');
  directory(runtimeDir);directory(path.join(runtimeDir,'agents'));directory(path.join(runtimeDir,'agents',roomId));
  const root=directory(path.join(runtimeDir,'agents',roomId,seatId));
  for(const name of ['requests','receipts','archive']) directory(path.join(root,name));
  return root;
}
export function publishSnapshot({runtimeDir,roomId,seat,state,campaign,maps,now=Date.now()}) {
  const root=agentFolder(runtimeDir,roomId,seat.id);
  const map=state.customMaps?.[state.mapId] || (Array.isArray(maps)?maps:maps.maps).find(m=>m.id===state.mapId);
  const gameView=view(state,seat,campaign,maps);gameView.availableChoices=gameView.availableChoices.filter(c=>!c.waiting);
  const data={protocol:1,roomId,seatId:seat.id,revision:state.revision,generatedAt:new Date(now).toISOString(),expiresAt:new Date(now+60000).toISOString(),seat:{id:seat.id,role:seat.role,heroIds:seat.heroIds},context:{title:campaign.title,chapter:state.chapter || 1,chapterInfo:campaign.chapters?.[(state.chapter || 1)-1] || null,deadline:campaign.deadline ?? 18,map,canNarrate:seat.role==='dm' && !state.ending,objectives:(campaign.arcs || []).filter(a=>state.arcs[a.id]?.status==='active' && (a.stages.find(st=>st.id===state.arcs[a.id].stage).chapter ?? 1)===(state.chapter || 1)).map(a=>{const stage=a.stages.find(st=>st.id===state.arcs[a.id].stage);return {arcId:a.id,title:stage.title,chapter:stage.chapter ?? 1,mapId:stage.mapId,pointId:stage.pointId,text:stage.text};})},state:gameView};
  atomicJSON(path.join(root,'snapshot.json'),data);return data;
}
function receiptFile(root,id,receipt) {atomicJSON(path.join(root,'receipts',`${id}.json`),receipt);}
function appendAudit(root,receipt) {
  const target=path.join(root,'audit.jsonl'); if(fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) throw new Error('日志不得是链接');
  // No token, action arguments, raw request, or external credentials are logged.
  fs.appendFileSync(target,JSON.stringify({at:receipt.at,requestId:receipt.requestId,status:receipt.status,revision:receipt.revision})+'\n',{encoding:'utf8',mode:0o600});
}
export function validateRequest(request,{roomId,seatId,revision,now=Date.now()}) {
  if(!request || typeof request!=='object' || Array.isArray(request) || Object.keys(request).some(k=>!['protocol','roomId','seatId','revision','requestId','expiresAt','action'].includes(k))) throw new Error('请求字段不在白名单');
  if(request.protocol!==1 || !isId(request.requestId) || request.roomId!==roomId || request.seatId!==seatId) throw new Error('请求身份无效');
  if(!Number.isSafeInteger(request.revision) || request.revision!==revision) throw new Error('状态修订已过期');
  const deadline=Date.parse(request.expiresAt);if(!Number.isFinite(deadline) || deadline<=now || deadline>now+300000) throw new Error('请求已超时或期限过长');
  return true;
}
// The host injects the authoritative room store and durable commit callback.
// A callback must persist state AND the receipt before publishing a result.
export function tick({runtimeDir,rooms,campaign,maps,commit,now=Date.now()}) {
  const results=[];
  for(const room of rooms instanceof Map?rooms.values():rooms) for(const member of room.seats.filter(x=>x.agent)) {
    const seat=member.seat,root=agentFolder(runtimeDir,room.id,seat.id),inbox=path.join(root,'requests');
    const files=fs.readdirSync(inbox).filter(name=>/^[A-Za-z0-9_-]{1,64}\.json(?:\.processing)?$/.test(name)).slice(0,40);
    for(const name of files) {
      const id=name.replace(/\.json(?:\.processing)?$/,''),source=path.join(inbox,name),processing=path.join(inbox,`${id}.json.processing`);
      let request,receipt;const key=`${seat.id}:${id}`;
      try {
        if(fs.lstatSync(source).isSymbolicLink() || fs.statSync(source).size>32768) throw new Error('请求文件无效或过大');
        if(source!==processing) {if(fs.existsSync(processing)) continue;fs.renameSync(source,processing);}
        const content=fs.readFileSync(processing,'utf8');
        try {request=JSON.parse(content);} catch {throw new Error('请求JSON无效');}
        if(request.requestId!==id) throw new Error('文件名必须匹配requestId');
        if(room.processed?.[key]) receipt=room.processed[key];
        else {
          validateRequest(request,{roomId:room.id,seatId:seat.id,revision:room.state.revision,now});
          const next=act(room.state,request.action,seat,campaign,maps);
          receipt={protocol:1,requestId:id,status:'accepted',revision:next.revision,at:new Date(now).toISOString()};
          commit(room,next,{key,receipt});
        }
      } catch(error) {
        receipt=room.processed?.[key] || {protocol:1,requestId:id,status:'rejected',revision:room.state.revision,error:error.message,at:new Date(now).toISOString()};
        if(!room.processed?.[key]) commit(room,room.state,{key,receipt});
      }
      receiptFile(root,id,receipt);appendAudit(root,receipt);
      const archive=path.join(root,'archive',`${id}.json`);
      if(fs.existsSync(processing)) {if(fs.existsSync(archive)) {if(!fs.lstatSync(archive).isSymbolicLink()) fs.unlinkSync(processing);} else fs.renameSync(processing,archive);}
      results.push(receipt);
    }
    publishSnapshot({runtimeDir,roomId:room.id,seat,state:room.state,campaign,maps,now});
  }
  return results;
}
