/* Deterministic, bounded presentation records of committed engine results.
 * No network, credentials, wall-clock values, or new game rules live here.
 */
const collectors = new WeakMap();
const EVENT_LIMIT = 200, SUMMARY_LIMIT = 16, SEEN_LIMIT = 120;
const clean = (value, max = 180) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, max);
const copy = value => structuredClone(value);
const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const entities = state => {
  const groups = [[state?.actors,'unknown'],[state?.party,'party'],[state?.heroes,'party'],[state?.enemies,'enemy'],[state?.combat?.enemies,'enemy'],[state?.battle?.enemies,'enemy']];
  const found = new Map();
  for (const [group,side] of groups) if (Array.isArray(group)) for (const actor of group) if (actor && typeof actor.id === 'string') found.set(actor.id,actor.side ? actor : {...actor,side});
  return [...found.values()];
};
const statuses = actor => {
  const values = [];
  const source = actor.conditions || actor.statuses || [];
  for (const item of Array.isArray(source) ? source : Object.keys(source).filter(key=>source[key])) {
    const name = typeof item === 'string' ? item : item?.name || item?.condition || item?.id;
    if (name) values.push(clean(name, 100));
  }
  for (const effect of Array.isArray(actor.effects) ? actor.effects : []) {
    if (isHidden(effect) || effect?.visibility === 'owner') continue;
    if (effect?.condition) values.push(clean(effect.condition,100));
    if (effect?.spell) values.push(`法术效果：${clean(effect.name || effect.spell,90)}`);
  }
  for (const [key, label] of [['prone','倒地'],['dead','死亡'],['down','倒下'],['defending','防御'],['guarding','防御'],['guard','防御'],['dodge','闪避'],['burning','燃烧'],['sapped','削弱'],['disengaged','撤离'],['stable','伤势稳定'],['departed','离场']]) if (actor[key] === true) values.push(label);
  if (actor.concentration?.spell) values.push(`专注：${clean(actor.concentration.spell,90)}`);
  if (typeof actor.status === 'string') values.push(actor.status === 'withdrawn' ? '已撤离' : clean(actor.status,100));
  return [...new Set(values)].sort();
};
const isHidden = actor => !!(actor?.hidden || actor?.secret || actor?.visibility === 'dm' || actor?.visibility === 'gm');
const visibilityRecord = actor => actor ? {id:clean(actor.id,100),side:clean(actor.side,30),hidden:!!actor.hidden,secret:!!actor.secret,visibility:clean(actor.visibility,30),...(Array.isArray(actor.ownerActorIds)?{ownerActorIds:actor.ownerActorIds.map(v=>clean(v,100)).slice(0,16)}:{}),...(Array.isArray(actor.actorIds)?{actorIds:actor.actorIds.map(v=>clean(v,100)).slice(0,16)}:{}),...(actor.actorId?{actorId:clean(actor.actorId,100)}:{})} : null;

export function battleSnapshot(state) {
  if (state?.__battleSnapshot === 1) return state;
  const battle = state?.battle || state?.combat;
  return {
    __battleSnapshot: 1, revision: finite(state?.revision) ?? 0,
    active: !!battle && state?.phase !== 'defeat' && state?.phase !== 'exploration',
    battleId: battle && typeof battle === 'object' ? clean(battle.id || battle.encounterId || '', 100) : '',
    scene: clean(state?.sceneId || state?.scene || state?.mapId || '', 100),
    actors: entities(state).map(actor => ({...visibilityRecord(actor),id: actor.id, name: clean(actor.name || actor.label || actor.id), hp: finite(actor.hp), side: actor.side || (state?.enemies?.includes(actor) ? 'enemy' : 'party'), hidden: isHidden(actor), withdrawn:actor.status === 'withdrawn' || !!actor.departed, statuses: statuses(actor)})),
  };
}

export function beginBattleCapture(state) { if (state && typeof state === 'object') collectors.set(state, []); }
export function recordBattleEffect(state, effect) {
  const collector = collectors.get(state);
  if (!collector || collector.length >= 180 || !effect || typeof effect !== 'object') return;
  const actor = effect.actor, target = effect.target;
  collector.push({...effect, actorId: effect.actorId || effect.sourceId || actor?.id || null, targetId: effect.targetId || target?.id || null,
    actorName: effect.actorName || actor?.name, targetName: effect.targetName || target?.name,
    visibility: effect.visibility || (isHidden(actor) || isHidden(target) ? 'gm' : 'all'),
    _combatActive: !!(state.battle || state.combat),
    _combatId: clean(state.battle?.id || state.combat?.id || '', 100),
    ...(effect.kind === 'damage' && effect.amount > 0 && target?.hp === 0 ? {statusesAdded:[...new Set([...(effect.statusesAdded || []),target.dead ? '死亡' : '倒下'])]} : {}),
  });
}

