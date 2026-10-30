import {beginBattleCapture, recordBattleEffect, captureBattleTransition, publicBattleReport} from '../../server/combat-ledger.mjs';
// Pure, JSON-serializable rules. No I/O, wall clock, or external random source.
export const GAME_ID = 'aztec-fifth-sun-v3';
const RESOURCE_KEYS = ['grain', 'silver', 'water', 'dread'];
const clone = value => JSON.parse(JSON.stringify(value));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const unique = list => [...new Set(list)];
const positionKey = ({ x, y }) => `${x},${y}`;
const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const living = unit => unit.hp > 0 && !unit.down;
const npcRelationship = (state,id) => Object.hasOwn(state.npcRelationships??{},id) ? state.npcRelationships[id] : 0;
const fixedMap = (maps, id) => maps.find(map => map.id === id);
const currentMap = (state, maps) => mapForState(state,maps);
const walkable = (map, x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < map.width && y < map.height && !['#', '~'].includes(map.tiles[y][x]);
const neighbors = (map, point) => [[0,-1],[-1,0],[1,0],[0,1]].map(([dx,dy]) => ({x:point.x+dx,y:point.y+dy})).filter(p => walkable(map,p.x,p.y));
const WORKSHOP_ENCOUNTERS = {
  reeds:{id:'workshop-reeds',name:'工坊遭遇：堤岸巡守',enemies:[
    {id:'workshop-reed-1',name:'黑曜石巡守',hp:12,attack:3,armor:1,range:1,x:-1,y:-1},
    {id:'workshop-reed-2',name:'投矛手',hp:9,attack:2,armor:0,range:3,x:-1,y:-1}
  ]},
  shades:{id:'workshop-shades',name:'工坊遭遇：黑镜亡影',enemies:[
    {id:'workshop-shade-1',name:'黑镜守望',hp:15,attack:4,armor:2,range:1,x:-1,y:-1},
    {id:'workshop-shade-2',name:'蛾翼亡影',hp:11,attack:3,armor:1,range:2,x:-1,y:-1}
  ]}
};

function journal(state, text) {
  state.journal.push({ clock: state.clock, text });
}

function reveal(state, map, unit) {
  const seen = new Set(state.explored[map.id] ?? []);
  for (let y = Math.max(0, unit.y - 3); y <= Math.min(map.height - 1, unit.y + 3); y++) {
    for (let x = Math.max(0, unit.x - 3); x <= Math.min(map.width - 1, unit.x + 3); x++) {
      if (distance(unit, {x,y}) <= 3) seen.add(`${x},${y}`);
    }
  }
  state.explored[map.id] = [...seen];
}

function reachableCells(map) {
  const queue = [map.spawn], seen = new Set([positionKey(map.spawn)]), cells = [];
  for (let i=0; i<queue.length; i++) {
    const cell = queue[i]; cells.push(cell);
    for (const next of neighbors(map, cell)) if (!seen.has(positionKey(next))) {
      seen.add(positionKey(next)); queue.push(next);
    }
  }
  return cells;
}

function placeParty(state, map) {
  assert(map && walkable(map, map.spawn.x, map.spawn.y), '地图出生点不可通行');
  const cells=reachableCells(map);
  assert(cells.length >= state.party.length, '出生区域没有足够的独立站位');
  state.party.forEach((unit, i) => {
    Object.assign(unit, cells[i], {ap:2, move:5, guarding:false}); reveal(state, map, unit);
  });
}

export function meetsRequirements(state, requirements = {}) {
  return (requirements.flags ?? []).every(flag => state.flags.includes(flag))
    && (requirements.notFlags ?? []).every(flag => !state.flags.includes(flag))
    && Object.entries(requirements.resources ?? {}).every(([key, amount]) => (state.resources[key] ?? 0) >= amount)
    && Object.entries(requirements.npcRelationships ?? {}).every(([id,min]) => Number.isFinite(min)&&npcRelationship(state,id)>=min)
    && Object.entries(requirements.npcRelationshipsMax ?? {}).every(([id,max]) => Number.isFinite(max)&&npcRelationship(state,id)<=max)
    && state.completedRoutes.length >= (requirements.completedRoutes ?? 0);
}

function initialNpcRelationships(campaign,existing={}) {
  assert(Array.isArray(campaign.majorNpcs??[]),'主要NPC必须为数组');
  const ids=new Set(),partyIds=new Set((campaign.companions??[]).map(companion=>companion.id)),entries=[];
  for(const npc of campaign.majorNpcs??[]) {
    assert(typeof npc.id==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(npc.id)&&!ids.has(npc.id),'主要NPC的ID无效或重复');
    assert(!partyIds.has(npc.id),'主要NPC不能同时成为可控队伍角色');ids.add(npc.id);
    const value=Object.hasOwn(existing??{},npc.id)?existing[npc.id]:0;
    assert(Number.isFinite(value),'存档中的NPC关系数值无效');entries.push([npc.id,value]);
  }
  return Object.fromEntries(entries);
}

// Fixed map variants are data-only passable terrain patches. The authored source
// and saved custom maps remain untouched, so restored flags reproduce the map.
export function mapForState(state,maps,id=state.mapId) {
  if(Object.hasOwn(state.customMaps??{},id))return clone(state.customMaps[id]);
  const source=fixedMap(maps,id);if(!source)return undefined;
  const map=clone(source);delete map.variants;map.activeVariants=source.variants?[]:clone(source.activeVariants??[]);
  assert(Array.isArray(source.pois??[]),'固定地图兴趣点必须是数组');
  map.pois=(source.pois??[]).filter(poi=>{
    exactKeys(poi,['id','name','x','y','description','requires'],'固定地图兴趣点');
    const requires=poi.requires??{};exactKeys(requires,['flags','notFlags'],'兴趣点条件');
    for(const key of ['flags','notFlags'])if(requires[key]!==undefined)assert(Array.isArray(requires[key])&&requires[key].every(flag=>typeof flag==='string'),'兴趣点条件必须是旗标数组');
    return meetsRequirements(state,requires);
  }).map(poi=>{const projected=clone(poi);delete projected.requires;return projected;});
  for(const variant of source.variants??[]) {
    exactKeys(variant,['id','requires','changes','description'],'地图变体');
    plainText(variant.id,64,'地图变体ID');assert(variant.id.length>0,'地图变体缺少ID');
    if(variant.description!==undefined)plainText(variant.description,1000,'地图变体描述');
    const requires=variant.requires??{};exactKeys(requires,['flags','notFlags'],'地图变体条件');
    for(const key of ['flags','notFlags'])if(requires[key]!==undefined)assert(Array.isArray(requires[key])&&requires[key].every(flag=>typeof flag==='string'),'地图变体条件必须是旗标数组');
    assert(Array.isArray(variant.changes)&&variant.changes.length<=source.width*source.height,'地图变体补丁数量无效');
    for(const change of variant.changes) {
      exactKeys(change,['x','y','tile'],'地图变体补丁');
      assert(Number.isInteger(change.x)&&Number.isInteger(change.y)&&change.x>=0&&change.x<source.width&&change.y>=0&&change.y<source.height,'地图变体补丁坐标无效');
      assert(typeof change.tile==='string'&&/^[.=^*]$/.test(change.tile),'地图变体只能使用可通行地形补丁');
    }
    if(!meetsRequirements(state,requires))continue;
    for(const {x,y,tile} of variant.changes)map.tiles[y]=map.tiles[y].slice(0,x)+tile+map.tiles[y].slice(x+1);
    map.activeVariants.push({id:variant.id,description:variant.description??''});
    if(variant.description)map.description=`${map.description??''}\n${variant.description}`.trim();
  }
  return map;
}

// Chapter progress is derived from durable settlement flags, never a mutable cursor.
// Both successful and failed route resolutions can supply the same settlement flag.
export function getChapterProgress(state, campaign) {
  let previousSettled=true;
  const chapters=(campaign.chapters??[]).map(chapter=>{
    const settledFlags=unique(chapter.settledFlags??[]);
    const completedFlags=settledFlags.filter(flag=>state.flags.includes(flag));
    const remainingFlags=settledFlags.filter(flag=>!state.flags.includes(flag));
    const settled=settledFlags.length>0&&remainingFlags.length===0;
    const unlocked=previousSettled&&meetsRequirements(state,chapter.requires);
    previousSettled=previousSettled&&settled;
    return {id:chapter.id,title:chapter.title,summary:chapter.summary??'',unlocked,settled,
      progress:completedFlags.length,total:settledFlags.length,completedFlags,remainingFlags};
  });
  const current=chapters.find(chapter=>chapter.unlocked&&!chapter.settled)??null;
  return {currentChapter:current?.id??null,current,chapters,allSettled:chapters.length>0&&chapters.every(chapter=>chapter.settled)};
}

function sceneParagraphs(text) {
  if(text===undefined||text===null)return [];
  const paragraphs=typeof text==='string'?[text]:text;
  assert(Array.isArray(paragraphs)&&paragraphs.every(paragraph=>typeof paragraph==='string'),'场景正文必须为文字或文字段落数组');
  return paragraphs.filter(paragraph=>paragraph.trim().length>0).slice();
}

// Rendering-only conditional prose: do not award flags, unlock choices or mutate
// either source. Normalized paragraph arrays also round-trip through JSON.
export function sceneForState(state,node) {
  const scene=clone(node),paragraphs=sceneParagraphs(node.text);
  // An already expanded scene is safe to render again without duplicate prose.
  if(!node.sceneVariants) {
    scene.text=paragraphs;
    scene.activeSceneVariants=clone(node.activeSceneVariants??[]);
    return scene;
  }
  assert(Array.isArray(node.sceneVariants),'场景变体必须是数组');
  scene.activeSceneVariants=[];
  for(const variant of node.sceneVariants) {
    exactKeys(variant,['id','requires','text'],'场景变体');
    assert(typeof variant.id==='string'&&variant.id.length>0,'场景变体缺少ID');
    const extra=sceneParagraphs(variant.text);
    if(!meetsRequirements(state,variant.requires))continue;
    paragraphs.push(...extra);scene.activeSceneVariants.push({id:variant.id});
  }
  scene.text=paragraphs;delete scene.sceneVariants;
  return scene;
}

// Major NPCs have a separate codex projection, never a controllable party unit.
// Several true public stances and recorded milestones may coexist.
export function majorNpcForState(state,npc) {
  assert(npc&&typeof npc.id==='string'&&npc.id.length>0,'主要NPC缺少ID');
  const view=clone(npc),relationship=npcRelationship(state,npc.id);
  assert(Number.isFinite(relationship),'NPC关系数值无效');
  view.relationship=relationship;view.controllable=false;
  for(const [sourceKey,targetKey] of [['stances','activeStances'],['milestones','activeMilestones']]) {
    const entries=npc[sourceKey]??[];assert(Array.isArray(entries),'NPC立场与里程碑必须为数组');
    view[targetKey]=entries.filter(entry=>{
      exactKeys(entry,['id','requires','title','text'],'NPC展示片段');
      assert(typeof entry.id==='string'&&entry.id.length>0&&typeof entry.title==='string','NPC展示片段缺少ID或标题');
      sceneParagraphs(entry.text);
      return meetsRequirements(state,entry.requires);
    }).map(entry=>({id:entry.id,title:entry.title,text:sceneParagraphs(entry.text)}));
    delete view[sourceKey];
  }
  return view;
}

function affordable(state, cost = {}) {
  return Object.entries(cost).every(([key, amount]) => RESOURCE_KEYS.includes(key) && Number.isFinite(amount) && amount >= 0 && state.resources[key] >= amount);
}

function applyEffects(state, effects = {}) {
  for (const [key, amount] of Object.entries(effects.resources ?? {})) {
    assert(RESOURCE_KEYS.includes(key) && Number.isFinite(amount), '非法资源效果');
    assert(state.resources[key] + amount >= 0, `资源不足：${key}`);
    state.resources[key] += amount;
  }
  state.flags = unique([...state.flags, ...(effects.flags ?? [])]).filter(flag => !(effects.clearFlags ?? []).includes(flag));
  for (const key of ['factions', 'relationships']) for (const [id, delta] of Object.entries(effects[key] ?? {})) {
    assert(Number.isFinite(delta), '非法关系效果'); state[key][id] = (state[key][id] ?? 0) + delta;
  }
  if(effects.npcRelationships!==undefined) {
    exactKeys(effects.npcRelationships,Object.keys(state.npcRelationships??{}),'NPC关系效果');
    for(const [id,delta] of Object.entries(effects.npcRelationships)) {
      assert(Number.isFinite(delta),'NPC关系增量必须是有限数值');
      const next=npcRelationship(state,id)+delta;assert(Number.isFinite(next),'NPC关系结果必须是有限数值');
      state.npcRelationships[id]=next;
    }
  }
  if (effects.completeRoute && !state.failedRoutes.includes(effects.completeRoute)) state.completedRoutes = unique([...state.completedRoutes, effects.completeRoute]);
  for (const route of effects.failRoutes ?? []) if (!state.completedRoutes.includes(route)) state.failedRoutes = unique([...state.failedRoutes, route]);
  if (effects.text) journal(state, effects.text);
}

export function createState(campaign, maps) {
  assert(campaign?.companions?.length && maps?.length, '缺少战役角色或地图');
  assert(campaign.id===GAME_ID,'战役不属于《第五日之城》');
  const mapId = fixedMap(maps,'harbor') ? 'harbor' : maps[0].id;
  const state = {
    schema:3, gameId:GAME_ID, campaignId:campaign.id, revision:0, clock:0, phase:'exploration', mapId,
    resources:Object.fromEntries(RESOURCE_KEYS.map(key => [key, campaign.initial?.[key] ?? 0])),
    flags:[], factions:Object.fromEntries((campaign.factions ?? []).map(f => [f.id,0])),
    relationships:Object.fromEntries(campaign.companions.map(c => [c.id,0])),npcRelationships:initialNpcRelationships(campaign),
    completedRoutes:[], failedRoutes:[],
    party:campaign.companions.map(c => ({id:c.id,name:c.name,role:c.role,hp:c.hp,maxHp:c.hp,attack:c.attack,armor:c.armor ?? 0,range:c.range ?? 1,x:0,y:0,ap:2,move:5,down:false,guarding:false,skillUsed:false})),
    selectedCharacter:campaign.companions[0].id, combat:null, journal:[], ending:null,
    customMaps:{}, explored:{}, seed:0x5eed1234
  };
  placeParty(state, currentMap(state,maps));
  journal(state, campaign.intro ?? '第五轮太阳之下，城邦等待你们作出选择。');
  return state;
}

export function legalChoices(state, campaign) {
  if (state.phase !== 'exploration' || state.ending) return [];
  const chapters=getChapterProgress(state,campaign).chapters;
  const unlockedChapters=new Set(chapters.filter(chapter=>chapter.unlocked&&!chapter.settled).map(chapter=>chapter.id));
  return (campaign.nodes ?? []).filter(node => node.map === state.mapId
    && (!chapters.length||unlockedChapters.has(node.chapter))
    && !state.flags.includes(`node:${node.id}`)
    && !state.completedRoutes.includes(node.route) && !state.failedRoutes.includes(node.route)
    && meetsRequirements(state, node.requires))
    .map(node => ({...sceneForState(state,node),node:node.id,choices:node.choices.filter(choice => meetsRequirements(state,choice.requires) && affordable(state,choice.cost)).map(clone)}))
    .filter(node => node.choices.length);
}

function die(state) {
  state.seed = ((state.seed >>> 0) * 1664525 + 1013904223) >>> 0;
  return (state.seed % 6) + 1;
}

// Dijkstra is a breadth-first expansion with terrain costs; occupancy blocks passage.
function pathTo(map, from, to, blocked = new Set()) {
  if (!walkable(map,to.x,to.y) || blocked.has(positionKey(to))) return null;
  const queue = [{...from,cost:0,path:[]}], best = new Map([[positionKey(from),0]]);
  while (queue.length) {
    queue.sort((a,b) => a.cost-b.cost);
    const step = queue.shift();
    if (step.cost !== best.get(positionKey(step))) continue;
    if (step.x === to.x && step.y === to.y) return step;
    for (const next of neighbors(map,step)) {
      if (blocked.has(positionKey(next))) continue;
      const cost = step.cost + (map.tiles[next.y][next.x] === '^' ? 2 : 1);
      if (cost < (best.get(positionKey(next)) ?? Infinity)) {
        best.set(positionKey(next),cost); queue.push({...next,cost,path:[...step.path,next]});
      }
    }
  }
  return null;
}

function occupied(state, except) {
  return new Set([...state.party,...(state.combat?.enemies ?? []).filter(living)].filter(unit => unit.id !== except).map(positionKey));
}

function lineOfSight(map, a, b) {
  let x=a.x, y=a.y;
  const dx=Math.abs(b.x-a.x),dy=Math.abs(b.y-a.y),sx=a.x<b.x?1:-1,sy=a.y<b.y?1:-1;
  let error=dx-dy;
  while (x!==b.x || y!==b.y) {
    const twice=2*error;
    if(twice>-dy){error-=dy;x+=sx;}
    if(twice<dx){error+=dx;y+=sy;}
    if(map.tiles[y]?.[x]==='#')return false;
  }
  return true;
}

function hurt(state, unit, damage, source = null, method = '规则伤害') {
  const previousHp = unit.hp;
  unit.hp = Math.max(0,unit.hp-damage); unit.down = unit.hp === 0;
  recordBattleEffect(state,{kind:'damage',actor:source,target:unit,amount:Math.max(0,previousHp-unit.hp),method});
  if (unit.down) { unit.ap=0; unit.move=0; journal(state,`${unit.name}倒下了。`); }
}

function walk(state, map, unit, path) {
  for(const cell of path) {
    unit.x=cell.x;unit.y=cell.y;
    if(state.party.some(p=>p.id===unit.id))reveal(state,map,unit);
    if(map.tiles[cell.y][cell.x]==='*') {
      const damage=1+(map.id==='underworld'&&(state.factions.shades??0)<=-4?1:0);
      hurt(state,unit,damage,null,'危险地形');journal(state,`${unit.name}受到危险地形伤害 ${damage}${damage>1?'（亡影敌意）':''}。`);
    }
    if(!living(unit))break;
  }
}

function strike(state,map,attacker,target) {
  assert(distance(attacker,target) <= attacker.range && lineOfSight(map,attacker,target),'目标超出射程或被墙壁阻隔');
  const roll=die(state), damage=Math.max(1,attacker.attack+roll-target.armor-(target.guarding?2:0));
  hurt(state,target,damage,attacker,'普通攻击'); journal(state,`${attacker.name}攻击${target.name}：骰 ${roll}，造成 ${damage} 伤害。`);
}

function finishCombat(state,maps) {
  if(!state.combat)return false;
  if(!state.party.some(living)) {
    const training=state.combat.training;
    if(!training)state.flags=unique([...state.flags,`encounter:${state.combat.id}:lost`]);
    state.resources.dread+=2;state.resources.silver=Math.max(0,state.resources.silver-3);
    recordBattleEffect(state,{kind:'battle-end',result:'defeat'});
    state.phase='defeat';state.combat=null;
    journal(state,training?'工坊遭遇全员倒下，蚀影+2、损失可可至多3。请休整恢复；没有改变剧情旗标。':'队伍全员倒下，商旅将你们送回营地。遭遇失败；休整后可承担后果继续剧情。');
    placeParty(state,currentMap(state,maps));return true;
  }
  if(!state.combat.enemies.some(living)) {
    const {reward,name}=state.combat;
    recordBattleEffect(state,{kind:'battle-end',result:'victory'});
    state.combat=null;state.phase='exploration';
    applyEffects(state,reward);
    for(const unit of state.party){unit.ap=2;unit.move=5;unit.guarding=false;}
    journal(state,`战斗胜利：${name}。`);return true;
  }
  return false;
}

function enemyTurn(state,maps,enemy) {
  const map=currentMap(state,maps);
  const targets=state.party.filter(living).sort((a,b)=>distance(enemy,a)-distance(enemy,b)||a.id.localeCompare(b.id));
  if(!targets.length)return;
  let target=targets[0];
  if(distance(enemy,target)>enemy.range || !lineOfSight(map,enemy,target)) {
    const blocked=occupied(state,enemy.id), options=[];
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++) {
      const cell={x,y};
      if(distance(cell,target)<=enemy.range&&lineOfSight(map,cell,target)) {
        const path=pathTo(map,enemy,cell,blocked); if(path)options.push(path);
      }
    }
    options.sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);
    if(options.length) {
      let spent=0;const steps=[];
      for(const cell of options[0].path) {
        const cost=map.tiles[cell.y][cell.x]==='^'?2:1;
        if(spent+cost>5)break;spent+=cost;steps.push(cell);
      }
      walk(state,map,enemy,steps);enemy.move-=spent;
    }
  }
  target=state.party.filter(living).sort((a,b)=>distance(enemy,a)-distance(enemy,b)||a.id.localeCompare(b.id))[0];
  if(living(enemy)&&target&&distance(enemy,target)<=enemy.range&&lineOfSight(map,enemy,target)){strike(state,map,enemy,target);enemy.ap--;}
}

