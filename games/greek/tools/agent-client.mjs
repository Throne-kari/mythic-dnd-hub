import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { atomicJSON } from './agent-bridge.mjs';
import { mockDecision } from './mock-api.mjs';

export async function runOnce({folder,decide=mockDecision,now=Date.now()}) {
  const root=path.resolve(folder),snapshotPath=path.join(root,'snapshot.json');
  if(fs.lstatSync(root).isSymbolicLink() || fs.lstatSync(snapshotPath).isSymbolicLink()) throw new Error('智能体目录或快照不得是链接');
  const snapshot=JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
  if(snapshot.protocol!==1 || Date.parse(snapshot.expiresAt)<=now) throw new Error('快照已过期，等待主机重新发布');
  const action=await decide(structuredClone(snapshot));if(!action) return {status:'idle',revision:snapshot.revision};
  const requestId=`r-${randomBytes(10).toString('hex')}`;
  const request={protocol:1,requestId,roomId:snapshot.roomId,seatId:snapshot.seatId,revision:snapshot.revision,expiresAt:new Date(now+30000).toISOString(),action};
  atomicJSON(path.join(root,'requests',`${requestId}.json`),request);
  return {status:'submitted',requestId,revision:snapshot.revision,actionType:action.type};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const folder=process.argv[2];if(!folder) {console.error('用法：node tools/agent-client.mjs <智能体席位目录>');process.exitCode=1;}
  else console.log(JSON.stringify(await runOnce({folder})));
}
