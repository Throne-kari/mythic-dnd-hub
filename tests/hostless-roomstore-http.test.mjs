import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const freePort=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
for(const game of ['fengshen','japan','india','jaffa','acre','qchina','qjapan','qindia'])test(`${game}: HTTP cooperative permissions, progression, slots and token reconnect`,{timeout:20000},async()=>{
 const dir=await fs.mkdtemp('/tmp/hostless-http-');const port=await freePort(),origin=`http://127.0.0.1:${port}`;let child;
 const start=async()=>{child=spawn(process.execPath,['server.mjs'],{cwd:path.join(root,'games',game),env:{...process.env,PORT:String(port),HOST:'127.0.0.1',HUB_DATA_DIR:dir,ROOMS_DIR:path.join(dir,'rooms'),RUNTIME_FILE:path.join(dir,'runtime.json')},stdio:['ignore','ignore','ignore']});for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('isolated server failed startup');try{if((await fetch(origin,{signal:AbortSignal.timeout(250)})).ok)return;}catch{}await new Promise(r=>setTimeout(r,25));}throw Error('isolated server readiness timeout');};
 const stop=async()=>{if(child&&child.exitCode===null){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}child=null;};
 const req=async(route,body,session,expected=200)=>{const response=await fetch(origin+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(session?{'x-seat-token':session.token,'x-room-id':session.room.id}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(2000)});assert.equal(response.status,expected,`${game}: ${route} expected HTTP ${expected}`);return response.json();};
 const body=(s,extra={})=>({revision:s.state.revision,commandId:randomUUID(),...extra});
 try{
  await start();let owner=await req('rooms',{displayName:'First independent session'});const token=owner.token;assert.ok(token);assert.equal(owner.seat.role,'player');assert.equal(owner.room.cooperative,true);assert.equal(owner.seat.isOwner,true);
  const choice=owner.state.choices[0];owner={...owner,...await req('command',body(owner,{command:{type:'choice',actor:owner.seat.actors[0],option:choice.id}}),owner)};
  let peer=await req('join',{invite:owner.room.invite,displayName:'Second independent session'});owner={...owner,...await req('state',undefined,owner)};
  assert.equal(peer.seat.actors.length,1);assert.notEqual(peer.seat.actors[0],owner.seat.actors[0]);
  await req('seat',body(owner,{actor:peer.seat.actors[0]}),owner,409);
  peer={...peer,...await req('seat',body(peer,{actor:'p3'}),peer)};assert.ok(peer.seat.actors.includes('p3'));
  owner={...owner,...await req('state',undefined,owner)};await req('room',body(owner,{dmSeatId:peer.seat.id}),owner,403);await req('seats',body(owner,{kind:'human',role:'dm'}),owner,403);
  await req('command',body(owner,{command:{type:'gm',text:'not an allowed cooperative action'}}),owner,403);await req('chapter',undefined,owner,403);await req('maps',undefined,owner,403);
  owner={...owner,...await req('slot',body(owner,{slot:1}),owner)};peer={...peer,...await req('state',undefined,peer)};await req('slot',body(peer,{slot:1}),peer,403);
  const snapshot=await req('save',undefined,owner);assert.ok(!snapshot.campaign,'cooperative export must not expose raw campaign state or unrevealed source');
  owner={...owner,...await req('room',body(owner,{autoNpc:false}),owner)};assert.equal(owner.room.autoNpc,true,'cooperative NPC scheduler cannot be accidentally disabled');
  peer={...peer,...await req('state',undefined,peer)};await req('new',body(peer),peer,403);owner={...owner,...await req('new',body(owner),owner)};const rev=owner.state.revision;
  await stop();await start();const restored=await req('state',undefined,{...owner,token});assert.equal(restored.seat.role,'player');assert.equal(restored.room.cooperative,true);assert.equal(restored.state.revision,rev);assert.deepEqual(restored.seat.actors,owner.seat.actors);
 }finally{await stop();await fs.rm(dir,{recursive:true,force:true});}
});
