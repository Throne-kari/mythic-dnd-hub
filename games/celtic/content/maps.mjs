export const TERRAIN=Object.freeze({
  wall:{name:'石墙',walkable:false,cost:0,symbol:'▧'},water:{name:'深水',walkable:false,cost:0,symbol:'≈'},
  floor:{name:'石地',walkable:true,cost:1,symbol:'·'},stone:{name:'立石',walkable:true,cost:1,symbol:'◇'},
  forest:{name:'荆林',walkable:true,cost:2,symbol:'♧'},mud:{name:'湿泥',walkable:true,cost:2,symbol:'∴'},
  bridge:{name:'石堤',walkable:true,cost:1,symbol:'═'},hazard:{name:'异界裂隙',walkable:true,cost:1,symbol:'✧'},
  ice:{name:'冷雾',walkable:true,cost:2,symbol:'❄'},snow:{name:'花灰',walkable:true,cost:2,symbol:'❋'}
});
const WIDTH=20,HEIGHT=14;
function base(id,name,subtitle,terrain='floor') {
  return {id,name,subtitle,width:WIDTH,height:HEIGHT,tiles:Array.from({length:HEIGHT},(_,y)=>Array.from({length:WIDTH},(_,x)=>x===0||y===0||x===WIDTH-1||y===HEIGHT-1?'wall':terrain)),pois:[],spawns:{party:[{x:2,y:10},{x:3,y:10},{x:2,y:11},{x:3,y:11}],enemy:[]},enemies:[]};
}
const fill=(map,x,y,w,h,terrain)=>{for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)map.tiles[yy][xx]=terrain;};
const point=(map,id,name,x,y,description)=>{map.pois.push({id,name,x,y,description});};
const foes=(map,...entries)=>{map.enemies=entries.map(([kind,x,y])=>({kind,x,y}));map.spawns.enemy=entries.map(([,x,y])=>({x,y}));};

const dunharrow=base('dunharrow','棘冠王庭','环堤、王座与仍可走出庭门的人。');
fill(dunharrow,6,2,9,1,'wall');fill(dunharrow,6,2,1,5,'wall');fill(dunharrow,14,2,1,5,'wall');fill(dunharrow,6,6,9,1,'wall');
fill(dunharrow,9,6,3,1,'floor');fill(dunharrow,8,3,5,1,'stone');fill(dunharrow,16,2,2,4,'forest');fill(dunharrow,2,3,2,3,'mud');
fill(dunharrow,5,9,11,1,'stone');
point(dunharrow,'crown-seat','空冠王座',10,4,'荆冠放在未坐人的王座上。座前有两条旧痕：一条是请愿者的鞋印，一条是被拖离者的脚跟。');
point(dunharrow,'common-granary','公共粮秤',4,8,'粮秤两边都能放物；谁负责定秤、谁有权拒绝称量，比秤砣上的王印更能决定收成。');
point(dunharrow,'court-record','庭外记名石',16,9,'成年归来者、潮门守卫与王庭旧役的名字分列三面。有人名下只有空白，不是没有活过，而是没有获准留下话。');
foes(dunharrow,['raider',10,5],['raider',13,8]);

const oathwood=base('oathwood','橡誓圣林','苔石围住泉眼，誓言沿水流到别人的田地。','forest');
fill(oathwood,10,1,2,12,'water');fill(oathwood,9,7,4,2,'bridge');fill(oathwood,2,8,7,4,'floor');
fill(oathwood,4,2,4,4,'floor');fill(oathwood,5,3,2,2,'stone');fill(oathwood,14,3,3,4,'floor');
fill(oathwood,15,4,1,1,'water');fill(oathwood,14,10,3,2,'mud');fill(oathwood,3,1,2,1,'wall');
point(oathwood,'oak-geis','缚誓橡根',6,4,'旧誓刻在活树根上，树皮把几处名字包进了年轮。新刻的誓文只要写下，便会真的向土地索取供养。');
point(oathwood,'brigid-well','三火泉井',14,5,'井旁三盏火分别留给炉灶、锻工和记诗人。水能救治眼前的病人，不能替任何人免去已经付出的代价。');
point(oathwood,'forest-refuge','避役者营地',15,11,'灰烬仍温着。这里的成年人各自留下了要带走的物品清单；没有一份清单同意把本人交给下一位领主。');
foes(oathwood,['wolf',7,6],['raider',15,8]);

