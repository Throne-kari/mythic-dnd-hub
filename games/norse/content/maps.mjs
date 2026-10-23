export const TERRAIN = Object.freeze({
  wall: {name:'石墙', walkable:false, cost:0, symbol:'▧'},
  water: {name:'深水', walkable:false, cost:0, symbol:'≈'},
  ice: {name:'薄冰', walkable:true, cost:2, symbol:'❄'},
  floor: {name:'石地', walkable:true, cost:1, symbol:'·'},
  mud: {name:'泥地', walkable:true, cost:2, symbol:'∴'},
  bridge: {name:'木桥', walkable:true, cost:1, symbol:'═'},
  hazard: {name:'危险', walkable:true, cost:1, symbol:'ᛉ'},
});
const legend={'#':'wall','~':'water','i':'ice','.':'floor',':':'mud','=':'bridge','!':'hazard'};
const make=(id,name,subtitle,rows,pois,party,enemy)=>({id,name,subtitle,width:16,height:12,tiles:rows.map(r=>[...r].map(c=>legend[c])),pois:pois.map(([id,name,x,y,description])=>({id,name,x,y,description})),spawns:{party:party.map(([x,y])=>({x,y})),enemy:enemy.map(([x,y])=>({x,y}))},enemies:enemy.map(([x,y],i)=>({kind:({harbor:['raider','wolf'],thing:['raider','raider'],mound:['draugr','draugr'],hel:['wraith','draugr'],forest:['wolf','raider'],forge:['jotun','draugr']})[id][i%2],x,y}))});
export const MAPS = [
  make('harbor','盐风港','盐雾与黑水间，旧债仍未结清。',[
    '################','##....ii~~~ii###','#.....ii~~~~~ii#','#..#...i~~~~~~~#','#......i~~~~~~~#','#....===========','#....==i~~~~~~~#','#....==i~~~~~~~#','#..:...i~~iii~~#','#..::..iiii..ii#','#......ii......#','################',
  ],[['harbor-bell','风暴钟',3,2,'盐锈覆住钟舌；缠在铜环上的新绳仍有余温。'],['harbor-ledger','港务账亭',2,7,'船费与粮运同写在一本账上，缺页边缘沾着黑蜡。'],['harbor-boat','未返的船',11,5,'冻住的缆绳没有断，船上的人却不在。']],[[3,8],[4,8],[3,9],[4,9]],[[9,5],[12,5]]),
  make('thing','议事长屋','三份誓约，一张不能空下的长桌。',[
    '################','#..............#','#.##........##.#','#.##...!!...##.#','#..............#','#...##....##...#','#...##....##...#','#..............#','#.##........##.#','#.##........##.#','#......==......#','################',
  ],[['thing-oath','断誓石',7,3,'三道新裂痕穿过古老刻字。'],['thing-table','长老之席',11,2,'每位发言者都须说明，究竟由谁履行其承诺。'],['thing-store','粮仓封蜡',4,8,'封蜡完整，印章的边沿却被反复摩挲。']],[[6,9],[7,9],[8,9],[9,9]],[[6,4],[9,4]]),
  make('mound','旧丘墓环','被冰雪封存的，并不总是死者。',[
    '################','#ii.....ii~~iii#','#i..##..ii~~iii#','#..#..#..i~~iii#','#..#.!...i~~iii#','#...##...i==iii#','#i.......i==iii#','#i..::...i~~iii#','#i..::##.i~~iii#','#ii...#!.iii..i#','#iii..#..iii..i#','################',
  ],[['mound-ring','质押臂环',5,4,'古铜臂环紧扣在石掌上；誓言与真实的持有人必须分清。'],['mound-name','无名墓碑',7,9,'六行刻文留着一行空白，名字只能由本人决定。']],[[3,6],[4,6],[3,7],[4,7]],[[7,4],[8,9]]),
  make('hel','雾厅渡口','黑水没有回声，船夫只问归程。',[
    '################','#~~~iii...ii~~~#','#~~~ii.....i~~~#','#~~~ii..#..i~~~#','#~~iii..#..ii~~#','#====...!..====#','#====......====#','#~~iii.....ii~~#','#~~~ii..#..i~~~#','#~~~ii.....i~~~#','#~~~~iii.iii~~~#','################',
  ],[['hel-ferry','亡者渡船',3,5,'船身浮在水面，影子却朝着另一岸。'],['hel-witness','雾厅证席',8,5,'亡者只说亲眼所见；沉默不是承认。'],['hel-lantern','返乡灯',12,6,'一盏未熄的灯标出仍可返回的方向。']],[[7,9],[8,9],[7,10],[9,9]],[[7,4],[9,4]]),
  make('forest','冻林粮道','最后一袋粮种，不能只按价称量。',[
    '################','#ii#iiiiiii#iii#','#i#iii::iiii#ii#','#iii:::::iiiiii#','#ii#:::ii#iiiii#','#iii::~~~~~iiii#','#iiii=======iii#','#iiii~~~~~::iii#','#ii#iiiii:::ii##','#iiii#iii::iiii#','#iiiiiiiiiii#ii#','################',
  ],[['forest-seed','覆雪粮车',5,3,'粮种仍能发芽，车轴却已被冻断。'],['forest-track','分岔足迹',10,8,'一队足迹向屋舍，另一队通往无火的林地。'],['forest-shelter','守林小棚',2,8,'棚门可修，柴火可借，责任须写到具体的人。']],[[3,9],[4,9],[3,10],[4,10]],[[10,6],[11,7]]),
  make('forge','余烬锻炉','余火与新铁，都需要有人照看。',[
    '################','#....##....##..#','#....##....##..#','#..!!.....!!...#','#..!!..##.!!...#','#......##......#','#..##......##..#','#..##..::..##..#','#.....::::.....#','#..##......##..#','#......==......#','################',
  ],[['forge-fire','最后的炉火',4,3,'火仍活着，守火人等着一个可兑现的修复方案。'],['forge-stone','第六行',11,3,'碑石上的空白并非疏漏。'],['forge-tools','共用工具架',8,8,'绳、钳和修屋用的钉子各有实际主人。']],[[6,9],[7,9],[8,9],[9,9]],[[6,4],[9,4]]),
];
export const maps=Object.fromEntries(MAPS.map(map=>[map.id,map]));
export const getMap=id=>maps[id]?structuredClone(maps[id]):null;
export default maps;
