// Project-authored map workshop. No external editor/runtime or network dependency.
import {createHash} from 'node:crypto';
const clone=v=>structuredClone(v);
const error=(message,status=400,code='INVALID_MAP')=>{throw Object.assign(Error(message),{status,code});};
const text=(v,max=200)=>String(v??'').slice(0,max);
const groups=['rooms','walls','openings','features','surfaces','roofs'];
const rectKeys=['id','label','name','kind','x','y','w','h','height_ft','height_start_ft','height_end_ft','height_start','height_end','raises','rise_ft','floor_ft','sill_ft','color','z','water','difficult','visibility','hidden','secret','classification'];
const pick=(v,keys)=>Object.fromEntries(keys.filter(k=>Object.hasOwn(v,k)).map(k=>[k,clone(v[k])]));
const publicKeys=rectKeys.filter(k=>!['visibility','hidden','secret','classification'].includes(k));
export function validateMap(input,id=input?.map_id){
 if(!input||typeof input!=='object'||Array.isArray(input))error('地图须为对象。');
 if(typeof id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(id))error('地图ID无效。');
 const s={schema_version:'2.0',map_id:id,name:text(input.name||id,100),width_ft:input.width_ft,height_ft:input.height_ft,grid_ft:5,origin:'NW; east+x; south+y'};
 if(![s.width_ft,s.height_ft].every(n=>Number.isFinite(n)&&n>=10&&n<=500&&n%5===0))error('宽、高须为10–500尺之间的5尺倍数。');
 if(input.grid_ft!==undefined&&input.grid_ft!==5)error('本桌使用5尺网格。');
 let count=0;
 for(const group of groups){
  const list=input[group]??[];if(!Array.isArray(list)||(count+=list.length)>1800)error('地图物件超过上限或格式错误。');
  s[group]=list.map((v,i)=>{
   if(!v||typeof v!=='object'||Array.isArray(v))error(`${group}第${i+1}项无效。`);
   const r=pick(v,group==='openings'?[...rectKeys,'a','b','state']:rectKeys);
   for(const k of ['id','label','name','kind','classification'])if(r[k]!==undefined)r[k]=text(r[k]);
   if(group==='openings'){
    if(![r.a,r.b].every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||!['open','closed','locked','barred'].includes(r.state??'closed'))error(`门窗${i+1}坐标或状态无效。`);
    if(r.a[0]===r.b[0]&&r.a[1]===r.b[1])error('门窗不能是零长度。');
    for(const p of [r.a,r.b])if(p[0]<0||p[1]<0||p[0]>s.width_ft||p[1]>s.height_ft)error('门窗超出场地。');
    r.state??='closed';r.kind??='door';
   }else{
    if(![r.x,r.y,r.w,r.h].every(Number.isFinite)||r.w<=0||r.h<=0||r.x<0||r.y<0||r.x+r.w>s.width_ft+.001||r.y+r.h>s.height_ft+.001)error(`${group}第${i+1}项超出边界或尺寸无效。`);
    if(group==='rooms')r.kind??='floor';
   }
   for(const k of ['height_ft','height_start_ft','height_end_ft','height_start','height_end','raises','rise_ft','floor_ft','sill_ft','z'])if(r[k]!==undefined&&r[k]!=='UNKNOWN'&&(!Number.isFinite(r[k])||Math.abs(r[k])>500))error('高度须是有限数值或UNKNOWN。');
   if(r.color!==undefined&&!/^#[0-9a-f]{3,8}$/i.test(r.color))delete r.color;
   return r;
  });
 }
 for(const k of ['gm_markers','notes','source_ids'])if(input[k]!==undefined&&!Array.isArray(input[k]))error(`${k}须为数组。`);
 s.gm_markers=(input.gm_markers||[]).slice(0,200).map(m=>{if(!m||typeof m!=='object')error('主持标记无效。');return {key:text(m.key,20),label:text(m.label),description:text(m.description,3000),x:m.x,y:m.y};});
 if(s.gm_markers.some(m=>![m.x,m.y].every(Number.isFinite)||m.x<0||m.y<0||m.x>s.width_ft||m.y>s.height_ft))error('主持标记超出场地。');
 s.notes=(input.notes||[]).slice(0,30).map(v=>text(v,3000));
 s.source_ids=(input.source_ids||[]).slice(0,30).map(v=>text(v));
 s.provenance=text(input.provenance||input.sourceScene||input.layout_classification||'主持人编辑的原创几何；不是历史遗址复原。',3000);
 if(input.starting!==undefined){if(!Array.isArray(input.starting)||input.starting.length>20||input.starting.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[0]<2.5||p[1]<2.5||p[0]>s.width_ft-2.5||p[1]>s.height_ft-2.5))error('起点须位于场地内。');s.starting=clone(input.starting);}
 return s;
}
export function publicMap(s){const out=pick(s,['schema_version','map_id','name','width_ft','height_ft','grid_ft','origin','mapRevision']);for(const group of groups)out[group]=(s[group]||[]).filter(v=>!v.hidden&&!v.secret&&v.visibility!=='dm').map(v=>pick(v,[...publicKeys,'a','b','state']));return out;}
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const mapHash=map=>createHash('sha256').update(JSON.stringify(canonical(map))).digest('hex');
export function validateMapState(s,catalog){
 for(const field of ['mapEdits','mapDrafts']){
  if(s[field]===undefined)continue;
  if(!s[field]||typeof s[field]!=='object'||Array.isArray(s[field])||Object.keys(s[field]).length>100)error('存档地图结构无效。');
  for(const [id,v]of Object.entries(s[field])){if(!Object.hasOwn(catalog,id)||!v||!Number.isSafeInteger(v.revision)||v.revision<1)error('存档地图场景或修订号无效。');const m=validateMap(v.map,id);if(v.hash&&v.hash!==mapHash(m))error('存档地图哈希不符。');}
 }
 return s;
}
export function mapWorkspace(s,catalog,id=s.scene){
 if(!Object.hasOwn(catalog,id))error('原场景不存在。',404);
 const draft=s.mapDrafts?.[id],published=s.mapEdits?.[id];
 return {scene:id,currentScene:s.scene,sources:Object.entries(catalog).map(([id,m])=>({id,name:m.name||id})),map:clone(draft?.map||published?.map||catalog[id]),draftRevision:draft?.revision||0,publishedRevision:published?.revision||0,publishedHash:published?.hash||null,publishedFromDraft:published?.draftRevision||0,actors:clone(id===s.scene?s.actors:[]),roomRevision:s.revision};
}
export function mapMutation(s,b,catalog){
 const id=b.scene;if(!Object.hasOwn(catalog,id))error('只能为本战役的实际场景制作地图。');
 s.mapDrafts||={};s.mapEdits||={};const draft=s.mapDrafts[id];
 if(b.draftRevision!==(draft?.revision||0))error('草稿已被另一位主持更新，请重新载入。',409,'MAP_REVISION_CONFLICT');
 if(b.action==='save'){
  if((draft?.revision||0)>=Number.MAX_SAFE_INTEGER)error('草稿修订号已达上限。');
  const map=validateMap(b.map,id),revision=(draft?.revision||0)+1;
  s.mapDrafts[id]={map,revision,hash:mapHash(map),savedAt:new Date().toISOString()};
  return {eventText:'主持人已保存地图草稿。',visibility:'dm'};
 }
 if(b.action!=='publish')error('未知制图操作。');
 if(s.combat)error('先结束或暂停处理先攻，再发布地图。',409,'MAP_IN_COMBAT');
 if(!draft)error('先保存草稿，再应用到房间。');
 const map=validateMap(draft.map,id);
 const subjects=id===s.scene?s.actors:(s.locations?.[id]?.actors||[]);
 const blocks=m=>[...(m.walls||[]),...(m.features||[]).filter(f=>['mountain','cart','crates','crate','altar','table','rock','pillar'].includes(f.kind))];
 const blocking=blocks(map),prior=blocks(s.mapEdits[id]?.map||catalog[id]);
 const changed=blocking.filter(r=>!prior.some(v=>['x','y','w','h','kind'].every(k=>v[k]===r[k])));
 for(const a of subjects.filter(a=>!a.dead&&!a.departed)){
  const radius=a.size==='Large'?5:2.5;
  if(a.x<radius||a.y<radius||a.x>map.width_ft-radius||a.y>map.height_ft-radius||blocking.some(r=>a.x>r.x&&a.x<r.x+r.w&&a.y>r.y&&a.y<r.y+r.h)||changed.some(r=>a.x+radius>r.x&&a.x-radius<r.x+r.w&&a.y+radius>r.y&&a.y-radius<r.y+r.h))error(`新几何会困住${a.name||a.id}；请调整物件或先移动角色。`,409,'MAP_ACTOR_BLOCKED');
 }
 if((s.mapEdits[id]?.revision||0)>=Number.MAX_SAFE_INTEGER)error('发布修订号已达上限。');
 const revision=(s.mapEdits[id]?.revision||0)+1;
 s.mapEdits[id]={map,revision,draftRevision:draft.revision,hash:mapHash(map),publishedAt:new Date().toISOString()};
 if(id===s.scene)s.doors={};
 return {eventText:`地图「${map.name}」修订${revision}已应用到本桌。`};
}
const xml=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function mapSvg(input,{gm=false}={}){
 const s=gm?input:publicMap(input),colors={water:'#376a79',tree:'#718368',ditch:'#6c5e4c',cart:'#997240',rock:'#827d70'};
 const out=[`<svg xmlns="http://www.w3.org/2000/svg" width="${s.width_ft*12}" height="${s.height_ft*12}" viewBox="0 0 ${s.width_ft} ${s.height_ft}" data-map-id="${xml(s.map_id)}" data-grid-ft="5"><rect width="100%" height="100%" fill="#d6c6a7"/>`];
 for(const [group,fill]of [['rooms','#e8dcc3'],['features','#b2a17f'],['walls','#343f3c']])for(const r of s[group]||[])out.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${colors[r.kind]||fill}" stroke="#6b6554" stroke-width=".12"/>`);
 for(let x=0;x<=s.width_ft;x+=5)out.push(`<path d="M${x} 0V${s.height_ft}" stroke="#504d43" stroke-width=".08" opacity=".5"/>`);
 for(let y=0;y<=s.height_ft;y+=5)out.push(`<path d="M0 ${y}H${s.width_ft}" stroke="#504d43" stroke-width=".08" opacity=".5"/>`);
 for(const d of s.openings||[])out.push(`<path d="M${d.a.join(' ')}L${d.b.join(' ')}" stroke="${d.state==='open'?'#80aa8b':'#b87d42'}" stroke-width=".5"/>`);
 if(gm)for(const m of s.gm_markers||[])out.push(`<text x="${m.x}" y="${m.y}" font-size="2.5" fill="#9b3934">${xml(m.key)}</text>`);
 out.push(`<text x="2" y="3" font-size="2" fill="#202d29">${xml(s.name)} · 5 ft${gm?' · GM':''}</text></svg>`);return out.join('');
}
