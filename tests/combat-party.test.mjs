import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {beginBattleCapture,recordBattleEffect,captureBattleTransition,publicBattleReport} from '../server/combat-ledger.mjs';

const read = async file => JSON.parse(await fs.readFile(new URL(file,import.meta.url),'utf8'));
const safeReport = report => assert.doesNotMatch(JSON.stringify(report),/hpBefore|hpAfter|maxHp|_private|_totals|_contributions|token|secret/);
for(const game of ['mesopotamia','aztec']) test(`${game}: actual party-engine effects, turn ownership and battle result`,async()=>{
  const engine=await import(`../games/${game}/engine.mjs`),campaign=await read(`../games/${game}/content/campaign.json`);
  const map={id:'harbor',name:'结算测试场',width:8,height:8,tiles:Array(8).fill('........'),spawn:{x:1,y:1},pois:[]},maps=[map];
  const actor={role:'host',characterId:null,roomMode:'party',canManage:true};
  const fixture=({hp=100,two=false}={})=>{
    let s=engine.createState(campaign,maps);s.mapId='ledger-fixture';s.customMaps[s.mapId]={...structuredClone(map),id:s.mapId};s=engine.applyAction(s,{type:'startEncounter',templateId:'reeds'},campaign,maps,actor);
    // This is a controlled rules fixture, not a modification to authored game content.
    s.party.forEach((p,i)=>Object.assign(p,{x:[2,0,0,1][i],y:[2,0,1,0][i],hp:200,maxHp:200,ap:2,move:5,down:false,guarding:false}));
    const enemy={id:'ledger-enemy-1',name:'结算敌手一',hp,maxHp:hp,attack:6,armor:0,range:1,x:3,y:2,ap:2,move:5,down:false,guarding:false};
    s.combat.enemies=[enemy,...(two?[{...structuredClone(enemy),id:'ledger-enemy-2',name:'结算敌手二',x:2,y:3}]:[])];
    s.combat.order=[s.party[0].id,...s.combat.enemies.map(e=>e.id),...s.party.slice(1).map(p=>p.id)];s.combat.turn=s.party[0].id;
    s.party[0].attack=99;s.battleReport=undefined;return s;
  };
  const act=(s,a)=>{const original=JSON.stringify(s);const n=engine.applyAction(s,a,campaign,maps,actor);assert.equal(JSON.stringify(s),original);return n;};
  let s=fixture({hp:1}),hero=s.party[0];s=act(s,{type:'attack',characterId:hero.id,targetId:'ledger-enemy-1'});
  const damage=s.battleReport.events.find(e=>e.kind==='damage');assert.equal(damage.amount,1);assert.equal(damage.actorId,hero.id);assert.equal(s.battleReport.summaries.at(-1).result,'victory');
  assert.equal(s.battleReport.summaries.at(-1).damageByActor.find(r=>r.actorId===hero.id).amount,1);
  s=fixture({two:true});hero=s.party[0];s=act(s,{type:'endTurn',characterId:hero.id});
  const npc=s.battleReport.events.filter(e=>e.kind==='damage');assert.ok(npc.some(e=>e.actorId==='ledger-enemy-1'));assert.ok(npc.some(e=>e.actorId==='ledger-enemy-2'));assert.ok(npc.every(e=>e.actorId!==hero.id));
  s=fixture();hero=s.party[0];s.combat.order=[hero.id,'ledger-enemy-1'];s=act(s,{type:'guard',characterId:hero.id});assert.ok(s.battleReport.events.some(e=>e.statusesAdded.includes('防御')));s=act(s,{type:'endTurn',characterId:hero.id});assert.ok(s.battleReport.events.some(e=>e.statusesRemoved.includes('防御')));
  s=fixture();hero=s.party[0];s.party[1].x=1;s.party[1].y=2;hero.hp=195;s.combat.turn=s.party[1].id;
  const healer=s.party[1].id;s=act(s,{type:'heal',characterId:healer,targetId:hero.id});const healed=s.battleReport.events.find(e=>e.kind==='healing');assert.equal(healed.actorId,healer);assert.equal(healed.amount,5);assert.equal(healed.method,'补给治疗');
  s=fixture();hero=s.party[0];s=act(s,{type:'skill',characterId:hero.id,targetId:'ledger-enemy-1'});assert.ok(s.battleReport.events.some(e=>e.kind==='status'&&e.statusesAdded.some(value=>value.startsWith('护甲降低'))));
  s=fixture();hero=s.party[0];s=act(s,{type:'retreat'});assert.equal(s.battleReport.summaries.at(-1).result,'escape');
  s=fixture();s.combat.enemies[0].hidden=true;s.combat.enemies[0].name='不可见对手';hero=s.party[0];s=act(s,{type:'attack',characterId:hero.id,targetId:'ledger-enemy-1'});const report=engine.publicState(s,{role:'player',characterId:hero.id,roomMode:'party'}).battleReport;assert.ok(!JSON.stringify(report).includes('不可见对手'));safeReport(report);
  const original=JSON.stringify(s);assert.throws(()=>act(s,{type:'attack',characterId:hero.id,targetId:'missing'}));assert.equal(JSON.stringify(s),original);
});

