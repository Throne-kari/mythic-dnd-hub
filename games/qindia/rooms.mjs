import {validateMapState} from './cartography.mjs';
import fs from 'node:fs';
import {ownsRecord,optionVisible} from './campaign-v2.mjs';
import {campaignData as pack} from './campaign-data.mjs';
import path from 'node:path';
import {randomBytes, createHash} from 'node:crypto';
import {createGame, apply, publicState, actor, log, localStep} from './engine.mjs';
import {publishHandout} from './handouts.mjs';

const secret = () => randomBytes(32).toString('base64url');
const hash = value => createHash('sha256').update(String(value)).digest('hex');
const copy = value => structuredClone(value);
export const problem = (message, status = 400, code = 'INVALID_REQUEST') => Object.assign(new Error(message), {status, code});
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, copy(obj[k])]));
export const isDm = (room, seat) => room.dmSeatId === seat.id;
export const isOwner = (room, seat) => room.ownerId === seat.id;
export function requireDm(room, seat) { if (!isDm(room, seat) && !isOwner(room, seat)) throw problem('这项操作需要主持人或房主权限。', 403, 'FORBIDDEN'); }
export function requireOwner(room, seat) { if (!isOwner(room, seat)) throw problem('这项操作需要房主权限。', 403, 'FORBIDDEN'); }
const visibleRecord=value=>!!value&&typeof value==='object'&&!value.hidden&&!value.secret&&value.visibility!=='dm';
const publicFactKeys=pack.publicFacts||Object.keys(pack.initialFacts||{});
function validateActorSnapshot(a){
  if(!a||typeof a!=='object'||!a.id||![a.hp,a.maxHp,a.x,a.y,a.ac,a.speed].every(Number.isFinite)||a.hp<0||a.maxHp<1||a.maxHp>2000||a.hp>a.maxHp||a.ac<0||a.ac>50||a.speed<0||a.speed>300||!Array.isArray(a.conditions)||!Array.isArray(a.abilities)||a.abilities.length!==6||a.abilities.some(n=>!Number.isInteger(n)||n<1||n>30)||!Array.isArray(a.weapons)||a.weapons.length>12||a.weapons.some(w=>!w||typeof w.name!=='string'||!/^\d{1,2}d\d{1,3}$/.test(w.dice)||![w.bonus,w.damageBonus,w.range,w.long].every(Number.isFinite)||w.range<0||w.long<w.range)||a.effects!==undefined&&(!Array.isArray(a.effects)||a.effects.length>100||a.effects.some(e=>!e||typeof e!=='object'||Array.isArray(e))))throw problem('角色或人物永久快照无效。');
  for(const key of ['slots','maxSlots'])if(a[key]!==undefined&&(!Array.isArray(a[key])||a[key].length>9||a[key].some(n=>!Number.isInteger(n)||n<0||n>20)))throw problem('人物快照法术位无效。');
  if((a.slots||[]).some((n,i)=>n>(a.maxSlots?.[i]||0)))throw problem('人物快照剩余法术位超界。');
}
function publicCampaign(view,room,seat){
  const owned=new Set(Object.keys(room.owners).filter(id=>room.owners[id]===seat.id)),allowed=v=>ownsRecord(v,owned);
  if(!view)return view;
  const out=pick(view,['chapter','title','entryLevel','milestoneLevel','node','description','descriptionSummary','sensitive','introSafety','completed','canAdvance','ended','pending']);
  out.facts=pick(view.facts||{},publicFactKeys);out.privateFacts=pick(view.privateFacts||{},[...owned]);out.relationships=(view.relationships||[]).filter(allowed).map(v=>pick(v,['id','npcId','actorId','status']));if(view.sensitive&&view.descriptionSummary){out.descriptionDetail=view.description;out.description=view.descriptionSummary;}
  out.objectives=(view.objectives||[]).filter(allowed).map(v=>pick(v,['id','label','status']));
  out.chapters=(view.chapters||[]).filter(allowed).map(v=>pick(v,['id','number','title','visited','completed']));
  out.options=(view.options||[]).filter(allowed).map(v=>{const out=pick(v,['id','label','text','textSummary','costSummary','actorIds','combat','at']);if(v.textSummary){out.textDetail=v.text;out.text=v.textSummary;}return out;});
  out.npcs=(view.npcs||[]).filter(v=>allowed(v)&&allowed(room.state.campaign?.npcs?.[v.id])&&(!room.state.campaign?.npcs?.[v.id]?.actor||allowed(room.state.campaign.npcs[v.id].actor))&&(!room.state.actors.find(a=>a.id===v.id)||allowed(room.state.actors.find(a=>a.id===v.id)))).map(({hp,maxHp,...v})=>({...pick(v,['id','name','status','attitude','location','locationLabel','safe','dead']),...(Number.isFinite(hp)?{down:hp===0,bloodied:hp>0&&Number.isFinite(maxHp)&&hp<=maxHp/2}:{})}));
  out.items=(view.items||[]).filter(allowed).map(v=>pick(v,['id','name','holder','kind','count','weight','location','borrowed','destroyed','charges','maxCharges']));
  out.promises=(view.promises||[]).filter(allowed).map(v=>pick(v,['id','text','status']));
  out.fireSources=(view.fireSources||[]).filter(allowed).map(v=>pick(v,['id','label','resolved']));
  out.fireZones=(view.fireZones||[]).filter(allowed).map(v=>pick(v,['id','x','y','w','h','radius','label','scene','damage','warned']));
  out.endings=(view.endings||[]).filter(allowed).map(v=>pick(v,['actor','name','status','destination','items']));
  out.ending=view.ending&&allowed(view.ending)?{...pick(view.ending,['id','title','text','pending','time']),facts:pick(view.ending.facts||{},publicFactKeys),people:(view.ending.people||[]).filter(allowed).map(v=>pick(v,['id','name','location','status','dead','stable']))}:null;
  return out;
}