function emptyReport() { return {schema: 1, events: [], summaries: [], currentBattleId: null, _battleSeq: 0, _seq: 0, _seen: [], _totals: null, _contributions:null}; }
function totals() { return {actions: 0, damageByActor: {}, damageTakenByActor: {}, healingByActor: {}, statusChanges: []}; }
function addAmount(group, id, name, amount) {
  if (!(amount > 0)) return;
  const key = id ? clean(id, 100) : '__rules__';
  if (!Object.hasOwn(group, key)) {
    if (Object.keys(group).length >= 120) return;
    Object.defineProperty(group, key, {value: {actorId: id ? key : null, actorName: id ? clean(name || id) : '规则结算', amount: 0}, enumerable: true, writable: true});
  }
  group[key].amount += amount;
}
function account(target, event) {
  if (event.kind === 'damage') { addAmount(target.damageByActor, event.actorId, event.actorName, event.amount); addAmount(target.damageTakenByActor, event.targetId, event.targetName, event.amount); }
  if (event.kind === 'healing') addAmount(target.healingByActor, event.actorId, event.actorName, event.amount);
  if ((event.statusesAdded?.length || event.statusesRemoved?.length) && target.statusChanges.length < 64) target.statusChanges.push({actorId:event.actorId,actorName:event.actorName,targetId:event.targetId,targetName:event.targetName,added:event.statusesAdded || [],removed:event.statusesRemoved || [],text:clean(event.text,400)});
}
function shapeTotals(value) { return {actions:value.actions, damageByActor:Object.values(value.damageByActor), damageTakenByActor:Object.values(value.damageTakenByActor), healingByActor:Object.values(value.healingByActor), statusChanges:copy(value.statusChanges)}; }
function contribute(report,event) {
  report._contributions ||= {};
  const key=JSON.stringify([event.kind,event.actorId,event.targetId,event.visibility,event._actorVisibility,event._targetVisibility,event.statusesAdded,event.statusesRemoved]);
  if (!Object.hasOwn(report._contributions,key)) {
    if (Object.keys(report._contributions).length >= 180) { report._contributionsLimited=true; return; }
    const row={kind:event.kind,actorId:event.actorId,actorName:event.actorName,targetId:event.targetId,targetName:event.targetName,visibility:event.visibility,_actorVisibility:copy(event._actorVisibility),_targetVisibility:copy(event._targetVisibility),statusesAdded:copy(event.statusesAdded),statusesRemoved:copy(event.statusesRemoved),text:clean(event.text,400),amount:0,absorbed:0,count:0};
    Object.defineProperty(report._contributions,key,{value:row,enumerable:true,writable:true});
  }
  const row=report._contributions[key];row.amount+=event.amount || 0;row.absorbed+=event.absorbed || 0;row.count++;
}
const METHOD = {attack:'普通攻击',cast:'施法',spell:'施法',ability:'能力',skill:'技能',heal:'治疗',wind:'回气',potion:'药水',end:'回合结束',endTurn:'回合结束',localStep:'NPC行动',move:'移动',defend:'防御',guard:'防御',dodge:'闪避',rest:'休整',start:'开始交锋',startEncounter:'开始遭遇',retreat:'撤退',travel:'旅行',choose:'剧情选择',choice:'剧情选择',wait:'等待',save:'规则检定',feature:'职业能力',item:'使用物品',dash:'疾走',disengage:'撤离',stand:'起身',surge:'动作如潮',door:'门扉交互',roll:'掷骰',prepare:'准备法术',levelup:'升级'};
const OMIT_ACTIONS = new Set(['note','narrate','map','mapSave','mapLoad','mapToken','saveMap','loadMap','import','restore','undo']);
function methodOf(action, options) { return clean(options.method || METHOD[action.type] || '规则行动'); }

