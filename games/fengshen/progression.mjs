// Fixed SRD 5.2.1 builds. Only the four untouched presets opt into advancement.
// Class tables: pp.36–40, 47–49, 61–64, 77–82. Advancement is not a rest.
export const spellSlots={3:[4,2],4:[4,3],5:[4,3,2],6:[4,3,3],7:[4,3,3,1],8:[4,3,3,2],9:[4,3,3,3,1],10:[4,3,3,3,2],11:[4,3,3,3,2,1],12:[4,3,3,3,2,1]};
export const proficiency=l=>2+Math.floor((l-1)/4);
const m=n=>Math.floor((n-10)/2),presetIds=new Set(['p1','p2','p3','p4']);
const preparedLimits={3:6,4:7,5:9,6:10,7:11,8:12,9:14,10:15,11:16,12:16};
// Wizard: ten normal level-1/2 spells at level 3 plus two Evocation Savant
// spells; two each later level plus one extra evocation on reaching levels 5/7/9/11.
const spellLists={
 Cleric:{3:['cure','word','bless','guiding','aid','lesser','sanctuary','detectmagic'],5:['sending','dispel','revivify','remove','guardians','massword'],7:['banish','deathward','freedom','auraLife'],9:['masscure','greater','raise'],11:['heal','trueseeing']},
 Wizard:{3:['shield','detectmagic','comprehend','disguise','longstrider','magearmor','featherfall','thunderwave','invisible','mistystep','missile','shatter'],4:['knock','detectthoughts'],5:['fireball','fly','counterspell'],6:['dispel','tongues'],7:['dimension','banish','wallfire'],8:['arcaneeye','gaseous'],9:['passwall','wallforce','coldcone'],10:['wallstone','teleportcircle'],11:['disintegrate','trueseeing','chainlightning'],12:['majorimage','scry']}
};
const lifeSpells={3:['aid','bless','cure','lesser'],5:['massword','revivify'],7:['auraLife','deathward'],9:['greater','masscure']};
const spellLevel={cure:1,word:1,bless:1,guiding:1,sanctuary:1,detectmagic:1,missile:1,shield:1,comprehend:1,disguise:1,longstrider:1,magearmor:1,featherfall:1,thunderwave:1,aid:2,lesser:2,knock:2,invisible:2,mistystep:2,detectthoughts:2,shatter:2,sending:3,dispel:3,revivify:3,remove:3,guardians:3,massword:3,fireball:3,fly:3,counterspell:3,tongues:3,gaseous:3,majorimage:3,banish:4,deathward:4,freedom:4,auraLife:4,dimension:4,arcaneeye:4,wallfire:4,masscure:5,greater:5,raise:5,passwall:5,wallforce:5,coldcone:5,wallstone:5,teleportcircle:5,scry:5,heal:6,trueseeing:6,disintegrate:6,chainlightning:6};
const unlocked=(table,l)=>Object.entries(table).filter(([at])=>l>=+at).flatMap(([,list])=>list);
const unique=values=>[...new Set(values)];
function spellBuild(a,f,l){
 f.preparedLimit=preparedLimits[l];f.knownSpells=unique(unlocked(spellLists[a.class],l));
 f.domainSpells=a.class==='Cleric'?unlocked(lifeSpells,l):[];
 f.cantrips=a.class==='Cleric'?['guidance','sacredflame','thaumaturgy',...(l>=4?['light']:[]),...(l>=10?['spare']:[])]:['firebolt','magehand','minorillusion',...(l>=4?['light']:[]),...(l>=10?['prestidigitation']:[])];
 const available=f.knownSpells.filter(key=>!f.domainSpells.includes(key));
 const staples=a.class==='Cleric'?['word','guardians','dispel','sending']:['shield','counterspell','mistystep','missile'];
 const high=[...available].sort((x,y)=>(spellLevel[y]||0)-(spellLevel[x]||0));
 const preferred=unique([...staples,...high,...available]).filter(key=>available.includes(key));
 f.prepared=(a.customPrepared&&Array.isArray(a.prepared)?unique(a.prepared).filter(key=>available.includes(key)):preferred).slice(0,f.preparedLimit);
 // Domain spells and cantrips do not spend a normal preparation slot.
 f.spells=unique([...f.cantrips,...f.domainSpells,...f.prepared]);
}
export function buildAt(a,level){
 const l=Math.max(3,Math.min(12,Number(level)||3)),pb=proficiency(l),abilities=[...(a.baseAbilities||a.abilities)];
 const main={Fighter:0,Rogue:1,Cleric:4,Wizard:3}[a.class];if(main===undefined)return null;
 const gains={Fighter:[4,6,8,12],Rogue:[4,8,10,12],Cleric:[4,8,12],Wizard:[4,8,12]}[a.class].filter(n=>n<=l).length;
 for(let i=0;i<gains;i++){if(abilities[main]<20)abilities[main]=Math.min(20,abilities[main]+2);else abilities[2]=Math.min(20,abilities[2]+2);}
 const hd={Fighter:10,Rogue:8,Cleric:8,Wizard:6}[a.class];
 const hp=hd+m(abilities[2])+(l-1)*(hd/2+1+m(abilities[2]))+(a.effects||[]).reduce((n,e)=>n+(e.maxHpBonus||0),0);
 const weapon=(name,stat,dice,type,range=5,long=range,extra={})=>({name,bonus:pb+m(abilities[stat]),dice,damageBonus:m(abilities[stat]),range,long,type,...extra});
 const f={level:l,proficiency:pb,abilities,maxHp:hp,hitDie:hd,maxHd:l,initiative:m(abilities[1]),attacks:1,subclass:{Fighter:'Champion',Rogue:'Thief',Cleric:'Life Domain',Wizard:'Evoker'}[a.class],build:'SRD 5.2.1 预设',saveProficiencies:{Fighter:[0,2],Rogue:[1,3],Cleric:[4,5],Wizard:[3,4]}[a.class],spellAbility:a.class==='Cleric'?4:3,spellDC:8+pb+m(abilities[main]),spellAttack:pb+m(abilities[main]),features:[],spells:[],knownSpells:[],prepared:[],preparedLimit:0,domainSpells:[],cantrips:[],maxSlots:[],skills:{}};
 if(a.class==='Fighter'){
  f.ac=19;f.attacks=l>=11?3:l>=5?2:1;f.maxWind=l>=10?4:l>=4?3:2;f.maxSurge=1;f.maxIndomitable=l>=9?1:0;f.critical=19;f.initiativeAdv=true;f.masteries=['长剑','轻弩','标枪',...(l>=4?['长弓']:[]),...(l>=10?['战锤']:[])];
  f.weapons=[weapon('长剑',0,'1d8','slashing',5,5,{mastery:'sap',dueling:l>=7?2:0}),weapon('轻弩',1,'1d8','piercing',80,320,{mastery:'slow',loading:true})];
  f.features=['防御战斗风格','回气','动作如潮','战术心智','勇士：精通重击、卓越运动员',...(l>=5?['额外攻击','战术移步']:[]),...(l>=7?['决斗战斗风格']:[]),...(l>=9?['不屈','战术大师']:[]),...(l>=10?['英勇斗士']:[])];
  f.skills={athletics:pb+m(abilities[0]),perception:pb+m(abilities[4])};
 }else if(a.class==='Rogue'){
  f.ac=11+m(abilities[1]);f.climb=a.speed||30;f.masteries=['短剑','短弓'];f.sneakDice=Math.ceil(l/2);f.weapons=[weapon('短剑',1,'1d6','piercing',5,5,{finesse:true,mastery:'vex'}),weapon('短弓',1,'1d6','piercing',80,320,{mastery:'vex'})];
  f.features=['偷袭','灵巧动作','稳固瞄准','盗贼：快手、二层攀爬',...(l>=5?['狡诈打击','直觉闪避']:[]),...(l>=6?['专精：察觉、调查']:[]),...(l>=7?['反射闪避','可靠才能']:[]),...(l>=9?['至高潜行']:[]),...(l>=11?['强化狡诈打击']:[])];
  f.skills={acrobatics:pb+m(abilities[1]),persuasion:pb+m(abilities[5]),perception:(l>=6?2:1)*pb+m(abilities[4]),stealth:2*pb+m(abilities[1]),investigation:(l>=6?2:1)*pb+m(abilities[3]),sleight:2*pb+m(abilities[1])};
 }else{
  f.ac=a.class==='Cleric'?18:10+m(abilities[1]);f.maxSlots=spellSlots[l].slice();spellBuild(a,f,l);
  f.weapons=a.class==='Cleric'?[weapon('硬头锤',0,'1d6','bludgeoning')]:[weapon('匕首',1,'1d4','piercing',5,5,{finesse:true}),{name:'火焰箭',bonus:f.spellAttack,dice:`${l>=11?3:l>=5?2:1}d10`,damageBonus:0,range:120,long:120,type:'fire',spell:true}];
  f.features=a.class==='Cleric'?['守护者圣职','引导神力','生命领域：生命门徒、维生',...(l>=5?['灼烧不死生物']:[]),...(l>=6?['蒙福医者']:[]),...(l>=7?['神圣打击']:[]),...(l>=10?['神圣干预']:[])]:['仪式施法','奥术回想','学者：奥秘专精','塑能师：塑能学者、强效戏法',...(l>=5?['默记法术']:[]),...(l>=6?['塑能法术']:[]),...(l>=10?['强化塑能']:[])];
  f.maxChannel=a.class==='Cleric'?(l>=6?3:2):0;f.maxIntervention=a.class==='Cleric'&&l>=10?1:0;f.maxArcane=a.class==='Wizard'?1:0;
  f.skills=a.class==='Cleric'?{persuasion:pb+m(abilities[5]),insight:pb+m(abilities[4]),religion:pb+m(abilities[3]),perception:pb+m(abilities[4]),medicine:pb+m(abilities[4])}:{arcana:2*pb+m(abilities[3]),history:pb+m(abilities[3]),investigation:pb+m(abilities[3]),religion:pb+m(abilities[3])};
 }
 return f;
}
export function advanceActor(a,l,{initial=false}={}){
 if(!a.preset||a.customBuild||!presetIds.has(a.id))return false;
 if(!a.baseAbilities)a.baseAbilities=[...a.abilities];
 const b=buildAt(a,l);if(!b)return false;
 const old={level:a.level||3,maxHp:a.maxHp,maxHd:a.maxHd||a.level||3,maxSlots:a.maxSlots||[],maxWind:a.maxWind||0,maxChannel:a.maxChannel||0,maxIndomitable:a.maxIndomitable||0,maxIntervention:a.maxIntervention||0,maxArcane:a.maxArcane||0};
 const spent={slots:b.maxSlots.map((_,i)=>Math.max(0,(old.maxSlots[i]||0)-(a.slots?.[i]||0))),wind:Math.max(0,old.maxWind-(a.wind||0)),channel:Math.max(0,old.maxChannel-(a.channel||0)),indomitable:Math.max(0,old.maxIndomitable-(a.indomitable||0)),intervention:Math.max(0,old.maxIntervention-(a.intervention||0)),arcane:Math.max(0,old.maxArcane-(a.arcane||0))};
 const oldWeapons=a.weapons||[];Object.assign(a,b);a.slots=b.maxSlots.map((n,i)=>Math.max(0,n-spent.slots[i]));
 for(const k of ['wind','channel','indomitable','intervention','arcane'])a[k]=Math.max(0,(a['max'+k[0].toUpperCase()+k.slice(1)]||0)-spent[k]);
 a.hd=Math.max(0,(a.hd||0)+b.maxHd-old.maxHd);if(initial)a.hp=b.maxHp;else if(a.hp>0)a.hp=Math.min(b.maxHp,a.hp+Math.max(0,b.maxHp-old.maxHp));
 for(const w of a.weapons){const prior=oldWeapons.find(x=>(x.baseName||x.name)===w.name);if(prior?.magic){w.baseName=w.name;w.name=prior.name;w.magic=prior.magic;w.bonus+=prior.magic;w.damageBonus+=prior.magic;}}
 a.manual='固定 SRD 构筑；属性提升、熟练、生命骰、准备上限、法术位和列出的能力随里程碑更新。升级保留已花费资源；自定义卡不自动重建。';return true;
}
export function advanceParty(s,l){for(const a of s.actors.filter(a=>a.side==='party'&&a.preset&&!a.customBuild&&presetIds.has(a.id)))if((a.level||3)<l)advanceActor(a,l);}