export function validateState(s, campaign) {
  if (!s || s.version !== 2 || s.gameId !== campaign.id || !Array.isArray(s.actors) || s.actors.length > 100 || !Array.isArray(s.log) || s.log.length > 500 || !Array.isArray(s.journal) || !s.locations || !Array.isArray(s.inventory) || !s.flags || !s.doors || !Number.isInteger(s.revision) || !Number.isInteger(s.chapter) || s.chapter < 1 || s.chapter > campaign.chapters.length || !campaign.scenes[s.scene]) throw problem('存档结构不兼容。');
  const plain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
  if(!plain(s.locations)||!plain(s.flags)||!plain(s.doors)||s.revision<0||!Number.isFinite(s.time)||!Number.isInteger(s.logSeq)||s.log.some(l=>!plain(l)||typeof l.kind!=='string'||typeof l.text!=='string'||!Number.isInteger(l.id))||s.journal.length>1000||s.journal.some(j=>!plain(j)||typeof j.title!=='string'||typeof j.text!=='string')||s.inventory.some(i=>typeof i!=='string'))throw problem('存档中的记录、时间或容器结构无效。');
  if(s.areas!==undefined&&(!Array.isArray(s.areas)||s.areas.length>100||s.areas.some(a=>!plain(a)||typeof a.id!=='string'||typeof a.spell!=='string'||![a.x,a.y,a.radius,a.expiresAt].every(Number.isFinite)||!Array.isArray(a.excluded)||!plain(a.lastHit))))throw problem('存档中的持续区域无效。');
  const ids = new Set();
  for (const a of s.actors) {
    if (!a.id || ids.has(a.id) || ![a.hp, a.maxHp, a.x, a.y, a.ac, a.speed].every(Number.isFinite) || !Array.isArray(a.weapons) || !Array.isArray(a.conditions)) throw problem('存档中的角色数据无效。');
    if(a.hp<0||a.maxHp<1||a.maxHp>2000||a.hp>a.maxHp||a.ac<0||a.ac>50||a.speed<0||a.speed>300||a.weapons.length>12||!Array.isArray(a.abilities)||a.abilities.length!==6||a.abilities.some(n=>!Number.isInteger(n)||n<1||n>30))throw problem('存档中的角色数值超界。');
    for(const key of ['slots','maxSlots'])if(a[key]!==undefined&&(!Array.isArray(a[key])||a[key].length>9||a[key].some(n=>!Number.isInteger(n)||n<0||n>20)))throw problem('存档中的法术位无效。');
    if((a.slots||[]).some((n,i)=>n>(a.maxSlots?.[i]||0)))throw problem('剩余法术位不能超过上限。');
    if(a.weapons.some(w=>!w||typeof w.name!=='string'||!/^\d{1,2}d\d{1,3}$/.test(w.dice)||![w.bonus,w.damageBonus,w.range,w.long].every(Number.isFinite)||w.range<0||w.long<w.range))throw problem('存档中的攻击卡无效。');
    if(a.effects!==undefined&&(!Array.isArray(a.effects)||a.effects.length>100||a.effects.some(e=>!plain(e))))throw problem('存档中的持续效果无效。');
    if(a.death!==undefined&&(!Array.isArray(a.death)||a.death.length!==2||a.death.some(n=>!Number.isInteger(n)||n<0||n>10)))throw problem('存档中的死亡豁免无效。');
    ids.add(a.id);
  }
  if(['p1','p2','p3','p4'].some(id=>!s.actors.some(a=>a.id===id&&a.side==='party'&&a.level>=3&&a.level<=12)))throw problem('存档必须保留四张有效预建卡。');
  if (s.combat && (!Array.isArray(s.combat.order) || s.combat.order.some(id => !ids.has(id)) || s.combat.index < 0 || s.combat.index >= s.combat.order.length)) throw problem('存档中的先攻数据无效。');
  if(s.passages!==undefined&&(!Array.isArray(s.passages)||s.passages.length>100||s.passages.some(p=>!p||!campaign.scenes[p.scene]||![p.x,p.y,p.w,p.h,p.expiresAt].every(Number.isFinite)||p.w<=0||p.h<=0)))throw problem('临时通道数据无效。');
  if (s.campaign !== undefined) {
    const value = s.campaign, plain = o => !!o && typeof o === 'object' && !Array.isArray(o);
    if (!plain(value) || ['facts', 'chapters', 'nodes', 'npcs', 'items', 'rewards', 'endings'].some(k => !plain(value[k])) || !Array.isArray(value.promises) || !Number.isInteger(value.milestoneLevel)||value.milestoneLevel<3||value.milestoneLevel>12) throw problem('战役进度结构无效。');
    if(Object.entries(value.facts).some(([key,v])=>!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)))throw problem('战役事实只接受有限数值、文本和真假值。');
    if (Object.values(value.chapters).some(v => !plain(v) || typeof v.completed !== 'boolean' || (v.outcome!==undefined&&typeof v.outcome !== 'string') || v.completed&&typeof v.outcome!=='string')) throw problem('章节收束数据无效。');
    if (Object.values(value.items).some(v => !plain(v) || typeof v.id !== 'string' || typeof v.name !== 'string' || !(v.holder === null || typeof v.holder === 'string'))) throw problem('战役物件归属数据无效。');
    if(value.promises.some(v=>!plain(v)||typeof v.id!=='string'||typeof v.text!=='string'||typeof v.status!=='string')||value.fireZones!==undefined&&(!Array.isArray(value.fireZones)||value.fireZones.some(v=>!plain(v)||![v.x,v.y,v.w,v.h].every(Number.isFinite)))||value.notes!==undefined&&(!Array.isArray(value.notes)||value.notes.some(v=>!plain(v)||typeof v.text!=='string')))throw problem('战役区域、承诺或备注无效。');
    for(const n of Object.values(value.npcs)){if(!plain(n)||typeof n.id!=='string'||typeof n.name!=='string')throw problem('人物永久快照无效。');if(n.actor)validateActorSnapshot(n.actor);}
  }else throw problem('存档缺少本游戏战役进度。');
  validateMapState(s,campaign.scenes);
  return s;
}