test('greek: actual hit/miss, medicine, defense expiry, NPC source and no damage for parley',async()=>{
  const engine=await import('../games/greek/engine.mjs'),campaign=await read('../games/greek/data/campaign.json'),maps=await read('../games/greek/data/maps.json');
  const seat={id:'qa-dm',role:'dm',heroIds:campaign.heroes.map(h=>h.id)};
  const fixture=({hp=100,two=false}={})=>{const s=engine.createGame(campaign,maps);const map={id:'ledger-fixture',name:'结算测试场',width:8,height:8,tiles:Array(8).fill('........'),spawn:{x:1,y:1},exits:[],points:[],enemies:[],tokens:[]};s.customMaps[map.id]=map;s.mapId=map.id;s.heroes.forEach((h,i)=>Object.assign(h,{x:[2,1,0,1][i],y:[2,2,1,0][i]}));const enemy={id:'ledger-enemy-1',name:'结算敌手一',hp,maxHp:hp,ac:0,attack:100,damage:2,speed:3,range:1,x:3,y:2,parley:true};s.enemies=[enemy,...(two?[{...structuredClone(enemy),id:'ledger-enemy-2',name:'结算敌手二',x:2,y:3}]:[])];s.combat=true;s.activeHeroId=s.heroes[0].id;s.turnUsage={move:0,action:false};s.rngState=1;return s;};
  const act=(s,a)=>{const before=JSON.stringify(s);const n=engine.act(s,a,seat,campaign,maps);assert.equal(JSON.stringify(s),before);return n;};
  let s=fixture({hp:1}),hero=s.heroes[0];s=act(s,{type:'attack',heroId:hero.id,targetId:'ledger-enemy-1'});const hit=s.battleReport.events.find(e=>e.kind==='damage');assert.equal(hit.amount,1);assert.equal(hit.actorId,hero.id);assert.equal(s.battleReport.summaries.at(-1).result,'victory');
  s=fixture({two:true});s.activeHeroId=s.heroes.at(-1).id;s=act(s,{type:'endTurn'});const hits=s.battleReport.events.filter(e=>e.kind==='damage');assert.ok(hits.some(e=>e.actorId==='ledger-enemy-1'));assert.ok(hits.some(e=>e.actorId==='ledger-enemy-2'));
  s=fixture();hero=s.heroes[0];s=act(s,{type:'defend',heroId:hero.id});assert.ok(s.battleReport.events.some(e=>e.statusesAdded.includes('防御')));s.activeHeroId=s.heroes.at(-1).id;s=act(s,{type:'endTurn'});assert.ok(s.battleReport.events.some(e=>e.statusesRemoved.includes('防御')));
  s=fixture();hero=s.heroes[0];s.heroes[1].hp-=3;s=act(s,{type:'heal',heroId:hero.id,targetId:s.heroes[1].id});assert.equal(s.battleReport.events.find(e=>e.kind==='healing').amount,3);
  s=fixture();hero=s.heroes[0];s=act(s,{type:'parley',heroId:hero.id,resource:'grain'});assert.ok(!s.battleReport.events.some(e=>e.kind==='damage'),'negotiated withdrawal is not damage');assert.ok(s.battleReport.events.some(e=>e.statusesAdded.includes('已撤离')));assert.equal(s.combat,false);
  s=fixture();hero=s.heroes[0];s=act(s,{type:'defend',heroId:hero.id});const count=s.battleReport.events.length,before=JSON.stringify(s);engine.legalActions(s,seat,campaign,maps);assert.equal(JSON.stringify(s),before);assert.equal(s.battleReport.events.length,count);
  const report=engine.view(s,{id:'viewer',role:'player',heroIds:[hero.id]},campaign,maps).battleReport;safeReport(report);
  assert.equal(engine.validateState(JSON.parse(JSON.stringify(s)),campaign,maps),true,'own saved ledger must survive the native state validator');
  const legacy=fixture();delete legacy.battleReport;assert.equal(engine.validateState(legacy,campaign,maps),true,'old saves without a ledger remain accepted');
});

