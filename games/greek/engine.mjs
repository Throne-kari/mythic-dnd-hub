import {beginBattleCapture, recordBattleEffect, captureBattleTransition, publicBattleReport} from '../../server/combat-ledger.mjs';
// A small, deterministic d20 ruleset. This is not the complete D&D rules.
const clone = value => structuredClone(value);
const LEDGER_PREVIEW = Symbol('ledger-preview');
const fail = message => { throw new Error(message); };
const plain = value => value && typeof value === 'object' && !Array.isArray(value) && [Object.prototype,null].includes(Object.getPrototypeOf(value));
const own = (o, k) => Object.hasOwn(o, k);
const safeId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value) && !['__proto__','constructor','prototype'].includes(value);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const number = value => Number.isFinite(value);
const validDamage = value => (number(value) && value>=0 && value<=50) || (typeof value==='string' && /^([1-4])d(4|6|8|10|12)([+-][0-9]{1,2})?$/.test(value));
function damageRoll(s,value) {
  if(number(value)) return value;
  const m=value.match(/^([1-4])d(4|6|8|10|12)([+-][0-9]{1,2})?$/);
  let damage=Number(m[3] || 0);for(let i=0;i<Number(m[1]);i++) damage+=roll(s,Number(m[2]));return Math.max(0,damage);
}
const keys = (object, allowed) => {
  if (!plain(object) || Object.keys(object).some(k => !allowed.includes(k))) fail('不允许的字段');
};
export const ACTION_TYPES = Object.freeze(['move','attack','defend','heal','parley','endTurn','travel','choose','rest','finish','mapSave','mapLoad','mapToken','narrate']);
const fields = {
  move:['heroId','x','y'], attack:['heroId','targetId'], defend:['heroId'], heal:['heroId','targetId'],parley:['heroId','resource'],
  endTurn:[], travel:['mapId'], choose:['arcId','optionId','heroId'], rest:[], finish:[], mapSave:['map'], mapLoad:['mapId'], mapToken:['token'],narrate:['text']
};
export function normalizeMaps(maps, campaign) {
  const list = Array.isArray(maps) ? maps : maps?.maps || campaign?.maps || [];
  if (!Array.isArray(list) || !list.length) fail('地图目录为空');
  return list;
}
function mapAt(state, campaign, maps, id = state.mapId) {
  return (state.customMaps && own(state.customMaps,id) && state.customMaps[id]) || normalizeMaps(maps, campaign).find(m => m.id === id) || fail('地图不存在');
}
const inside = (m,p) => Number.isInteger(p.x) && Number.isInteger(p.y) && p.x >= 0 && p.y >= 0 && p.x < m.width && p.y < m.height;
const walkable = (m,p) => inside(m,p) && !'#~c'.includes(m.tiles[p.y][p.x]);
export function validateMap(map) {
  keys(map, ['id','name','width','height','tiles','spawn','exits','points','enemies','description','tokens','subtitle','decorations']);
  if (!safeId(map.id) || typeof map.name !== 'string' || !map.name.trim() || map.name.length > 100) fail('地图标识或名称无效');
  if((map.subtitle!==undefined && (typeof map.subtitle!=='string' || map.subtitle.length>300)) || (map.description!==undefined && (typeof map.description!=='string' || map.description.length>2000))) fail('地图说明文本无效');
  if (!Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 6 || map.height < 6 || map.width > 40 || map.height > 40) fail('地图尺寸必须为6至40');
  if (!Array.isArray(map.tiles) || map.tiles.length !== map.height || map.tiles.some(r => typeof r !== 'string' || r.length !== map.width || /[^.#~r^c2]/.test(r))) fail('地图地形无效');
  if (!plain(map.spawn) || !walkable(map,map.spawn)) fail('出生点不可通行');
  for (const field of ['points','exits','enemies','tokens']) if (map[field] !== undefined && (!Array.isArray(map[field]) || map[field].length > 100)) fail('地图对象数量无效');
  const ids = new Set();
  for (const p of map.points || []) {
    keys(p,['id','x','y','label','description']);
    if (!safeId(p.id) || ids.has(p.id) || !walkable(map,p)) fail('地图点位无效或重复');
    if((p.label!==undefined && (typeof p.label!=='string' || p.label.length>100)) || (p.description!==undefined && (typeof p.description!=='string' || p.description.length>1500))) fail('地图点位文本无效');
    ids.add(p.id);
  }
  for (const e of map.exits || []) if (!safeId(e.to || e.mapId) || !walkable(map,e)) fail('地图出口无效');
  const positions = new Set();
  for (const e of map.enemies || []) {
    if (!safeId(e.id) || ids.has(e.id) || !walkable(map,e) || !number(e.hp) || e.hp <= 0 || !number(e.ac) || !number(e.attack) || !number(e.range ?? 1) || !validDamage(e.damage)) fail('敌人数据无效');
    const p = `${e.x},${e.y}`; if (positions.has(p) || dist(e,map.spawn) === 0) fail('敌人位置重复');
    positions.add(p); ids.add(e.id);
  }
  if((map.tokens || []).length>30 || new Set((map.tokens || []).map(t=>t.id)).size!==(map.tokens || []).length) fail('地图标记重复或过多');
  for(const t of map.tokens || []) {keys(t,['id','x','y','label','color']);if(!safeId(t.id) || !walkable(map,t) || typeof t.label!=='string' || t.label.length>80 || (t.color!==undefined && !/^#[0-9a-fA-F]{6}$/.test(t.color))) fail('地图标记无效');}
  const decorationTypes=['roof','tomb','benches','beam','tree','statue','tripod','brazier','desk','ledger','dock','stairs','valve','gate'];
  if(map.decorations!==undefined && (!Array.isArray(map.decorations) || map.decorations.length>150)) fail('地图装饰必须为至多150项的列表');
  for(const d of map.decorations || []) {
    keys(d,['type','x','y','w','h']);const w=d.w ?? 1,h=d.h ?? 1;
    if(!decorationTypes.includes(d.type) || !inside(map,d) || !Number.isInteger(w) || !Number.isInteger(h) || w<1 || h<1 || d.x+w>map.width || d.y+h>map.height) fail('地图装饰类型、坐标或尺寸无效');
  }
  // Every authored point and exit must be reachable from the spawn.
  const seen = new Set([`${map.spawn.x},${map.spawn.y}`]), queue = [map.spawn];
  for (let i=0; i<queue.length; i++) for (const p of neighbors(queue[i])) {
    const key = `${p.x},${p.y}`;
    if (walkable(map,p) && !seen.has(key)) { seen.add(key); queue.push(p); }
  }
  if ([...(map.points || []),...(map.exits || [])].some(p => !seen.has(`${p.x},${p.y}`))) fail('地图点位或出口不可达');
  return true;
}
function neighbors(p) { return [{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}]; }
function path(state,map,from,to,ignoreId) {
  const occupied = new Set([...state.heroes,...state.enemies].filter(e => e.hp>0 && e.id !== ignoreId).map(e=>`${e.x},${e.y}`));
  const queue = [{...from,cost:0,steps:[]}], best = new Map([[`${from.x},${from.y}`,0]]);
  while (queue.length) {
    queue.sort((a,b)=>a.cost-b.cost); const p=queue.shift();
    if (p.x===to.x && p.y===to.y) return p;
    for (const next of neighbors(p)) {
      const key=`${next.x},${next.y}`;
      if (!walkable(map,next) || occupied.has(key)) continue;
      const cost=p.cost + ('2^'.includes(map.tiles[next.y][next.x])?2:1);
      if (cost < (best.get(key) ?? Infinity)) { best.set(key,cost); queue.push({...next,cost,steps:[...p.steps,next]}); }
    }
  }
  return null;
}
export const LOG_LIMIT=800;
function log(s,text,kind='story') { s.log.push({id:s.revision+1,turn:s.turn,day:s.world.day,kind,text}); s.log=s.log.slice(-LOG_LIMIT); }
function roll(s,faces=20) { s.rngState=(Math.imul(s.rngState,1664525)+1013904223)>>>0; return s.rngState%faces+1; }
function freeSpawn(s,map) {
  const used=new Set(s.enemies.filter(e=>e.hp>0).map(e=>`${e.x},${e.y}`));
  const cells=[]; for(let y=0;y<map.height;y++) for(let x=0;x<map.width;x++) if(walkable(map,{x,y})) cells.push({x,y});
  cells.sort((a,b)=>dist(a,map.spawn)-dist(b,map.spawn));
  for(const h of s.heroes) { const p=cells.find(p=>!used.has(`${p.x},${p.y}`)); if(!p) fail('地图没有队伍空间'); Object.assign(h,p); used.add(`${p.x},${p.y}`); }
}
function enter(s,map) {
  if (s.mapId && s.mapStates) s.mapStates[s.mapId]={enemies:clone(s.enemies),tokens:clone(s.tokens || [])};
  s.mapId=map.id; s.enemies=clone(s.mapStates[map.id]?.enemies ?? (map.enemies || [])).map(e=>({...e,maxHp:e.maxHp ?? e.hp}));
  s.tokens=clone(s.mapStates[map.id]?.tokens || map.tokens || []); freeSpawn(s,map);
  s.combat=s.enemies.some(e=>e.hp>0); s.activeHeroId=s.heroes.find(h=>h.hp>0)?.id; s.turnUsage={move:0,action:false};
}
export function createGame(campaign,maps) {
  validateCampaignFlow(campaign);
  const list=normalizeMaps(maps,campaign), ids=new Set();
  for(const map of list) { validateMap(map); if(ids.has(map.id)) fail('重复地图'); ids.add(map.id); }
  for(const map of list) for(const exit of map.exits || []) if(!ids.has(exit.to || exit.mapId)) fail('出口目标地图不存在');
  if(!Array.isArray(campaign.heroes) || campaign.heroes.length !== 4 || new Set(campaign.heroes.map(h=>h.id)).size!==4) fail('需要四名不同英雄');
  for(const h of campaign.heroes) if(!safeId(h.id) || !number(h.maxHp) || h.maxHp<=0 || !number(h.hp) || h.hp<=0 || h.hp>h.maxHp || !number(h.ac) || !number(h.attack) || !validDamage(h.damage) || !number(h.speed) || h.speed<1) fail('英雄数据无效');
  const initial=campaign.initial || {};
  const s={version:1,revision:0,turn:1,activeHeroId:campaign.heroes[0].id,mapId:null,heroes:clone(campaign.heroes),enemies:[],resources:clone(initial.resources || {coin:8,grain:8,medicine:4}),world:{unrest:0,taint:0,day:1,...clone(initial.world || {})},flags:clone(initial.flags || {}),relations:clone(initial.relations || {hearth:0,temple:0,council:0}),companions:clone(initial.companions || {melia:0,ion:0}),arcs:{},log:[],combat:false,ending:null,customMaps:{},mapStates:{},tokens:[],rngState:20261021,turnUsage:{move:0,action:false}};
  for(const arc of campaign.arcs || []) { if(!safeId(arc.id) || !arc.stages?.length || own(s.arcs,arc.id)) fail('剧情弧无效'); s.arcs[arc.id]={stage:arc.stages[0].id,status:'active'}; }
  s.chapter=1;s.chapterHistory=[];arriveChapter(s,campaign,1);
  enter(s,list.find(m=>m.id==='agora') || list[0]); log(s,campaign.intro || '抵达无葬之城。'); return s;
}
const stageChapter = stage => stage.chapter ?? 1;
const chapterCount = campaign => campaign.chapters?.length || 1;
const deadline = campaign => campaign.deadline ?? 18;
export function validateRequires(requires={}) {
  let count=0;
  function check(r,depth) {
    if(++count>256 || depth>12) fail('条件表达式过于复杂');
    keys(r,['all','any','not','flags','resources','world','relations','companions','arcs']);
    for(const [group,values] of Object.entries(r)) {
      if(group==='all' || group==='any') {if(!Array.isArray(values) || !values.length || values.length>32) fail('逻辑条件列表无效');for(const v of values) check(v,depth+1);continue;}
      if(group==='not') {check(values,depth+1);continue;}
      if(!plain(values) || Object.keys(values).length>100) fail('条件分组无效');
      for(const [key,want] of Object.entries(values)) {
        if(!safeId(key)) fail('条件键无效');
        if(group==='flags') {if(!['string','number','boolean'].includes(typeof want) || (typeof want==='number' && !number(want)) || (typeof want==='string' && want.length>200)) fail('旗标条件值无效');}
        else if(group==='arcs') {if(!['active','complete','failed'].includes(want)) fail('剧情状态条件无效');}
        else if(!number(want)) {keys(want,['min','max']);if(!Object.keys(want).length || !Object.values(want).every(number) || (want.min!==undefined && want.max!==undefined && want.min>want.max)) fail('数值条件范围无效');}
      }
    }
  }
  check(requires,0);return true;
}
export function meets(state,requires={}) {
  validateRequires(requires);
  function evaluate(r) {return Object.entries(r).every(([group,values])=>{
    if(group==='all') return values.every(evaluate);
    if(group==='any') return values.some(evaluate);
    if(group==='not') return !evaluate(values);
    return Object.entries(values).every(([key,want])=>{
    const have=state[group]?.[key];
    if(group==='flags') return have===want;
    if(group==='arcs') return have?.status===want;
    if(number(want)) return number(have) && have>=want;
    if(plain(want) && Object.keys(want).length && Object.keys(want).every(k=>['min','max'].includes(k)) && Object.values(want).every(number)) return number(have) && (want.min===undefined || have>=want.min) && (want.max===undefined || have<=want.max);
    return have===want;
  });});}
  return evaluate(requires);
}
function validateCampaignFlow(campaign) {
  if(!safeId(campaign.id) || !Number.isSafeInteger(campaign.contentVersion ?? 1) || (campaign.contentVersion ?? 1)<1) fail('战役标识或内容版本无效');
  if(!Number.isInteger(deadline(campaign)) || deadline(campaign)<2 || deadline(campaign)>365) fail('战役期限无效');
  if(campaign.chapters!==undefined) {
    if(!Array.isArray(campaign.chapters) || !campaign.chapters.length || campaign.chapters.length>8 || new Set(campaign.chapters.map(c=>c.id)).size!==campaign.chapters.length) fail('章节列表无效');
    for(const [index,ch] of campaign.chapters.entries()) if(!plain(ch) || !safeId(ch.id) || ch.number!==index+1 || typeof ch.title!=='string') fail('章节编号必须连续');
  }
  for(const arc of campaign.arcs || []) {
    if(!Array.isArray(arc.stages) || !arc.stages.length || new Set(arc.stages.map(st=>st.id)).size!==arc.stages.length) fail('剧情阶段列表无效');
    for(const st of arc.stages) {
      if(!safeId(st.id) || !Number.isInteger(stageChapter(st)) || stageChapter(st)<1 || stageChapter(st)>chapterCount(campaign) || (campaign.chapters && st.chapter===undefined) || !Array.isArray(st.options) || !st.options.length) fail('剧情阶段章节或选项无效');
      for(const o of st.options) {
        if(!safeId(o.id)) fail('剧情选项标识无效');validateRequires(o.requires || {});
        for(const next of [o.next,...(o.check?.failNext?[o.check.failNext]:[])]) if(!['complete','failed'].includes(next)) {const target=arc.stages.find(s=>s.id===next);if(!target || arc.stages.indexOf(target)<=arc.stages.indexOf(st) || stageChapter(target)<stageChapter(st) || stageChapter(target)>stageChapter(st)+1) fail('剧情后继不可倒退或跨越章节');}
      }
    }
    if(stageChapter(arc.stages[0])!==1 || (campaign.chapters && Array.from({length:chapterCount(campaign)},(_,i)=>i+1).some(n=>!arc.stages.some(st=>stageChapter(st)===n)))) fail('每条主线需要涵盖各章');
  }
  for(const ending of campaign.endings || []) validateRequires(ending.requires || {});
}
function arriveChapter(s,campaign,number) {
  if(s.chapterHistory.some(entry=>entry.number===number)) {s.chapter=number;return;}
  s.chapter=number;
  const entry={number,enteredDay:s.world.day,arrivalApplied:true,outcomes:{}};s.chapterHistory.push(entry);
  const chapter=campaign.chapters?.[number-1];
  if(chapter?.arrivalEffects) effect(s,chapter.arrivalEffects);
  if(chapter) log(s,`第${number}章 · ${chapter.title}。${chapter.summary || ''}${chapter.arrivalEffects?` 公开入章变化：${JSON.stringify(chapter.arrivalEffects)}`:''}`,'chapter');
}
function chapterEntry(s) {return s.chapterHistory?.find(entry=>entry.number===(s.chapter || 1));}
function chapterProgress(s,campaign) {
  if(s.ending || s.combat) return;
  for(let guard=0;guard<chapterCount(campaign);guard++) {
    const current=s.chapter || 1;
    const pending=campaign.arcs.some(a=>s.arcs[a.id].status==='active' && stageChapter(a.stages.find(st=>st.id===s.arcs[a.id].stage))<=current);
    if(pending) return;
    const history=chapterEntry(s);if(history && history.completedDay===undefined) history.completedDay=s.world.day;
    if(current>=chapterCount(campaign)) return;
    arriveChapter(s,campaign,current+1);
  }
}
function effect(s,effects={}) {
  keys(effects,['resources','world','relations','companions','flags']);
  for(const [group,entries] of Object.entries(effects)) {
    if(!plain(entries)) fail('效果格式无效');
    for(const [key,value] of Object.entries(entries)) {
      if(!safeId(key)) fail('效果键无效');
      if(group==='flags') { if(!['string','number','boolean'].includes(typeof value) || (typeof value==='number' && !number(value))) fail('旗标值无效'); s.flags[key]=value; }
      else { if(!own(s[group],key) || !number(value)) fail('效果数值无效'); const n=s[group][key]+value; if(group==='resources' && n<0) fail('资源不足'); s[group][key]=Math.max(group==='world'?0:-99,Math.min(999,n)); }
    }
  }
}
function cost(s,costs={}) {
  if(!plain(costs)) fail('成本无效');
  for(const [key,n] of Object.entries(costs)) if(!own(s.resources,key) || !Number.isInteger(n) || n<0 || s.resources[key]<n) fail('资源不足或成本无效');
  for(const [key,n] of Object.entries(costs)) s.resources[key]-=n;
}
function owner(s,seat,id,combatAction=true) {
  const h=s.heroes.find(h=>h.id===id) || fail('英雄不存在');
  if(seat.role!=='dm' && !seat.heroIds?.includes(id)) fail('无权控制这名英雄');
  if(h.hp<=0) fail('英雄已倒下');
  if(s.combat && combatAction && s.activeHeroId!==id) fail('尚未轮到这名英雄');
  return h;
}
function spend(s) { if(s.combat && s.turnUsage.action) fail('本回合行动已使用'); if(s.combat) s.turnUsage.action=true; }
function lineOfSight(map,a,b) {
  let x=a.x,y=a.y,dx=Math.abs(b.x-x),dy=Math.abs(b.y-y),sx=x<b.x?1:-1,sy=y<b.y?1:-1,err=dx-dy;
  while(x!==b.x || y!==b.y) { const e=2*err; if(e>-dy) {err-=dy;x+=sx;} if(e<dx) {err+=dx;y+=sy;} if('#c'.includes(map.tiles[y]?.[x])) return false; }
  return true;
}
function strike(s,attacker,target,map) {
  const die=roll(s), cover=neighbors(target).some(p=>map.tiles[p.y]?.[p.x]==='c')?2:0;
  const hit=die===20 || (die!==1 && die+(attacker.attack || 0)>=target.ac+cover+(target.defending?2:0));
  const damage=hit?Math.max(1,damageRoll(s,attacker.damage ?? 1)+(die===20?roll(s,6):0)):0;
  const previousHp=target.hp;target.hp=Math.max(0,target.hp-damage);recordBattleEffect(s,{kind:hit?'damage':'miss',actor:attacker,target,method:'普通攻击',...(hit?{amount:previousHp-target.hp}:{})}); log(s,`${attacker.name} 掷 ${die}${attacker.attack>=0?'+':''}${attacker.attack}，${hit?`命中 ${target.name}，造成 ${damage} 伤害`:`未击中 ${target.name}`}。`,'combat');
}
function enemyTurn(s,map) {
  for(const e of s.enemies.filter(e=>e.hp>0)) {
    const living=s.heroes.filter(h=>h.hp>0); if(!living.length) break;
    living.sort((a,b)=>dist(e,a)-dist(e,b)); const target=living[0], range=e.range || 1;
    if(dist(e,target)>range || !lineOfSight(map,e,target)) {
      let best=null; for(const h of living) for(const p of neighbors(h)) { const route=path(s,map,e,p,e.id); if(route && (!best || route.cost<best.cost)) best=route; }
      if(best) { let movement=0; for(const p of best.steps) { movement+=('2^'.includes(map.tiles[p.y][p.x])?2:1); if(movement>(e.speed || 3)) break; e.x=p.x;e.y=p.y; } }
    }
    const victim=s.heroes.filter(h=>h.hp>0 && dist(e,h)<=range && lineOfSight(map,e,h)).sort((a,b)=>dist(e,a)-dist(e,b))[0];
    if(victim) strike(s,e,victim,map);
  }
  s.turn++; s.heroes.forEach(h=>{h.defending=false;}); s.activeHeroId=s.heroes.find(h=>h.hp>0)?.id; s.turnUsage={move:0,action:false};
}
function resolve(s,campaign,maps) {
  const wasCombat=s.combat;s.combat=s.enemies.some(e=>e.hp>0);
  if(wasCombat&&!s.combat)recordBattleEffect(s,{kind:'battle-end',result:s.enemies.some(e=>e.status==='withdrawn')?'ended':'victory'});
  if(!s.combat) s.turnUsage={move:0,action:false};
  if(!s.heroes.some(h=>h.hp>0)) {
    recordBattleEffect(s,{kind:'battle-end',result:'defeat'});
    s.heroes.forEach(h=>{const previousHp=h.hp;h.hp=Math.max(1,Math.ceil(h.maxHp/2));h.defending=false;recordBattleEffect(s,{kind:'healing',target:h,actorName:'规则救援',method:'梅莉娅救援',amount:Math.max(0,h.hp-previousHp),...(previousHp<=0?{statusesRemoved:['倒下']}:{})});}); s.world.day+=2; s.world.unrest++; s.resources.grain=Math.max(0,s.resources.grain-2);
    enter(s,mapAt(s,campaign,maps,'agora')); log(s,'队伍全员倒下。梅莉娅把众人带回集市；两日流逝，粮食损失2，城中动荡增加。','system');
  }
  if(s.world.day>=deadline(campaign) && !s.ending) {
    const completed=[],lost=[];
    for(const [id,arc] of Object.entries(s.arcs)) {
      if(arc.status==='active') {
        const authored=campaign.arcs.find(a=>a.id===id),st=authored.stages.find(st=>st.id===arc.stage);
        if(stageChapter(st)<=(s.chapter || 1)) {s.flags[`${id}_c${s.chapter || 1}_failed`]=true;if(chapterEntry(s)) chapterEntry(s).outcomes[id]='failed';}
        arc.status='failed';s.flags[`${id}_failed`]=true;lost.push(authored.title || id);
      }
      else if(arc.status==='complete') completed.push(campaign.arcs.find(a=>a.id===id)?.title || id);
    }
    s.ending={id:'time_failure',title:`第${deadline(campaign)}日：封城钟声`,text:`第${deadline(campaign)}日城门封闭。${lost.length?`未完成的${lost.join('、')}宣告失败。`:'三条线已留下结论，却未能及时举行最后的公议。'}${completed.length?`已经完成的${completed.join('、')}仍被城民记住；此前的决定与代价保留。`:'无葬者继续等待迟来的回答。'}已走过的章节成果与损失仍保留。`};log(s,s.ending.text,'ending');
  }
  chapterProgress(s,campaign);
  if(!s.activeHeroId || !s.heroes.some(h=>h.id===s.activeHeroId && h.hp>0)) s.activeHeroId=s.heroes.find(h=>h.hp>0)?.id;
}
function stageFor(s,campaign,id) {
  const arc=campaign.arcs.find(a=>a.id===id),progress=s.arcs[id];if(!arc || progress?.status!=='active') fail('剧情弧不可推进');
  const stage=arc.stages.find(st=>st.id===progress.stage) || fail('剧情阶段不存在');
  if(stageChapter(stage)!==(s.chapter || 1)) fail('等待其他主线完成本章');
  return {arc,progress,stage};
}
export function act(state,action,seat,campaign,maps,previewToken) {
  if(!plain(seat) || !['dm','player'].includes(seat.role) || !Array.isArray(seat.heroIds)) fail('席位无效');
  if(!plain(action) || !ACTION_TYPES.includes(action.type)) fail('未知行动');
  keys(action,['type',...fields[action.type]]);
  if(state.ending) fail('故事已经结束');
  const preview=previewToken===LEDGER_PREVIEW;const {battleReport:ignoredReport,...withoutReport}=state;const s=clone(preview?withoutReport:state),map=mapAt(s,campaign,maps);if(!preview)beginBattleCapture(s);
  if(['mapSave','mapLoad','mapToken','narrate'].includes(action.type) && seat.role!=='dm') fail('仅主持人可执行此游戏主持动作');
  switch(action.type) {
    case 'narrate': {
      if(typeof action.text!=='string' || !action.text.trim() || action.text.length>1500) fail('主持叙事需1至1500字');log(s,action.text,'dm');break;
    }
    case 'move': {
      const h=owner(s,seat,action.heroId),route=path(s,map,h,action,h.id);
      if(!walkable(map,action) || !route || route.cost===0 || route.cost>(s.combat?h.speed-s.turnUsage.move:map.width*map.height*2)) fail('目的地不可达或超出移动力');
      h.x=action.x; h.y=action.y; if(s.combat) s.turnUsage.move+=route.cost;
      log(s,`${h.name} 移动到 (${h.x}, ${h.y})。`,'move'); break;
    }
    case 'attack': {
      const h=owner(s,seat,action.heroId),e=s.enemies.find(e=>e.id===action.targetId && e.hp>0) || fail('目标不存在或已倒下');
      if(dist(h,e)>(h.range || 1) || !lineOfSight(map,h,e)) fail('目标超出射程或被墙遮挡'); spend(s);strike(s,h,e,map);break;
    }
    case 'defend': { const h=owner(s,seat,action.heroId);spend(s);h.defending=true;log(s,`${h.name} 防御，直到敌人回合结束护甲+2。`,'combat');break; }
    case 'heal': {
      const h=owner(s,seat,action.heroId),t=s.heroes.find(h=>h.id===action.targetId) || fail('治疗目标不存在');
      if(t.hp<=0 && [...s.heroes,...s.enemies].some(e=>e.id!==t.id && e.hp>0 && dist(e,t)===0)) fail('倒地队友的位置被占据，需先清空');
      if(dist(h,t)>2 || t.hp>=t.maxHp) fail('治疗目标太远或无需治疗'); cost(s,{medicine:1});spend(s);
      const aid=s.companions.melia>=2?2:0,previousHp=t.hp;t.hp=Math.min(t.maxHp,t.hp+6+aid);recordBattleEffect(s,{kind:'healing',actor:h,target:t,method:'药物治疗',amount:t.hp-previousHp});log(s,`${h.name} 消耗1药物，为 ${t.name} 恢复${6+aid}生命。${aid?'梅莉娅信任你们，协助包扎+2。':s.companions.melia<=-3?'梅莉娅拒绝协助，由英雄自行包扎。':''}`,'combat');break;
    }
    case 'parley': {
      const h=owner(s,seat,action.heroId),enemies=s.enemies.filter(e=>e.hp>0);
      if(!s.combat || !enemies.length || enemies.some(e=>e.parley!==true)) fail('这场战斗的敌人不接受交涉');
      if(Math.min(...enemies.map(e=>dist(h,e)))>6) fail('需要在敌人六格内交涉');
      if(!['grain','coin'].includes(action.resource)) fail('交涉只能使用粮食或银币');
      const amount=action.resource==='grain'?2:3;cost(s,{[action.resource]:amount});spend(s);
      enemies.forEach(e=>{e.hp=0;e.status='withdrawn';recordBattleEffect(s,{kind:'status',actor:h,target:e,method:'交涉',statusesAdded:['已撤离']});});log(s,`${h.name} 支付${amount}${action.resource==='grain'?'粮食':'银币'}完成交涉。敌人撤离，未被杀死；这场战斗结束。`,'combat');break;
    }
    case 'endTurn': {
      if(!s.combat) fail('当前没有战斗'); owner(s,seat,s.activeHeroId);
      const index=s.heroes.findIndex(h=>h.id===s.activeHeroId),next=s.heroes.slice(index+1).find(h=>h.hp>0);
      if(next) {s.activeHeroId=next.id;s.turnUsage={move:0,action:false};} else enemyTurn(s,map); break;
    }
    case 'travel': {
      if(s.combat) fail('战斗中不能旅行'); if(!map.exits?.some(e=>(e.to || e.mapId)===action.mapId)) fail('这里没有通向目标的道路');
      if(seat.role!=='dm' && !s.heroes.some(h=>seat.heroIds.includes(h.id) && h.hp>0)) fail('没有可行动英雄');
      enter(s,mapAt(s,campaign,maps,action.mapId));log(s,`队伍抵达${mapAt(s,campaign,maps).name}。`);break;
    }
    case 'choose': {
      if(s.combat) fail('先结束战斗，才能继续剧情');
      const h=owner(s,seat,action.heroId),{arc,stage,progress}=stageFor(s,campaign,action.arcId);
      const p=map.points?.find(p=>p.id===stage.pointId);
      if(stage.mapId!==s.mapId || !p || dist(h,p)>2) fail('需要靠近本阶段剧情点（两格内）');
      const option=stage.options.find(o=>o.id===action.optionId) || fail('选项不存在');
      if(!meets(s,option.requires || {})) fail('未满足选项前提');
      cost(s,option.cost);spend(s);
      let success=true;
      if(option.check) { const die=roll(s),aid=s.companions.ion>=2?1:s.companions.ion<=-3?-1:0,bonus=(h.skills?.[option.check.skill] || 0)+aid;success=die+bonus>=option.check.dc;log(s,`${h.name} 的 ${option.check.skill} 检定：${die}+${bonus} / DC ${option.check.dc}，${success?'成功':'失败'}。${aid>0?'伊昂提供见证，检定+1。':aid<0?'伊昂拒绝作证，检定-1。':''}`,'check'); }
      effect(s,success?option.effects:option.check.failEffects);
      log(s,`${arc.title}：${option.label}。${success?(option.text || ''):(option.check.failText || '承担失败的代价。')}`);
      const next=(!success && option.check?.failNext) || option.next,currentChapter=s.chapter || 1;
      if(next==='complete' || next==='failed') {
        if(currentChapter<chapterCount(campaign)) {
          const nextStage=arc.stages.find(st=>stageChapter(st)===currentChapter+1) || fail('本弧没有下一章入口');progress.stage=nextStage.id;
          if(next==='failed') s.flags[`${arc.id}_c${currentChapter}_failed`]=true;
        } else progress.status=next;
      } else {const target=arc.stages.find(st=>st.id===next) || fail('剧情后继不存在');if(stageChapter(target)<currentChapter || stageChapter(target)>currentChapter+1) fail('剧情不能倒退或越章');progress.stage=next;}
      if(progress.status!=='active' || stageChapter(arc.stages.find(st=>st.id===progress.stage))>currentChapter) {
        if(chapterEntry(s)) chapterEntry(s).outcomes[arc.id]=(next==='failed' || s.flags[`${arc.id}_c${currentChapter}_failed`]===true)?'failed':'complete';
      }
      if(option.encounter?.length) {
        for(const enemy of option.encounter) {
          if(!safeId(enemy.id) || s.enemies.some(e=>e.id===enemy.id) || !walkable(map,enemy) || [...s.enemies,...s.heroes].some(e=>e.hp>0 && dist(e,enemy)===0) || !number(enemy.hp) || enemy.hp<=0 || !validDamage(enemy.damage) || !number(enemy.ac) || !number(enemy.attack)) fail('遭遇敌人无效或位置被占');
          s.enemies.push({...clone(enemy),maxHp:enemy.maxHp ?? enemy.hp});
        }
      }
      s.world.day++; break;
    }
    case 'rest': {
      if(s.combat) fail('战斗中不能休整'); if(seat.role!=='dm' && !seat.heroIds.length) fail('无可控制英雄');cost(s,{grain:2});s.heroes.forEach(h=>{h.hp=h.maxHp;h.defending=false;});s.world.day++;log(s,'消耗2粮食休整一日，全队恢复。');break;
    }
    case 'finish': {
      if(s.combat || (s.chapter || 1)!==chapterCount(campaign) || Object.values(s.arcs).some(a=>a.status==='active')) fail('需要先完成最后一章三条剧情线并结束战斗');
      const endings=campaign.endings.filter(e=>meets(s,e.requires || {}));if(campaign.chapters && endings.length>1) fail('终局条件不互斥，拒绝选择含混的结局');const ending=endings[0];if(!ending) fail('没有符合条件的终局');s.ending=clone(ending);log(s,`${ending.title}：${ending.text}`,'ending');break;
    }
    case 'mapSave': {
      validateMap(action.map); if(normalizeMaps(maps,campaign).some(m=>m.id===action.map.id)) fail('不能覆盖剧情地图');
      if(Object.keys(s.customMaps).length>=12 && !own(s.customMaps,action.map.id)) fail('自定义地图已达上限');
      for(const e of action.map.exits || []) mapAt(s,campaign,maps,e.to || e.mapId);
      s.customMaps[action.map.id]=clone(action.map);delete s.mapStates[action.map.id];
      if(s.mapId===action.map.id) {s.enemies=clone(action.map.enemies || []).map(e=>({...e,maxHp:e.maxHp ?? e.hp}));s.tokens=clone(action.map.tokens || []);freeSpawn(s,action.map);s.activeHeroId=s.heroes.find(h=>h.hp>0)?.id;s.turnUsage={move:0,action:false};}
      log(s,`主持人保存地图：${action.map.name}。`,'system');break;
    }
    case 'mapLoad': {if(s.combat) fail('战斗中不能载入地图');enter(s,mapAt(s,campaign,maps,action.mapId));log(s,'主持人载入地图。','system');break;}
    case 'mapToken': {
      const t=action.token;keys(t,['id','x','y','label','color']);
      if(!safeId(t.id) || !walkable(map,t) || typeof t.label!=='string' || t.label.length>80 || (t.color!==undefined && !/^#[0-9a-fA-F]{6}$/.test(t.color))) fail('地图标记无效');
      const i=s.tokens.findIndex(x=>x.id===t.id); if(i<0) {if(s.tokens.length>=30) fail('标记已达上限');s.tokens.push(clone(t));} else s.tokens[i]=clone(t);log(s,'主持人更新地图标记。','system');break;
    }
  }
  resolve(s,campaign,maps);s.revision=state.revision+1;if(!preview)captureBattleTransition(state,s,action,{actorId:action.heroId || (action.type==='endTurn'?state.activeHeroId:null),targetId:action.targetId});return s;
}
export function legalActions(state,seat,campaign,maps) {
  if(state.ending) return [];
  const result=[],map=mapAt(state,campaign,maps),owned=state.heroes.filter(h=>h.hp>0 && (seat.role==='dm' || seat.heroIds.includes(h.id)) && (!state.combat || h.id===state.activeHeroId));
  const add=action=>{try {act(state,action,seat,campaign,maps,LEDGER_PREVIEW);result.push(action);} catch {}};
  for(const h of owned) {
    for(const p of neighbors(h)) add({type:'move',heroId:h.id,...p});
    for(const e of state.enemies.filter(e=>e.hp>0)) add({type:'attack',heroId:h.id,targetId:e.id});
    add({type:'defend',heroId:h.id});for(const t of state.heroes) add({type:'heal',heroId:h.id,targetId:t.id});
    for(const resource of ['grain','coin']) add({type:'parley',heroId:h.id,resource});
    for(const arc of campaign.arcs || []) if(state.arcs[arc.id]?.status==='active') { const st=arc.stages.find(st=>st.id===state.arcs[arc.id].stage); for(const o of st.options) add({type:'choose',arcId:arc.id,optionId:o.id,heroId:h.id}); }
  }
  add({type:'endTurn'});add({type:'rest'});add({type:'finish'});for(const e of map.exits || []) add({type:'travel',mapId:e.to || e.mapId});
  return result;
}
export function view(state,seat,campaign,maps) {
  const result=clone(state);result.battleReport=publicBattleReport(state,{privileged:seat.role==='dm'});result.seat=clone(seat);result.legalActions=legalActions(state,seat,campaign,maps);
  result.availableChoices=(campaign.arcs || []).filter(a=>state.arcs[a.id]?.status==='active').map(a=>{
    const st=a.stages.find(st=>st.id===state.arcs[a.id].stage);
    const waiting=stageChapter(st)>(state.chapter || 1);
    return {arcId:a.id,stageId:st.id,chapter:stageChapter(st),waiting,mapId:st.mapId,pointId:st.pointId,options:st.options.map(o=>({...clone(o),available:result.legalActions.some(x=>x.type==='choose' && x.arcId===a.id && x.optionId===o.id),reason:waiting?'等待其他主线完成本章':!meets(state,o.requires || {})?'未满足条件':'靠近剧情点并使用当前可控英雄'}))};
  });
  return result;
}

// Validate untrusted disk state BEFORE it enters the authoritative room store.
export function validateState(s,campaign,maps) {
  keys(s,['version','revision','turn','activeHeroId','mapId','heroes','enemies','resources','world','flags','relations','companions','arcs','log','combat','ending','customMaps','mapStates','tokens','rngState','turnUsage','chapter','chapterHistory','battleReport']);
  if(s.battleReport!==undefined&&(!plain(s.battleReport)||s.battleReport.schema!==1||!Array.isArray(s.battleReport.events)||s.battleReport.events.length>200||!Array.isArray(s.battleReport.summaries)||s.battleReport.summaries.length>16||JSON.stringify(s.battleReport).length>524288))fail('存档结算记录无效');
  if(s.version!==1 || !Number.isSafeInteger(s.revision) || s.revision<0 || !Number.isSafeInteger(s.turn) || s.turn<1 || !Number.isInteger(s.rngState) || s.rngState<0 || s.rngState>0xffffffff) fail('存档版本、修订或随机状态无效');
  const base=normalizeMaps(maps,campaign),known=new Set(base.map(m=>m.id));
  if(!plain(s.customMaps) || Object.keys(s.customMaps).length>12) fail('存档自定义地图无效');
  for(const [id,m] of Object.entries(s.customMaps)) {if(id!==m.id || known.has(id)) fail('存档地图标识冲突');validateMap(m);known.add(id);}
  for(const m of [...base,...Object.values(s.customMaps)]) for(const e of m.exits || []) if(!known.has(e.to || e.mapId)) fail('存档地图出口无效');
  if(!safeId(s.mapId) || !known.has(s.mapId)) fail('存档当前地图无效');
  const current=mapAt(s,campaign,maps);
  function numericGroup(group,expected,min) {
    const values=s[group];if(!plain(values) || Object.keys(values).sort().join('|')!==Object.keys(expected).sort().join('|') || Object.values(values).some(v=>!Number.isInteger(v) || v<min || v>999)) fail(`存档${group}数值无效`);
  }
  numericGroup('resources',campaign.initial?.resources || {coin:0,grain:0,medicine:0},0);
  numericGroup('world',{unrest:0,taint:0,day:1,...campaign.initial?.world},0);
  numericGroup('relations',campaign.initial?.relations || {hearth:0,temple:0,council:0},-99);
  numericGroup('companions',campaign.initial?.companions || {melia:0,ion:0},-99);
  if(!plain(s.flags) || Object.keys(s.flags).length>500 || Object.entries(s.flags).some(([k,v])=>!safeId(k) || !['boolean','number','string'].includes(typeof v) || (typeof v==='number' && !number(v)) || (typeof v==='string' && v.length>200))) fail('存档旗标无效');
  function actors(entities,map,heroes=false) {
    if(!Array.isArray(entities) || entities.length>(heroes?4:100)) fail('存档角色列表无效');const ids=new Set();
    for(const e of entities) {
      if(!plain(e) || !safeId(e.id) || ids.has(e.id) || !walkable(map,e) || typeof e.name!=='string' || e.name.length>100 || !number(e.hp) || e.hp<0 || !number(e.maxHp ?? e.hp) || (e.maxHp ?? e.hp)<1 || e.hp>(e.maxHp ?? e.hp) || !number(e.ac) || !number(e.attack) || !validDamage(e.damage) || !number(e.range ?? 1) || (e.range ?? 1)<1 || !number(e.speed ?? 3) || (e.speed ?? 3)<1 || (e.parley!==undefined && typeof e.parley!=='boolean')) fail('存档角色属性或位置无效');
      ids.add(e.id);
      if(heroes) {const original=campaign.heroes.find(h=>h.id===e.id);if(!original || ['maxHp','ac','attack','range','speed','damage'].some(k=>e[k]!==original[k]) || JSON.stringify(e.skills)!==JSON.stringify(original.skills)) fail('存档英雄模板无效');}
    }
    return ids;
  }
  if(!Array.isArray(s.heroes) || s.heroes.length!==4) fail('存档需要四英雄');actors(s.heroes,current,true);actors(s.enemies,current);
  if(!s.heroes.some(h=>h.hp>0 && h.id===s.activeHeroId) || typeof s.combat!=='boolean' || s.combat!==s.enemies.some(e=>e.hp>0)) fail('存档回合状态无效');
  const occupied=new Set();for(const e of [...s.heroes,...s.enemies].filter(e=>e.hp>0)) {const p=`${e.x},${e.y}`;if(occupied.has(p)) fail('存档角色位置重叠');occupied.add(p);}
  function tokens(values,map) {if(!Array.isArray(values) || values.length>30 || new Set(values.map(t=>t.id)).size!==values.length || values.some(t=>!plain(t) || !safeId(t.id) || !walkable(map,t) || typeof t.label!=='string' || t.label.length>80 || (t.color!==undefined && !/^#[0-9a-fA-F]{6}$/.test(t.color)))) fail('存档地图标记无效');}
  tokens(s.tokens,current);
  if(!plain(s.mapStates) || Object.keys(s.mapStates).length>base.length+12) fail('存档地图缓存无效');
  for(const [id,entry] of Object.entries(s.mapStates)) {if(!known.has(id) || !plain(entry)) fail('存档地图缓存标识无效');const m=mapAt(s,campaign,maps,id);actors(entry.enemies,m);tokens(entry.tokens || [],m);}
  if(!plain(s.arcs) || Object.keys(s.arcs).sort().join('|')!==campaign.arcs.map(a=>a.id).sort().join('|')) fail('存档剧情列表无效');
  for(const arc of campaign.arcs) {const progress=s.arcs[arc.id];if(!plain(progress) || !['active','complete','failed'].includes(progress.status) || !arc.stages.some(st=>st.id===progress.stage)) fail('存档剧情阶段无效');}
  if(!Number.isInteger(s.chapter) || s.chapter<1 || s.chapter>chapterCount(campaign) || !Array.isArray(s.chapterHistory) || s.chapterHistory.length!==s.chapter) fail('存档章节状态无效');
  for(const [index,h] of s.chapterHistory.entries()) {
    keys(h,['number','enteredDay','arrivalApplied','outcomes','completedDay']);
    if(h.number!==index+1 || !Number.isInteger(h.enteredDay) || h.enteredDay<0 || h.enteredDay>s.world.day || h.arrivalApplied!==true || !plain(h.outcomes) || Object.entries(h.outcomes).some(([id,outcome])=>!own(s.arcs,id) || !['complete','failed'].includes(outcome)) || (h.completedDay!==undefined && (!Number.isInteger(h.completedDay) || h.completedDay<h.enteredDay || h.completedDay>s.world.day)) || (h.number<s.chapter && (h.completedDay===undefined || Object.keys(h.outcomes).length!==campaign.arcs.length))) fail('存档章节历史无效');
    if(index>0 && h.enteredDay<s.chapterHistory[index-1].completedDay) fail('存档章节日期倒退');
  }
  if(s.ending?.id!=='time_failure') for(const arc of campaign.arcs) {
    const p=s.arcs[arc.id],st=arc.stages.find(st=>st.id===p.stage),n=stageChapter(st),outcome=chapterEntry(s).outcomes[arc.id];
    if(p.status==='active' && (n<s.chapter || n>s.chapter+1 || (n>s.chapter && !outcome) || (n===s.chapter && outcome!==undefined))) fail('存档剧情越章或等待状态无效');
    if(p.status!=='active' && campaign.chapters && (s.chapter!==chapterCount(campaign) || n!==s.chapter)) fail('存档主线过早终结');
  }
  if(!plain(s.turnUsage) || !Number.isInteger(s.turnUsage.move) || s.turnUsage.move<0 || s.turnUsage.move>100 || typeof s.turnUsage.action!=='boolean') fail('存档行动点无效');
  if(!Array.isArray(s.log) || s.log.length>LOG_LIMIT || s.log.some(l=>!plain(l) || typeof l.text!=='string' || l.text.length>20000 || !Number.isInteger(l.turn) || !Number.isInteger(l.day))) fail('存档日志无效');
  if(s.ending!==null && (!plain(s.ending) || !safeId(s.ending.id) || !['time_failure',...campaign.endings.map(e=>e.id)].includes(s.ending.id) || typeof s.ending.title!=='string' || typeof s.ending.text!=='string')) fail('存档终局无效');
  return true;
}
