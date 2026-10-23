import {advanceActor} from './progression.mjs';
import {campaignOptions} from './campaign-play.mjs';
import {bestiary,rawStatBlocks} from './bestiary.mjs';
export const weapon = (name, bonus, dice, damageBonus, range=5, long=range, type='slashing', extra={}) => ({name,bonus,dice,damageBonus,range,long,type,...extra});
export const templates = {
  bandit: {name:'假军差',ac:12,maxHp:11,speed:30,initiative:1,abilities:[11,12,12,10,10,10],weapons:[weapon('弯刀',3,'1d6',1,5,5),weapon('轻弩',3,'1d8',1,80,320,'piercing')],source:'SRD 5.2.1 Bandit p.261'},
  scout: {name:'仓院弓手',ac:13,maxHp:16,speed:30,initiative:2,abilities:[11,14,12,11,13,11],attacks:2,weapons:[weapon('短剑',4,'1d6',2,5,5,'piercing'),weapon('长弓',4,'1d8',2,150,600,'piercing')],source:'SRD 5.2.1 Scout p.322'},
  berserker: {name:'曹斗',ac:13,maxHp:67,speed:30,initiative:1,abilities:[16,12,17,9,11,9],frenzy:true,weapons:[weapon('巨斧',5,'1d12',3)],source:'SRD 5.2.1 Berserker p.263'},
  armor: {name:'守祠铜甲',ac:18,maxHp:33,speed:25,initiative:2,abilities:[14,11,13,1,3,1],attacks:2,construct:true,weapons:[weapon('重击',4,'1d6',2,5,5,'bludgeoning')],source:'SRD 5.2.1 Animated Armor p.259'},
  sword: {name:'守祠飞剑',ac:17,maxHp:14,speed:50,initiative:4,abilities:[12,15,11,1,5,1],construct:true,weapons:[weapon('剑刃',4,'1d8',2)],source:'SRD 5.2.1 Animated Flying Sword p.259; 使用飞行速度，垂直移动由 DM 裁定'}
};
Object.assign(templates,bestiary);
for(const type of ['bandit','scout','berserker','armor','sword'])if(rawStatBlocks.blocks[type])templates[type].fullStatBlock=rawStatBlocks.blocks[type].text;
for(const type of ['armor','sword'])Object.assign(templates[type],{immunities:['poison','psychic'],conditionImmunities:['charmed','deafened','exhaustion','frightened','paralyzed','petrified','poisoned'],creatureType:'Construct',blindsight:60});
export function party() {
  const shared={side:'party',level:3,speed:30,attacks:1,potions:1,death:[0,0],controller:'human',slots:[0,0],maxSlots:[0,0],hd:3,maxHd:3,conditions:[],reaction:true};
  return [
    {id:'p1',name:'姬衡',role:'执盾武者',class:'Fighter',color:'#d5aa69',ac:18,maxHp:28,abilities:[16,12,14,10,13,10],initiative:1,hitDie:10,wind:2,maxWind:2,surge:1,weapons:[weapon('长剑',5,'1d8',3),weapon('轻弩',3,'1d8',1,80,320,'piercing')],skills:{athletics:5,persuasion:0,perception:3},portrait:'衡',bio:'西岐出身的护送者。先让身后的人走过去，再谈谁赢。',manual:'战斗风格、武器精通、子职能力请按完整角色卡由 DM 裁定；此卡只预配基础攻击、回气与动作如潮。'},
    {id:'p2',name:'燕归',role:'轻足游荡者',class:'Rogue',color:'#7bb6a1',ac:14,maxHp:24,abilities:[10,16,14,13,12,10],initiative:3,hitDie:8,weapons:[weapon('短剑',5,'1d6',3,5,5,'piercing',{finesse:true}),weapon('短弓',5,'1d6',3,80,320,'piercing')],skills:{athletics:0,persuasion:2,perception:3,stealth:7,investigation:3},portrait:'归',bio:'识路，也识人说谎时看向何处。',manual:'按游荡者基础卡。自动偷袭 2d6 与附赠疾走/撤离；隐藏、武器精通、子职请交 DM。'},
    {id:'p3',name:'陆青',role:'持符医者',class:'Cleric',color:'#9fbcdc',ac:18,maxHp:24,abilities:[13,10,14,10,16,12],initiative:0,hitDie:8,slots:[4,2],maxSlots:[4,2],weapons:[weapon('硬头锤',3,'1d6',1,5,5,'bludgeoning')],skills:{athletics:1,persuasion:1,perception:5,medicine:5},portrait:'青',bio:'符纸落在掌心，火光照见伤口。',manual:'按牧师基础卡。预配疗伤术、治愈真言；其余准备法术、引导神力和子职由 DM 裁定。'},
    {id:'p4',name:'闻溪',role:'行旅法师',class:'Wizard',color:'#be9fce',ac:12,maxHp:20,abilities:[8,14,14,16,12,10],initiative:2,hitDie:6,slots:[4,2],maxSlots:[4,2],weapons:[weapon('匕首',4,'1d4',2,5,5,'piercing',{finesse:true}),weapon('火焰箭',5,'1d10',0,120,120,'fire',{spell:true})],skills:{athletics:-1,persuasion:0,perception:1,arcana:5,investigation:5},portrait:'溪',bio:'带着半卷书出门，想知道书外的山河。',manual:'按法师基础卡。预配火焰箭、魔法飞弹；其余法术、仪式、奥术回想和子职由 DM 裁定。'}
  ].map(p=>{const a={...structuredClone(shared),...p,hp:p.maxHp,x:0,y:0,preset:true};advanceActor(a,3,{initial:true});return a;});
}
export const ferry = {map_id:'FERRY',name:'青蒲渡',width_ft:100,height_ft:80,grid_ft:5,rooms:[{x:5,y:5,w:65,h:70,kind:'yard',label:'渡口'}],walls:[],openings:[],features:[{kind:'water',x:80,y:0,w:20,h:80,height_ft:0,label:'河水（游泳由 DM 裁定）'},{kind:'cart',x:12,y:50,w:10,h:5,height_ft:4,label:'粮车'},{kind:'cart',x:27,y:50,w:10,h:5,height_ft:4,label:'粮车'},{kind:'tree',x:8,y:15,w:6,h:6,height_ft:15},{kind:'tree',x:60,y:12,w:6,h:6,height_ft:18},{kind:'floor',x:65,y:32,w:20,h:10,height_ft:1,label:'渡船栈道'}],gm_markers:[],notes:['渡口为本次游戏改编的可逆场地；100×80尺。'],routes_to_check:[]};
export const openings = {
 FERRY:'河风吹过芦苇。十二名旅人守着两车口粮，等候前往西岐的渡船。阮寿横过刀鞘：“军中查验，粮车留下。”陶七悄悄摇头——这道军令，他从未见过。',
 B001:'旧祠的院门敞着，歪树投下一片碎影。东侧屋传来压低的求救声。前厅以北，一道磨旧的白石线横在殿门前，铜甲与悬剑沉默地守着供台。',
 B002:'粮袋垒在石梁仓墙下，袋口依稀看得见原主的记号。曹斗站在粮车旁，两个弓手盯着院门。他先开口：“人可以走，粮得留下。”'
};
export const starting = {
 FERRY:[[32.5,67.5],[42.5,67.5],[32.5,72.5],[42.5,72.5]],
 B001:[[32.5,92.5],[37.5,92.5],[32.5,97.5],[37.5,97.5]],
 B002:[[32.5,52.5],[37.5,52.5],[32.5,57.5],[37.5,57.5]]
};
export function encounter(id) {
  const list=id==='FERRY'?[['bandit','阮寿',32.5,32.5],['bandit','假军差乙',42.5,32.5],['bandit','假军差丙',52.5,37.5],['bandit','假军差丁',22.5,37.5]]:
    id==='B001'?[['armor','守祠铜甲',32.5,32.5],['sword','守祠飞剑',42.5,27.5]]:
    id==='B002'?[['berserker','曹斗',52.5,27.5],['scout','北檐弓手',47.5,17.5],['scout','木箱旁弓手',22.5,27.5]]:[];
  return list.map(([type,name,x,y],i)=>({...structuredClone(templates[type]),id:`${id}-e${i}`,type,name,x,y,hp:templates[type].maxHp,side:'enemy',conditions:[],reaction:true,death:[0,0],controller:'local'}));
}
export function choices(s) {
 if(s.chapter>1)return campaignOptions(s);
 if(s.combat) return [];
 const f=s.flags;
 if(s.scene==='FERRY') return [
  {id:'inspect',label:'查看军令',text:'认真查看纸上印记与文书。'},
  ...(f.forgery&&!f.ferryClear?[{id:'expose',label:'指出假令，给他们退路',text:'不必掷骰；阮寿愿意活着离开。'}]:[]),
  ...(!f.ferryClear?[{id:'persuade',label:'劝军差放行',text:'说服 DC15；失败可以换一种办法。'},{id:'bypass',label:'随陶七绕行浅滩',text:'花半天护送旅人与自有粮车，不必交战。'}]:[]),
  {id:'shrine',label:'沿林路去旧祠',text:'约十五至二十分钟。'},
  {id:'warehouse',label:'前往石梁仓',text:'追查被劫的粮食。'},
  ...(f.ferryClear&&!f.chapter1Done?[{id:'finish',label:'护送旅人与粮车过河',text:'完成本回，并记录你们留下的选择。'}]:[]),
  ...campaignOptions(s)
 ];
 if(s.scene==='B001') return [
  ...(!f.ledger?[{id:'ledger',label:'搜索前厅松砖',text:'走到前厅西侧（约 22.5,52.5 尺），认真查看即可找到。'}]:[]),
  ...(!f.ahe?[{id:'rescue',label:'救出阿禾',text:'先走到侧屋门旁，移去横木；或到东窗外用绳协助。'}]:[]),
  {id:'warehouse',label:'前往石梁仓',text:'阿禾与粮袋都能作为证据。'},{id:'ferry',label:'回到青蒲渡',text:'回到旅人与渡工身边。'}
 ];
 if(s.scene==='B002') return [
  ...(!f.grain?[{id:'grainmarks',label:'查看粮袋记号',text:'靠近粮车，找到原主的标记。'},{id:'bargain',label:'让曹斗交粮后离开',text:f.ledger||f.ahe||f.grainEvidence?'已有证据；条件明确即可成交。':'说服 DC15；同一说辞不重复刷骰。'}]:[]),
  {id:'shrine',label:'去旧祠找阿禾',text:'道路仍然通着。'},{id:'ferry',label:'返回渡口',text:'把实际找到的人与物带回去。'}
 ];
 return [];
}