function advanceTurn(state,maps) {
  let safety=0;
  while(state.combat && safety++<100) {
    const combat=state.combat;
    const index=combat.order.indexOf(combat.turn);
    const nextIndex=(index+1)%combat.order.length;
    if(nextIndex===0){combat.round++;journal(state,`第 ${combat.round} 回合。`);}
    combat.turn=combat.order[nextIndex];
    const unit=[...state.party,...combat.enemies].find(u=>u.id===combat.turn);
    if(!unit||!living(unit))continue;
    unit.ap=2;unit.move=5;unit.guarding=false;
    if(state.party.some(p=>p.id===unit.id)){state.selectedCharacter=unit.id;return;}
    enemyTurn(state,maps,unit);
    if(finishCombat(state,maps))return;
  }
}

function startCombat(state,encounter,node,maps) {
  assert(encounter.enemies?.length,'遭遇缺少敌人');
  const map=currentMap(state,maps), used=occupied(state), ids=new Set(state.party.map(u=>u.id)),reachable=reachableCells(map),reachableKeys=new Set(reachable.map(positionKey));
  const enemies=encounter.enemies.map((spec,index)=>{
    assert(spec.id&&!ids.has(spec.id),'敌人ID重复');ids.add(spec.id);
    const unit={...clone(spec),maxHp:spec.hp,armor:spec.armor??0,range:spec.range??1,ap:2,move:5,down:false,guarding:false};
    assert(unit.hp>0&&unit.attack>=0,'敌人属性无效');
    if(!walkable(map,unit.x,unit.y)||used.has(positionKey(unit))||!reachableKeys.has(positionKey(unit))) {
      const cells=reachable.filter(cell=>!used.has(positionKey(cell)));
      cells.sort((a,b)=>distance(b,map.spawn)-distance(a,map.spawn)||a.y-b.y||a.x-b.x);
      assert(cells.length,'出生连通区域没有可达敌人站位');Object.assign(unit,cells[index%cells.length]);
    }
    used.add(positionKey(unit));return unit;
  });
  for(const unit of state.party){unit.ap=2;unit.move=5;unit.guarding=false;unit.skillUsed=false;}
  const order=[...state.party.map(u=>u.id),...enemies.map(u=>u.id)],first=state.party.find(living)?.id;
  assert(first,'全队倒下，必须先休整');
  state.combat={id:encounter.id,name:encounter.name,round:1,turn:first,order,enemies,route:node.route??null,training:!!node.training,reward:clone(encounter.reward??{})};
  state.phase='combat';state.selectedCharacter=first;journal(state,`遭遇：${encounter.name}。`);
}

