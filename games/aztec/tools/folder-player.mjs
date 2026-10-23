import '../hub-environment.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {GAME_ID} from '../engine.mjs';
import {parseModelAction} from './api-adapter.mjs';

const ROOT=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DATA=path.resolve(process.env.AZTEC_DATA_DIR||path.join(ROOT,'data','aztec-v3'));
const BRIDGE=path.join(DATA,'bridge');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const print=value=>console.log(JSON.stringify(value,null,2));
const args=process.argv.slice(2),command=args.shift()||'help',options={};
for(let i=0;i<args.length;i++) {
  if(!args[i].startsWith('--')||!args[i+1]||args[i+1].startsWith('--'))throw Error('参数格式：--名称 值');
  options[args[i].slice(2)]=args[++i];
}
const read=file=>JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
function snapshotAt(folder) {
  const real=fs.realpathSync(folder),root=fs.realpathSync(BRIDGE);
  const relative=path.relative(root,real);
  if(relative.startsWith('..')||path.isAbsolute(relative)||relative.split(path.sep).length!==2)throw Error('请选择本作 bridge 下的房间/智能体目录');
  const snapshot=read(path.join(real,'snapshot.json'));
  if(snapshot.gameId!==GAME_ID||snapshot.protocol!==1)throw Error('不是本作的智能体快照');
  return {folder:real,snapshot};
}
function selected() {
  if(!options.folder)throw Error('需要 --folder，使用游戏返回的智能体目录');
  return snapshotAt(path.resolve(options.folder));
}
function summary(snapshot) {
  return {gameId:snapshot.gameId,roomId:snapshot.roomId,agentId:snapshot.agentId,role:snapshot.role,characterId:snapshot.characterId,revision:snapshot.revision,phase:snapshot.phase,turn:snapshot.turn,map:snapshot.currentMap?.name,legalActions:snapshot.legalActions?.length??0,ending:snapshot.state?.ending?.title??null};
}
async function main() {
  if(command==='help') {
    console.log(`第五日之城：文件夹玩家\n\nlist                         列出本作已创建的智能体（不读席位凭据）\ncreate --room ID --character nelli   用 AZTEC_SEAT_TOKEN 管理令牌创建玩家\nsnapshot --folder PATH       输出当前快照、剧情与合法行动\nwatch --folder PATH --seconds 30    等待状态变化，默认30秒\nsubmit --folder PATH --revision N --action-file ACTION.json [--id REQUEST_ID]\n\nrevision 使用你决定此动作时所读的快照修订号，冲突后重新决定。\ncreate 的服务器地址取 --url 或 AZTEC_URL，默认 http://127.0.0.1:8856。\nsubmit 只写本作 inbox.json，服务端验证后写 receipt.json；不调用模型。\n四个角色ID：yaotl / itzel / nelli / xoco。共游玩家可操作固定全队。`);
    return;
  }
  if(command==='list') {
    const result=[];
    if(fs.existsSync(BRIDGE))for(const room of fs.readdirSync(BRIDGE,{withFileTypes:true}))if(room.isDirectory()&&!room.isSymbolicLink())for(const agent of fs.readdirSync(path.join(BRIDGE,room.name),{withFileTypes:true}))if(agent.isDirectory()&&!agent.isSymbolicLink()) {
      try{const item=snapshotAt(path.join(BRIDGE,room.name,agent.name));result.push({...summary(item.snapshot),folder:item.folder});}catch{}
    }
    print(result);return;
  }
  if(command==='create') {
    if(!options.room||!options.character)throw Error('create 需要 --room 和 --character；也可直接在游戏的智能体面板创建');
    if(!process.env.AZTEC_SEAT_TOKEN)throw Error('先在当前终端设置 AZTEC_SEAT_TOKEN 为本房间管理席位令牌；不要把令牌放进命令参数');
    if(!['yaotl','itzel','nelli','xoco'].includes(options.character))throw Error('请选择本作四位角色之一');
    const url=new URL((options.url||process.env.AZTEC_URL||'http://127.0.0.1:8856').replace(/\/$/,'')+'/api/rooms/'+encodeURIComponent(options.room)+'/agents');
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.AZTEC_SEAT_TOKEN},body:JSON.stringify({role:'player',characterId:options.character}),signal:AbortSignal.timeout(10000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'创建玩家失败');
    print(result);return;
  }
  const {folder,snapshot}=selected();
  if(command==='snapshot'){print(snapshot);return;}
  if(command==='watch') {
    const seconds=Number(options.seconds??30);if(!Number.isFinite(seconds)||seconds<1||seconds>3600)throw Error('seconds 为1–3600');
    let revision=snapshot.revision;print(summary(snapshot));const until=Date.now()+seconds*1000;
    while(Date.now()<until){await pause(500);try{const next=snapshotAt(folder).snapshot;if(next.revision!==revision){revision=next.revision;print(summary(next));}}catch{}}
    return;
  }
  if(command==='submit') {
    let text;
    if(options['action-file'])text=fs.readFileSync(path.resolve(options['action-file']),'utf8').replace(/^\uFEFF/,'');
    else if(options.action)text=options.action;
    else throw Error('submit 需要 --action-file ACTION.json 或 --action JSON');
    const revision=options.revision===undefined?NaN:Number(options.revision);
    if(!Number.isSafeInteger(revision)||revision<0)throw Error('需要 --revision，填写决定动作时所读快照的 revision；避免把旧意图套到新局面');
    const request=parseModelAction(text,{...snapshot,revision},{id:options.id||randomUUID()});
    const inbox=path.join(folder,'inbox.json'),temporary=path.join(folder,'.inbox-'+randomUUID()+'.tmp');
    if(fs.existsSync(inbox))throw Error('上一条请求仍待处理，请先读取 receipt.json 或稍后重试');
    try{fs.writeFileSync(temporary,JSON.stringify(request,null,2),{encoding:'utf8',flag:'wx'});fs.renameSync(temporary,inbox);}finally{if(fs.existsSync(temporary))fs.unlinkSync(temporary);}
    print({submitted:true,id:request.id,expectedRevision:request.expectedRevision});
    const until=Date.now()+10000;
    while(Date.now()<until){await pause(250);try{const receipt=read(path.join(folder,'receipt.json'));if(receipt.id===request.id){print(receipt);if(!receipt.ok)process.exitCode=1;return;}}catch{}}
    print({pending:true,id:request.id,message:'尚未收到回执。服务器恢复后会处理；先查 receipt.json，结果不明时沿用相同ID。'});return;
  }
  throw Error('未知命令，运行 node tools/folder-player.mjs help 查看用法');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
