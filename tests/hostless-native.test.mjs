import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {once} from 'node:events';
import {createServer as createGreekServer} from '../games/greek/server.mjs';
import * as greek from '../games/greek/engine.mjs';
import {nextInteractCell,distance} from '../games/greek/public/rules-view.js';
import {startServer as startMeso} from '../games/mesopotamia/server.mjs';
import {startServer as startAztec} from '../games/aztec/server.mjs';
import * as meso from '../games/mesopotamia/engine.mjs';
import * as aztec from '../games/aztec/engine.mjs';

const read = async relative => JSON.parse(await fs.readFile(new URL(relative,import.meta.url),'utf8'));
const request = async (origin,route,{body,token,method=body===undefined?'GET':'POST'}={}) => {
  const response=await fetch(origin+route,{method,headers:{'Content-Type':'application/json',Origin:origin,...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
  return {status:response.status,data:await response.json()};
};
const listenGreek = async options => {const server=createGreekServer(options);server.listen(0,'127.0.0.1');await once(server,'listening');return {server,origin:`http://127.0.0.1:${server.address().port}`};};
const closeGreek = async server => {const closed=once(server,'close');server.shutdown();await closed;};

test('greek: cooperative players share only unclaimed/offline heroes, never need a DM, and preserve legacy hosted saves',async()=>{
  const runtime=await fs.mkdtemp('/tmp/mythic-hostless-greek-');let clock=1700000000000;
  let live=await listenGreek({runtimeDir:runtime,now:()=>clock,presenceTimeoutMs:1000});
  try{
    const catalog=(await request(live.origin,'/api/catalog')).data,heroes=catalog.campaign.heroes;
    const made=await request(live.origin,'/api/rooms',{body:{name:'Cooperative A'}});assert.equal(made.status,201);const a=made.data,id=a.roomId,base=`/api/rooms/${id}`;
    assert.equal(a.seat.role,'player');assert.equal(a.seat.roomMode,'cooperative');assert.equal(a.seat.canManage,true);assert.equal(a.seat.heroIds.length,4);assert.deepEqual(a.seat.ownedHeroIds,[]);
    const joined=await request(live.origin,base+'/join',{body:{name:'Cooperative B',heroId:heroes[0].id}});assert.equal(joined.status,201);const b=joined.data;
    let av=(await request(live.origin,base+'/state',{token:a.token})).data;assert.ok(!av.seat.heroIds.includes(heroes[0].id));assert.equal(av.seat.heroIds.length,3);
    const blocked=await request(live.origin,base+'/join',{body:{name:'Cannot steal',heroId:heroes[0].id}});assert.equal(blocked.status,409);
    const bv=(await request(live.origin,base+'/state',{token:b.token})).data,step=bv.state.legalActions.find(value=>value.type==='move'&&value.heroId===heroes[0].id);assert.ok(step);
    let action=await request(live.origin,base+'/action',{token:a.token,body:{revision:av.state.revision,action:step}});assert.equal(action.status,400);
    assert.equal((await request(live.origin,base+'/action',{token:a.token,body:{revision:av.state.revision,action:{type:'narrate',text:'not a DM'}}})).status,400);
    assert.equal((await request(live.origin,base+'/agents',{token:a.token,body:{name:'not a DM bot',role:'dm'}})).status,403);
    assert.equal((await request(live.origin,base+'/save',{token:b.token,body:{slot:'coop'}})).status,200);
    assert.equal((await request(live.origin,base+'/load',{token:b.token,body:{slot:'coop'}})).status,403);
    assert.equal((await request(live.origin,base+'/load',{token:a.token,body:{slot:'coop'}})).status,200);
    clock+=1001;av=(await request(live.origin,base+'/state',{token:a.token})).data;assert.ok(av.seat.heroIds.includes(heroes[0].id),'confirmed offline hero should be controllable');
    const offlineStep=av.state.legalActions.find(value=>value.type==='move'&&value.heroId===heroes[0].id);assert.ok(offlineStep);
    action=await request(live.origin,base+'/action',{token:a.token,body:{revision:av.state.revision,action:offlineStep}});assert.equal(action.status,200);
    await request(live.origin,base+'/state',{token:b.token});av=(await request(live.origin,base+'/state',{token:a.token})).data;assert.ok(!av.seat.heroIds.includes(heroes[0].id),'returning active holder is protected again');
    const streamController=new AbortController(),stream=await fetch(live.origin+base+'/events',{headers:{Authorization:`Bearer ${b.token}`},signal:streamController.signal}),reader=stream.body.getReader();await reader.read();clock+=1001;
    assert.equal((await request(live.origin,base+'/join',{body:{name:'SSE cannot be stolen',heroId:heroes[0].id}})).status,409,'live SSE protects background tabs');
    streamController.abort();await reader.cancel().catch(()=>{});await new Promise(resolve=>setTimeout(resolve,30));
    const reclaimed=await request(live.origin,base+'/join',{body:{name:'Offline replacement',heroId:heroes[0].id}});assert.equal(reclaimed.status,201);
    const returning=(await request(live.origin,base+'/state',{token:b.token})).data;assert.ok(!returning.seat.ownedHeroIds.includes(heroes[0].id));assert.ok(!returning.seat.heroIds.includes(heroes[0].id));
    const old=await request(live.origin,'/api/rooms',{body:{name:'Optional legacy',mode:'hosted'}});assert.equal(old.status,201);assert.equal(old.data.seat.role,'dm');
    delete live.server.rooms.get(old.data.roomId).mode;
    assert.equal((await request(live.origin,`/api/rooms/${old.data.roomId}/action`,{token:old.data.token,body:{revision:old.data.state.revision,action:{type:'narrate',text:'Optional legacy narration'}}})).status,200);
    await closeGreek(live.server);live=await listenGreek({runtimeDir:runtime,now:()=>clock,presenceTimeoutMs:1000});
    const restored=await request(live.origin,base+'/state',{token:a.token});assert.equal(restored.status,200);assert.equal(restored.data.seat.role,'player');assert.equal(restored.data.seat.roomMode,'cooperative');
    const legacy=await request(live.origin,`/api/rooms/${old.data.roomId}/state`,{token:old.data.token});assert.equal(legacy.status,200);assert.equal(legacy.data.seat.role,'dm');
  }finally{await closeGreek(live.server);await fs.rm(runtime,{recursive:true,force:true});}
});

test('greek: ordinary player travel and endTurn run the real rules and enemy round',async()=>{
  const campaign=await read('../games/greek/data/campaign.json'),maps=await read('../games/greek/data/maps.json'),seat={id:'ordinary-player',role:'player',heroIds:campaign.heroes.map(hero=>hero.id)};
  let state=greek.createGame(campaign,maps);assert.ok(greek.legalActions(state,seat,campaign,maps).some(action=>action.type==='travel'));
  const fixture={id:'hostless-fixture',name:'规则验证场',width:8,height:8,tiles:Array(8).fill('........'),spawn:{x:1,y:1},exits:[],points:[],enemies:[],tokens:[]};
  state.customMaps[fixture.id]=fixture;state.mapId=fixture.id;state.heroes.forEach((hero,index)=>Object.assign(hero,{x:index,y:1}));state.enemies=[{id:'rule-enemy',name:'规则敌手',hp:99,maxHp:99,ac:12,attack:3,damage:2,speed:1,range:1,x:7,y:7}];state.combat=true;state.activeHeroId=state.heroes[1].id;state.turnUsage={move:0,action:false};
  const startRound=state.turn;
  for(let index=0;index<4;index++)state=greek.act(state,{type:'endTurn'},seat,campaign,maps);
  assert.ok(state.turn>startRound,'last player turn triggers actual enemy round');assert.ok(state.battleReport.events.some(event=>event.method==='回合结束'));
  assert.throws(()=>greek.act(state,{type:'narrate',text:'not authorized'},seat,campaign,maps));
});


test('greek: SSE refreshes newly shared offline controls without advancing a game revision',async()=>{
  const runtime=await fs.mkdtemp('/tmp/mythic-hostless-presence-');let clock=1700000000000;
  const live=await listenGreek({runtimeDir:runtime,now:()=>clock,presenceTimeoutMs:1000,heartbeatInterval:20}),abort=new AbortController();
  try{
    const a=(await request(live.origin,'/api/rooms',{body:{name:'Presence A'}})).data,hero=a.state.heroes[0].id,base=`/api/rooms/${a.roomId}`;
    await request(live.origin,base+'/join',{body:{name:'Presence B',heroId:hero}});
    const stream=await fetch(live.origin+base+'/events',{headers:{Authorization:`Bearer ${a.token}`},signal:abort.signal}),reader=stream.body.getReader(),decoder=new TextDecoder();
    const initial=decoder.decode((await reader.read()).value),first=JSON.parse(initial.split('data: ')[1].split('\n')[0]);assert.ok(!first.seat.heroIds.includes(hero));
    clock+=1001;let buffer='',updated;
    const deadline=Date.now()+1000;
    while(!updated&&Date.now()<deadline){buffer+=decoder.decode((await reader.read()).value);for(const event of buffer.split('\n\n'))if(event.includes('data: ')){updated=JSON.parse(event.split('data: ')[1].split('\n')[0]);if(updated.seat.heroIds.includes(hero))break;updated=null;}}
    assert.ok(updated?.seat.heroIds.includes(hero));assert.equal(updated.revision,first.revision);
    abort.abort();await reader.cancel().catch(()=>{});
  }finally{abort.abort();await closeGreek(live.server);await fs.rm(runtime,{recursive:true,force:true});}
});

test('greek: a normal cooperative player reaches a real four-chapter ending using only public rules',async()=>{
  const campaign=await read('../games/greek/data/campaign.json'),maps=greek.normalizeMaps(await read('../games/greek/data/maps.json'),campaign),seat={id:'cooperative-player',role:'player',heroIds:campaign.heroes.map(hero=>hero.id)};
  let state=greek.createGame(campaign,maps),actions=0;const stages=new Set(),chapters=new Set();
  const submit=action=>{state=greek.act(state,action,seat,campaign,maps);actions++;chapters.add(state.chapter);};
  const routeTo=target=>{const queue=[[state.mapId]];for(const route of queue){if(route.at(-1)===target)return route;for(const exit of maps.find(map=>map.id===route.at(-1)).exits??[]){const next=exit.to??exit.mapId;if(!route.includes(next))queue.push([...route,next]);}}throw Error(`No public route to ${target}`);};
  while(!state.ending&&actions<400){
    const legal=greek.legalActions(state,seat,campaign,maps),map=maps.find(map=>map.id===state.mapId);
    if(state.combat){
      let action=legal.find(action=>action.type==='parley')??legal.find(action=>action.type==='attack');
      if(!action){const enemies=state.enemies.filter(enemy=>enemy.hp>0),hero=state.heroes.find(hero=>hero.id===state.activeHeroId),near=cell=>Math.min(...enemies.map(enemy=>distance(cell,enemy)));action=legal.filter(action=>action.type==='move').sort((a,b)=>near(a)-near(b))[0];if(action&&near(action)>=near(hero))action=null;}
      submit(action??{type:'endTurn'});continue;
    }
    const arc=campaign.arcs.find(arc=>state.arcs[arc.id].status==='active'&&(arc.stages.find(stage=>stage.id===state.arcs[arc.id].stage).chapter??1)<=state.chapter);
    if(!arc){const finish=legal.find(action=>action.type==='finish');assert.ok(finish,'settled stories expose the actual ending action');submit(finish);continue;}
    const stage=arc.stages.find(stage=>stage.id===state.arcs[arc.id].stage);
    if(state.mapId!==stage.mapId){submit({type:'travel',mapId:routeTo(stage.mapId)[1]});continue;}
    const hero=state.heroes.find(hero=>hero.hp>0),point=map.points.find(point=>point.id===stage.pointId);
    if(distance(hero,point)>2){const cell=nextInteractCell({...state,seat},map,point,hero);assert.ok(cell,`public UI approach to ${stage.id}`);submit({type:'move',heroId:hero.id,x:cell.x,y:cell.y});continue;}
    const cost=option=>Object.values(option.cost??{}).reduce((sum,value)=>sum+value,0),options=stage.options.filter(option=>legal.some(action=>action.type==='choose'&&action.heroId===hero.id&&action.optionId===option.id&&action.arcId===arc.id)).sort((a,b)=>Number(!!a.encounter?.length)-Number(!!b.encounter?.length)||Number(!!a.check)-Number(!!b.check)||cost(a)-cost(b));
    assert.ok(options.length,`ordinary player has a rule-valid choice at ${stage.id}`);stages.add(stage.id);submit({type:'choose',heroId:hero.id,arcId:arc.id,optionId:options[0].id});
  }
  assert.ok(state.ending);assert.equal(state.chapter,4);assert.deepEqual([...chapters],[1,2,3,4]);assert.ok(stages.size>=30);assert.ok(Object.values(state.arcs).every(arc=>arc.status!=='active'));assert.ok(state.world.day<=49);
});

for(const [game,start,engine]of [['mesopotamia',startMeso,meso],['aztec',startAztec,aztec]])test(`${game}: authenticated actions are bounded, engine-valid, read-only and room-scoped`,async()=>{
  const directory=await fs.mkdtemp(`/tmp/mythic-hostless-actions-${game}-`),live=start({dataDir:directory,port:0,host:'127.0.0.1'});if(!live.server.listening)await once(live.server,'listening');const origin=`http://127.0.0.1:${live.server.address().port}`;
  try{
    const campaign=await read(`../games/${game}/content/campaign.json`),maps=await read(`../games/${game}/content/maps.json`);
    const created=(await request(origin,'/api/rooms',{body:{name:'Action A',roomName:'Isolated actions',mode:'party'}})).data,base=`/api/rooms/${created.roomId}`,record=live.rooms.get(created.roomId),before=JSON.stringify(record.state);
    const response=await request(origin,base+'/actions',{token:created.token});assert.equal(response.status,200);assert.equal(response.data.revision,record.state.revision);assert.ok(response.data.actions.length>0&&response.data.actions.length<=128);assert.equal(JSON.stringify(record.state),before);
    const actor={id:created.seatId,role:'player',characterId:created.characterId,roomMode:'party',canManage:true};
    for(const action of response.data.actions){const copy=engine.applyAction(record.state,action,campaign,maps,actor);assert.ok(copy.revision>record.state.revision);assert.equal(JSON.stringify(record.state),before);}
    assert.equal((await request(origin,base+'/actions')).status,401);assert.equal((await request(origin,base+'/actions',{token:created.token,body:{}})).status,405);
    const other=(await request(origin,'/api/rooms',{body:{name:'Action other',mode:'party'}})).data;assert.equal((await request(origin,`/api/rooms/${other.roomId}/actions`,{token:created.token})).status,401);
    const valid=response.data.actions.find(action=>action.type==='move')||response.data.actions[0];const sent=await request(origin,base+'/action',{token:created.token,body:{requestId:'hostless-valid-action',expectedRevision:response.data.revision,action:valid}});assert.equal(sent.status,200);
    assert.equal((await request(origin,base+'/action',{token:created.token,body:{requestId:'hostless-stale-action',expectedRevision:response.data.revision,action:valid}})).status,409);
  }finally{await live.close();await fs.rm(directory,{recursive:true,force:true});}
});
