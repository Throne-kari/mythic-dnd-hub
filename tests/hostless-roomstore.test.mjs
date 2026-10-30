import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {test} from 'node:test';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const games=['fengshen','japan','india','jaffa','acre','qchina','qjapan','qindia'];
const campaignFor=async game=>{const dir=path.join(root,'games',game);return fs.access(path.join(dir,'campaign-data.mjs')).then(async()=> (await import(pathToFileURL(path.join(dir,'campaign-data.mjs')))).campaignData).catch(async()=>JSON.parse(await fs.readFile(path.join(dir,'data/campaign.json'),'utf8')));};
for(const game of games)test(`${game}: hostless default, public story, safe cooperative control and defeat recovery`,async()=>{
 const dir=await fs.mkdtemp('/tmp/hostless-roomstore-');let store,reloaded;
 try{
  const mod=await import(pathToFileURL(path.join(root,'games',game,'rooms.mjs'))),campaign=await campaignFor(game);
  store=new mod.RoomStore(dir,campaign);const made=store.create({name:'Isolated cooperative QA'});let room=made.room,seat=made.seat;const roomId=room.id;
  assert.equal(room.mode,'cooperative');assert.equal(seat.role,'player');assert.equal(room.dmSeatId,null);assert.equal(room.autoNpc,true);assert.equal(room.aiPaused,true);assert.ok(!room.config.key);assert.equal(room.owners.p1,seat.id);
  const view=()=>store.view(room,room.seats.find(s=>s.id===seat.id));let seq=0;
  const command=command=>{room=store.command(room,room.seats.find(s=>s.id===seat.id),{revision:room.state.revision,commandId:`hostless:${++seq}`,command}).room;};
  assert.deepEqual(view().seat.controllableActors,['p1','p2','p3','p4']);assert.equal(mod.isDm(room,seat),false);assert.throws(()=>mod.requireDm(room,seat),e=>e.code==='FORBIDDEN');
  for(const type of ['travel','chapter','gm'])assert.throws(()=>mod.authorizeCommand(room,seat,{type,actor:'p1',option:1}),e=>e.code==='FORBIDDEN');
  room.state.log.push({id:++room.state.logSeq,kind:'gm',text:'QA_UNREVEALED_DM_SOURCE',time:room.state.time});assert.ok(!JSON.stringify(view()).includes('QA_UNREVEALED_DM_SOURCE'));
  const first=view().state.choices?.[0];assert.ok(first,'default must offer authored public story choice');command({type:'choice',actor:'p1',option:first.id});assert.ok(room.state.revision>0);
  const joined=store.join({invite:room.invite,displayName:'Second independent seat'});room=joined.room;const second=room.seats.find(s=>s.id===joined.seat.id);assert.equal(room.owners.p2,second.id);
  assert.throws(()=>mod.authorizeCommand(room,seat,{type:'end',actor:'p2'}),e=>e.code==='NOT_YOUR_CHARACTER');
  second.lastSeen=new Date(Date.now()-46000).toISOString();second.online=true;assert.equal(mod.canControlActor(room,seat,'p2'),false,'live SSE protects holder regardless old timestamp');second.online=false;assert.equal(mod.canControlActor(room,seat,'p2'),true,'verified disconnected holder is available after grace');assert.ok(mod.authorizeCommand(room,seat,{type:'end',actor:'p2'}));
  store.auth(joined.token,room.id);assert.equal(mod.canControlActor(room,seat,'p2'),false,'authenticated reconnect/poll renews grace');
  const party=room.state.actors.filter(a=>a.side==='party');const enemy={...structuredClone(party[0]),id:'qa-rule-enemy',name:'QA rule opponent',side:'enemy',hp:100,maxHp:100,conditions:[],effects:[],dead:false,departed:false,controller:'local'};
  room.state.actors=[...party,enemy];const free=party.find(a=>!room.owners[a.id]);assert.ok(free);Object.assign(free,{action:1,bonus:1,attackLeft:0});room.state.combat={order:[free.id,enemy.id,...party.filter(a=>a.id!==free.id).map(a=>a.id)],scores:[],index:0,round:1};store.commit(room);
  const before=room.state.revision;store.npcTick(room);room=store.rooms.get(roomId);assert.ok(room.state.revision>before,'unclaimed turn must make deterministic progress');assert.ok(room.events.some(e=>e.type==='party-fallback'));assert.ok(view().state.battleReport.events.some(e=>e.actorId===free.id&&e.kind==='action'));
  for(const s of room.seats)Object.assign(s,{online:false,lastSeen:new Date(0).toISOString()});store.commit(room);const emptyRevision=room.state.revision;store.npcTick(room);room=store.rooms.get(roomId);assert.equal(room.state.revision,emptyRevision,'empty rooms wait rather than losing rounds off-screen');store.auth(made.token,room.id);
  room.state.combat={order:['p2',enemy.id,'p1','p3','p4'],scores:[],index:0,round:1};Object.assign(room.seats.find(s=>s.id===second.id),{online:true,lastSeen:new Date(0).toISOString()});store.commit(room);const protectedRevision=room.state.revision;store.npcTick(room);room=store.rooms.get(roomId);assert.equal(room.state.revision,protectedRevision,'never auto-end a live holder turn');
  for(const a of room.state.actors.filter(a=>a.side==='party'))Object.assign(a,{hp:0,dead:true,death:[0,3]});room.state.combat.index=1;store.commit(room);store.npcTick(room);room=store.rooms.get(roomId);assert.equal(room.state.combat,null);assert.equal(room.state.partyDefeated,true);assert.equal(view().room.recoveryAvailable,true);assert.equal(view().state.battleReport.summaries.at(-1).result,'defeat');assert.ok(room.state.actors.filter(a=>a.side==='party').every(a=>a.hp===0&&a.dead),'defeat must not heal or resurrect');
  store.persist(room);store.close();store=null;reloaded=new mod.RoomStore(dir,campaign);const restored=reloaded.auth(made.token);assert.equal(restored.room.id,roomId);assert.equal(restored.seat.role,'player');assert.equal(restored.room.mode,'cooperative');assert.equal(restored.room.owners.p1,seat.id);assert.equal(restored.room.state.partyDefeated,true);
  const hosted=reloaded.create({mode:'hosted',displayName:'Optional legacy GM'});assert.equal(hosted.seat.role,'dm');assert.equal(mod.isPrivileged(hosted.room,hosted.seat),true);delete hosted.room.mode;assert.equal(mod.isPrivileged(hosted.room,hosted.seat),true,'old saves without mode remain compatible');assert.doesNotThrow(()=>mod.authorizeCommand(hosted.room,hosted.seat,{type:'chapter',option:1}));
 }finally{store?.close();reloaded?.close();await fs.rm(dir,{recursive:true,force:true});}
});
for(const game of ['qchina','qindia','qjapan'])test(`${game}: authored party-setback truce is never false victory`,async()=>{
 const dir=await fs.mkdtemp('/tmp/hostless-truce-');let store;
 try{
  const mod=await import(pathToFileURL(path.join(root,'games',game,'rooms.mjs'))),campaign=await campaignFor(game);store=new mod.RoomStore(dir,campaign);let {room,seat}=store.create({});let seq=0;const run=command=>{room=store.command(room,seat,{revision:room.state.revision,commandId:`truceQA:${++seq}`,command}).room;};
  const paths={qchina:['C00:summon','C11:commission','C11:road-threat'],qindia:['HUB:arc-a','A1:physical-conflict'],qjapan:['HUB:arc-a','A1:physical-dispute']};for(const option of paths[game])run({type:'choice',actor:'p1',option});run({type:'start',actor:'p1'});
  const enemies=room.state.actors.filter(a=>a.side==='enemy');assert.ok(enemies.some(a=>a.truceOnPartyDown===1),'authored setback fixture must use actual enemy rule');const p=room.state.actors.find(a=>a.id==='p1');p.hp=0;p.dead=false;run({type:'note',actor:'p2',text:'Observe current authored encounter consequence'});
  assert.ok(room.state.actors.some(a=>a.truceReason==='party_setback'));assert.equal(room.state.combat,null);const report=store.view(room,seat).state.battleReport;assert.equal(report.summaries.at(-1)?.result,'defeat');assert.ok(Object.keys(room.state.campaign.facts).some(k=>k.endsWith('_party_setback')&&room.state.campaign.facts[k]===true));assert.equal(p.hp,0);
 }finally{store?.close();await fs.rm(dir,{recursive:true,force:true});}
});
