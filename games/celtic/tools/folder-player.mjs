import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {atomicJson,parseProposal} from '../bridge.mjs';

export async function readPlayerSnapshot(root) {
  root=path.resolve(root);
  const folder=await fs.lstat(root),file=path.join(root,'snapshot.json'),stat=await fs.lstat(file);
  if(!folder.isDirectory()||folder.isSymbolicLink()||!stat.isFile()||stat.isSymbolicLink()||stat.size>2*1024*1024)throw Error('请选择管理席创建的文件夹玩家目录。');
  const snapshot=JSON.parse(await fs.readFile(file,'utf8'));
  if(!snapshot.active)throw Error('文件夹玩家已停用。');
  if(!Array.isArray(snapshot.actions)||snapshot.seat?.role!=='player'||!snapshot.automatic)throw Error('这个目录没有可自主行动的普通玩家快照。');
  return snapshot;
}
export async function submitFolderAction({root,actionIndex,narration='',snapshot}) {
  const current=snapshot||await readPlayerSnapshot(root);
  if(Date.now()>=Date.parse(current.expiresAt))throw Error('快照已超时，请读取最新 snapshot.json 后再决定。');
  const proposal=parseProposal({protocolVersion:1,requestId:current.requestId,revision:current.revision,actionIndex,narration});
  if(actionIndex!==null&&!current.actions[actionIndex])throw Error('行动索引不在最新快照中。');
  await atomicJson(path.join(path.resolve(root),'inbox',`${current.requestId}.json`),proposal);
  return {requestId:current.requestId,revision:current.revision,status:'submitted',receiptFile:path.join(path.resolve(root),'receipts',`${current.requestId}.json`)};
}
// A caller may inject an already-authorized decision callback. This module does
// not create provider clients, load credentials, or manufacture player choices.
export async function runFolderPlayer({root,decide,signal,pollMs=750}) {
  if(typeof decide!=='function')throw Error('请显式提供 decide(snapshot) 决策函数。');
  let answered=null;
  while(!signal?.aborted) {
    const snapshot=await readPlayerSnapshot(root);
    if(snapshot.requestId!==answered&&Date.now()<Date.parse(snapshot.expiresAt)) {
      const raw=await decide(structuredClone(snapshot));
      const proposal=parseProposal(raw);
      if(proposal.requestId!==snapshot.requestId||proposal.revision!==snapshot.revision)throw Error('决策回复与当前快照不匹配。');
      const latest=await readPlayerSnapshot(root);
      if(latest.requestId!==snapshot.requestId||Date.now()>=Date.parse(snapshot.expiresAt)){answered=snapshot.requestId;continue;}
      await submitFolderAction({root,snapshot,actionIndex:proposal.actionIndex,narration:proposal.narration});answered=snapshot.requestId;
    }
    await new Promise(resolve=>setTimeout(resolve,pollMs));
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const argument=name=>process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
  const root=argument('dir');
  if(!root){console.log('读取：node tools/folder-player.mjs --dir="管理席显示的目录"\n行动：node tools/folder-player.mjs --dir="目录" --action=行动索引 --narration="可选旁白"\n等待：node tools/folder-player.mjs --dir="目录" --wait\n服务器会自动执行合法回复；不必点击采用。');}
  else if(argument('action')!==undefined){const value=argument('action');console.log(JSON.stringify(await submitFolderAction({root,actionIndex:value==='null'?null:Number(value),narration:argument('narration')||''}),null,2));}
  else if(process.argv.includes('--wait')){let shown=null;while(true){const snapshot=await readPlayerSnapshot(root);if(snapshot.requestId!==shown){console.log(JSON.stringify(snapshot,null,2));shown=snapshot.requestId;}await new Promise(resolve=>setTimeout(resolve,1000));}}
  else console.log(JSON.stringify(await readPlayerSnapshot(root),null,2));
}