const barrow=base('barrow','白骨陵丘','陵门朝着海，归来者却从内侧敲门。','mud');
fill(barrow,5,2,10,1,'wall');fill(barrow,5,2,1,8,'wall');fill(barrow,14,2,1,8,'wall');fill(barrow,5,9,10,1,'wall');
fill(barrow,6,3,8,6,'floor');fill(barrow,9,9,2,1,'stone');fill(barrow,9,2,2,1,'stone');fill(barrow,8,4,4,2,'stone');
fill(barrow,1,3,2,4,'water');fill(barrow,16,2,2,3,'forest');fill(barrow,16,9,2,2,'hazard');
point(barrow,'cauldron-rim','无底釜沿',10,5,'铜釜里没有倒影。釜边的凹槽能够容纳手掌、骨片和写过名字的木签，留下哪一样，归来的便会向哪一样索债。');
point(barrow,'grave-witness','陵门见证刻',9,8,'守陵者把死者最后说的话与后来替他们添上的话分开刻。最深的一道刻痕写着：归来并不等于仍是原来的人。');
point(barrow,'unclaimed-bones','未领骨匣',16,11,'骨匣各留着不同家族的旧系带。收回尸骨、役使尸骨与承认失踪，是三种会改变生者生活的决定。');
foes(barrow,['draugr',8,6],['wraith',12,4]);

const tidegate=base('tidegate','黑潮巨门','海水越过阶台时，旧贡物仍在门槛上。','mud');
fill(tidegate,10,1,9,12,'water');fill(tidegate,8,6,11,3,'bridge');fill(tidegate,15,3,3,8,'stone');
fill(tidegate,4,2,4,3,'wall');fill(tidegate,5,4,2,1,'floor');fill(tidegate,2,8,6,4,'floor');
fill(tidegate,12,6,1,1,'hazard');fill(tidegate,13,8,1,1,'hazard');
point(tidegate,'tribute-stair','贡税石阶',7,7,'潮线高过去年钉在墙上的木牌。贡物每次加重，守门人仍把它叫作同一份古老约定。');
point(tidegate,'fomorian-gate','福莫尔潮闸',16,5,'巨门一侧系着渔村的小船，另一侧缠着能转动闸轴的铁链。毁门、守门和握住链条，将把不同的人留在海边。');
point(tidegate,'storm-mark','海暴刻度',17,10,'刻度没有写神的名字，只写每次涨潮淹到了谁的家。最上方的新刻痕还未被盐风磨白。');
foes(tidegate,['jotun',16,7],['raider',9,7]);

const sidhe=base('sidhe','无暮之廷','银枝没有落叶，席间却少了一季人间。','snow');
fill(sidhe,3,3,14,7,'floor');fill(sidhe,4,3,1,6,'wall');fill(sidhe,15,3,1,6,'wall');
fill(sidhe,5,4,10,1,'stone');fill(sidhe,5,8,10,1,'stone');fill(sidhe,9,3,2,1,'hazard');
fill(sidhe,9,6,2,1,'water');fill(sidhe,9,7,2,1,'bridge');fill(sidhe,2,1,3,1,'forest');fill(sidhe,16,10,2,2,'forest');
point(sidhe,'silver-branch','银枝计年',7,4,'枝上三枚银铃分别记得出发、停留和归返。铃声同时响起时，凡间有人会替席上的客人度过一整年。');
point(sidhe,'sidhe-feast','不散之宴',13,6,'果盘每次回到眼前都像初次摆上，唯有门口鞋底的泥越来越干。宴约能够保证快乐，不能保证何时回家。');
point(sidhe,'returning-door','朝人间的门',10,10,'门外能看见篱笆和熟悉的山。门内记录着每次穿越所借用的岁月；归程必须由谁偿还，仍可以当面谈清。');
foes(sidhe,['wraith',8,6],['wraith',13,7]);

const causeway=base('causeway','归潮石堤','三条路在退潮线交汇，远处有人等你们开门。','water');
fill(causeway,1,9,6,4,'floor');fill(causeway,5,6,13,3,'bridge');fill(causeway,8,2,5,10,'stone');
fill(causeway,2,2,5,3,'forest');fill(causeway,6,3,3,1,'bridge');fill(causeway,14,2,4,3,'mud');fill(causeway,12,3,3,1,'bridge');
fill(causeway,16,8,2,4,'floor');fill(causeway,11,5,1,1,'hazard');fill(causeway,8,8,1,1,'hazard');
point(causeway,'three-pledges','三路交誓台',10,4,'王庭的冠、陵丘的釜和异界的银枝各占一角。每一件都能兑现力量，每一件也都能把没有来到这里的人写进代价里。');
point(causeway,'last-return','归潮登岸点',5,10,'岸上留着不同尺码的鞋。选择一条能让自己回来却不让别人回来之路，也会留下清楚可见的脚印。');
point(causeway,'shore-names','岸上人名桩',16,10,'立桩上写着自愿迁居、拒绝征召与等待归人的名单。名单不是祭品目录，也可以被掌权者改造成那个样子。');
foes(causeway,['jotun',11,6],['wraith',14,7]);

export const MAPS=[dunharrow,oathwood,barrow,tidegate,sidhe,causeway];
export const maps=Object.fromEntries(MAPS.map(map=>[map.id,map]));
export const getMap=id=>maps[id]?structuredClone(maps[id]):null;
export default maps;