export function projectState(room, seat, campaign) {
  const s = publicState(room.state, campaign);
  if (isDm(room, seat) || isOwner(room, seat)) return s;
  const owned=new Set(Object.keys(room.owners).filter(id=>room.owners[id]===seat.id));
  const out = pick(s, ['version', 'gameId', 'revision', 'chapter', 'scene', 'journal', 'inventory', 'gold', 'time', 'combat', 'doors', 'created', 'choices', 'current', 'chapters', 'campaignView', 'passages', 'handouts']);
  out.log = s.log.filter(l => !['gm', 'ai-note', 'secret', 'dm','debug'].includes(l.kind) && l.visibility !== 'dm'&&!l.secret&&ownsRecord(l,owned)).map(l => ({...pick(l, ['id', 'kind', 'text', 'time','summary']),...(l.summary?{text:l.summary,detailText:l.text}:{})}));
  out.journal = (out.journal || []).filter(j => j.visibility !== 'dm' && !j.secret&&ownsRecord(j,owned)).map(j=>{const chapter=campaign.chapters[(j.sourceChapter||0)-1];const summary=j.summary||(chapter?.sensitive?chapter.descriptionSummary||'敏感场面已略述；规则后果保留。':null);return summary?{...j,text:summary,summary,detailText:j.text}:j;});out.inventory=out.inventory.filter(name=>{const items=Object.values(room.state.campaign?.items||{}).filter(i=>i.name===name);return !items.length||items.some(i=>ownsRecord(i,owned));});
  out.campaignView=publicCampaign(out.campaignView,room,seat);out.choices=out.campaignView.options;
  out.actors = s.actors.filter(a => ownsRecord(a,owned)).map(a => {
    if (a.side === 'party') return {...pick(a, ['id', 'name', 'side', 'saves', 'languages', 'tools', 'inventory', 'armor', 'shield', 'species', 'size', 'backgroundSkills', 'role', 'source', 'manual', 'class', 'subclass', 'build', 'level', 'race', 'background', 'bio', 'portrait', 'color', 'ac', 'hp', 'maxHp', 'tempHp', 'speed', 'x', 'y', 'weapons', 'attacks', 'abilities', 'skills', 'proficiency', 'saveProficiencies', 'spellDC', 'spellAttack', 'spellAbility', 'spells', 'knownSpells', 'domainSpells', 'cantrips', 'preparedLimit', 'customPrepared', 'customBuild', 'preset', 'climb', 'inspiration', 'initiative', 'initiativeAdv', 'conditions', 'death', 'dead', 'stable', 'prone', 'action', 'bonus', 'move', 'reaction', 'attackLeft', 'slots', 'maxSlots', 'wind', 'maxWind', 'surge', 'maxSurge', 'channel', 'maxChannel', 'arcane', 'maxArcane', 'indomitable', 'maxIndomitable', 'intervention', 'maxIntervention', 'hd', 'maxHd', 'hitDie', 'potions', 'controller', 'features', 'resources', 'magicInitiate', 'maxMagicInitiate', 'ritualSpells', 'savageAttacker', 'spellbook', 'prepared', 'dodge', 'disengaged', 'masteries', 'critical', 'sneakDice', 'uncanny', 'evasion', 'reliable']), ...((room.owners[a.id] === seat.id) ? pick(a, ['effects', 'concentration', 'reactionPolicy', 'exhaustion', 'whelmExhaustion','privateBrief']) : {effects: (a.effects || []).filter(e=>ownsRecord(e,owned)).map(e => pick(e, ['condition', 'spell', 'expiresAt'])), concentration: a.concentration ? {spell: a.concentration.spell} : null})};
    return {...pick(a, ['id', 'name', 'side', 'color', 'x', 'y', 'conditions', 'dead', 'prone']), effects: (a.effects || []).filter(e=>ownsRecord(e,owned)).map(e => pick(e, ['condition', 'spell', 'expiresAt'])), concentration: a.concentration ? {spell: a.concentration.spell} : null, bloodied: a.hp > 0 && a.hp <= a.maxHp / 2, down: a.hp === 0};
  });
  const visibleIds = new Set(out.actors.map(a => a.id));if(out.combat){out.combat.order=out.combat.order.filter(id=>visibleIds.has(id));out.combat.index=Math.max(0,out.combat.order.indexOf(out.current));delete out.combat.scores;if(!visibleIds.has(out.current))out.current=null;}for(const key of ['dm','secret','secrets','source','notes','dmText','gmNotes'])if(out.campaignView)delete out.campaignView[key];
  out.areas = (s.areas || []).map(area => ({...pick(area, ['id', 'spell', 'level', 'x', 'y', 'radius', 'expiresAt']), caster: visibleIds.has(area.caster) ? area.caster : null}));
  // Map geometry is public. Authored GM markers, route solutions and source notes are not.
  out.sceneData = pick(s.sceneData, ['schema_version', 'map_id', 'mapRevision', 'name', 'width_ft', 'height_ft', 'origin', 'grid_ft', 'rooms', 'walls', 'openings', 'features', 'surfaces', 'roofs', 'art', 'image', 'asset']);
  for (const key of ['rooms', 'walls', 'openings', 'features', 'surfaces', 'roofs']) if (out.sceneData[key]) out.sceneData[key] = out.sceneData[key].filter(v => !v.hidden && !v.secret && v.visibility !== 'dm').map(v => pick(v, ['id', 'label', 'name', 'kind', 'x', 'y', 'w', 'h', 'a', 'b', 'state', 'height_ft', 'height_start_ft', 'height_end_ft', 'height_start', 'height_end', 'difficult', 'raises', 'rise_ft', 'floor_ft', 'sill_ft', 'color', 'z', 'water', 'alpha']));
  return out;
}