export function captureBattleTransition(beforeState, after, action = {}, options = {}) {
  if (!after || typeof after !== 'object') return emptyReport();
  const before = battleSnapshot(beforeState), next = battleSnapshot(after);
  const existing = after.battleReport;
  const report = existing?.schema === 1 && Array.isArray(existing.events) && Array.isArray(existing.summaries) ? existing : emptyReport();
  if (!Array.isArray(report._seen)) report._seen = [];
  report._seq = Number(report._seq) || Math.max(0, ...report.events.map(e => Number(e.seq) || 0)); report._battleSeq ||= 0;
  const requestId = options.requestId ? clean(options.requestId, 160) : null;
  const recorded = [...(collectors.get(after) || []), ...(Array.isArray(options.events) ? options.events : [])]; collectors.delete(after);
  if (requestId && report._seen.includes(requestId)) { after.battleReport = report; return report; }
  const oldActors = new Map(before.actors.map(a => [a.id,a])), newActors = new Map(next.actors.map(a => [a.id,a]));
  const find = id => newActors.get(id) || oldActors.get(id);
  const explicitEnd = recorded.findLast(event => event?.kind === 'battle-end');
  const hadBattle = before.active || next.active || recorded.some(event => event?._combatActive) || !!explicitEnd;
  if (hadBattle && !report.currentBattleId) {
    const authoredId=next.battleId || before.battleId || recorded.find(event => event?._combatId)?._combatId || next.scene || before.scene || 'table';
    report.currentBattleId = `${clean(authoredId,80)}#${++report._battleSeq}`;
    report._totals = {all:totals(),public:totals()};
    report._contributions = {}; report._contributionsLimited=false;
  }
  if (report.currentBattleId && !report._totals) report._totals = {all:totals(),public:totals()};
  const actorId = options.actorId || action.actorId || action.characterId || action.heroId || action.actor || null;
  const targetId = options.targetId || action.targetId || action.target || null;
  const method = methodOf(action,options), actor = find(actorId);
  const handled = new Set();
  const push = raw => {
    if (!raw || raw.kind === 'battle-end') return;
    const whoId = raw.actorId || raw.sourceId || raw.actor?.id || null, toId = raw.targetId || raw.target?.id || null;
    const who = find(whoId), to = find(toId);
    const visibility = raw.visibility === 'gm' || raw.visibility === 'dm' || who?.hidden || to?.hidden || isHidden(raw.actor) || isHidden(raw.target) ? 'gm' : 'all';
    const event = {id:`battle-event-${++report._seq}`,seq:report._seq,battleId:report.currentBattleId,revision:next.revision,kind:clean(raw.kind || 'action',30),actorId:whoId ? clean(whoId,100) : null,actorName:clean(raw.actorName || raw.actor?.name || who?.name || '规则结算'),targetId:toId ? clean(toId,100) : null,targetName:clean(raw.targetName || raw.target?.name || to?.name || ''),method:clean(raw.method || method),visibility};
    event._actorVisibility=visibilityRecord(raw.actor ? {...who,...raw.actor,side:raw.actor.side || who?.side} : who);event._targetVisibility=visibilityRecord(raw.target ? {...to,...raw.target,side:raw.target.side || to?.side} : to);
    if (Number.isFinite(raw.amount) && raw.amount >= 0) event.amount = raw.amount;
    if (Number.isFinite(raw.absorbed) && raw.absorbed > 0) event.absorbed = raw.absorbed;
    event.statusesAdded = [...new Set((raw.statusesAdded || []).map(v=>clean(v,100)))].slice(0,32);
    event.statusesRemoved = [...new Set((raw.statusesRemoved || []).map(v=>clean(v,100)))].slice(0,32);
    if (raw.text) event.text = clean(raw.text,1400);
    else if (event.kind === 'damage') event.text = `${event.actorName} · ${event.method} → ${event.targetName}：实际损失 ${event.amount || 0} 点生命${event.absorbed ? `（另有 ${event.absorbed} 点被临时生命吸收）` : ''}。`;
    else if (event.kind === 'healing') event.text = `${event.actorName} · ${event.method} → ${event.targetName}：实际恢复 ${event.amount || 0} 点生命。`;
    else if (event.kind === 'miss') event.text = `${event.actorName} · ${event.method} → ${event.targetName}：未命中。`;
    else if (event.statusesAdded.length || event.statusesRemoved.length) event.text = `${event.targetName || event.actorName}：${event.statusesAdded.length ? `陷入 ${event.statusesAdded.join('、')}` : ''}${event.statusesAdded.length && event.statusesRemoved.length ? '；' : ''}${event.statusesRemoved.length ? `解除 ${event.statusesRemoved.join('、')}` : ''}（${event.method}）。`;
    else event.text = `${event.actorName} 完成${event.method}${event.targetName ? ` → ${event.targetName}` : ''}。`;
    if(event.kind!=='status'&&(event.statusesAdded.length||event.statusesRemoved.length))event.text+=`${event.statusesAdded.length?` 施加：${event.statusesAdded.join('、')}。`:''}${event.statusesRemoved.length?` 解除：${event.statusesRemoved.join('、')}。`:''}`;
    report.events.push(event);
    if (report._totals && event.battleId) { account(report._totals.all,event); if (visibility === 'all') account(report._totals.public,event); contribute(report,event); }
    if (toId) handled.add(`${event.kind}:${toId}`);
  };
  for (const event of recorded) push(event);
  // Only actual existing-unit changes are compared; spawning/removing a unit is not damage/healing.
  for (const current of next.actors) {
    const previous = oldActors.get(current.id); if (!previous) continue;
    if(current.side!=='party'&&(before.scene!==next.scene||!before.active&&next.active))continue;
    const delta = previous.hp !== null && current.hp !== null ? current.hp - previous.hp : 0;
    // A direct character action can identify its own target. Turn ticks and NPC chains cannot.
    const attributable = actorId && !['end','endTurn','localStep','npc','wait','rest','retreat','move','start','startEncounter','choose','choice','travel'].includes(action.type) && (!targetId || targetId === current.id || actorId === current.id);
    const source = attributable ? actorId : null;
    if (delta < 0 && !current.withdrawn && !handled.has(`damage:${current.id}`)) push({kind:'damage',actorId:source,targetId:current.id,amount:-delta,method:attributable ? method : '规则结算（来源未单列）'});
    if (delta > 0 && !handled.has(`healing:${current.id}`)) push({kind:'healing',actorId:source,targetId:current.id,amount:delta,method:attributable ? method : '规则结算（来源未单列）'});
    const added = current.statuses.filter(value=>!previous.statuses.includes(value)), removed = previous.statuses.filter(value=>!current.statuses.includes(value));
    if ((added.length || removed.length) && !handled.has(`status:${current.id}`)) push({kind:'status',actorId:source,targetId:current.id,statusesAdded:added,statusesRemoved:removed,method:attributable ? method : '规则结算'});
  }
  if (action.type && !OMIT_ACTIONS.has(action.type)) {
    push({kind:'action',actorId,targetId,method,visibility:actor?.hidden ? 'gm' : 'all'});
    if (report._totals && report.currentBattleId) { report._totals.all.actions++; if (!actor?.hidden) report._totals.public.actions++; }
  }
  if (report.currentBattleId && (explicitEnd || before.active && !next.active || !next.active && recorded.some(event=>event?._combatActive))) {
    const result = ['victory','defeat','escape'].includes(explicitEnd?.result || options.result) ? explicitEnd?.result || options.result : 'ended';
    const summaryId = `battle-summary-${report.currentBattleId}-${report._seq}`;
    const label = {victory:'战斗胜利',defeat:'战斗失败',escape:'撤离战斗',ended:'战斗结束'}[result];
    const make = value => ({id:summaryId,battleId:report.currentBattleId,result,...shapeTotals(value),text:`${label} · ${value.actions} 次行动；可见结算中有效生命损失 ${Object.values(value.damageTakenByActor).reduce((n,row)=>n+row.amount,0)} 点，治疗 ${Object.values(value.healingByActor).reduce((n,row)=>n+row.amount,0)} 点。`});
    const summary = make(report._totals?.public || totals()); summary._private = make(report._totals?.all || totals());
    summary._contributions=Object.values(report._contributions || {});summary._contributionsLimited=!!report._contributionsLimited;
    report.summaries.push(summary); report.currentBattleId = null; report._totals = null;report._contributions=null;
  }
  if (requestId) { report._seen.push(requestId); report._seen = report._seen.slice(-SEEN_LIMIT); }
  if(report.events.length>EVENT_LIMIT||report.summaries.length>SUMMARY_LIMIT)report._truncated=true;
  report.events = report.events.slice(-EVENT_LIMIT); report.summaries = report.summaries.slice(-SUMMARY_LIMIT);
  // Keep history snapshots and SSE payloads small even for unusually long custom labels.
  let size=JSON.stringify(report).length;
  while(size>262144&&report.summaries.length>1){report.summaries.shift();report._truncated=true;size=JSON.stringify(report).length;}
  while(size>262144&&report.events.length>20){report.events.shift();report._truncated=true;size=JSON.stringify(report).length;}
  after.battleReport = report; return report;
}

