import '../hub-environment.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),opts={},pos=[];
const booleanOptions=new Set(['help','auto-apply']);
for(let i=0;i<args.length;i++){
 const arg=args[i];
 if(arg.startsWith('--')){
  const [name,...value]=arg.slice(2).split('=');
  if(booleanOptions.has(name)){opts[name]=true;continue;}
  if(!['url','room','token-env','cursor','out','request','request-id','revision','interval','stop-file','command-id','seat','steps'].includes(name))throw Error('未知选项 --'+name+'。');
  opts[name]=value.length?value.join('='):args[++i];
  if(opts[name]===undefined||opts[name].startsWith('--'))throw Error('--'+name+' 需要值。');
 }else pos.push(arg);
}
const [command,arg,...rest]=pos;
const help='node tools/bridge.mjs [--url HTTPS地址 --room 房间ID --token-env 环境变量名] state | events [游标] | inbox | request dm|player 角色ID [文字] | submit 回复.json | apply | command 行动.json | watch | stop | pause | resume | takeover | cancel\n选项：--out 文件、--request 请求.json、--request-id ID、--revision 版本、--cursor 游标、--interval 毫秒、--stop-file 文件、--command-id ID、--seat 席位ID、--steps 请求次数、--auto-apply。\n远程席位凭据只从环境变量读取，默认 FENGSHEN_V03_SEAT_TOKEN；不接受命令行明文 token。watch 仅保持连接并写入事件/待办，按 Ctrl+C 或另开终端运行相同配置的 stop 可停止。';
const stopFile=opts['stop-file']?path.resolve(root,opts['stop-file']):process.env.HUB_DATA_DIR?path.join(process.env.HUB_DATA_DIR,'bridge','workspace-watch.stop'):path.join(root,'data','bridge-v03','workspace-watch.stop');
const credentialFields=new Set(['token','seattoken','gametoken','eventtoken','processtoken','tokenhash','invite','inviteurl','key','apikey','authorization']);
const safeOutput=value=>Array.isArray(value)?value.map(safeOutput):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!credentialFields.has(key.toLowerCase())).map(([key,item])=>[key,safeOutput(item)])):value;
const print=value=>console.log(JSON.stringify(safeOutput(value),null,2));
const atomic=(file,value)=>{fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(value,null,2),'utf8');fs.renameSync(tmp,file);};
const writeOutput=value=>{if(opts.out)atomic(path.resolve(opts.out),safeOutput(value));else print(value);};
const readJSON=file=>{try{return JSON.parse(fs.readFileSync(path.resolve(file),'utf8').replace(/^\uFEFF/,''));}catch{throw Error('无法读取 JSON 文件，请检查文件是否存在与格式是否正确。');}};
const configuredUrl=opts.url||process.env.FENGSHEN_V03_URL;
let runtime={};
if(!configuredUrl&&command&&!opts.help&&command!=='stop'){
 const modern=path.resolve(process.env.RUNTIME_FILE||path.join(root,'data/runtime-v03.json'));
 if(fs.existsSync(modern))runtime=readJSON(modern);
}
const remote=!!configuredUrl;
const baseString=configuredUrl||runtime.url;
const tokenEnv=opts['token-env']||'FENGSHEN_V03_SEAT_TOKEN';
const token=process.env[tokenEnv]||(!remote&&!runtime.multiplayer?runtime.token:'')||'';
const room=opts.room||process.env.FENGSHEN_V03_ROOM||runtime.roomId||'';
let base;
function connect(){
 if(!baseString)throw Error('尚未找到游戏服务；先启动本地服务或指定 --url。');
 base=new URL(baseString);
 if(base.username||base.password||base.search||base.hash)throw Error('游戏 URL 不应包含凭据、参数或片段。');
 const local=['localhost','127.0.0.1','[::1]'].includes(base.hostname);
 if(base.protocol!=='https:'&&!(base.protocol==='http:'&&local))throw Error('远程游戏需要 HTTPS，本机可用 HTTP。');
 if(!token)throw Error('缺少席位凭据。请将房主授予的席位 token 放入 '+tokenEnv+' 环境变量。');
 if(/[\r\n]/.test(token))throw Error('席位凭据必须为单行。');
}
async function api(route,body,{signal,timeout=30000}={}){
 const target=new URL(base.href.replace(/\/$/,'')+'/api/'+route);
 const combined=signal?AbortSignal.any([signal,AbortSignal.timeout(timeout)]):AbortSignal.timeout(timeout);
 let response;try{response=await fetch(target,{method:body===undefined?'GET':'POST',headers:{'x-seat-token':token,'x-game-token':token,...(room?{'x-room-id':room}:{}),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify({commandId:opts['command-id']||randomUUID(),...body})}),signal:combined,redirect:'error'});}catch{if(signal?.aborted)throw Error('连接器已停止。');throw Object.assign(Error('无法连接游戏服务，或连接已超时。'),{retryable:true});}
 const retryable=response.status>=500||[408,425,429].includes(response.status);
 let result;try{result=await response.json();}catch{throw Object.assign(Error('游戏服务没有返回 JSON（HTTP '+response.status+'）。'),{retryable,status:response.status});}
 if(!response.ok)throw Object.assign(Error(result.error||'游戏接口返回 HTTP '+response.status+'。'),{retryable,status:response.status});
 return result;
}
const stateOf=view=>view.state||view;
const lastResult=view=>({revision:stateOf(view).revision,seq:view.seq??view.room?.seq,last:stateOf(view).log?.slice(-5),pending:view.pending||null});
function numeric(value,label){const n=Number(value);if(!Number.isInteger(n)||n<0)throw Error(label+' 必须为非负整数。');return n;}
function savedRequest(){
 if(opts.request){const value=readJSON(opts.request);return value.request||value;}
 return null;
}
async function runWatch(){
 const controller=new AbortController(),serverUrl=base.href.replace(/\/$/,'');
 let cursor=opts.cursor===undefined?0:numeric(opts.cursor,'游标'),inboxId=null,inbox=null,lastMessage={};
 if(opts.cursor===undefined&&opts.out&&fs.existsSync(path.resolve(opts.out))){
  try{const previous=readJSON(opts.out);if(Number.isInteger(previous.cursor)&&previous.cursor>=0&&(!previous.server||previous.server===serverUrl)&&(!room||!previous.room||previous.room===room)){cursor=previous.cursor;console.error('工作区连接器将从已保存的游标 '+cursor+' 继续。');}}catch{}
 }
 const interval=Math.max(1000,Math.min(30000,numeric(opts.interval||3000,'轮询间隔')));
 if(fs.existsSync(stopFile))fs.rmSync(stopFile);
 const stop=()=>controller.abort();
 const filePoll=setInterval(()=>{if(fs.existsSync(stopFile))stop();},500);
 process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  let reconnectDelay=1000,announced=false;
  while(!controller.signal.aborted){
   try{
    await api('bridge/presence',{status:'connected',cursor},{signal:controller.signal});
    if(!announced){console.error('工作区连接器已连接；按 Ctrl+C，或运行 bridge.mjs stop 停止。');announced=true;}
    while(!controller.signal.aborted){
     const update=await api('updates?since='+cursor,undefined,{signal:controller.signal});
     const events=update.events||[],next=update.nextCursor??update.cursor??update.eventSeq??update.seq??update.room?.seq??cursor;
     const nextCursor=numeric(next,'事件游标'),state=update.state||update.view?.state,pending=update.pending||update.view?.pending||null;
     if(pending?.id!==inboxId){const wanted=pending?.id||null;let received=null;if(wanted){const result=await api('bridge/request',undefined,{signal:controller.signal});received=result.request||null;}inboxId=wanted;inbox=received;}
     const own=update.seat?.actors||[];
     const todo=update.todo||update.tasks||(pending?{kind:pending.stale?'refresh':pending.result?'review':'reply',requestId:pending.id,revision:pending.revision,stale:!!pending.stale,request:inbox}:state?.current&&own.includes(state.current)?{kind:'turn',actor:state.current,revision:state.revision}:update.seat?.role==='dm'?{kind:'host',actor:state?.current||null,revision:state?.revision}:null);
     lastMessage={connection:'connected',server:serverUrl,room:room||update.room?.id||null,cursor:nextCursor,revision:state?.revision??update.revision,reset:!!update.reset,...(update.reset?{state}:{}),seat:update.seat,events,pending,todo};
     if(events.length||pending||todo||opts.out)writeOutput(lastMessage);
     cursor=nextCursor;reconnectDelay=1000;
     await api('bridge/presence',{status:'connected',cursor},{signal:controller.signal});
     await delay(interval,undefined,{signal:controller.signal});
    }
   }catch(error){
    if(controller.signal.aborted)break;
    if(!error.retryable)throw error;
    announced=false;inboxId=null;inbox=null;
    writeOutput({...lastMessage,connection:'reconnecting',server:serverUrl,room:room||lastMessage.room||null,cursor,retryInMs:reconnectDelay,error:error.message});
    console.error('工作区连接中断，'+reconnectDelay/1000+' 秒后重连；停止指令仍然有效。');
    await delay(reconnectDelay,undefined,{signal:controller.signal});
    reconnectDelay=Math.min(30000,reconnectDelay*2);
   }
  }
 }catch(error){if(!controller.signal.aborted)throw error;}
 finally{
  controller.abort();clearInterval(filePoll);
  try{await api('bridge/presence',{status:'disconnected',cursor},{timeout:5000});}catch{}
  process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  if(opts.out)atomic(path.resolve(opts.out),safeOutput({...lastMessage,connection:'disconnected',server:serverUrl,room:room||lastMessage.room||null,cursor}));
  console.error('工作区连接器已断开。');
 }
}
try{
 if(!command||opts.help){console.log(help);}
 else if(command==='stop'){
  fs.mkdirSync(path.dirname(stopFile),{recursive:true});fs.writeFileSync(stopFile,'stop\n','utf8');print({status:'stop-requested'});
 }else{
  connect();
  if(command==='state'){const result=await api('state');writeOutput(remote||runtime.multiplayer?result:result.state||result);}
  else if(command==='events'){writeOutput(await api('updates?since='+numeric(opts.cursor||arg||0,'游标')));}
  else if(command==='inbox'){writeOutput(await api('bridge/request'));}
  else if(command==='request'){
   const view=await api('state'),state=stateOf(view);
   const role=['dm','player'].includes(arg)?arg:undefined;
   const actor=role?(rest[0]||state.current||'p1'):(arg||state.current||'p1');
   const text=role?rest.slice(1).join(' '):rest.join(' ');
   const result=await api('ai/request',{revision:state.revision,role,actor,mode:'bridge',text});
   writeOutput(result.request||result);
  }else if(command==='submit'){
   if(!arg)throw Error('submit 需要结构化回复 JSON 文件。');
   const response=readJSON(arg),req=savedRequest(),view=await api('state');
   let id=opts['request-id']||response.requestId||req?.requestId||req?.id||view.pending?.id;
   if(!id&&!remote&&!runtime.multiplayer){const legacy=path.join(root,'data/bridge-v03/request.json');if(fs.existsSync(legacy))id=readJSON(legacy).id;}
   if(!id)throw Error('没有当前请求，请先 request，或使用 --request 请求.json。');
   const result=await api('bridge/submit',{id,revision:response.revision??req?.revision??stateOf(view).revision,response});
   writeOutput(result.pending||result);
  }else if(command==='apply'){
   const view=await api('state'),req=savedRequest(),id=opts['request-id']||req?.requestId||req?.id||view.pending?.id;
   if(!id)throw Error('没有待采用的 AI 回复。');
   writeOutput(lastResult(await api('ai/apply',{id,revision:opts.revision===undefined?(req?.revision??stateOf(view).revision):numeric(opts.revision,'版本')})));
  }else if(command==='command'){
   if(!arg)throw Error('command 需要行动 JSON 文件。');
   const input=readJSON(arg),req=savedRequest(),view=await api('state');
   const revision=opts.revision!==undefined?numeric(opts.revision,'版本'):input.revision??req?.revision;
   if(revision===undefined&&(remote||runtime.multiplayer))throw Error('房间命令需要读取局面时的 revision；用 {revision,command} 文件，或 --request 请求.json / --revision N。');
   const result=await api('command',{commandId:input.commandId||opts['command-id']||randomUUID(),revision:revision??stateOf(view).revision,command:input.command||input});
   writeOutput(lastResult(result));
  }else if(command==='watch')await runWatch();
  else if(['pause','resume','takeover','cancel'].includes(command)){
   const view=await api('state');writeOutput(await api('ai/control',{action:command,seatId:opts.seat||arg||undefined,revision:stateOf(view).revision,...(opts.steps!==undefined?{steps:numeric(opts.steps,'请求次数')}:{}),...(opts['auto-apply']?{autoApply:true}:{})}));
  }else throw Error('未知命令。使用 --help 查看用法。');
 }
}catch(error){console.error(error.message);process.exitCode=1;}