const playerTypes = new Set(['move', 'attack', 'start', 'end', 'dash', 'disengage', 'dodge', 'stand', 'wind', 'surge', 'spell', 'potion', 'stabilize', 'door', 'choice', 'roll', 'note', 'rest', 'wait', 'feature', 'item', 'retreat', 'levelup', 'skill', 'save', 'cast', 'prepare']);
export function authorizeCommand(room, seat, command) {
  if (!command || typeof command !== 'object' || Array.isArray(command) || typeof command.type !== 'string') throw problem('缺少有效行动。');
  if (seat.kind !== 'human' && room.aiPaused) throw problem('房主已暂停 AI，请恢复后继续。', 403, 'AI_PAUSED');
  const cmd = copy(command);delete cmd._authority;if(cmd.type==='chat'){cmd.text=`${seat.name}：${String(cmd.text||'').slice(0,3000)}`;return cmd;}
  if (isDm(room, seat) || isOwner(room, seat)) {cmd._authority={privileged:true,ownedActors:room.state.actors.map(a=>a.id)};return cmd;}
  if (!playerTypes.has(cmd.type)) throw problem('这项行动需要主持权限。', 403, 'FORBIDDEN');
  const owned = Object.keys(room.owners).filter(id => room.owners[id] === seat.id);
  if (!owned.length) throw problem('请先选择自己的角色。', 403, 'NO_CHARACTER');
  if (!cmd.actor) cmd.actor = owned[0];
  cmd._authority={privileged:false,ownedActors:owned};if(cmd.type==='choice'&&!projectState(room,seat,pack).choices?.some(o=>o.id===cmd.option))throw problem('当前席位不能使用这项私人选择。',403,'PRIVATE_CHOICE');
  if (!owned.includes(cmd.actor) || actor(room.state, cmd.actor).side !== 'party') throw problem('只能操作分配给自己的角色。', 403, 'NOT_YOUR_CHARACTER');
  const visible = new Set(room.state.actors.filter(a => !a.hidden && a.visibility !== 'dm').map(a => a.id));
  if(cmd.type==='item'){const item=room.state.campaign?.items?.[String(cmd.option||'').split(':')[1]];if(item&&!ownsRecord(item,new Set(owned)))throw problem('当前席位不能操作这件未公开物品。',403,'PRIVATE_ITEM');}
  if ((cmd.target && !visible.has(cmd.target)) || (cmd.targets && (!Array.isArray(cmd.targets) || cmd.targets.some(id => !visible.has(id))))) throw problem('目标尚未出现在当前可见局面中。', 403, 'HIDDEN_TARGET');
  if (cmd.type === 'note') cmd.text = `${seat.name}：${String(cmd.text || '').slice(0, 5000)}`;
  return cmd;
}