export function publicBattleReport(stateOrReport, {privileged = false, canViewActor} = {}) {
  const report = stateOrReport?.battleReport || stateOrReport;
  if (report?.schema !== 1 || !Array.isArray(report.events)) return {schema:1,events:[],summaries:[],currentBattleId:null};
  const rows = value => (Array.isArray(value) ? value : []).slice(0,120).map(row=>({actorId:row.actorId ? clean(row.actorId,100) : null,actorName:clean(row.actorName),amount:Math.max(0,finite(row.amount) || 0)}));
  const changes = value => (Array.isArray(value) ? value : []).slice(0,160).map(row=>({actorId:row.actorId ? clean(row.actorId,100) : null,actorName:clean(row.actorName),targetId:row.targetId ? clean(row.targetId,100) : null,targetName:clean(row.targetName),added:(Array.isArray(row.added)?row.added:[]).slice(0,32).map(v=>clean(v,100)),removed:(Array.isArray(row.removed)?row.removed:[]).slice(0,32).map(v=>clean(v,100)),text:clean(row.text,1400)}));
  const allowed = (record,event) => {
    if(!record)return true;
    if(record.hidden||record.secret||['dm','gm'].includes(record.visibility))return false;
    // PVE combat evidence belongs to the whole party, not only a character's owner.
    if(record.side==='party')return true;
    if(canViewActor){try{return !!canViewActor(record,event);}catch{return false;}}
    return record.visibility!=='owner';
  };
  const visible = event => privileged || event.visibility!=='gm'&&event.visibility!=='dm'&&allowed(event._actorVisibility,event)&&allowed(event._targetVisibility,event);
  const project = event => {
    if(!event)return null;
    if(visible(event))return event;
    // A public teammate's HP change is public PVE evidence even when its cause is still a GM secret.
    if(!privileged&&['damage','healing'].includes(event.kind)&&event._targetVisibility?.side==='party'&&allowed(event._targetVisibility,event)){
      const method='规则结算（来源未揭晓）',amount=Math.max(0,Number(event.amount)||0),verb=event.kind==='damage'?'损失':'恢复';
      return {...event,actorId:null,actorName:'规则结算',method,visibility:'all',_actorVisibility:null,statusesAdded:[],statusesRemoved:[],text:`${event.targetName} 实际${verb} ${amount} 点生命（来源未揭晓）。`};
    }
    return null;
  };
  return {schema:1,currentBattleId:report.currentBattleId ? clean(report.currentBattleId,100) : null,limits:{events:EVENT_LIMIT,summaries:SUMMARY_LIMIT},truncated:!!report._truncated,
    events:report.events.map(project).filter(Boolean).slice(-EVENT_LIMIT).map(event=>({id:clean(event.id,140),seq:finite(event.seq) || 0,battleId:event.battleId ? clean(event.battleId,100) : null,revision:finite(event.revision) || 0,kind:clean(event.kind,30),actorId:event.actorId ? clean(event.actorId,100) : null,actorName:clean(event.actorName),targetId:event.targetId ? clean(event.targetId,100) : null,targetName:clean(event.targetName),method:clean(event.method),...(Number.isFinite(event.amount)?{amount:Math.max(0,event.amount)}:{}),...(Number.isFinite(event.absorbed)&&event.absorbed>0?{absorbed:event.absorbed}:{}),statusesAdded:(Array.isArray(event.statusesAdded)?event.statusesAdded:[]).slice(0,32).map(v=>clean(v,100)),statusesRemoved:(Array.isArray(event.statusesRemoved)?event.statusesRemoved:[]).slice(0,32).map(v=>clean(v,100)),text:clean(event.text,1400)})),
    summaries:(Array.isArray(report.summaries)?report.summaries:[]).slice(-SUMMARY_LIMIT).map(summary=>{let source=privileged && summary._private || summary;
      if(!privileged&&Array.isArray(summary._contributions)){
        const projected=totals();for(const row of summary._contributions.map(project).filter(Boolean)){account(projected,row);if(row.kind==='action')projected.actions+=row.count || 1;}
        const shaped=shapeTotals(projected),label={victory:'战斗胜利',defeat:'战斗失败',escape:'撤离战斗',ended:'战斗结束'}[source.result]||'战斗结束';
        source={...source,...shaped,text:`${label} · ${shaped.actions} 次可见行动；有效生命损失 ${shaped.damageTakenByActor.reduce((n,row)=>n+row.amount,0)} 点，治疗 ${shaped.healingByActor.reduce((n,row)=>n+row.amount,0)} 点${summary._contributionsLimited?'（仅含已保留的结算分组）':''}。`};
      }
      return {id:clean(source.id,140),battleId:clean(source.battleId,100),result:clean(source.result,30),actions:Math.max(0,finite(source.actions) || 0),damageByActor:rows(source.damageByActor),damageTakenByActor:rows(source.damageTakenByActor),healingByActor:rows(source.healingByActor),statusChanges:changes(source.statusChanges),text:clean(source.text,1400)};}),
  };
}
