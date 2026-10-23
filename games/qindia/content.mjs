import {campaignData as pack} from './campaign-data.mjs';
import {party as baseParty} from './preset-base.mjs';
import {advanceActor} from './progression.mjs';
import {campaignOptions} from './campaign-play.mjs';
import {bestiary} from './bestiary.mjs';
export const templates=bestiary;
export const initialScene=pack.initialScene;
export const weapon=(name,bonus,dice,damageBonus,range=5,long=range,type='slashing',extra={})=>({name,bonus,dice,damageBonus,range,long,type,...extra});
export const openings=Object.fromEntries(pack.chapters.map(ch=>[ch.scene,ch.opening||ch.description]));
export const starting=Object.fromEntries(Object.entries(pack.scenes).map(([id,sc])=>[id,(sc.starting||[[2.5,2.5],[7.5,2.5],[12.5,2.5],[17.5,2.5]]).map(([x,y])=>[Math.min(sc.width_ft-2.5,Math.floor(x/5)*5+2.5),Math.min(sc.height_ft-2.5,Math.floor(y/5)*5+2.5)])]));
export function party(){
 const common={side:'party',level:3,proficiency:2,speed:30,attacks:1,potions:1,death:[0,0],controller:'human',slots:[],maxSlots:[],hd:3,maxHd:3,conditions:[],effects:[],reaction:true,preset:true,species:'Human',size:'Medium',darkvision:0,inspiration:1,heroicInspiration:true,languages:['通用语'],tools:[],inventory:['背包','口粮1日','水袋','火绒盒','麻绳50尺'],build:'SRD 5.2.1 固定预建卡'};
 const defaults=[
  {id:'p1',name:'守护者',role:'执盾战士',class:'Fighter',abilities:[16,13,16,8,12,10],ac:19,maxHp:31,hitDie:10,wind:2,maxWind:2,surge:1,maxSurge:1,shield:true,armor:'链甲',stealthDisadvantage:true,fightingStyle:'Defense',savageAttacker:true,portrait:'盾',color:'#c89b65'},
  {id:'p2',name:'行路者',role:'轻足游荡者',class:'Rogue',abilities:[8,17,14,14,12,10],ac:15,maxHp:24,hitDie:8,armor:'皮甲',ammunition:20,portrait:'路',color:'#7dafa1'},
  {id:'p3',name:'疗愈者',role:'生命牧师',class:'Cleric',abilities:[13,10,14,12,17,9],ac:18,maxHp:24,hitDie:8,shield:true,armor:'链甲',stealthDisadvantage:true,divineOrder:'Protector',portrait:'愈',color:'#a5b9ce'},
  {id:'p4',name:'求知者',role:'塑能法师',class:'Wizard',abilities:[8,14,13,17,13,10],ac:12,maxHp:17,hitDie:6,armor:'无甲',portrait:'书',color:'#b39ac2'}
 ];
 return baseParty().map((base,i)=>{const d=defaults[i];const a=base;const prior=structuredClone(a);a.baseAbilities=[...a.abilities];if((pack.initialLevel||3)>3){advanceActor(a,pack.initialLevel,{initial:true});const skillAbility={acrobatics:1,animalhandling:4,arcana:3,athletics:0,deception:5,history:3,insight:4,intimidation:5,investigation:3,medicine:4,nature:3,perception:4,performance:5,persuasion:5,religion:3,sleight:1,stealth:1,survival:4},mod=n=>Math.floor((n-10)/2);for(const [skill,old]of Object.entries(prior.skills)){const stat=skillAbility[skill];const rank=Math.max(0,Math.min(2,Math.round((old-mod(prior.abilities[stat]))/2)));a.skills[skill]=mod(a.abilities[stat])+rank*a.proficiency;}a.initiative=mod(a.abilities[1])+(a.alert?a.proficiency:0);a.weapons=prior.weapons.map(w=>{const oldMods=prior.abilities.map(mod),newMods=a.abilities.map(mod);const primary=w.spell?prior.spellAbility:w.finesse?(oldMods[1]>=oldMods[0]?1:0):w.range>5&&!w.thrown?1:0;return {...w,bonus:a.proficiency+newMods[primary],damageBonus:w.spell?0:newMods[primary]};});a.features=[...new Set([...a.features,...prior.features.filter(f=>/Human|Skilled|Magic Initiate|Savage|Alert/.test(f))])];a.cantrips=[...new Set([...(a.cantrips||[]),...(prior.cantrips||[])])];a.spells=[...new Set([...a.spells,...a.cantrips,...(a.alwaysPrepared||[])])];}a.saves=a.abilities.map((n,j)=>Math.floor((n-10)/2)+(a.saveProficiencies.includes(j)?a.proficiency:0));a.armor=a.class==='Rogue'?'铆钉皮甲':a.armor;a.background=['Soldier','Criminal','Acolyte','Sage'][i];a.preset=true;a.customBuild=false;const identity=pack.party?.find(p=>p.id===a.id)||pack.party?.[i]||{};for(const k of ['name','role','bio','portrait','color','languages','tools','inventory','background','privateBrief'])if(identity[k]!==undefined)a[k]=structuredClone(identity[k]);const named=pack.characterNames?.[['warrior','rogue','cleric','wizard'][i]];if(named)a.name=typeof named==='string'?named:named.name;a.potions=Math.floor((pack.initialPotions??4)/4)+(i<(pack.initialPotions??4)%4?1:0);a.bio??='沿实际目标、物品和道路决定自己的行动。';return a;});
}
export function encounter(){return [];}
export function choices(s){return campaignOptions(s);}