test('ledger: private ownership predicates apply equally to events, summaries and counts',()=>{
  const before={revision:0,combat:{id:'private-test'},actors:[{id:'p',name:'公开角色',hp:10,side:'party'},{id:'private',name:'私有人物',hp:10,visibility:'owner',ownerActorIds:['owner-hero'],side:'enemy'}]};
  const after=structuredClone(before);beginBattleCapture(after);after.actors[1].hp=7;recordBattleEffect(after,{kind:'damage',actor:after.actors[0],target:after.actors[1],method:'真实规则测试',amount:3});recordBattleEffect(after,{kind:'battle-end',result:'victory'});after.combat=null;after.revision++;captureBattleTransition(before,after,{type:'attack',actorId:'p',targetId:'private'});
  const denied=publicBattleReport(after,{canViewActor:record=>record.visibility!=='owner'});assert.ok(!JSON.stringify(denied).includes('私有人物'));assert.ok(!JSON.stringify(denied).includes('private\"'));assert.equal(denied.summaries[0].damageByActor.length,0);assert.equal(denied.summaries[0].damageTakenByActor.length,0);assert.equal(denied.summaries[0].actions,0);
  const allowed=publicBattleReport(after,{canViewActor:record=>!record.hidden});assert.ok(allowed.events.some(e=>e.targetId==='private'));assert.equal(allowed.summaries[0].damageByActor[0].amount,3);safeReport(denied);
});

test('ledger: browser-safe module, bounded windows and JSON-only persistent data',async()=>{
  const source=await fs.readFile(new URL('../server/combat-ledger.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/from\s+['"]node:|import\s*\(['"]node:/);
  let state={revision:0,combat:{id:'bounds'},actors:[{id:'p',name:'测试角色',hp:10,side:'party'}]};
  for(let i=0;i<240;i++){const next=structuredClone(state);next.revision++;captureBattleTransition(state,next,{type:'move',actorId:'p'});state=next;}
  const report=publicBattleReport(JSON.parse(JSON.stringify(state)));assert.equal(report.events.length,200);assert.equal(report.truncated,true);assert.deepEqual(report.limits,{events:200,summaries:16});assert.ok(JSON.stringify(state.battleReport).length<262144);
});

test('ledger: cooperative teammate evidence is public while undisclosed causes are anonymized',()=>{
  const before={revision:0,combat:{id:'cooperative'},actors:[{id:'a',name:'队友甲',side:'party',hp:10,visibility:'owner',ownerActorIds:['a']},{id:'b',name:'队友乙',side:'party',hp:10,visibility:'owner',ownerActorIds:['b']},{id:'gm-source',name:'未揭晓人物',side:'enemy',hp:10,visibility:'dm'}]};
  const after=structuredClone(before);beginBattleCapture(after);after.actors[1].hp-=3;recordBattleEffect(after,{kind:'damage',actor:after.actors[2],target:after.actors[1],amount:3,method:'DM底稿法术名',visibility:'gm',statusesAdded:['未揭晓状态']});after.actors[0].guarding=true;recordBattleEffect(after,{kind:'battle-end',result:'victory'});after.combat=null;captureBattleTransition(before,after,{type:'guard',actorId:'a'});
  const report=publicBattleReport(after,{canViewActor:()=>false});const damage=report.events.find(row=>row.kind==='damage');assert.equal(damage.targetId,'b');assert.equal(damage.amount,3);assert.equal(damage.actorId,null);assert.equal(damage.method,'规则结算（来源未揭晓）');assert.ok(report.events.some(row=>row.targetId==='a'&&row.statusesAdded.includes('防御')));assert.ok(report.events.some(row=>row.actorId==='a'&&row.kind==='action'));assert.equal(report.summaries[0].damageTakenByActor.find(row=>row.actorId==='b').amount,3);assert.equal(report.summaries[0].actions,1);assert.doesNotMatch(JSON.stringify(report),/未揭晓人物|gm-source|DM底稿法术名|未揭晓状态/);
});
