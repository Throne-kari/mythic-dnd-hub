import assert from 'node:assert/strict';
import test from 'node:test';

// Focused deterministic engine fixtures: no network, credentials, user saves or provider APIs.
for (const game of ['norse', 'celtic']) {
 test(`${game}: authoritative battle ledger, permissions and previews`, async () => {
  const engine = await import(`../games/${game}/engine.mjs`);
  let request = 0;
  const seat = {id: 'qa-player', role: 'player', actorIds: ['p1', 'p2', 'p3', 'p4']};
  const fixture = ({hp = 100, secondEnemy = false} = {}) => {
    const state = engine.createState(1);
    state.maps['ledger-fixture'] = {id:'ledger-fixture',name:'结算测试',width:8,height:8,tiles:Array.from({length:8},()=>Array(8).fill('floor')),spawns:{party:[{x:2,y:2},{x:1,y:2},{x:1,y:1},{x:2,y:1}]},pois:[]};
    state.mapId = 'ledger-fixture';
    state.actors = state.actors.filter(actor=>actor.side==='party');
    state.actors.forEach((actor,i)=>Object.assign(actor,state.maps[state.mapId].spawns.party[i]));
    const enemy = {id:'qa-enemy-1',name:'测试敌手一',side:'enemy',hp,maxHp:hp,ac:1,attack:100,damage:6,speed:1,range:1,x:3,y:2,conditions:[],tempHp:0,stats:{dex:0,str:0,wis:0}};
    state.actors.push(enemy);
    if(secondEnemy)state.actors.push({...structuredClone(enemy),id:'qa-enemy-2',name:'测试敌手二',x:2,y:3});
    const order=['p1','qa-enemy-1',...(secondEnemy?['qa-enemy-2']:[]),'p2','p3','p4'];
    state.battle={id:'qa-battle',definition:{name:'结算测试遭遇',sandbox:true},sandbox:true,order,index:0,round:1};
    state.turn={round:1,actorId:'p1',order:[...order],movement:6,action:true,bonusAction:true};
    state.rng=1;
    return state;
  };
  const turn = (state,id) => {state.battle.index=state.battle.order.indexOf(id);state.turn={round:state.battle.round,actorId:id,order:[...state.battle.order],movement:6,action:true,bonusAction:true};return state;};
  const act = (state,action) => {const original=JSON.stringify(state);const result=engine.dispatch(state,action,{seat,requestId:`qa-${game}-${++request}`});assert.equal(result.ok,true,result.error?.message);assert.equal(JSON.stringify(state),original,'dispatch must not mutate its source');return result.state;};
  const events = state => state.battleReport.events;

  let state=fixture({hp:1});
  state=act(state,{type:'attack',actorId:'p1',targetId:'qa-enemy-1'});
  const finalDamage=events(state).find(event=>event.kind==='damage');
  assert.equal(finalDamage.actorId,'p1');assert.equal(finalDamage.targetId,'qa-enemy-1');assert.equal(finalDamage.amount,1,'overkill is actual HP loss, not unbounded rolled damage');
  assert.equal(state.battle,null);assert.equal(state.battleReport.summaries.at(-1).result,'victory');
  assert.equal(state.battleReport.summaries.at(-1).damageByActor.find(row=>row.actorId==='p1').amount,1);

  state=act(fixture({secondEnemy:true}),{type:'endTurn',actorId:'p1'});
  const enemyDamage=events(state).filter(event=>event.kind==='damage'&&event.targetId==='p1');
  assert.equal(enemyDamage.length,2);assert.deepEqual(enemyDamage.map(event=>event.actorId),['qa-enemy-1','qa-enemy-2']);
  assert.ok(!enemyDamage.some(event=>event.actorId==='p1'),'enemy chain must not be charged to the player ending a turn');

  let source=fixture();source.actors.find(actor=>actor.id==='p1').hp=5;turn(source,'p3');
  state=act(source,{type:'ability',actorId:'p3',targetId:'p1',abilityId:'heal'});
  const healing=events(state).find(event=>event.kind==='healing');
  assert.equal(healing.actorId,'p3');assert.equal(healing.targetId,'p1');assert.equal(healing.method,engine.ABILITIES.heal.name);
  assert.equal(healing.amount,state.actors.find(actor=>actor.id==='p1').hp-5);

  source=turn(fixture(),'p2');state=act(source,{type:'ability',actorId:'p2',targetId:'qa-enemy-1',abilityId:'pin'});
  assert.ok(events(state).some(event=>event.kind==='status'&&event.statusesAdded.includes('slowed')));
  state=act(state,{type:'endTurn',actorId:'p2'});
  // The authored order goes p2 -> p3; explicitly advance that unmodified engine order to the enemy.
  for(let i=0;i<4&&!events(state).some(event=>event.kind==='status'&&event.statusesRemoved.includes('slowed'));i++)state=act(state,{type:'endTurn',actorId:state.turn.actorId});
  assert.ok(events(state).some(event=>event.kind==='status'&&event.statusesRemoved.includes('slowed')));

  source=turn(fixture(),'p3');state=act(source,{type:'ability',actorId:'p3',targetId:'p1',abilityId:'ward'});
  assert.ok(events(state).some(event=>event.kind==='status'&&event.statusesAdded.includes('temporary-hit-points')));
  turn(state,'p1');state=act(state,{type:'endTurn',actorId:'p1'});
  assert.ok(events(state).some(event=>event.kind==='damage'&&event.targetId==='p1'&&event.amount===0&&event.absorbed===6));
  assert.ok(events(state).some(event=>event.kind==='status'&&event.targetId==='p1'&&event.statusesRemoved.includes('temporary-hit-points')));

  source=fixture();source.actors.find(actor=>actor.id==='qa-enemy-1').ac=999;state=act(source,{type:'attack',actorId:'p1',targetId:'qa-enemy-1'});
  assert.ok(events(state).some(event=>event.kind==='miss'&&event.actorId==='p1'&&event.targetId==='qa-enemy-1'));
  assert.ok(!events(state).some(event=>event.kind==='damage'));

  source=fixture();source.actors.find(actor=>actor.id==='qa-enemy-1').hidden=true;source.actors.find(actor=>actor.id==='qa-enemy-1').name='HIDDEN_LEDGER_SENTINEL';
  state=act(source,{type:'attack',actorId:'p1',targetId:'qa-enemy-1'});
  const report=engine.publicState(state,seat).battleReport;
  assert.ok(!JSON.stringify(report).includes('HIDDEN_LEDGER_SENTINEL'));assert.ok(!JSON.stringify(report).includes('qa-enemy-1'));
  assert.ok(!JSON.stringify(report).includes('hpBefore'));assert.ok(!JSON.stringify(report).includes('maxHp'));
  const before=JSON.stringify(state.battleReport);engine.publicState(state,seat);assert.equal(JSON.stringify(state.battleReport),before,'legal-action previews must not append events');

  source=fixture();const rejected=engine.dispatch(source,{type:'attack',actorId:'p1',targetId:'missing'},{seat});
  assert.equal(rejected.ok,false);assert.equal(rejected.state,source);assert.equal(source.battleReport,undefined);
  state=act(fixture(),{type:'retreat'});assert.equal(state.battleReport.summaries.at(-1).result,'escape');
 });
}
