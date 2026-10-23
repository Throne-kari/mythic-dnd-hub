import fs from 'node:fs';
export const rawStatBlocks=JSON.parse(fs.readFileSync(new URL('./data/static/rule-statblocks.json',import.meta.url),'utf8'));
const knownType=value=>typeof value==='string'&&Object.hasOwn(rawStatBlocks.blocks,value);
function referenceMetadata(type){
  if(!knownType(type))return {};const block=rawStatBlocks.blocks[type];
  return {statBlockRef:type,statBlockKind:block.kind,fullStatBlock:block.text,originalStatBlock:block.originalText,originalStatBlockName:block.originalName,sourceName:block.sourceTitle,sourceUrl:block.source,sourcePages:[...block.pages],sourceLicense:block.license,sourceLicenseUrl:block.licenseUrl,sourceAttribution:block.attribution,statBlockAdaptations:[...block.adaptations],statBlockNotice:block.runtimeNotice};
}
// Enrich a view or a newly created card, without replacing live mechanical values.
// Old rooms/slots need only their saved type; reading a reference never writes a save.
export function withStatBlock(actor){
  const type=knownType(actor?.type)?actor.type:knownType(actor?.statBlockRef)?actor.statBlockRef:Object.keys(rawStatBlocks.blocks).find(key=>rawStatBlocks.blocks[key].originalName&&rawStatBlocks.blocks[key].originalName===actor?.original);
  return type?{...actor,...referenceMetadata(type)}:actor;
}
const weapon = (name, bonus, dice, damageBonus, range = 5, long = range, type = 'bludgeoning', extra = {}) => ({name, bonus, dice, damageBonus, range, long, type, ...extra});
// Bounded local cards: human opponents are individuals, never a religious faction.
export const bestiary = {
  commoner: {name:'港区居民', ac:10, maxHp:4, speed:30, abilities:[10,10,10,10,10,10], weapons:[weapon('棍棒',2,'1d4',0)], attacks:1, initiative:0, original:'Commoner', source:'SRD 5.2.1 Commoner；原创个人身份；关键人物使用角色式死亡豁免', creatureType:'Humanoid',vital:true},
  guard: {name:'守夜人', ac:16, maxHp:11, speed:30, abilities:[13,12,12,10,11,10], weapons:[weapon('矛',3,'1d6',1,20,60,'piercing',{meleeAlternative:true})], attacks:1, initiative:1, skills:{perception:2}, original:'Guard', source:'SRD 5.2.1 Guard；本冒险明确标示的低等级遭遇改编', creatureType:'Humanoid'},
  bandit: {name:'受雇打手', ac:12, maxHp:11, speed:30, abilities:[11,12,12,10,10,10], weapons:[weapon('短刀',3,'1d6',1,5,5,'slashing'),weapon('轻弩',3,'1d8',1,80,320,'piercing',{loading:true})], attacks:1, initiative:1, original:'Bandit', source:'SRD 5.2.1 Bandit；原创个人身份', creatureType:'Humanoid'},
  odon: {name:'奥东', original:'Bandit Captain',ac:15, maxHp:52, speed:30, abilities:[15,16,14,14,11,14], saves:{0:4,1:5,2:2,3:2,4:2,5:2},weapons:[weapon('弯刀',5,'1d6',3,5,5,'slashing')], attacks:2, initiative:3,parry:2,skills:{athletics:4,deception:4},languages:['港区通用语','盗贼黑话'],source:'SRD 5.2.1 Bandit Captain pp.261–262；v1 E03明确删去手枪，只保留两次原有弯刀',creatureType:'Humanoid'},
  ember: {name:'烬客', ac:12, maxHp:22, speed:20, fly:20,hover:true,abilities:[6,14,12,6,10,8], weapons:[weapon('火触',4,'1d6',0,5,5,'fire',{spell:true})], attacks:1, initiative:2, immunities:['fire'], vulnerabilities:['cold'],conditionImmunities:[],specials:['emberbreath'],recharge:{emberbreath:5},spellDC:12,creatureType:'Elemental', source:'雅法余烬v1原创E04；估计CR1/2，未宣称桌测平衡',darkvision:60,languages:['港区通用语','Ignan'],noComponents:true,size:'Small'}
};
for (const [type,value] of Object.entries(bestiary)) Object.assign(value, {proficiency:2, level:1, size:value.size || 'Medium', conditions:[], effects:[], death:[0,0], slots:[], maxSlots:[], reaction:true, controller:'local'},referenceMetadata(type));
export function makeNPC(type, id, name, x, y, side = 'enemy') {
  const card = bestiary[type];
  if (!card) throw new Error(`未知敌卡 ${type}`);
  return {...structuredClone(card), id, npcId:id, type, name:name || card.name, x, y, side, hp:card.maxHp, spellUses:{}, rechargeReady:Object.fromEntries(Object.keys(card.recharge||{}).map(k=>[k,true]))};
}