export class RoomStore {
  constructor(directory, campaign, defaults = {}) {
    this.directory = directory;
    this.campaign = campaign;
    this.defaults = {model: defaults.model || '', baseUrl: defaults.baseUrl || 'https://api.openai.com/v1', protocol: defaults.protocol || 'responses'};
    this.rooms = new Map(); this.tokens = new Map(); this.watchers = new Map(); this.eventTokens = new Map(); this.seatEventTokens = new Map(); this.presenceTimers = new Map();
    fs.mkdirSync(directory, {recursive: true, mode: 0o700});
    for (const file of fs.readdirSync(directory).filter(f => /^[a-zA-Z0-9_-]+\.json$/.test(f))) {
      try {
        const room = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
        if (room.schema !== 2 || room.id + '.json' !== file || !Array.isArray(room.seats) || !room.seats.some(s => s.id === room.ownerId)) continue;
        validateState(room.state, campaign);
        room.config = {...this.defaults, ...room.config, key: ''};
        room.aiBusy = false;
        room.aiPaused = true; // A restart never resumes paid calls without a host action.
        if(room.aiAutomation)room.aiAutomation.enabled=false;
        if(room.pending?.mode==='api'&&!room.pending.result)room.pending.error='服务已重启，上一次 API 请求未完成；请重新请求。';
        room.history ||= []; room.events ||= []; room.receipts ||= []; room.owners ||= {};
        room.seats.forEach(s => { s.online = false; s.presence = 'disconnected'; });
        this.rooms.set(room.id, room); this.index(room);
      } catch { console.warn(`房间文件 ${file} 未能读取，原文件已保留。`); }
    }
  }
  index(room) { for (const seat of room.seats) this.tokens.set(seat.tokenHash, {roomId: room.id, seatId: seat.id}); }
  persist(room) {
    const value = {...room, config: {...room.config, key: undefined}, aiBusy: false, seats: room.seats.map(s => ({...s, online: false}))};
    const file = path.join(this.directory, room.id + '.json'), temp = file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(value), {encoding: 'utf8', mode: 0o600});
    fs.renameSync(temp, file);
  }
  auth(raw, roomId) {
    const found = raw && this.tokens.get(hash(raw));
    const room = found && this.rooms.get(found.roomId), seat = room?.seats.find(s => s.id === found.seatId);
    if (!seat || seat.disabled || (roomId && roomId !== room.id)) throw problem('席位凭据无效，请从邀请重新加入或使用已保存的席位。', 401, 'INVALID_SEAT');
    seat.lastSeen = new Date().toISOString();
    return {room, seat};
  }
  eventAuth(value) {
    const record = this.eventTokens.get(value);
    if (!record || record.expires < Date.now()) throw problem('实时连接凭据已过期，请刷新局面后重连。', 401, 'EVENT_SESSION_EXPIRED');
    const room = this.rooms.get(record.roomId), seat = room?.seats.find(s => s.id === record.seatId && !s.disabled);
    if (!seat) throw problem('席位已离开。', 401);
    return {room, seat};
  }
  create({name, displayName}) {
    const token = secret(), id = randomBytes(9).toString('base64url'), seatId = randomBytes(9).toString('base64url');
    const room = {schema: 2, id, name: String(name || this.campaign.title).trim().slice(0, 60), ownerId: seatId, dmSeatId: seatId, invite: secret(), created: new Date().toISOString(), seq: 0, state: createGame(this.campaign), seats: [{id: seatId, name: String(displayName || '主持人').trim().slice(0, 40), role: 'dm', kind: 'human', tokenHash: hash(token), online: false}], owners: {}, history: [], events: [], receipts: [], pending: null, aiBusy: false, aiPaused: true, autoNpc: true, config: {...this.defaults, key: ''}};
    this.record(room, 'room-created', '房间已建立。', seatId);
    this.persist(room); this.rooms.set(id, room); this.index(room);
    return {room, seat: room.seats[0], token};
  }
  join({invite, displayName}) {
    const room = [...this.rooms.values()].find(r => r.invite === invite);
    if (!room) throw problem('邀请无效或已被房主更换。', 404, 'INVITE_NOT_FOUND');
    const token = secret(), seat = {id: randomBytes(9).toString('base64url'), name: String(displayName || '同行者').trim().slice(0, 40), role: 'player', kind: 'human', tokenHash: hash(token), online: false};
    if(room.seats.filter(s=>!s.disabled).length>=12)throw problem('房间席位已满（最多12席，建议3–5人）。',409,'ROOM_FULL');const next = copy(room); next.seats.push(seat); this.record(next, 'seat-joined', `${seat.name}加入了房间。`, seat.id);
    this.commit(next); return {room: next, seat, token};
  }
  record(room, type, text, seatId, visibility = 'all') {
    const event = {seq: ++room.seq, revision: room.state.revision, type, text, seatId, visibility, time: new Date().toISOString()};
    room.events.push(event); if (room.events.length > 400) room.events.splice(0, room.events.length - 400);
  }
  commit(room) { for(const seat of room.seats.filter(s=>!s.disabled))projectState(room,seat,this.campaign);this.persist(room); this.rooms.set(room.id, room); this.index(room); this.publish(room); }
  transact(room, seat, body, type, fn, {history = true, revision = true, bump = true, record = true} = {}) {
    const commandId = body.commandId;
    if (typeof commandId !== 'string' || !/^[a-zA-Z0-9:_-]{8,120}$/.test(commandId)) throw problem('每次操作需要唯一 commandId。', 400, 'COMMAND_ID_REQUIRED');
    const fingerprint = hash(JSON.stringify({...body, commandId: undefined}));
    const receipt = room.receipts.find(r => r.seatId === seat.id && r.id === commandId);
    if (receipt) {
      if (receipt.type !== type || receipt.fingerprint !== fingerprint) throw problem('同一 commandId 不能用于不同操作。', 409, 'COMMAND_ID_REUSED');
      return {room, duplicate: true, result: receipt.result};
    }
    if (revision && body.revision !== room.state.revision) throw problem('局面已更新，已为你取得最新状态；请重新选择这一步。', 409, 'REVISION_CONFLICT');
    const next = copy(room), nextSeat = next.seats.find(s => s.id === seat.id);
    if (history) { next.history.push(copy(room.state)); if (next.history.length > 30) next.history.shift(); }
    const result = fn(next, nextSeat);
    if (bump && next.state.revision === room.state.revision) next.state.revision++;
    if (next.pending && next.pending.request.revision !== next.state.revision) next.pending.stale = true;
    if (record) this.record(next, type, result?.eventText || `${seat.name}更新了局面。`, seat.id, result?.visibility || 'all');
    next.receipts.push({id: commandId, seatId: seat.id, type, fingerprint, revision: next.state.revision, result: result?.receipt || null});
    if (next.receipts.length > 500) next.receipts.shift();
    this.commit(next); return {room: next, duplicate: false, result: result?.receipt || null};
  }
  command(room, seat, body) { return this.transact(room, seat, body, 'command', (r, s) => { const command=authorizeCommand(r,s,body.command);if(command.type==='handout'){requireDm(r,s);publishHandout(r.state,command.option);}else apply(r.state,command,this.campaign); }); }
  view(room, seat) {
    const privileged = isDm(room, seat) || isOwner(room, seat);
    const pending = room.pending && (privileged || room.pending.seatId === seat.id) ? {id: room.pending.id, revision: room.pending.request.revision, role: room.pending.request.role, actor: room.pending.request.actor, seatId: room.pending.seatId, stale: room.pending.stale || room.pending.request.revision !== room.state.revision, error: room.pending.error || null, result: room.pending.result || null, action: room.pending.result?.command || (room.pending.result?.actionIndex != null ? room.pending.request.actions[room.pending.result.actionIndex] : null)} : null;
    const eventKey = room.id + ':' + seat.id, previous = this.seatEventTokens.get(eventKey);
    const eventToken = previous && this.eventTokens.get(previous)?.expires > Date.now() + 60000 ? previous : secret();
    if (eventToken !== previous) { this.eventTokens.set(eventToken, {roomId: room.id, seatId: seat.id, expires: Date.now() + 15 * 60 * 1000}); this.seatEventTokens.set(eventKey, eventToken); }
    if (this.eventTokens.size > 2000) for (const [k, v] of this.eventTokens) if (v.expires < Date.now()) this.eventTokens.delete(k);
    return {state: projectState(room, seat, this.campaign), room: {id: room.id, name: room.name, ...(isOwner(room, seat) ? {invite: room.invite} : {}), ownerId: room.ownerId, dmSeatId: room.dmSeatId, owners: room.owners, seats: room.seats.filter(s => !s.disabled).map(s => ({...pick(s, ['id', 'name', 'kind', 'online', 'lastSeen', 'presence']), online: !!s.online || Date.now() - Date.parse(s.lastSeen || 0) < 12000, role: room.dmSeatId === s.id ? 'dm' : 'player', actors: Object.keys(room.owners).filter(id => room.owners[id] === s.id)})), autoNpc: room.autoNpc, aiPaused: room.aiPaused, aiAutomation: room.aiAutomation ? pick(room.aiAutomation, ['seatId', 'enabled', 'remaining', 'autoApply']) : null, seq: room.seq}, seat: {id: seat.id, name: seat.name, role: isDm(room, seat) ? 'dm' : 'player', isOwner: isOwner(room, seat), kind: seat.kind, actors: Object.keys(room.owners).filter(id => room.owners[id] === seat.id)}, pending, settings: privileged ? {...pick(room.config, ['model', 'baseUrl', 'protocol']), hasKey: !!room.config.key} : {}, aiBusy: room.aiBusy, eventSeq: room.seq, eventToken};
  }
  updates(room, seat, since = 0) {
    const privileged = isDm(room, seat) || isOwner(room, seat);
    return {events: room.events.filter(e => e.seq > since && (e.visibility === 'all' || privileged)).map(e => copy(e)), reset: since > room.seq || (since > 0 && since < (room.events[0]?.seq || 1) - 1), ...this.view(room, seat)};
  }
  subscribe(room, seat, response, since) {
    const set = this.watchers.get(room.id) || new Set(); this.watchers.set(room.id, set);
    const watcher = {seatId: seat.id, response}; set.add(watcher);
    seat.online = true;
    this.presence(room.id);
    response.write(`id: ${room.seq}\nevent: state\ndata: ${JSON.stringify(this.updates(room, seat, since))}\n\n`);
    const keepalive = setInterval(() => response.write(': heartbeat\n\n'), 25000);
    response.on('close', () => { clearInterval(keepalive); set.delete(watcher); const r = this.rooms.get(room.id), s = r?.seats.find(v => v.id === seat.id); if (s && ![...set].some(v => v.seatId === seat.id)) s.online = false; this.presence(room.id); });
  }
  presence(roomId) {
    clearTimeout(this.presenceTimers.get(roomId));
    this.presenceTimers.set(roomId, setTimeout(() => { this.presenceTimers.delete(roomId); const room = this.rooms.get(roomId); if (room) this.publish(room); }, 350));
  }
  expirePresence(room) {
    let changed = false;
    for (const seat of room.seats) if (seat.presence === 'connected' && Date.now() - Date.parse(seat.lastSeen || 0) > 15000) { seat.presence = 'disconnected'; changed = true; }
    if (changed) this.presence(room.id);
  }
  publish(room) {
    for (const watcher of this.watchers.get(room.id) || []) {
      const seat = room.seats.find(s => s.id === watcher.seatId && !s.disabled);
      if (!seat) { watcher.response.end(); continue; }
      seat.online = true;
      try { watcher.response.write(`id: ${room.seq}\nevent: state\ndata: ${JSON.stringify(this.view(room, seat))}\n\n`); } catch { watcher.response.end(); }
    }
  }
  npcTick(room) {
    if (!room.autoNpc || room.aiBusy || !room.state.combat) return;
    const id = room.state.combat.order[room.state.combat.index], a = room.state.actors.find(v => v.id === id);
    const dm = room.seats.find(s => s.id === room.dmSeatId && !s.disabled);
    const workspaceHosting = dm?.kind === 'workspace' && (dm.online || (dm.presence === 'connected' && Date.now() - Date.parse(dm.lastSeen || 0) < 15000));
    if(a?.side==='neutral'&&a.vital){const next=copy(room);try{next.history.push(copy(room.state));if(next.history.length>30)next.history.shift();apply(next.state,{type:'end',actor:a.id},this.campaign);this.record(next,'npc-death-turn',`${a.name}的濒死回合结束。`,'server',a.hidden||a.visibility==='dm'?'dm':'all');this.commit(next);}catch{next.autoNpc=false;this.commit(next);}return;}
    if (!a || a.side === 'party' || a.side === 'neutral' && !(a.vital&&a.hp===0&&!a.dead&&!a.stable) || (!room.aiPaused && (dm?.kind === 'api' || workspaceHosting))) return;
    const next = copy(room);
    try { next.history.push(copy(room.state)); if (next.history.length > 30) next.history.shift(); localStep(next.state, this.campaign); this.record(next, 'npc-action', `${a.name}行动。`, 'server',a.hidden||a.visibility==='dm'?'dm':'all'); this.commit(next); }
    catch { next.autoNpc = false; log(next.state, 'gm', '自动 NPC 行动暂停，请主持人处理当前局面。'); next.state.revision++; this.record(next, 'npc-paused', 'NPC 自动行动已暂停。', 'server'); this.commit(next); }
  }
  close() { for (const timeout of this.presenceTimers.values()) clearTimeout(timeout); for (const set of this.watchers.values()) for (const w of set) w.response.end(); for (const room of this.rooms.values()) this.persist(room); }
}