const MAP_KEYS=['id','name','description','width','height','tiles','spawn','pois'];
function exactKeys(value,allowed,label) {
  assert(value&&typeof value==='object'&&!Array.isArray(value),`${label}格式错误`);
  assert(Object.keys(value).every(key=>allowed.includes(key)),`${label}含未授权属性`);
}
function plainText(value,max,label) {assert(typeof value==='string'&&value.length<=max&&!/[<>\u0000-\u0008]/.test(value),`${label}必须是纯文字`);}
function validateMap(map,state,maps) {
  exactKeys(map,MAP_KEYS,'地图');
  assert(typeof map.id==='string'&&/^[a-z][a-z0-9_-]{0,63}$/.test(map.id),'地图ID格式错误');
  assert(!fixedMap(maps,map.id),'固定地图不可覆盖，请使用新的ID');
  plainText(map.name,80,'地图名');plainText(map.description??'',1000,'地图描述');
  assert(Number.isInteger(map.width)&&map.width>=8&&map.width<=40&&Number.isInteger(map.height)&&map.height>=6&&map.height<=30,'地图尺寸须为8–40 × 6–30');
  assert(Array.isArray(map.tiles)&&map.tiles.length===map.height&&map.tiles.every(row=>typeof row==='string'&&row.length===map.width&&/^[.#~=^*]+$/.test(row)),'地图地形尺寸或字符无效');
  exactKeys(map.spawn,['x','y'],'出生点');assert(walkable(map,map.spawn.x,map.spawn.y),'出生点不可通行');
  assert(Array.isArray(map.pois)&&map.pois.length<=50,'兴趣点格式错误');
  const ids=new Set();
  for(const poi of map.pois){exactKeys(poi,['id','name','x','y','description'],'兴趣点');plainText(poi.id,64,'兴趣点ID');plainText(poi.name,80,'兴趣点名');plainText(poi.description??'',1000,'兴趣点描述');assert(!ids.has(poi.id),'兴趣点ID重复');ids.add(poi.id);assert(walkable(map,poi.x,poi.y),'兴趣点不可通行');}
  const test={party:clone(state.party),explored:{}};placeParty(test,map);
}

const CHARACTER_ACTIONS=['move','attack','guard','heal','skill','endTurn'];
const PROGRESS_ACTIONS=['choose','travel','rest','retreat','finale'];
const MANAGEMENT_ACTIONS=['saveMap','loadMap','startEncounter'];
const ALL_ACTIONS=['move','travel','choose','attack','guard','heal','skill','endTurn','retreat','rest','finale','saveMap','loadMap','startEncounter'];

// The server builds actor from the authenticated seat and persisted room mode.
// Claimed character is identity in party mode; it remains an ownership lock in hosted mode.
export function capabilitiesForActor(actor) {
  assert(actor&&['host','player'].includes(actor.role),'无效角色权限');
  const roomMode=actor.roomMode===undefined?'hosted':actor.roomMode;
  assert(['party','hosted'].includes(roomMode),'无效房间模式');
  const controlAll=actor.role==='host'||roomMode==='party';
  const canProgress=controlAll,canManage=actor.role==='host'||(roomMode==='party'&&actor.canManage===true);
  const allowedActions=ALL_ACTIONS.filter(type=>CHARACTER_ACTIONS.includes(type)||(canProgress&&PROGRESS_ACTIONS.includes(type))||(canManage&&MANAGEMENT_ACTIONS.includes(type)));
  return {allowedActions,canManage,controlAll,canProgress};
}

function authorize(actor,action) {
  const capabilities=capabilitiesForActor(actor);
  assert(!['role','canManage','roomMode','actor','capabilities','viewer'].some(key=>Object.hasOwn(action,key)),'行动不能携带权限字段');
  if(!capabilities.allowedActions.includes(action.type)) {
    if(MANAGEMENT_ACTIONS.includes(action.type))throw new Error('只有管理员或主持人可以执行此行动');
    if(PROGRESS_ACTIONS.includes(action.type))throw new Error('只有主持人可以执行此行动');
    throw new Error('未知行动');
  }
  if(CHARACTER_ACTIONS.includes(action.type)&&!capabilities.controlAll)assert(actor.characterId&&actor.characterId===action.characterId,'不能操控其他玩家的角色');
}

function ownUnit(state,action,combatRequired=false) {
  const unit=state.party.find(p=>p.id===action.characterId);assert(unit,'角色不存在');assert(living(unit),'倒下的角色需要治疗或休整');
  if(combatRequired)assert(state.phase==='combat','此行动只能在战斗中执行');
  if(state.phase==='combat')assert(state.combat.turn===unit.id,'尚未轮到此角色');
  state.selectedCharacter=unit.id;return unit;
}

export function applyAction(input, action, campaign, maps, actor={role:'host',characterId:null}) {
  assert(input?.schema===3,'不支持的存档版本');assert(action&&typeof action.type==='string','缺少行动');
  assert(campaign.id===GAME_ID&&input.gameId===GAME_ID&&input.campaignId===campaign.id,'此进度不属于《第五日之城》，请新建本作房间');
  assert(input.phase!=='ending'&&!input.ending,'结局已经写定，不能继续行动');authorize(actor,action);
  const state=clone(input);beginBattleCapture(state);state.npcRelationships=initialNpcRelationships(campaign,state.npcRelationships);
  const map=currentMap(state,maps);assert(map,'当前地图不存在');
  if(state.phase==='defeat')assert(action.type==='rest','队伍倒下，请先休整恢复');
  state.clock++;
  switch(action.type) {
    case 'move': {
      assert(['exploration','combat'].includes(state.phase),'当前不能移动');
      const unit=ownUnit(state,action),path=pathTo(map,unit,{x:action.x,y:action.y},occupied(state,unit.id));
      assert(path&&path.path.length,'目标不可达或没有移动');
      assert(path.cost<=(state.phase==='combat'?unit.move:5),'移动距离超出本次行动上限');
      if(state.phase==='combat')unit.move-=path.cost;
      walk(state,map,unit,path.path);
      if(state.phase==='combat'){if(!finishCombat(state,maps)&&!living(unit))advanceTurn(state,maps);}
      else if(!state.party.some(living)){state.phase='defeat';journal(state,'全员倒下，请休整恢复。');}
      break;
    }
    case 'travel': case 'loadMap': {
      assert(state.phase==='exploration','战斗或失败状态不能旅行');
      const next=action.type==='travel'?fixedMap(maps,action.mapId):(state.customMaps[action.mapId]??fixedMap(maps,action.mapId));
      assert(next,'地图不存在；旅行仅允许固定地图');
      state.mapId=next.id;placeParty(state,next);journal(state,`抵达${next.name}。`);break;
    }
    case 'choose': {
      assert(state.phase==='exploration','战斗中不能选择剧情');
      const node=legalChoices(state,campaign).find(n=>n.id===action.nodeId),choice=node?.choices.find(c=>c.id===action.choiceId);
      assert(choice,'此节点或选择不可用：检查地图、前置条件、路线及资源');
      for(const [key,amount] of Object.entries(choice.cost??{}))state.resources[key]-=amount;
      state.flags=unique([...state.flags,`node:${node.id}`]);
      journal(state,`${node.title}：${choice.label}`);
      applyEffects(state,choice.effects);
      if(choice.encounter)startCombat(state,choice.encounter,node,maps);
      break;
    }
    case 'attack': {
      const unit=ownUnit(state,action,true),target=state.combat.enemies.find(e=>e.id===action.targetId&&living(e));
      assert(unit.ap>=1,'行动点不足');assert(target,'敌人不存在或已倒下');strike(state,map,unit,target);unit.ap--;
      if(!finishCombat(state,maps)&&unit.ap===0)advanceTurn(state,maps);break;
    }
    case 'guard': {
      const unit=ownUnit(state,action,true);assert(unit.ap>=1,'行动点不足');assert(!unit.guarding,'本轮已经防守');
      unit.ap--;unit.guarding=true;journal(state,`${unit.name}采取防守，下一次轮到自己前护甲 +2。`);
      if(unit.ap===0)advanceTurn(state,maps);break;
    }
    case 'heal': {
      const unit=ownUnit(state,action),target=state.party.find(p=>p.id===action.targetId);
      assert(target&&target.hp<target.maxHp,'治疗目标无效或无需治疗');assert(distance(unit,target)<=1,'治疗需要相邻');
      assert(state.resources.grain>=1,'治疗需要1玉米');if(state.phase==='combat')assert(unit.ap>=1,'行动点不足');
      state.resources.grain--;const previousHp=target.hp;target.hp=Math.min(target.maxHp,target.hp+5);target.down=false;recordBattleEffect(state,{kind:'healing',actor:unit,target,amount:target.hp-previousHp,method:'补给治疗'});
      journal(state,`${unit.name}消耗1玉米治疗${target.name}，恢复至${target.hp}生命。`);
      if(state.phase==='combat'){unit.ap--;if(unit.ap===0)advanceTurn(state,maps);}break;
    }
    case 'skill': {
      const unit=ownUnit(state,action,true);
      const relation=state.relationships[unit.id]??0,skillCost=relation<=-3?2:1,empowered=relation>=3;
      assert(unit.ap>=skillCost,`行动点不足：此技能需要${skillCost}AP${skillCost===2?'（关系迟疑）':''}`);assert(!unit.skillUsed,'此角色本场战斗已使用独特技能');
      if(unit.id==='yaotl'||unit.id==='itzel') {
        const target=state.combat.enemies.find(e=>e.id===action.targetId&&living(e));
        assert(target,'请选择存活敌人作为技能目标');
        const range=unit.id==='yaotl'?3:4;
        assert(distance(unit,target)<=range&&lineOfSight(map,unit,target),'技能目标超出范围或被墙壁阻隔');
        const reduction=(unit.id==='yaotl'?2:3)+(empowered?1:0);const previousArmor=target.armor;target.armor=Math.max(0,target.armor-reduction);recordBattleEffect(state,{kind:'status',actor:unit,target,method:unit.id==='yaotl'?'黑曜破阵':'镜纹封刃',statusesAdded:[`护甲降低 ${previousArmor-target.armor}`]});
        if(unit.id==='yaotl') {
          const blocked=occupied(state,target.id);
          const pull=neighbors(map,target).filter(cell=>!blocked.has(positionKey(cell))&&distance(unit,cell)<distance(unit,target)).sort((a,b)=>distance(unit,a)-distance(unit,b)||a.y-b.y||a.x-b.x)[0];
          if(pull)walk(state,map,target,[pull]);
          journal(state,`${unit.name}使用黑曜破阵，将${target.name}护甲降低${reduction}，并尝试牵引一格。`);
        } else journal(state,`${unit.name}使用镜纹封刃，${target.name}护甲降低${reduction}，持续本场战斗。`);
      } else if(unit.id==='nelli') {
        const extra=empowered?7:5;unit.move+=extra;journal(state,`${unit.name}使用苇舟疾行，本回合移动力增加${extra}。`);
      } else if(unit.id==='xoco') {
        const target=state.party.find(p=>p.id===action.targetId);
        assert(target&&target.hp<target.maxHp,'请选择需要治疗的队友');
        assert(distance(unit,target)<=3&&lineOfSight(map,unit,target),'净水救护范围为3且需要视线');
        assert(state.resources.grain>=1,'净水救护需要1玉米');state.resources.grain--;
        const previousHp=target.hp;target.hp=Math.min(target.maxHp,target.hp+(empowered?10:8));target.down=false;recordBattleEffect(state,{kind:'healing',actor:unit,target,amount:target.hp-previousHp,method:'净水救护'});
        journal(state,`${unit.name}使用净水救护，消耗1玉米，使${target.name}恢复至${target.hp}生命。`);
      } else throw new Error('此角色没有配置独特技能');
      if(empowered)journal(state,`${unit.name}与你们的信任令技能增强。`);
      if(skillCost===2)journal(state,`${unit.name}因关系紧张而迟疑，技能消耗2AP。`);
      unit.skillUsed=true;unit.ap-=skillCost;
      if(!finishCombat(state,maps)&&unit.ap===0)advanceTurn(state,maps);break;
    }
    case 'endTurn': {const unit=ownUnit(state,action,true);unit.ap=0;unit.move=0;advanceTurn(state,maps);break;}
    case 'retreat': {
      assert(state.phase==='combat','当前没有战斗');
      const training=state.combat.training;
      if(!training)state.flags=unique([...state.flags,`encounter:${state.combat.id}:lost`]);
      state.resources.dread++;recordBattleEffect(state,{kind:'battle-end',result:'escape'});state.combat=null;state.phase='exploration';
      for(const unit of state.party)if(!living(unit)){unit.hp=1;unit.down=false;}
      placeParty(state,map);journal(state,training?'工坊遭遇撤退，队伍回到出生区域，蚀影+1，没有改变剧情旗标。':'队伍撤回营地，蚀影 +1，遭遇失败；可继续处理此路线的后果。');break;
    }
    case 'rest': {
      assert(state.phase==='exploration'||state.phase==='defeat','战斗中不能休整');
      const required=(state.factions.commons??0)>=3?1:2,cost=Math.min(state.resources.grain,required);state.resources.grain-=cost;
      if(required===1)journal(state,'居民互助送来口粮（居民声望≥3），本次休整只需1玉米。');
      if(cost<required){state.resources.dread+=required-cost;journal(state,'口粮不足，靠城民施舍恢复；欠缺的每份口粮令蚀影 +1。');}
      for(const unit of state.party){unit.hp=unit.maxHp;unit.down=false;unit.ap=2;unit.move=5;unit.guarding=false;}
      state.phase='exploration';state.combat=null;placeParty(state,map);journal(state,`休整完成，消耗 ${cost} 玉米。`);break;
    }
    case 'finale': {
      assert(state.phase==='exploration','只有探索时可以决定结局');
      const chapters=getChapterProgress(state,campaign);
      if(chapters.chapters.length)assert(chapters.allSettled,'所有章节均须完成主线收束后才能触发结局');
      else assert(unique([...state.completedRoutes,...state.failedRoutes]).length>=2,'至少处理两条主线后才能触发结局');
      const matches=(campaign.endings??[]).filter(ending=>meetsRequirements(state,ending.requires));
      if(chapters.chapters.length)assert(matches.length===1,`结局条件数据错误：应唯一匹配1个主结局，实际匹配${matches.length}个。`);
      const ending=matches[0];assert(ending,'目前尚未满足任何结局条件');
      const routeNames=ids=>ids.map(id=>campaign.routes?.find(r=>r.id===id)?.title??id).join('、')||'无';
      const unsettled=(campaign.routes??[]).map(r=>r.id).filter(id=>!state.completedRoutes.includes(id)&&!state.failedRoutes.includes(id));
      const followups=(campaign.epilogues??[]).filter(epilogue=>meetsRequirements(state,epilogue.requires)).map(epilogue=>({id:epilogue.id,text:epilogue.text}));
      let consequences=`完成路线：${routeNames(state.completedRoutes)}。失败路线：${routeNames(state.failedRoutes)}。未处理路线：${routeNames(unsettled)}${unsettled.length?'，其争端将由城邦自行裁决，队伍无法保障其命运':''}。玉米 ${state.resources.grain}，可可 ${state.resources.silver}，净水 ${state.resources.water}，蚀影 ${state.resources.dread}。`;
      if(followups.length)consequences+=`\n\n后续：\n${followups.map(followup=>followup.text).join('\n\n')}`;
      state.ending={...clone(ending),followups,consequences};state.phase='ending';journal(state,`${ending.title}：${ending.text}\n${consequences}`);break;
    }
    case 'saveMap': {
      assert(state.phase==='exploration','战斗中不能编辑地图');validateMap(action.map,state,maps);
      assert(action.map.id!==state.mapId,'请离开当前自定义地图后再修改');
      state.customMaps[action.map.id]=clone(action.map);journal(state,`自定义地图「${action.map.name}」已保存，可载入探索。`);break;
    }
    case 'startEncounter': {
      exactKeys(action,['type','templateId'],'工坊遭遇行动');
      assert(state.phase==='exploration','只能在探索时开始工坊遭遇');
      assert(Object.hasOwn(state.customMaps,state.mapId),'工坊遭遇仅限已载入的自定义地图');
      assert(typeof action.templateId==='string'&&Object.hasOwn(WORKSHOP_ENCOUNTERS,action.templateId),'未知的工坊遭遇模板');
      startCombat(state,WORKSHOP_ENCOUNTERS[action.templateId],{training:true},maps);
      journal(state,'工坊遭遇使用固定模板；没有剧情旗标或资源奖励。撤退和全倒仍按通常规则承担损失。');break;
    }
    default: throw new Error('未知行动');
  }
  state.revision++;
  captureBattleTransition(input,state,action,{actorId:action.characterId,targetId:action.targetId});
  return state;
}

// Exact actionable examples for folder players. Movement lists adjacent steps;
// longer valid paths remain available through the normal move action.
export function legalActionsForState(state,campaign,maps,actor) {
  const capabilities=capabilitiesForActor(actor),allowed=new Set(capabilities.allowedActions),actions=[];
  if(state.gameId!==GAME_ID||state.ending||state.phase==='ending')return actions;
  const add=action=>{if(allowed.has(action.type))actions.push(action);};
  if(state.phase==='defeat'){add({type:'rest'});return actions;}
  const map=currentMap(state,maps);if(!map)return actions;
  if(state.phase==='exploration') {
    for(const node of legalChoices(state,campaign))for(const choice of node.choices)add({type:'choose',nodeId:node.id,choiceId:choice.id});
    for(const destination of maps)if(destination.id!==state.mapId)add({type:'travel',mapId:destination.id});
    add({type:'rest'});
    if(getChapterProgress(state,campaign).allSettled&&(campaign.endings??[]).filter(e=>meetsRequirements(state,e.requires)).length===1)add({type:'finale'});
    if(Object.hasOwn(state.customMaps??{},state.mapId))for(const templateId of Object.keys(WORKSHOP_ENCOUNTERS))add({type:'startEncounter',templateId});
  } else if(state.phase==='combat')add({type:'retreat'});
  for(const unit of state.party.filter(living)) {
    if(!capabilities.controlAll&&unit.id!==actor.characterId)continue;
    if(state.phase==='combat'&&state.combat.turn!==unit.id)continue;
    const blocked=occupied(state,unit.id),movement=state.phase==='combat'?unit.move:5;
    for(const cell of neighbors(map,unit))if(!blocked.has(positionKey(cell))&&(map.tiles[cell.y][cell.x]==='^'?2:1)<=movement)add({type:'move',characterId:unit.id,x:cell.x,y:cell.y});
    const hasAp=state.phase!=='combat'||unit.ap>=1;
    if(hasAp&&state.resources.grain>=1)for(const target of state.party)if(target.hp<target.maxHp&&distance(unit,target)<=1)add({type:'heal',characterId:unit.id,targetId:target.id});
    if(state.phase!=='combat')continue;
    add({type:'endTurn',characterId:unit.id});
    const targets=state.combat.enemies.filter(living);
    if(unit.ap>=1) {
      if(!unit.guarding)add({type:'guard',characterId:unit.id});
      for(const target of targets)if(distance(unit,target)<=unit.range&&lineOfSight(map,unit,target))add({type:'attack',characterId:unit.id,targetId:target.id});
    }
    const skillCost=(state.relationships[unit.id]??0)<=-3?2:1;
    if(unit.skillUsed||unit.ap<skillCost)continue;
    if(['yaotl','itzel'].includes(unit.id))for(const target of targets) {
      if(distance(unit,target)<=(unit.id==='yaotl'?3:4)&&lineOfSight(map,unit,target))add({type:'skill',characterId:unit.id,targetId:target.id});
    }
    else if(unit.id==='nelli')add({type:'skill',characterId:unit.id});
    else if(unit.id==='xoco'&&state.resources.grain>=1)for(const target of state.party) {
      if(target.hp<target.maxHp&&distance(unit,target)<=3&&lineOfSight(map,unit,target))add({type:'skill',characterId:unit.id,targetId:target.id});
    }
  }
  return actions;
}

export function publicState(state, actor={role:'host',characterId:null}) {
  const result=clone(state);result.battleReport=publicBattleReport(state,{privileged:actor.role==='host'});
  const capabilities=capabilitiesForActor(actor);
  // Engine state never stores seat credentials. Also drop accidentally attached server metadata.
  for(const key of ['token','tokens','seats','password','secret'])delete result[key];
  if(result.combat){delete result.combat.pendingEffects;delete result.combat.reward;}
  result.party=result.party.map(unit=>({...unit,skillCost:(state.relationships[unit.id]??0)<=-3?2:1,skillEmpowered:(state.relationships[unit.id]??0)>=3}));
  result.capabilities=clone(capabilities);
  result.viewer={role:actor.role,characterId:actor.characterId??null,roomMode:actor.roomMode===undefined?'hosted':actor.roomMode,...capabilities};
  return result;
}
