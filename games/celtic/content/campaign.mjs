import {installEndings} from './endings.mjs';

// 原创战役；爱尔兰叙事传统为主要母题来源，具体王国、人物、法术与制度均为本作创作。
const f=id=>({flag:id});
const no=value=>({not:value});
const all=(...value)=>({all:value});
const any=(...value)=>({any:value});
const silver=n=>({resourceAtLeast:{gold:n}});
const food=n=>({resourceAtLeast:{supplies:n}});
const merge=(...parts)=>{
  const out={};
  for(const part of parts.filter(Boolean))for(const [key,value]of Object.entries(part)){
    if(['resources','relations','factions','flags','quests'].includes(key))out[key]={...(out[key]||{}),...value};
    else if(key==='unlockScenes')out[key]=[...(out[key]||[]),...value];
    else out[key]=value;
  }
  return out;
};
const done=(id,effects={})=>{
  const n=Number(id.slice(1));
  const next=/^[ABC]\d+$/.test(id)?(n===5?null:n===10?'interlude':`${id[0]}${n+1}`):null;
  return merge({flags:{[`${id}_done`]:true},unlockScenes:next?[next]:[]},effects);
};
const opt=(id,label,description,effects={},extra={})=>({id,label,description,effects,next:'hub',once:true,...extra});
const arc={A:'荆冠与土地',B:'七夜归潮',C:'无名者之誓'};
const step=(id,title,mapId,text,choices,extra={})=>{
  const n=Number(id.slice(1)),chapter=n<=5?1:n<=10?2:3;
  return {id,chapter,arc:arc[id[0]],title,location:title,mapId,text,once:true,
    requires:all({chapterAtLeast:chapter},{sceneUnlocked:id},no(f(`${id}_done`))),choices,...extra};
};
const result=(text,effects)=>({text,effects,next:'hub'});

export const campaign={
  id:'celtic-thorncrown-returning-tide-v1',version:'1.0.0',title:'荆冠与归潮',
  subtitle:'三章 · 三条交织主线 · 二十四种结局',
  prologue:'萨温将至，杜恩·卡奥兰的第七次收成没有成熟。七十年前失踪的船却从潮门驶回，船上人只老了七夜。摄政说，土地、岁月与名字都可以抵债。你们带着自己的旧舟与二十八枚银币，来到一张空着第七只碗的宴席。',
  startScene:'prologue',
  initialState:{chapter:1,resources:{gold:28,supplies:12,potions:5},relations:{siofra:0,fergal:0,mael:0},factions:{root:0,veil:0,ledger:0},flags:{party_boat:true},quests:{land:'active',time:'active',name:'active',siofra:'active',fergal:'active',mael:'active'},unlockScenes:['prologue']},
  resourceLabels:{gold:'共同银币',supplies:'行粮与柴料',potions:'疗伤药水'},
  statLabels:{str:'力量',dex:'敏捷',con:'体质',int:'智力',wis:'感知',cha:'魅力'},
  party:[
    {id:'p1',name:'芬恩',role:'护路战士 · 盾推与救援',bio:'三十四岁的渡口护卫，曾替旧王征取最后一袋种粮。他带着一面修过七次的盾，如今要决定它朝向哪一边。'},
    {id:'p2',name:'奈芙',role:'荆林游侠 · 侦查与牵制',bio:'二十九岁的林路猎手。她的田在抄来的地契上消失过，活人的脚印比王庭的边界更值得她信任。'},
    {id:'p3',name:'艾妲',role:'守火祭司 · 愈合与护持',bio:'三十八岁的行旅医者，供奉布里吉德。她既会照料活人，也会认出一具被迫继续工作的遗体。'},
    {id:'p4',name:'布兰诺克',role:'欧甘术士 · 识读与封路',bio:'三十一岁的刻字人，名字与著名航海者布兰无亲缘关系。他能辨认树边文字，也知道字可以被掌权者用成绞索。'}
  ],
  companions:[
    {id:'siofra',name:'席芙拉',role:'归来船工 · 七夜与七十年',faction:'veil',portrait:'siofra',campScene:'camp_siofra',description:'成年船工，随失踪船返回时仍是三十六岁。妹妹已在二十年前去世，妹妹的成年孙女却与她一样高。她愿带人认潮，不愿让另一个家庭替自己的失年付账。',stance:'想取得属于今天的生活；支持能逐人退出的渡航，反对偷取他人的余生。',reactions:[{requires:f('stolen_years'),stance:'亲眼见过你们抽取守门人的岁月。她仍给出已知潮线，拒绝为新的盗年航行掌舵。'},{requires:f('lifespan_contract'),stance:'寿年契已签，不能靠一句补偿撤回被夺的岁月；她要求每名当事人的名字保留在账上。'},{requires:f('return_roster'),stance:'归乡者逐人留下意愿，她准备第一次去见已经成年的外甥孙女。'},{requires:f('siofra_home'),stance:'你们听见她想去的那扇门，没有要求她永远扮演七十年前的人。'}]},
    {id:'fergal',name:'费尔加',role:'守誓者 · 旧王留下的命令',faction:'root',portrait:'fergal',campScene:'camp_fergal',description:'四十二岁的王庭守卫。旧王把不许拒客与不许在暮后开门两道誓禁缠在他身上，摄政曾利用矛盾逼他交出一名求庇护的友人。',stance:'愿保护具体的人；要求新誓写清命令范围，不再以誓的名义免去发令者责任。',reactions:[{requires:f('names_bound'),stance:'活人名字被缚进王册，他退出执行新命令的守卫队；自己曾立的旧誓仍待处理。'},{requires:f('oath_weapon'),stance:'你们把相冲的誓禁用作武器。他不会替这种诅咒选择下一名对象。'},{requires:f('oath_rewritten'),stance:'他接受可以拒绝明显伤害命令的新誓，愿以自己的名义作一季守卫。'},{requires:f('fergal_heard'),stance:'旧事已说清。他愿协助拆解具体誓文，没有交出今后所有决定。'}]},
    {id:'mael',name:'梅尔',role:'记名师 · 活人写成死者',faction:'ledger',portrait:'mael',campScene:'camp_mael',description:'四十六岁的成年记名师，曾把六名反对征收的农人列入死亡册。其中四人仍活着。院长卡苏拿他的署名作威胁，他带着一张撕下的底稿来见你们。',stance:'想公开底稿、还活人原名；愿受追问，不愿靠再消掉一个人的名字赎罪。',reactions:[{requires:f('names_sold'),stance:'你们售出了避难者的原名，他拒绝继续提供新名单，已经交出的底稿没有消失。'},{requires:f('hidden_ledger'),stance:'原册留在新的秘密掌权者手里，他保留自己那页罪证，拒绝为秘密名册署名。'},{requires:f('public_ledger'),stance:'底稿和修订一起公开。他愿站在受害者面前，承担曾经署过的名字。'},{requires:f('mael_confessed'),stance:'他知道你们没有替他免罪，也没有把他的供述当成可以出售的货。'}]}
  ],
  factions:[
    {id:'root',name:'赤楸诸户',leader:'穆伊琳与村议者奥兰',description:'耕户、守林人和旧贵族中反对永久献收成的人。土地化身穆伊琳会说话，却不能替每个住在土地上的人投票。',goal:'取回能播种的田与可拒绝的王令。'},
    {id:'veil',name:'银潮诸庭',leader:'潮使伊蕾丝',description:'居于丘下与潮外的多支异界庭院。有人愿立分季条约，有人把凡人的一生当成宴席上一枚筹码，并非同一种意志。',goal:'保有通路与界限，决定是否继续接受人间献年。'},
    {id:'ledger',name:'黑蜡记名院',leader:'院长卡苏',description:'保存谱系、誓文与死亡册的记名师组织。其记录确曾护住流民继承权，也被院长改造成能征用活人与亡者的王册。',goal:'保住记名权；院内有人要求公开，有人愿为新王继续封蜡。'}
  ],
  quests:[
    {id:'land',title:'荆冠与土地',summary:'第七收成被旧王的异界献约扣住。听土地发言、落实种粮与权柄，决定这座王国靠什么继续存在。',nodeIds:Array.from({length:15},(_,i)=>`A${i+1}`),stakes:'统治、饥荒、土地化身、役尸丰年、永冬。'},
    {id:'time',title:'七夜归潮',summary:'失踪七十年的船只过了七夜。归来者要面对已经长大的家谱；时间可以归还，也可以从别人身上偷来。',nodeIds:Array.from({length:15},(_,i)=>`B${i+1}`),stakes:'归乡、老去、异界宴席、代际债、偷取余生。'},
    {id:'name',title:'无名者之誓',summary:'黑蜡王册能把活人写成死者、把死者命回田野。夺回原稿，处置誓禁，决定谁有权写下一道命令。',nodeIds:Array.from({length:15},(_,i)=>`C${i+1}`),stakes:'身份、誓禁、谱系、亡者劳役、消名统治。'},
    {id:'siofra',title:'同伴 · 今天的那扇门',summary:'听席芙拉说她愿怎样见自己的亲人。',nodeIds:['camp_siofra'],optional:true},
    {id:'fergal',title:'同伴 · 两道相冲的誓',summary:'听费尔加讲出守门之夜，不替旧王洗去责任。',nodeIds:['camp_fergal'],optional:true},
    {id:'mael',title:'同伴 · 署名人的底稿',summary:'决定如何接住梅尔的供述与原页。',nodeIds:['camp_mael'],optional:true}
  ],
  chapters:[
    {id:1,title:'第七只碗',summary:'收成停在麦穗里，归来船停在七十年之外，王册里站起了本应活着的人。',startScenes:['prologue'],objectives:['A','B','C'].map(k=>({id:`first_${k}`,label:`${arc[k]} · 查明旧约`,requires:f(`${k}5_done`)})),completion:all(f('A5_done'),f('B5_done'),f('C5_done'))},
    {id:2,title:'借来的岁月',summary:'取种、立锚、夺册。你们必须把承诺做成实物，也会看见黑暗力量实际取走了谁的东西。',startScenes:['A6','B6','C6'],objectives:['A','B','C'].map(k=>({id:`second_${k}`,label:`${arc[k]} · 落实代价`,requires:f(`${k}10_done`)})),completion:f('interlude_done')},
    {id:3,title:'无王之夜',summary:'摄政来取最后一次献约。三界石堤将留下王国、归航与名字的真实结果。',startScenes:['A11','B11','C11'],objectives:[{id:'land_final',label:'兑现土地之约',requires:f('A_final')},{id:'time_final',label:'兑现归潮之约',requires:f('B_final')},{id:'name_final',label:'兑现记名之约',requires:f('C_final')}]}
  ],
  scenes:{
    prologue:{id:'prologue',chapter:1,arc:'序幕',title:'宴席上空着的第七只碗',location:'杜恩·卡奥兰 · 赤楸厅',mapId:'dunharrow',once:true,requires:all({sceneUnlocked:'prologue'},no(f('prologue_done'))),text:[
      '六只碗盛着热汤，第七只扣着黑蜡。摄政德雷赫没有坐在王位上，他说王位属于土地，而土地七十年前已经答应把每第七次收成献给丘下。窗外，麦穗像骨针一样空。',
      '席芙拉把仍湿的船桨放到桌上：“我在潮上只吃过七顿晚饭。我妹妹在哪里？”记名师梅尔却在她的名字旁看见一枚七十年前的死印。费尔加按住厅门，门外是拿空粮袋的人，门内是要求守誓的人。你们自己的旧舟还系在渡口，今夜尚未许给任何人。'
    ],choices:[opt('take_table','把第七只碗翻过来，邀请三方坐下','',merge(done('prologue'),{flags:{arrived:true},unlockScenes:['hub','A1','B1','C1','camp_siofra','camp_fergal','camp_mael']}))]},
    hub:{id:'hub',chapter:1,arc:'赤楸厅',title:'没有王座的圆桌',location:'杜恩·卡奥兰 · 赤楸厅',mapId:'dunharrow',repeatable:true,text:[
      '赤楸木桌上摆着三样东西：空麦穗、潮湿的船钟、没有名字的木牌。三条路从同一扇门出去；从哪条路回来，就把真正带回的东西放在桌上。',
      '穆伊琳的根须在窗下伸展，潮使的银灯在檐外摇晃，梅尔给每一张已经动过的纸留出更正的位置。摄政仍在高处等着，等待你们替他决定谁来偿付旧王的债。'
    ],choices:[]},

    A1:step('A1','麦穗里没有第七粒','dunharrow',[
      '磨坊主奥兰掐开十二根麦穗，只有第七根完全空着。收税人把空穗也放上秤：旧王的献约不管有没有长出粮，王庭仍须交足。地里的人已经吃完了可换的余粮。',
      '收税人愿收银延缓三天，也愿拿走种袋当作完成差事的凭据。奥兰不求你们许下明年的丰收，只指着一辆陷进泥里的种车。'
    ],[
      opt('lift','付两枚银币雇人抬车，先把种袋送回磨坊','银币−2，行粮+3；保住种车并取得耕户协助。',done('A1',{resources:{gold:-2,supplies:3},flags:{seed_cart_saved:true},factions:{root:1}}),{requires:silver(2)}),
      opt('carry','卸下能背走的种袋，放弃陷住的车架','行粮+2；种袋保住，失去可运重物的车架。',done('A1',{resources:{supplies:2},flags:{seed_cart_saved:true,cart_abandoned:true}})),
      opt('tax','准许收税人把种袋抵入献约，收下赏银','银币+8；王庭实收种粮，耕户失去这批春种。',done('A1',{resources:{gold:8},flags:{seed_taxed:true},factions:{ledger:1,root:-2},relations:{fergal:-1}}))
    ]),
    A2:step('A2','土地把脚从王靴里抽出来','oathwood',[
      '泉水边坐着一名衣角长出赤楸根的女子。穆伊琳没有王冠，也没有向你们求婚。她把一块被刮薄的树皮翻过来：旧王许出去的是她每七年的收成，不是她曾答应的一碗麦酒。',
      '“不要只问我肯不肯让另一个人作王。”她指着坡下的住屋，“他们住在我身上，也不归我所有。”泉底有一枚旧王藏下的银叶，能指认那次献约的地点。'
    ],[
      opt('listen','听她说完，把土地与住户分别记为见证者','获得土地证词与银叶；关系到后续共同议事。',done('A2',{flags:{land_heard:true,land_leaf:true},factions:{root:2},relations:{fergal:1}})),
      opt('price','只问怎样用另一份东西买回收成','得到献约地点；穆伊琳拒绝为新的统治者加冕。',done('A2',{flags:{land_leaf:true,land_bargain_only:true},factions:{root:-1}})),
      opt('test','辨读树皮上被刮掉的献约范围','智力DC12；成功看清旧王私加的永久字样，失利仍保留银叶与地点。',{}, {check:{stat:'int',dc:12,success:result('刮痕下的“永久”比树皮其他字晚刻一层。穆伊琳承认的款待被人改成了献土。',done('A2',{flags:{land_heard:true,land_leaf:true,royal_forgery:true}})),failure:result('泉光没能照清刮痕。女子仍把银叶交给你们，要求带回她本人没有献土的说法。',done('A2',{flags:{land_heard:true,land_leaf:true}}))}})
    ],{sourceRefs:['CE01']}),
    A3:step('A3','来收债的是一场旧宴','barrow',[
      '王陵门口守着两名戴木面具的追猎者。他们每人提一只空盘，盘底刻着旧王亲手盖过的印。德雷赫已经把陵中的荆冠送去重新缠枝，只留献约副本供你们看。',
      '守陵人罗丝知道一条排水沟，沟里仍有旧宴客人遗下的杯底。面具人并非没有身体：其中一人咳嗽着摘下面具，露出王庭卫兵的脸。他们只是被名册命来守住一张纸。'
    ],[
      opt('leaf','以泉底银叶证明来意，请守陵人交出副本','需要银叶；取得献约原文，守卫不必为纸流血。',done('A3',{flags:{harvest_contract:true,royal_guards_spared:true},relations:{fergal:1}}),{requires:f('land_leaf')}),
      opt('drain','沿排水沟取回旧杯与刻印，绕开守卫','敏捷DC12；成功取得完整刻印，失利只得可辨年份的半杯，均能继续。',{}, {check:{stat:'dex',dc:12,success:result('杯底与门前副本的印纹相同，献约日期比公开的登基誓晚了一夜。',done('A3',{flags:{harvest_contract:true,cup_seal:true}})),failure:result('一只杯在石缝里裂开。半个刻印仍足以把献约指回旧王本人。',done('A3',{flags:{harvest_contract:true,broken_cup:true}}))}}),
      opt('fight','击退替摄政收债的追猎者','可选战斗；胜利得副本，败退或撤离改用守陵人的口述继续。',{}, {combat:'royal_collectors'})
    ]),
    A4:step('A4','荆根里存着去年的太阳','oathwood',[
      '献约的荆根缠在泉眼下，一边长着银白的粮穗，一边挂着能扎进冠骨的黑刺。穆伊琳说，取走银穗能留下少数不受旧约控制的种；取走黑刺，则能让持冠者强迫土地继续结果。',
      '两样东西接在同一条活根上，挖出一边，另一边就会缩进深处。奥兰带来一只很小的种匣，摄政的使者却带来一只足够装冠的盒子。'
    ],[
      opt('seed','轻轻取下银穗，把能再播种的部分留给人间','得到丰收种；土地保有自己的根，异界不会因此立刻归还整片田。',done('A4',{flags:{harvest_seed:true},factions:{root:1}})),
      opt('thorn','砍下黑刺，收进冠盒','获得荆冠的强迫之力；穆伊琳的泉水开始发苦。',done('A4',{flags:{thorn_armed:true,land_wounded:true},factions:{root:-2},relations:{fergal:-1}})),
      opt('wait','不挖活根，只带落在水边的少数谷粒','保留少量丰收种，收成较少；行粮−1用于守泉过夜。',done('A4',{resources:{supplies:-1},flags:{harvest_seed:true,root_intact:true},factions:{root:1}}),{requires:food(1)}),
      opt('empty','空手离开，把是否动根留待后来承担的人','没有种与冠刺；保存土地证词，仍可走分土、断冠或迁离。',done('A4',{flags:{root_intact:true}}))
    ]),
    A5:step('A5','摄政请你们替他戴冠','dunharrow',[
      '德雷赫没有否认旧王改约。“我继承的是一个会饿死的王国，不是一张干净的纸。”他愿把临时征粮权交给你们，条件是明夜仍把第七只碗摆回原处。',
      '奥兰的农人站在厅外，费尔加的手还放在门闩上。接受权柄能立即调粮，也会使下一道命令从你们的名字发出；拒绝权柄不会让献约自行消失。'
    ],[
      opt('assembly','拒绝代摄政，召集有田者与无田者共同议粮','立下共同议事的早期承诺；银币−2支付传信，诸户愿来。',done('A5',{resources:{gold:-2},flags:{assembly_called:true},factions:{root:1}}),{requires:silver(2)}),
      opt('marshal','接下三日征粮令，把你们的名字写在令末','行粮+3；取得实际征粮权，后续能建立也能放弃统治。',done('A5',{resources:{supplies:3},flags:{royal_mandate:true},factions:{ledger:1,root:-1}})),
      opt('road','承认暂不能开仓，先画出各户可退往的高路','不花资源；留下迁离计划，无人因拒绝戴冠而被追加献约。',done('A5',{flags:{refugee_route:true,assembly_called:true}}))
    ]),

    B1:step('B1','船钟只敲了七次','tidegate',[
      '归来船的船壳还是新刨的，码头却已换了三次石。席芙拉认得旧灯塔，认不得灯塔旁自己的碑。六名成年船员围在船钟旁，各自相信只走了七夜。',
      '一名叫艾琳的老年女子赶来，说自己是席芙拉妹妹的女儿。她没有立刻伸手拥抱这个比自己年轻的姨母，只带来妹妹临终前留的一把门钥。'
    ],[
      opt('moor','帮助船员系稳旧船，留出各自说话的位置','保住归来船的实物证据；席芙拉愿认潮。',done('B1',{flags:{return_ship_safe:true},relations:{siofra:1}})),
      opt('market','替船员把七十年前的货卖给收藏商','银币+10；船员得到现银，货物与一部分可核日期的包装流散。',done('B1',{resources:{gold:10},flags:{return_ship_safe:true,old_cargo_sold:true}})),
      opt('measure','先量船壳树轮与码头修建年，暂缓认亲','感知DC12；成功得到双时序的物证，失利仍保住钟与船。',{}, {check:{stat:'wis',dc:12,success:result('新船壳与三次修缮的码头同时是真的。船员没有靠一句谎话把人间变老。',done('B1',{flags:{return_ship_safe:true,time_measure:true}})),failure:result('潮水淹过刻年。船钟仍只磨损了七次，等退潮后能去取旧年尺。',done('B1',{flags:{return_ship_safe:true}}))}})
    ],{sourceRefs:['CE02']}),
    B2:step('B2','银枝响起时，海像草地','sidhe',[
      '席芙拉敲响旧船钟，雾里出现一条草色潮路。潮使伊蕾丝驾车而来，车轮没有压碎海水。她递出的银枝上结着白花，花瓣落到你们掌心，下一息又长了回去。',
      '“这条路通往丘下的阿赫拉庭。”她说，“与你们隔海听来的威尔士阿努恩故事不是同一个地方。”她能带你们到宴厅，也会把宴外已过的岁月如实记入账。'
    ],[
      opt('invitation','接下只供这次来回的银枝邀请','获得银庭邀请；伊蕾丝允许你们不饮宴酒也可入庭。',done('B2',{flags:{silver_invitation:true,invitation_limited:true},factions:{veil:1}})),
      opt('pledge','以旧船钟押作通行担保，请她留一条退路','获得银庭邀请；钟押在潮门，往返需守住同一条退潮时线。',done('B2',{flags:{silver_invitation:true,bell_pledged:true},relations:{siofra:-1}})),
      opt('shore','不接受宴客身份，只请她在岸边回答来意','得到潮门通路位置；拒赴宴仍能调查异界时间。',done('B2',{flags:{shore_parley:true,tide_route_known:true}}))
    ],{sourceRefs:['CE02','CE04']}),
    B3:step('B3','两只沙漏都没有撒谎','sidhe',[
      '银庭门前有两只沙漏，一只漏七粒银沙，另一只漏七十圈黑沙。管门人解释，旧王曾用本土未来的七次收成，买一条让王家远行船永不衰老的航路。船员被留在航路里，人间却仍在过日子。',
      '布兰诺克发现，契约空白处还容得下一项“由他人补足”。若只关心把自己的日子找回来，这四个字足够让整座岛成为补偿物。'
    ],[
      opt('calibrate','留下两套同刻度的年尺，核定这次来回的差数','取得时间实测；后续可帮助归来者选择有限的老去。',done('B3',{flags:{time_measure:true,year_rulers:true},factions:{veil:1}})),
      opt('loophole','誊出“由他人补足”，保留转嫁岁月的术式','取得时间实测与盗年术式；席芙拉看见这项新用途。',done('B3',{flags:{time_measure:true,year_rulers:true,years_formula:true},relations:{siofra:-1}})),
      opt('observe','不碰契文，只在门外等一次潮落','也取得时间实测；失去快走近路的机会，归来者仍可自行决定。',done('B3',{flags:{time_measure:true,waited_tide:true}}))
    ]),
    B4:step('B4','借年之影带着别人的白发','tidegate',[
      '潮门回路上站着一团有王家披风的影。它每走一步，岸边花草便提前凋一圈；影子胸口钉着七枚船员的旧名字。那是献约多年没有兑清的差额，已经学会寻找可抵的活人。',
      '席芙拉说，船员尚未选择如何回归。影子却先把他们算作旧王的货物。伊蕾丝愿开一条绕行潮沟，代价是放弃追回影子携带的完整航印。'
    ],[
      opt('detour','带船员走潮沟，保住人，放弃完整航印','人平安；取得半枚潮门钥，仍可后续封门或立锚。',done('B4',{flags:{gate_half_key:true,returnees_safe:true}})),
      opt('pay','付四枚银币请潮使以银灯截住它','银币−4；取回航印，潮使亲自承担这一次截流。',done('B4',{resources:{gold:-4},flags:{gate_key:true,returnees_safe:true},factions:{veil:1}}),{requires:silver(4)}),
      opt('fight','打散钉着他人名字的借年之影','可选战斗；胜利得完整门钥，失利与撤退仍可带人退到潮沟。',{}, {combat:'borrowed_years'})
    ]),
    B5:step('B5','妹妹那把钥匙打不开现在的门','dunharrow',[
      '席芙拉找到了旧屋。门已加宽，钥孔也换了；屋里住着妹妹的成年后代与另一家租客。艾琳愿给她铺一张床，却不愿把七十年的生活全让回一个本已被埋葬的名字。',
      '其他船员同样各有不同：有人想一口气补回老年，有人宁愿离岛，有人只想明日先找份活。德雷赫派来的人却拿着一张“归来船员共同同意”去换港税。'
    ],[
      opt('each','逐人听完，把每个人的意愿分开记录','获得逐人归来意愿；席芙拉可先以客人身份进门。',done('B5',{flags:{return_choices_heard:true},relations:{siofra:2}})),
      opt('house','付四枚银币租下空屋，让认亲不必以争屋开始','银币−4；获得归来者暂居处，不改变旧屋现住户权利。',done('B5',{resources:{gold:-4},flags:{return_house:true,return_choices_heard:true},relations:{siofra:1}}),{requires:silver(4)}),
      opt('collective','替船员签下共同同意，用未来劳务换安置','行粮+2；所有船员被归入一份合约，尚未答应的人也被写进其中。',done('B5',{resources:{supplies:2},flags:{return_collective_signed:true},relations:{siofra:-2},factions:{ledger:1}}))
    ]),

    C1:step('C1','死人在王册上缴了今年的税','dunharrow',[
      '黑蜡院门口，农人塔赫说不出自己的姓。他记得母亲的脸、田边的石与所有邻居，唯独家名在舌头上化成一口冷气。梅尔从死亡册里找到了他：七年前的秋末，院长命人给六名反对征收的农人封了死印。',
      '其中四人如今站在门外，不能继田、不能在庭上作证，收税人却仍认得他们的债。梅尔承认，最后一枚印是自己盖的。'
    ],[
      opt('shelter','把四名无名者带到赤楸厅，不让死印替代活人','建立临时避所；取得死亡册页号。',done('C1',{flags:{nameless_met:true,shelter_promised:true},relations:{mael:1},factions:{root:1}})),
      opt('ink','买下院门誊手的废稿，先取得改名痕迹','银币−2；获得原页线索与死亡册页号。',done('C1',{resources:{gold:-2},flags:{nameless_met:true,ledger_margin:true}}),{requires:silver(2)}),
      opt('demand','当众叫院长出来，看活人如何回答死人税单','魅力DC12；成功获得有见证的院门承认，失利仍拿到页号。',{}, {check:{stat:'cha',dc:12,success:result('两名院内学徒走出来，承认六枚死印比死亡记录晚了一旬。塔赫第一次在门前得到旁人应答。',done('C1',{flags:{nameless_met:true,ledger_margin:true,apprentices_witness:true}})),failure:result('卡苏没有露面。门内有人把一张写着页号的纸从门缝推了出来。',done('C1',{flags:{nameless_met:true}}))}})
    ]),
    C2:step('C2','石边的字先于黑蜡','oathwood',[
      '四块带欧甘刻痕的界石立在旧路旁。布兰诺克用侧光辨出名字与父系关系，塔赫听见其中一个名字时，竟能短暂把自己的姓说出来。王册能压过活人的声音，仍没能改掉每一块留在野外的石。',
      '梅尔提醒，石也可能被搬动，谱系也不等于某个人必须服从哪位主人。你们可以抄录并带回原处，或者把界石整块搬进自己的控制之中。'
    ],[
      opt('copy','抄下四块石与所在位置，让无名者逐一核对','获得名字副本；石仍属于各自路边，后续能公开复核。',done('C2',{flags:{names_copied:true,stone_locations:true},relations:{mael:1}})),
      opt('take','付两枚银币把一块石搬到赤楸厅','银币−2；取得实物名字证据，原地边界少一块标志。',done('C2',{resources:{gold:-2},flags:{names_copied:true,name_stone_taken:true},factions:{root:-1}}),{requires:silver(2)}),
      opt('memory','请塔赫记住读出的名字，只留一份不署地点的手稿','得到名字副本；地点不公开，未来公开裁判较难找到原物。',done('C2',{flags:{names_copied:true,stone_locations_private:true}}))
    ],{sourceRefs:['CE05']}),
    C3:step('C3','暮后的客人，不能开的门','oathwood',[
      '费尔加把两道誓文刻在不同木片上：不得拒客，不得暮后开门。旧王亲手给过他这两道誓，摄政便在暮后押来他的成年友人，迫他自己挑一次背誓。他的手至今一遇夕光就发抖。',
      '这不是所有人身上都一样的通用戒律。梅尔认出，院长后来在誓文中添了“由现任摄政解释”，把悲剧改造成可反复发出的命令。'
    ],[
      opt('read','把个人誓禁与后来添上的解释权分开读','理解誓禁与操纵痕迹；后续可重写、斩断或利用矛盾。',done('C3',{flags:{geis_understood:true,geis_forgery:true},relations:{fergal:1}})),
      opt('weapon','抄下两道相冲誓文的结构，研究怎样逼人必然背誓','理解誓禁，另存强迫术式；费尔加拒绝替你们选择对象。',done('C3',{flags:{geis_understood:true,geis_formula:true},relations:{fergal:-2}})),
      opt('witness','让费尔加只说自己愿意说的守门之夜','仍理解誓禁；保住受害者证言，不取得可施放的术式。',done('C3',{flags:{geis_understood:true,fergal_testimony:true},relations:{fergal:2}}))
    ],{sourceRefs:['CE03']}),
    C4:step('C4','没有脸的送信人','barrow',[
      '去旧陵取原册的路上，一名蒙面送信人把四封空信按在胸前。他试图报出自己的名字，嘴里却只有蜡滴落地的声音。两名王庭追猎者跟在他后面，命你们把无名者的去向交回院里。',
      '送信人仍能用手写。他在泥上划出一条通向院墙底部的水道，只要你们先割开锁住他手腕的誓绳。追猎者的铜扣，正是解绳的钥。'
    ],[
      opt('buy','付四枚银币买下送信人未完的差事，再解开誓绳','银币−4；送信人自由，得到通向底稿的水道位置。',done('C4',{resources:{gold:-4},flags:{courier_freed:true,archive_route:true},relations:{mael:1}}),{requires:silver(4)}),
      opt('slip','沿送信人画出的水道撤离，留下路标让他随后跟上','敏捷DC12；成功取下铜扣救人，失利送信人被带走，水道位置仍保留。',{}, {check:{stat:'dex',dc:12,success:result('铜扣从追猎者腰间滑落，誓绳开了。送信人在你们掌心写下一个仍不能念出的名字。',done('C4',{flags:{courier_freed:true,archive_route:true}})),failure:result('追猎者带走了送信人。你们从水道退入暗处，记住了他冒险留下的位置。',done('C4',{flags:{courier_taken:true,archive_route:true}}))}}),
      opt('fight','夺下铜扣，击退押送无名者的追猎者','可选战斗；胜利能解绳救人，败退或撤离仍保留院墙水道。',{}, {combat:'faceless_courier'})
    ]),
    C5:step('C5','原名可以买一冬的安静','dunharrow',[
      '卡苏的使者在赤楸厅外摆出十二枚银币。他不要你们杀人，只要四名无名者各自出生时的名字。那些名字一进王册，院长便能隔着任何门发出命令。',
      '塔赫拿着一张别人替他写的木牌：“你们若觉得我住在这里碍事，可以让我走。别说交出名字只是登记。”厅里的火只够暖一间屋，安置确实要有人让出床位。'
    ],[
      opt('shelter','让出厅中床铺，保留无名者拒交原名的权利','建成无名避所；本章不再从他们身上取安置费。',done('C5',{flags:{nameless_sheltered:true},factions:{root:1,ledger:-1},relations:{mael:2}})),
      opt('sell','收下十二枚银币，把四人的原名交给使者','银币+12；四名成年人随后被王册召回，梅尔停止提供新名单。',done('C5',{resources:{gold:12},flags:{names_sold:true,nameless_recalled:true},factions:{ledger:2,root:-2},relations:{mael:-3}})),
      opt('move','把自己的行囊搬去棚下，请四人先借住一季','建成无名避所；队伍接下今冬露宿的实际不便。',done('C5',{flags:{nameless_sheltered:true,party_sleeps_shed:true},relations:{mael:1}}))
    ]),

    A6:step('A6','一块地不止有一个旧主人','oathwood',[
      '春种前的界线横过泉眼：穆伊琳认得一条百年前的林界，奥兰一家在林界里耕了三代。旧王把两种权利都写成自己的，恰好让献约能同时吞掉它们。',
      '这里没有只把土交还一人就能结束的办法。你们须决定，后续断冠与立王将依据一份共同地凭，还是把有争议的林地、耕田与迁徙路分开。'
    ],[
      opt('title','让土地与现住诸户共认一份有异议栏的地凭','取得共同地凭；可支持有界王权或以地凭强立荆王。',done('A6',{flags:{root_title:true},factions:{root:1}})),
      opt('partition','沿水线分出林地、耕地与公共迁路，设独立界石','落实分土方案；每方失去一部分原有最大主张。',done('A6',{flags:{land_partition:true},factions:{root:1,veil:1}})),
      opt('royal','把现有边界暂记在你们名下，再允许各户使用','取得地凭但保留个人最终裁量；诸户把这项临时权力记在账上。',done('A6',{flags:{root_title:true,land_personal_title:true},factions:{root:-1,ledger:1}}))
    ]),
    A7:step('A7','田里的人不需要吃饭','barrow',[
      '陵丘下的麦田一夜变黑，黑土里站着旧王军队的亡者。他们握着生前不曾握过的农具，手指沿木柄不停磨损。卡苏说，只要把死亡册接进田界，就能换来一季不挨饿的粮。',
      '一具遗体脖上系着罗丝父亲的旧哨。罗丝已经五十岁，仍认得父亲停步等她时会偏过头的样子。粮会真实长出，命令也会真实压在不能再拒绝的人身上。'
    ],[
      opt('rest','切断田界，把亡者送回有自己名字的墓位','解除此处役使；本季粮较少，家属愿维护后续祭地。',done('A7',{flags:{dead_released:true,fields_restored:true},relations:{fergal:1,mael:1},factions:{root:1}})),
      opt('marrow','接通死亡册与黑土，命亡者耕完这季','行粮+5；建立役尸粮田，家属被迫看着亲人重复劳作。',done('A7',{resources:{supplies:5},flags:{marrow_fields:true,dead_enslaved:true},relations:{fergal:-2,mael:-1},factions:{ledger:1,root:-2}})),
      opt('seed','用自己的三份行粮作种，拆掉田边的誓柱','行粮−3；解除役使并获得能耕作的小片田。',done('A7',{resources:{supplies:-3},flags:{dead_released:true,living_field:true},factions:{root:2}}),{requires:food(3)})
    ]),
    A8:step('A8','王位旁摆下三张不一样高的凳','dunharrow',[
      '诸户终于到了王庭。穆伊琳坐在窗外的根上，农人坐在旧客凳，原贵族坐在高背椅；所有人都说自己已经让步。德雷赫承认，献约要改，总得有人签下王的一格。',
      '伊蕾丝带来另一个方案：人间与丘庭分季使用泉眼，粮不再按永世献收成扣走，但每年仍须让出三次银潮通行。三种安排会给后续冠与粮不同的主人。'
    ],[
      opt('charter','把三张凳锯成同一高度，立共同议事章程','建立诸户议事章程，土地与现住户各有席位。',done('A8',{flags:{assembly_charter:true},factions:{root:2},relations:{fergal:1}})),
      opt('king','认可一位受地凭与任期约束的王，保留退位程序','立有界王约；需要后续将冠真正锻成可取下的形状。',done('A8',{flags:{king_compact:true},factions:{root:1,ledger:1}})),
      opt('season','与伊蕾丝签分季共用泉眼的条约','立人与丘民条约；每年三次银潮须让出道路。',done('A8',{flags:{sidhe_treaty:true,season_passages:true},factions:{veil:2}}))
    ]),
    A9:step('A9','冠有一处可以被取下的扣','oathwood',[
      '赤楸匠人把荆冠放在火盆上。原冠没有开扣：一旦枝条长进佩戴者，王与土地就成了一份可以永远续用的担保。德雷赫留下两名追猎者，要求冠保持完整。',
      '匠人能用软银作可拆的扣，也能敲碎冠环，或把黑刺磨成能穿透地凭的尖。黑刺尚未取过的，便要在此再伤泉根一次。'
    ],[
      opt('temper','付四枚银币作软银扣，让冠可在任期后取下','银币−4；得到有界荆冠，不把王的肉身永久锁在土地里。',done('A9',{resources:{gold:-4},flags:{crown_tempered:true},factions:{root:1}}),{requires:silver(4)}),
      opt('break','亲手打碎冠环，把碎枝交给诸户保存','王冠失去强迫加冕能力；分土与无王方案有了实物。',done('A9',{flags:{crown_broken:true,thorn_armed:false},factions:{root:1,ledger:-1}})),
      opt('thorn','磨开黑刺，把持冠者的命令接进活根','得到强制荆冠；穆伊琳的根在火中挣动，泉水再苦一层。',done('A9',{flags:{thorn_armed:true,crown_tempered:false,land_wounded:true},factions:{root:-2,ledger:1},relations:{fergal:-2}})),
      opt('fight','击退监工，再让匠人把冠环敲断','可选战斗；胜利断冠，败退则只能带走开扣的半件样品。',{}, {combat:'crown_watch'})
    ]),
    A10:step('A10','第一斗粮归谁拿钥匙','dunharrow',[
      '能在旧献约之外成熟的第一斗粮终于进仓。它可能来自银穗、少量活田，也可能带着陵丘黑土。奥兰把秤放在仓外，要求粮从哪里来、由谁拿走都留下记号。',
      '德雷赫的使者提出，把粮存在持冠者手里能熬过最坏的一夜；无田者担心，熬过去后也再没有拒绝领粮条件的办法。高路上的车已经能出发，撤离同样是一种实际安排。'
    ],[
      opt('common','把第一斗粮交共同仓，三户分别持钥','建立公共粮源；行粮+2，终章共同种粮需要议事章程。',done('A10',{resources:{supplies:2},flags:{grain_common:true},factions:{root:2}})),
      opt('hoard','将粮封在队伍名下，以服从调度换取配给','行粮+4；建立个人粮储，配给成为命令的力量。',done('A10',{resources:{supplies:4},flags:{grain_hoarded:true,ration_command:true},factions:{root:-2,ledger:1},relations:{fergal:-1}})),
      opt('flight','把粮装上迁车，正式放弃守住全部低地','落实饥荒迁离；旧屋与部分田地留在献约下，迁路真实开通。',done('A10',{flags:{famine_flight:true,refugees_ready:true},factions:{root:1}}))
    ]),

    B6:step('B6','归航的锚可以铸在人身上','tidegate',[
      '沙漏的差额已被量清，潮门仍需要一枚固定在“今天”的锚。船匠愿铸银锚，旧门卫却有另一种办法：抽走他十年余生，把这十年钉在潮线上，所有人都能不老地来回。',
      '门卫把十年前写给伴侣的信攥在手里。他没有答应献年，只是被卡苏安排在能被法术找到的位置。席芙拉说，若你们选了他，就不要再称那是时间自己收的价。'
    ],[
      opt('anchor','付六枚银币铸银锚，以器物固定这次来回','银币−6；建立归航锚，后续有限渡航可逐人选择。',done('B6',{resources:{gold:-6},flags:{return_anchor:true},relations:{siofra:1}}),{requires:silver(6)}),
      opt('years','抽走门卫十年余生，铸成可供反复调用的年锚','获得盗年锚与4枚王庭赏银；门卫当场老去，少了真实可活的十年。',done('B6',{resources:{gold:4},flags:{stolen_years:true,year_guard_aged:true},relations:{siofra:-3,fergal:-1},factions:{ledger:1}})),
      opt('labor','把队伍未来一季的掌舵与修绳押进潮锚','不花银币；建立归航锚，队伍接下后续一季往返维护。',done('B6',{flags:{return_anchor:true,party_ferry_service:true},relations:{siofra:1}}))
    ]),
    B7:step('B7','让冬天停住，也会停住种子','sidhe',[
      '伊蕾丝把三种潮序摆在银盘：按实测开落的有限潮，人与丘民各用一季的分季潮，以及停在此夜不再流走的冻结潮。最后一种会让粮仓里的粮不腐，也会让种子永不发芽。',
      '庭中有人把冻结叫作仁慈：饥荒不再到来，老年不再逼近。但被留在王国里的人仍会记得每一个没有走到明天的夜晚。'
    ],[
      opt('safe','按双年尺重定三次可核的来回潮','建立安全潮线；归航仍需实际船、锚与掌舵者。',done('B7',{flags:{tide_safe:true},factions:{veil:1}})),
      opt('treaty','签分季潮约，让人间与丘庭轮用三道潮门','立分季条约；丘庭取回三次通行，人间免去无限献年。',done('B7',{flags:{sidhe_treaty:true,tide_safe:true,season_passages:true},factions:{veil:2}})),
      opt('stop','把银盘停在此夜，冻结领地季节','冬夜开始延长；粮不腐、种不生，后续可建立永冬领地或永宴。',done('B7',{flags:{stopped_season:true,winter_unending:true},factions:{veil:-1,root:-2},relations:{siofra:-2}}))
    ]),
    B8:step('B8','航路刻在每一双旧桨上','tidegate',[
      '旧船员把桨并在岸边，潮使才认出每根桨脊都刻着一次不同的来回。旧王不是第一次瞒报失踪船：他把带回的每一道航路存进私库，把船员留在歌里。',
      '黑蜡院来焚桨，理由是让所有人都知道路会招来更多渡潮者。保住档案可以让后人核对失年，也会让危险航路不再只掌握在少数人手里。'
    ],[
      opt('copy','付两枚银币请船工分刻三份航路，分别保存','银币−2；保住航路档案并分散持有，原桨不再是唯一入口。',done('B8',{resources:{gold:-2},flags:{route_archive:true,route_distributed:true},relations:{siofra:1}}),{requires:silver(2)}),
      opt('hide','把可核的旧桨沉在有码记的浅湾，留一份岸图','保住航路档案；没有公开，下一次查阅要找持图人。',done('B8',{flags:{route_archive:true,route_hidden:true}})),
      opt('burn','亲手焚去旧桨，接受无人再靠这批航路归乡','航路档案毁去；这扇危险门少了入口，归来者也失去一份可核过去。',done('B8',{flags:{route_destroyed:true},relations:{siofra:-2},factions:{ledger:1}})),
      opt('fight','保住原桨，击退来焚航路的追猎者','可选战斗；胜利保全原档，失利也能由船工留下口述简图。',{}, {combat:'oar_archive'})
    ]),
    B9:step('B9','每个人都得写自己的归期','dunharrow',[
      '六名成年船员在桌边写下不同归期。席芙拉想慢慢老去，舵手达兰想把未过的老年一并走完；最年轻也已成年的洛赫只想留在丘庭。院长提供一张更省事的寿年契，把所有差额抵在不在场的沿岸成年人身上。',
      '寿年契能让归来者保持现在的身体，却会使另一批人提早走到终年。那批人的姓名已经写在背面，不是一个抽象的“岛上”。'
    ],[
      opt('roster','逐人登记选择，允许改意者停在岸上','完成归来名册；不要求所有人同归、同老或同留。',done('B9',{flags:{return_roster:true},relations:{siofra:2}})),
      opt('contract','签寿年契，把差额转嫁给背面的沿岸成年人','银币+8；取得寿年契，沿岸受害者开始提前衰老。',done('B9',{resources:{gold:8},flags:{lifespan_contract:true,coast_years_taken:true},relations:{siofra:-3,mael:-1},factions:{ledger:2,root:-2}})),
      opt('witness','请船员各留口述，让不会写字的人也各自署记','完成归来名册与口述记录；船员没有因识字与否失去选择。',done('B9',{flags:{return_roster:true,oral_roster:true},relations:{siofra:1,mael:1}}))
    ]),
    B10:step('B10','潮门不能只靠一句归乡','tidegate',[
      '人、锚、名册都有了去处，真正的门还要有人守。伊蕾丝可以交出能关门的潮钥，船工可以组一季渡队，或者你们现在就把岸边最后一条近路封死。',
      '席芙拉不肯让尚未答应的人被补进船员名单。若曾偷取余生，岸边已经有人撑杖来问自己的十年去了哪里；这扇门此后开的每一次，都必须面对他们。'
    ],[
      opt('ferry','与自愿船工立一季渡航承诺，明确每次载谁','建立渡队承诺；以后必须用真实船与维护履约。',done('B10',{flags:{ferry_pledge:true},relations:{siofra:1}})),
      opt('key','接下完整潮钥，承诺最后一夜决定开闭','取得潮门钥；留待终章关门或建立有限往返。',done('B10',{flags:{gate_key:true},factions:{veil:1}})),
      opt('close','就此封住近岸小潮门，撤下渡航标记','近岸潮门封闭；最终仍须处置石堤大门，旧归来者留在人间。',done('B10',{flags:{tide_closed:true,gate_key:true},factions:{veil:-1}}))
    ]),

    C6:step('C6','底稿里的手还留着抖痕','barrow',[
      '院墙水道通向没有火的旧书库。梅尔从夹层里抽出六张底稿，四名仍活着的人在原稿上都没有死亡日期；后来有人用黑蜡把空白封成既成事实。',
      '其中一张底稿下压着梅尔自己的副署。卡苏确曾下令，梅尔也确曾照做。若把副署刮掉，只能造出另一张看起来更方便的纸。'
    ],[
      opt('whole','带走整套底稿，保留梅尔的副署与后来改写','取得原名证据；梅尔将与院长一同面对各自做过的事。',done('C6',{flags:{name_proof:true,mael_signature_kept:true},relations:{mael:1}})),
      opt('clean','刮去梅尔的副署，只留下院长封蜡的页','仍得原名证据；原稿被你们再次改动，梅尔失去为自己作证的完整痕迹。',done('C6',{flags:{name_proof:true,proof_altered:true},relations:{mael:-1}})),
      opt('rubbing','无法带走整册，就把原名与印次拓在自有纸上','取得原名证据与可复查的位置；原册暂留旧库。',done('C6',{flags:{name_proof:true,proof_rubbing:true}}))
    ]),
    C7:step('C7','陵里的人听见了命令','barrow',[
      '书库下的陵厅传来整齐脚步。两百年前的战死者被王册一页页点起，站在每块棺石前等候下一次发令。卡苏把唤名笔留在台上，像故意放下的一把总钥。',
      '费尔加认出，其中一人是自己友人的父亲。亡者能开路、搬粮、结阵，却不会因为命令叫作救国便重新有能力说不。你们也可以把笔折断，让他们回到各自的安静。'
    ],[
      opt('release','划去唤名笔上的王令，让已起身的亡者逐一归棺','解除此处亡者役使；取得可断命令的笔尖。',done('C7',{flags:{dead_released:true,release_nib:true},relations:{fergal:2,mael:1},factions:{ledger:-1}})),
      opt('host','握住唤名笔，命亡者成为队伍的沉默军队','建立亡者军役；可给黑暗终章提供真实劳役与武力。',done('C7',{flags:{dead_host:true,dead_enslaved:true},relations:{fergal:-3,mael:-1},factions:{ledger:2,root:-2}})),
      opt('fight','击散正在执行追杀令的前队，再封住唤名台','可选战斗；胜利封台解除本批命令，失利或撤离仍能取走笔尖。',{}, {combat:'silent_host'})
    ]),
    C8:step('C8','一道命令抵达每个人喉咙','dunharrow',[
      '卡苏试着在远处念出塔赫的原名。若名字早已售出，四名无名者被迫从被关押的屋里走来；若避所仍在，他们便在厅中捂住咽喉。你们夺来的笔尖足以改写这一次召回。',
      '解除活人名字的绑定，会让院里失去对他们的远程命令。改绑到你们手里则能立刻叫停卡苏，代价是这些人的日后仍由另一只手决定。'
    ],[
      opt('free','把活人名字从召令页拆下，交回本人保存','活人名字获得自由；曾受迫召回的人仍记得那次出售。',done('C8',{flags:{living_names_free:true,names_bound:false},relations:{mael:2,fergal:1},factions:{root:1}})),
      opt('bound','将召令改为你们掌管，注明只到下次萨温','取得一年有期缚名；本人仍被迫服从，期限写下了也需真正执行。',done('C8',{flags:{names_bound:true,binding_term:true,living_names_free:false},relations:{fergal:-3,mael:-1},factions:{ledger:1}})),
      opt('burn','焚去这一批召令页，保住记名证据的另页副本','解除活人绑定；王册未整体销毁，院内其他被召者仍待终章处理。',done('C8',{flags:{living_names_free:true,summons_burned:true,names_bound:false},relations:{mael:1}}))
    ]),
    C9:step('C9','王令该不该有一种不会服从的回答','oathwood',[
      '两道相冲的誓文被摆到泉边。费尔加愿把旧誓重写成一份能拒绝明显伤害命令、到期须重新应许的约，也能以失去王家身份为代价彻底斩断。',
      '布兰诺克手里的旧结构还可以反用：给任何反对者各下一道不能同时满足的誓，等他必然违背时再宣布惩罚合法。泉边的乌鸦没有给出答案，只啄走一条写坏的木屑。'
    ],[
      opt('rewrite','请本人逐条同意，把拒绝伤害与到期退出写进新誓','重写守誓制度；费尔加以自己的名义愿守一季。',done('C9',{flags:{oath_rewritten:true},relations:{fergal:2},factions:{root:1}})),
      opt('shatter','斩断旧誓与王家身份，让费尔加不再从属王庭','誓禁解除；王家俸禄与席位同时失去，后续可解散誓院。',done('C9',{flags:{oath_shattered:true,fergal_no_title:true},relations:{fergal:1},factions:{ledger:-1}})),
      opt('weapon','把相冲誓禁写成针对反对者的可用术式','建立诅咒王令；首名受试者无法同时遵命，被宣告有罪。',done('C9',{flags:{oath_weapon:true,first_geis_victim:true},relations:{fergal:-3,mael:-1},factions:{ledger:2,root:-2}}))
    ],{sourceRefs:['CE03']}),
    C10:step('C10','谁保管下一次更正','dunharrow',[
      '原册、底稿、抄本和新誓都回到桌上。梅尔问，明年另一个被错记的人该找谁。公开能让名字不再只听一间院子的解释，也会暴露已经被记录的羞辱与罪行。',
      '秘密保存能让新的持册者高效发令，焚毁能永远拆掉这套现有命令，却也会失去部分尚未找到亲属的谱系。纸不会自己挑出只有好处的一面。'
    ],[
      opt('public','公开原稿与修订，让每个当事人另持自己的副本','建立公共记名册；有期缚名若仍存在，会在公开文字中被看见。',done('C10',{flags:{public_ledger:true},relations:{mael:2},factions:{ledger:-1,root:1}})),
      opt('hidden','把原册封在队伍掌中的黑蜡匣里','保留秘密记名权；院长失去总册，新的秘密持有人获得同样结构。',done('C10',{flags:{hidden_ledger:true},relations:{mael:-2},factions:{ledger:1}})),
      opt('burn','留出个人证据后，焚毁可统一发令的总册','总册烧毁；谱系中未被个人保住的部分永远失去。',done('C10',{flags:{ledger_burned:true},relations:{mael:1},factions:{ledger:-2}}))
    ]),

    interlude:{id:'interlude',chapter:2,arc:'转章',title:'旧舟只能交给一个承诺',location:'杜恩·卡奥兰 · 赤楸渡',mapId:'dunharrow',once:true,requires:all({sceneUnlocked:'interlude'},f('A10_done'),f('B10_done'),f('C10_done'),no(f('interlude_done'))),text:[
      '萨温夜前，所有人来到你们自己的旧舟旁。奥兰要把它抵给土地新约作履约担保，席芙拉要把它改成只能载人的归航锚舟，梅尔要烧掉刻过队伍旧誓的船骨，让新的记名权不再系在一位旧主人身上。',
      '一条船不能同时抵押、出航与成灰。你们仍要完成三条路，今后最深的生活却只能系向一处：留下承担土地之约，留在潮间做归航人，或舍掉旧身份去守新名字。'
    ],choices:[
      opt('land','把旧舟押给诸户，留下承担土地与王权的结果','旧舟不再可售或载归来者；主结局以荆冠与土地为重心，其他两线保留完整余波。',done('interlude',{flags:{interlude_done:true,priority_A:true,party_boat:false,boat_pledged:true,party_stays_land:true}})),
      opt('time','把旧舟改为归航锚舟，队伍此后承担掌舵维护','旧舟不再载货或抵给土地；主结局以七夜归潮为重心。',done('interlude',{flags:{interlude_done:true,priority_B:true,party_boat:false,boat_anchor:true,party_tide_service:true}})),
      opt('name','焚去刻着队伍旧誓的舟骨，让新约不再认旧主人','旧舟真正烧毁，队伍失去原有出海与王庭通行担保；主结局以无名者之誓为重心。',done('interlude',{flags:{interlude_done:true,priority_C:true,party_boat:false,boat_burned:true,party_old_titles_lost:true}}))
    ]},

    A11:step('A11','土地的旧伤没有因新约闭合','oathwood',[
      '穆伊琳的泉眼露出了旧王埋下的第三根界柱。柱上不再谈献粮，而说凡归乡者所带来的陌生岁月也都算作土地应缴的利息。德雷赫把三条原本分开的债钉在了同一块地上。',
      '你们可以把柱拆成各户能够质疑的地凭，或沿柱把黑刺接得更深。若已经分土，拆柱者还须承认银潮通路不会因人间一方改约便凭空消失。'
    ],[
      opt('hear','请土地与现住诸户一起拆柱，把旧伤列进新约','补全土地证词与共同地凭；此前的永久献土条款失去单方解释。',done('A11',{flags:{land_heard:true,root_title:true,buried_interest_exposed:true},factions:{root:1}})),
      opt('partition','按已划的水线断开界柱，只保留各方实管的部分','需要分土；保住分界并交出一段独占泉路。',done('A11',{flags:{partition_confirmed:true,crown_broken:true,thorn_armed:false},factions:{root:1,veil:1}}),{requires:f('land_partition')}),
      opt('pierce','以黑刺穿透第三界柱，让冠直接命令土地','补得强制荆冠与地凭；泉边林木一夜抽空新芽。',done('A11',{flags:{thorn_armed:true,root_title:true,land_wounded:true,forest_drained:true},factions:{root:-2},relations:{fergal:-2}}))
    ]),
    A12:step('A12','粮车要过一条属于别人的路','causeway',[
      '石堤中段由潮民巨卫科尔守着。他的族人不是旧王献约的共同债主，只是替被欠了三代的引潮工保住一段路。摄政的追猎队在另一端烧起王旗，准备把所有潮民都算成敌人。',
      '科尔愿按有限互市让粮车过，也愿给撤离者开放不回头的高岸；以武力夺堤能快，却会留下真正需要驻守的伤口。'
    ],[
      opt('trade','以两份行粮结清本次通行，约明下一次另议','行粮−2；保住粮道与安全潮线，不创造永久免费通行权。',done('A12',{resources:{supplies:-2},flags:{land_supply_route:true,tide_safe:true,tideworkers_paid:true},factions:{veil:1}}),{requires:food(2)}),
      opt('flight','接受高岸撤离路，让愿走的人与粮车先过','补全迁离方案与人员去处；低地部分故土确实放弃。',done('A12',{flags:{famine_flight:true,refugees_ready:true,land_supply_route:true},factions:{root:1}})),
      opt('charter','出示分季条约，请巨卫按已约通路放行','需要分季条约；粮道开放，下一次银潮也须照约让路。',done('A12',{flags:{land_supply_route:true,tide_safe:true,season_route_honored:true},factions:{veil:1}}),{requires:f('sidhe_treaty')}),
      opt('fight','夺下摄政王旗，以兵刃打通石堤','可选战斗；胜利得军管粮道，败退或撤离改走高岸并推进迁离。',{}, {combat:'causeway_tribute'})
    ]),
    A13:step('A13','最后一回收成不再装进空碗','oathwood',[
      '穆伊琳把最后一只空碗放在活根上。德雷赫来要的不是某一袋粮，而是你们是否承认永远有一个人能替土地、归来者与无名者许出未来。王国已走到必须真正兑现选择的一夜。',
      '奥兰摊开粮的去向，银潮使指出每次条约通行，家属带来陵丘亡者的名字。即使走向残酷的富足，这些代价也不会再躲在一份“为了所有人”的总账里。'
    ],[
      opt('present','公开三种收成来源，让每方拿回自己的凭据','完成土地终章准备；既有种、粮、冠与分界按实际保留。',done('A13',{flags:{land_ready:true,land_costs_public:true},factions:{root:1}})),
      opt('coerce','令持粮者与亡者前队列在根庭外，强行开最后庭议','需要个人粮储或亡者军；完成准备并留下公开威压的事实。',done('A13',{flags:{land_ready:true,land_council_coerced:true},factions:{root:-2},relations:{fergal:-1}}),{requires:any(f('grain_hoarded'),f('dead_host'))}),
      opt('depart','把已保住的种与人移到高岸，不再许诺守住全境','完成准备并补全迁离；现存故土与庇护按实际去向保留。',done('A13',{flags:{land_ready:true,famine_flight:true,refugees_ready:true},factions:{root:1}}))
    ]),

    B11:step('B11','今天不能全部退给七十年前','dunharrow',[
      '艾琳在旧屋摆了第二把椅子，席芙拉终于坐下。她们谈了妹妹喜欢的汤、屋顶漏水的地方，也谈了谁都无法补过来的葬礼。门钥放在两人中间，没有再次被当作物权凭据。',
      '其他船员等着最终过门。尚未留下个人意愿的，可以在此补齐；仍打算转嫁余生的，则必须面对被契约指名的人已经来到门外。'
    ],[
      opt('today','承认失去的七十年，逐人确认今天愿去的地方','补全归来名册与时间实测；席芙拉留下一封写给今天亲人的信。',done('B11',{flags:{return_roster:true,time_measure:true,siofra_today:true},relations:{siofra:2}})),
      opt('lineage','把航路档案交给两代在场者共同核对','需要航路档案；落实代际接纳与逐人归来名册。',done('B11',{flags:{return_roster:true,generations_witness:true},relations:{siofra:1,mael:1}}),{requires:f('route_archive')}),
      opt('debt','以寿年契要求沿岸人承认归来者优先获得余生','需要寿年契；受害人被迫在自家门口让路，盗年秩序公开执行。',done('B11',{flags:{year_debt_enforced:true},relations:{siofra:-2},factions:{root:-2,ledger:1}}),{requires:f('lifespan_contract')})
    ]),
    B12:step('B12','潮上使者不替任何人选归期','tidegate',[
      '马纳南的潮上使者从远处掠过，只留下一道能辨真伪潮线的白痕。伊蕾丝说，这道痕不是赦免，也不是征讨；凡人的余生究竟归谁，仍是岸上人在做。',
      '德雷赫放来的借年之影追着归来名册而至。你们可以借白痕重立银锚，承认一季维护；也能再抽一名王庭俘虏的岁月，让影认你们为新债主。'
    ],[
      opt('anchor','沿白痕重立银锚，承诺队伍修守一季','补全归航锚与渡队承诺；这份劳动不能再交给未答应的船工。',done('B12',{flags:{return_anchor:true,ferry_pledge:true,party_ferry_service:true},relations:{siofra:1}})),
      opt('steal','从成年王庭俘虏身上抽走余年，迫使影承认新主人','补得盗年锚；俘虏迅速老去，你们取得向他人转嫁岁月的地位。',done('B12',{flags:{stolen_years:true,prisoner_years_taken:true},relations:{siofra:-3},factions:{root:-1,ledger:1}})),
      opt('key','关闭白痕内的支门，只保留可一次封死的大门钥','取得潮钥；继续有限往返须用其他已经建成的船与锚。',done('B12',{flags:{gate_key:true,branch_gate_closed:true},factions:{veil:-1}})),
      opt('fight','击碎试图重占归来名册的借年之影','可选战斗；胜利保住双年尺与银锚，失利可撤回有门钥的岸线。',{}, {combat:'last_year_shadow'})
    ],{sourceRefs:['CE02']}),
    B13:step('B13','第八次船钟该怎样敲响','tidegate',[
      '失踪船的钟终于等到第八次敲响。有人要走向已经衰老的人间，有人要留下，有人望着冻结的银宴不愿醒来。那些被偷走余生的人也到了岸边，能够指出哪一处白发在签契后出现。',
      '伊蕾丝把航海灯、门钥与空名册分别放下。你们下一步必须用其中真正拥有的东西履约，不能靠一句“都送回去”把各人的归期再合成一张纸。'
    ],[
      opt('confirm','逐项展示锚、船、名册与代价，准备最后通航','完成时间终章准备；既有盗年事实与各人的意愿同时保留。',done('B13',{flags:{time_ready:true,tide_costs_public:true}})),
      opt('seal','决定把最后门钥带上石堤，准备永远关门','完成准备并取得门钥；此前已经到岸的人不被倒送回异界。',done('B13',{flags:{time_ready:true,gate_key:true,closure_prepared:true}})),
      opt('leave','收起队伍的潮旗，为没有锚的流亡准备一条岸路','完成准备；不许诺靠新债把失去的时间全找回来。',done('B13',{flags:{time_ready:true,exile_shore_ready:true}}))
    ]),

    C11:step('C11','被写掉的人站在发令者面前','dunharrow',[
      '塔赫与另三名成年人来到赤楸厅。若他们曾被卖名，腕上还留着王册命令烧出的灰痕；若活名已经解开，他们第一次能在院长在场时不站起来。梅尔把自己的副署摊在他们面前。',
      '卡苏说，只有统一的名册才能保证任何命令到达。他并未说谎；你们已经看过这份效率怎样工作。现在，受命者可以亲口提出新约，也可以再次被划进无权发言的一栏。'
    ],[
      opt('proof','让原名本人核对底稿，公开每一次修改','补全原名证据与副本；曾售名者须在场听完追问。',done('C11',{flags:{name_proof:true,names_copied:true,victims_heard:true},relations:{mael:1}})),
      opt('guard','持公开王册确认缚名期限，并让受缚者各留副本','需要有期缚名与公共王册；把期限落实为可指认的证据，服从仍被强迫。',done('C11',{flags:{binding_term_witnessed:true},factions:{ledger:1}}),{requires:all(f('names_bound'),f('public_ledger'))}),
      opt('silence','命受缚者在审问时保持沉默，让院长交出剩余解释','需要缚名；同一套强迫第一次由你们在公开庭上执行。',done('C11',{flags:{witnesses_silenced:true},relations:{mael:-2,fergal:-2},factions:{root:-2,ledger:1}}),{requires:f('names_bound')})
    ]),
    C12:step('C12','院里最后一扇门','barrow',[
      '卡苏退回陵下的记名院。他把院门锁在自己的名上：只要还有一个人愿称他为院长，门内的旧命令便继续。三名学徒留在外面，各自只拿到一半的谱系。',
      '梅尔能带学徒建立互留更正的记名桌，也能烧去印章使旧院解散；若你们仍保存秘密原册，卡苏愿交出全部技法，换自己继续坐在新主人的下首。'
    ],[
      opt('desk','让学徒与原名持有人共同办记名桌，公开更正办法','补全公共王册与新誓；若已毁总册，重建的是个人互证副本。',done('C12',{flags:{public_ledger:true,oath_rewritten:true,shared_name_desk:true},relations:{mael:2},factions:{ledger:-1,root:1}})),
      opt('dissolve','烧掉院长印与发令封蜡，停止院的统一召名','补全断誓与毁总册；旧院解散，未被个人保住的谱系随之失去。',done('C12',{flags:{oath_shattered:true,ledger_burned:true,institute_dissolved:true},factions:{ledger:-2}})),
      opt('keep','留卡苏为新主人的记名官，把剩余解释收入密匣','取得秘密记名权与诅咒术式；卡苏继续为有名的主人写无名的命令。',done('C12',{flags:{hidden_ledger:true,oath_weapon:true,kathal_retained:true},relations:{mael:-3,fergal:-2},factions:{ledger:2}}))
    ]),
    C13:step('C13','不许任何人用终章替自己改名','barrow',[
      '摄政德雷赫来到陵门，第一次亲口承认自己让卡苏把旧债接成王册。他不再假装只是看守旧王留下的东西：“没有人替所有人作决定，王国就会裂开。”',
      '他愿以退位换你们保留秘密名册，也准备唤起最后一队陵卫。费尔加没有替你们举刀，梅尔也没有替你们抹去任何旧署名。最后的名字安排必须由你们自己兑现。'
    ],[
      opt('confront','拿底稿与活人原名当面质询，带他去石堤交令','完成记名终章准备；摄政交出发令印，责任仍归各自署名的人。',done('C13',{flags:{name_ready:true,dreoch_surrenders:true,royal_seal:true},relations:{mael:1}}),{requires:any(f('name_proof'),f('public_ledger'),f('ledger_burned'))}),
      opt('bargain','接受他退位，让密册进入你们的新命令体系','需要秘密王册；完成准备，摄政以协助延续结构换取自身退场。',done('C13',{flags:{name_ready:true,dreoch_retired:true,royal_seal:true},relations:{fergal:-1},factions:{ledger:1}}),{requires:f('hidden_ledger')}),
      opt('empty','拒接发令印，带愿离开的人到石堤外另立名册','无资源退路；完成准备并建无名避所，不把退让写成全部旧债已偿。',done('C13',{flags:{name_ready:true,nameless_sheltered:true,royal_seal_rejected:true}})),
      opt('fight','击败摄政唤起的陵卫，夺下最后发令印','可选战斗；胜利夺印，败退与撤离仍能带现有副本到石堤收束。',{}, {combat:'regent_last_order'})
    ]),

    camp_siofra:{id:'camp_siofra',chapter:1,arc:'同伴',title:'今天的那扇门',location:'赤楸渡 · 系桨处',mapId:'tidegate',once:true,requires:all({sceneUnlocked:'camp_siofra'},no(f('camp_siofra_done'))),text:[
      '席芙拉把妹妹的旧门钥系到桨上。她说自己最怕的不是妹妹已经死去，而是所有人都要求她替妹妹重新成为一个没有过七十年的人。她想先去看看那扇现在的门，再决定今后在哪边掌舵。'
    ],choices:[
      opt('home','陪她认路，答应让她自己决定敲门的时辰','关系+2；她的归乡意愿不会变成替队伍永久掌舵的承诺。',done('camp_siofra',{relations:{siofra:2},flags:{siofra_home:true},quests:{siofra:'done'}})),
      opt('company','在桨边陪她坐一会，只以朋友身份听旧事','关系+1；不替她预定家人应当怎样回应。',done('camp_siofra',{relations:{siofra:1},flags:{siofra_friend:true},quests:{siofra:'done'}})),
      opt('past','说既然旧家已变，不如把自己全交给队伍','关系−2；她拒绝把一次失去变成另一份永久归属。',done('camp_siofra',{relations:{siofra:-2},flags:{siofra_refused:true},quests:{siofra:'done'}}))
    ]},
    camp_fergal:{id:'camp_fergal',chapter:1,arc:'同伴',title:'两道相冲的誓',location:'赤楸厅 · 后门',mapId:'dunharrow',once:true,requires:all({sceneUnlocked:'camp_fergal'},no(f('camp_fergal_done'))),text:[
      '费尔加每天都等夕光从门槛退下才松开手。他说自己交出友人时还努力把每一条誓守到字面，现在终于能说：旧王与摄政把他推到那道门前，他仍需要面对自己松开过的手。'
    ],choices:[
      opt('hear','听完他亲手做过的部分，也追问发令的人','关系+2；他愿提供自己的完整证言。',done('camp_fergal',{relations:{fergal:2},flags:{fergal_heard:true},quests:{fergal:'done'}})),
      opt('repair','陪他修好门闩，不要求一个当夜就能完成的答案','关系+1；他仍愿共同处理具体誓文。',done('camp_fergal',{relations:{fergal:1},flags:{fergal_supported:true},quests:{fergal:'done'}})),
      opt('order','说服从只要有效，就应当继续用下去','关系−2；他不再愿执行你们未经讨论的新命令。',done('camp_fergal',{relations:{fergal:-2},flags:{fergal_refused_command:true},quests:{fergal:'done'}}))
    ]},
    camp_mael:{id:'camp_mael',chapter:1,arc:'同伴',title:'署名人的底稿',location:'赤楸厅 · 灯下',mapId:'dunharrow',once:true,requires:all({sceneUnlocked:'camp_mael'},no(f('camp_mael_done'))),text:[
      '梅尔把自己写过的一个“死”字描了三遍。他说第一次写时以为只是在院长的册上添一笔，直到塔赫在门外再也说不出家名。他想把底稿交回，也知道底稿不能替曾经服从的自己免罪。'
    ],choices:[
      opt('confess','接住底稿，请他以自己的名字在场说明','关系+2；他愿公开供述，不要求你们预先免罪。',done('camp_mael',{relations:{mael:2},flags:{mael_confessed:true},quests:{mael:'done'}})),
      opt('copy','帮他留一份完整副本，让受影响的人能各自追问','关系+1；底稿不会只剩一名冒险者独占。',done('camp_mael',{relations:{mael:1},flags:{mael_copy_kept:true},quests:{mael:'done'}})),
      opt('profit','问他还知道多少可以卖钱的原名','关系−2；他拒绝再交新名单，已交底稿仍保留。',done('camp_mael',{relations:{mael:-2},flags:{mael_refused_names:true},quests:{mael:'done'}}))
    ]}
  },
  battles:{
    royal_collectors:{id:'royal_collectors',name:'王陵收债者',mapId:'barrow',enemies:[{kind:'raider',name:'木面追猎者',x:9,y:4},{kind:'raider',name:'献约守卫',x:10,y:8}],next:'hub',victory:done('A3',{flags:{harvest_contract:true,royal_guards_defeated:true}}),defeat:done('A3',{flags:{harvest_contract:true,royal_collectors_escaped:true}}),escape:done('A3',{flags:{harvest_contract:true,royal_collectors_avoided:true}}),outcomeText:{victory:'面具落在陵门边。你们取得献约副本，守陵人将受伤守卫带离；取胜没有让旧纸上的债自动消失。',defeat:'你们退进排水沟，罗丝递来自己抄下的献约。副本未取成，旧王改约的内容仍能带回。',escape:'你们带走罗丝的口述与旧杯拓印，退出陵门。献约仍可查明。'}},
    borrowed_years:{id:'borrowed_years',name:'钉着七名船员的借年之影',mapId:'tidegate',enemies:[{kind:'wraith',name:'借年之影',hp:30,x:10,y:5}],next:'hub',victory:done('B4',{flags:{gate_key:true,returnees_safe:true,year_shadow_broken:true}}),defeat:done('B4',{flags:{gate_half_key:true,returnees_safe:true,year_shadow_remains:true}}),escape:done('B4',{flags:{gate_half_key:true,returnees_safe:true,year_shadow_avoided:true}}),outcomeText:{victory:'七枚旧名从影上落下，潮使收住涌来的差额。归来船员平安，完整航印成为门钥。',defeat:'席芙拉把伤者拉进潮沟。船员安全撤到岸边，你们保住半枚钥印，尚可另立银锚。',escape:'你们沿退潮线离开，影没有进入岸上住屋。人带到了，未取回的航印仍留在门外。'}},
    faceless_courier:{id:'faceless_courier',name:'无脸信使的铜扣',mapId:'barrow',enemies:[{kind:'raider',name:'誓绳押送者',x:9,y:4},{kind:'raider',name:'黑蜡巡卫',x:11,y:8}],next:'hub',victory:done('C4',{flags:{courier_freed:true,archive_route:true}}),defeat:done('C4',{flags:{courier_taken:true,archive_route:true}}),escape:done('C4',{flags:{courier_taken:true,archive_route:true}}),outcomeText:{victory:'铜扣解开誓绳。信使不能立即找回声音，却把通向底稿的水道完整写出。',defeat:'押送者带走信使。你们沿他画出的水道撤退，仍保存寻找底稿的位置。',escape:'你们记住泥上的水道，退向旧院墙。信使被带走的事实留在这一夜。'}},
    crown_watch:{id:'crown_watch',name:'守着无扣荆冠的监工',mapId:'oathwood',enemies:[{kind:'raider',name:'荆冠监工',x:9,y:4},{kind:'wolf',name:'王庭荆林犬',x:11,y:8}],next:'hub',victory:done('A9',{flags:{crown_broken:true,thorn_armed:false,crown_watch_defeated:true}}),defeat:done('A9',{flags:{crown_tempered:true,crown_half_clasp:true}}),escape:done('A9',{flags:{crown_tempered:true,crown_half_clasp:true}}),outcomeText:{victory:'匠人敲断冠环，把不能再扣成同一个王冠的碎枝交给诸户。',defeat:'匠人带你们退入根窖，留下已经做出的半扣。冠尚能有期限地佩戴，不能用于永久缠身。',escape:'你们带着开扣样品退走，匠人把剩下的枝环藏入泉底。'}},
    oar_archive:{id:'oar_archive',name:'焚桨的黑蜡队',mapId:'tidegate',enemies:[{kind:'raider',name:'焚档追猎者',x:9,y:4},{kind:'wraith',name:'旧航路残影',hp:20,x:11,y:8}],next:'hub',victory:done('B8',{flags:{route_archive:true,original_oars:true}}),defeat:done('B8',{flags:{route_archive:true,oral_route_only:true}}),escape:done('B8',{flags:{route_archive:true,oral_route_only:true}}),outcomeText:{victory:'原桨从火边拖了回来，船员把每一处旧刻逐一指认。档案保住了，也更难再只归王家私用。',defeat:'半批旧桨被烧，船工在岸图上补出口述简图。可核档案缩小了，仍没有完全消失。',escape:'你们带走岸图与能背起的两根桨，放弃其余原件。航路仍可有限复查。'}},
    silent_host:{id:'silent_host',name:'不肯停步的旧王前队',mapId:'barrow',enemies:[{kind:'draugr',name:'唤名陵卫',x:9,y:4},{kind:'draugr',name:'唤名陵卫',x:11,y:8},{kind:'wraith',name:'黑蜡召令',hp:18,x:11,y:5}],next:'hub',victory:done('C7',{flags:{dead_released:true,release_nib:true,summons_platform_sealed:true}}),defeat:done('C7',{flags:{release_nib:true,old_dead_commands_remain:true}}),escape:done('C7',{flags:{release_nib:true,old_dead_commands_remain:true}}),outcomeText:{victory:'黑蜡召令裂开，前队停在各自墓位前。你们封台，取走能断开活人召令的笔尖。',defeat:'梅尔从倒下的台边取出笔尖，带你们退出。前队旧命令仍在，终章必须承认这份未尽之事。',escape:'你们折下笔尖退出陵厅。没有新立亡者军，旧命令也未在撤退时自动解除。'}},
    causeway_tribute:{id:'causeway_tribute',name:'摄政旗与潮门巨卫',mapId:'causeway',enemies:[{kind:'jotun',name:'被王旗逼战的潮门巨卫',hp:38,damage:8,x:11,y:5},{kind:'raider',name:'摄政引战者',x:10,y:8}],next:'hub',victory:done('A12',{flags:{land_supply_route:true,military_causeway:true,tideworkers_hurt:true},factions:{veil:-2}}),defeat:done('A12',{flags:{famine_flight:true,refugees_ready:true,land_supply_route:true}}),escape:done('A12',{flags:{famine_flight:true,refugees_ready:true,land_supply_route:true}}),outcomeText:{victory:'王旗倒下，巨卫带伤退开，粮车通过。道路留下军管守口与未偿的引潮工伤势。',defeat:'科尔没有追杀伤者，令高岸放行。你们带人退往迁离路线，放弃以王旗统治石堤。',escape:'队伍收起兵刃走向高岸，粮与愿走的人继续前进。通行来自撤离安排。'}},
    last_year_shadow:{id:'last_year_shadow',name:'最后一笔旧王年债',mapId:'tidegate',enemies:[{kind:'wraith',name:'旧王借年之影',hp:34,x:10,y:4},{kind:'wolf',name:'潮雾猎犬',x:11,y:8}],next:'hub',victory:done('B12',{flags:{return_anchor:true,time_measure:true,last_shadow_broken:true}}),defeat:done('B12',{flags:{gate_key:true,last_shadow_remains:true}}),escape:done('B12',{flags:{gate_key:true,last_shadow_avoided:true}}),outcomeText:{victory:'白痕穿过旧王的影，年债不再追着归来名册跑。银锚立住，双年尺仍在岸边。',defeat:'你们带着门钥退上岸，伊蕾丝收住支门。下一步能关大门，已有别的锚与船则仍可使用。',escape:'潮钥被带回岸上。借年影留在门外，归来者没有被再送进影里抵债。'}},
    regent_last_order:{id:'regent_last_order',name:'摄政的最后王令',mapId:'barrow',enemies:[{kind:'raider',name:'摄政德雷赫',hp:35,ac:15,x:10,y:4},{kind:'draugr',name:'旧王誓卫',x:9,y:8},{kind:'draugr',name:'旧王誓卫',x:11,y:8}],next:'hub',victory:done('C13',{flags:{name_ready:true,dreoch_defeated:true,royal_seal:true}}),defeat:done('C13',{flags:{name_ready:true,royal_seal_lost:true,nameless_sheltered:true}}),escape:done('C13',{flags:{name_ready:true,royal_seal_rejected:true,nameless_sheltered:true}}),outcomeText:{victory:'摄政倒下，发令印落在封蜡上。你们可以决定命令如何终止或延续，旧署名仍各有其人。',defeat:'梅尔与费尔加带队伍退到石堤外，现有副本与愿走的人留下。没有夺印，仍可以成立别的庇护与收束。',escape:'你们带走愿离开者与现有记录。摄政保有残余命令，石堤上的新安排须面对这个真实边界。'}}
  },
  endings:[],epilogues:[],
  codex:[
    {id:'irish_traditions',title:'爱尔兰诸叙事，并非一部统一神典',category:'神话传统',text:'本作主要借爱尔兰的神话与航海叙事组织土地、异界与誓禁主题。《第二次莫伊图拉之战》里的王权、款待、技艺与征贡进入同一政治冲突。杜恩·卡奥兰、德雷赫与献收成契约均为原创。',sourceRefs:['CE01']},
    {id:'bran_time',title:'布兰的远航与两个时序',category:'神话原典',text:'《布兰航海记》中，异界停留者与故乡经历的时间不一致，归乡也会触发危险。这里的七夜与七十年、银锚、年债和可操纵的寿年契是游戏设定。',sourceRefs:['CE02']},
    {id:'geis',title:'Geis 与 Geasa',category:'神话原典',text:'Geis为单数，geasa为复数，可指人物特有的禁约或禁忌。《达·德尔加旅舍的毁灭》通过科纳雷的禁约逐步收紧悲剧。本作不把所有凯尔特传统归为同一套可计算法律；远程缚名与相冲誓咒为原创机制。',sourceRefs:['CE03']},
    {id:'welsh_distinction',title:'威尔士《四支》与阿努恩',category:'传统辨别',text:'威尔士《马比诺吉四支》属于中世纪威尔士语叙事，普伊尔与阿劳恩的相遇通向阿努恩。爱尔兰马纳南与威尔士马纳维丹不能直接写作同一人物，本作银庭也不冒称阿努恩。两种传统在文献中独立说明。',sourceRefs:['CE04']},
    {id:'ogham',title:'欧甘：文字不是通用符文',category:'文物与创作',text:'欧甘碑石常沿石边刻字，铭文与姓名、亲属关系相关。本作让名字与地界成为证据；欧甘施法、夺名王册与远程召令均为游戏原创，不作为古代真实制度介绍。',sourceRefs:['CE05']},
    {id:'morrigan',title:'乌鸦没有宣布你们正义',category:'神话与创作',text:'莫瑞甘在爱尔兰叙事里与战事、预言等主题相连。本作泉边乌鸦只作为不确定征兆，不替任何政治路线背书；潮民与丘民也不以族属决定善恶。',sourceRefs:['CE01']},
    {id:'runtime_rules',title:'这张桌怎样前进',category:'桌面规则',text:'玩家控制四名固定成年英雄，系统掷d20、结算选择、安排敌方回合并推进章节。三主线每章均须落到下一节点；战斗可撤退，失利有实际结果并继续故事。两份行粮可作全队短休。',sourceRefs:[]}
  ],
  sourceRefs:[
    {id:'CE01',title:'Cath Maige Tuired / The Second Battle of Mag Tuired，CELT / University College Cork',url:'https://celt.ucc.ie/published/T300010.html',scope:'王权、款待、征贡、技艺与政治冲突母题；具体献约、王国与人物为原创。'},
    {id:'CE02',title:'Immram Brain / The Voyage of Bran，Séamus Mac Mathúna 编，CELT / UCC',url:'https://celt.ucc.ie/document/G303028/',scope:'异界航海与归乡时序差、马纳南潮上意象；银锚和盗年机制为原创。'},
    {id:'CE03',title:'Togail Bruidne Da Derga / The Destruction of Da Derga’s Hostel，Whitley Stokes 译，CELT / UCC',url:'https://celt.ucc.ie/published/T301017A.html',scope:'人物特有禁约与悲剧推进；不推导为普遍古代法规。'},
    {id:'CE04',title:'The White Book of Rhydderch / Four Branches，National Library of Wales 教育手稿资料',url:'https://www.library.wales/fileadmin/docs_gwefan/new_structure/discover/education/education_services/learning_resources/manuscripts/llawysgrifau_saesneg.pdf',scope:'明确威尔士四支传统及其手稿归属，与本作爱尔兰主框架区别。'},
    {id:'CE05',title:'The ogham stones which show off the earliest writing in Ireland，Maynooth University',url:'https://www.maynoothuniversity.ie/research/spotlight-research/ogham-stones-which-show-earliest-writing-ireland',scope:'欧甘碑石、石边刻文及姓名亲属记录；游戏魔法不作历史事实。'},
    {id:'CE06',title:'Brigit: Saint or Goddess?，University College Cork',url:'https://www.ucc.ie/en/smg/newsevents/brigit-saint-or-goddess.html',scope:'布里吉德与诗、金属工艺、疗愈的文献联系；艾妲的祭仪与技能为原创。'}
  ],
  contentNotes:{rating:'成年朋友向黑暗奇幻；背叛、饥荒、强迫统治、役使亡者、偷取余生；不以露骨性描写或猎奇刑罚推进。',relationships:'所有可交涉同伴、归来船员、被缚名者与被抽年对象均成年。关系数字表示公开信任与立场，不可兑换劳动、身份或身体。',adaptation:'原创爱尔兰母题战役，威尔士传统单列辨别；不声称复原统一凯尔特宗教。',runtime:'本作d20合作CRPG使用固定英雄与有限能力，不声称完整实现D&D所有法术与职业。'}
};

// 已做出的跨线行动会改变关键场景，不把另一路的损失清回默认状态。
campaign.scenes.A10.textVariants=[
  {requires:f('marrow_fields'),text:['粮袋带着陵丘黑土，亡者耕出的粮真的到了仓门。罗丝没有来领，她坐在父亲的空墓边。奥兰把这批粮单独过秤，拒绝写成没有来源的丰收。','你们现在决定由谁掌钥。拿役尸粮救急、拿它统治或拿它撤离，都将保留这份粮的来处。']},
  {requires:all(f('stopped_season'),no(f('marrow_fields'))),text:['第一斗粮进仓时，外面的影子还停在昨日的同一条缝里。银潮已经冻结季节，粮不再腐坏，田里的种也不再向明天生长。','公共仓、个人配给与迁离车都已经备好；这场停住的冬夜会跟着还留在领地的人。']}
];
campaign.scenes.B11.textVariants=[{requires:f('lifespan_contract'),text:['艾琳在旧屋摆了第二把椅子，席芙拉却看见门外一名本来同她年纪相近的妇人已须拄杖。她的姓名就在寿年契背面，提前衰老并非与归航无关的天灾。','归来名册仍能补齐，旧屋也仍能接纳亲人。被夺岁月的人同时在场，不会因一次认亲而被从今天赶走。']}];
campaign.scenes.C8.textVariants=[{requires:f('names_sold'),text:['卡苏在远处念出四个你们售给他的原名。塔赫等人从关押处走来，腕上的黑蜡印一齐发热；十二枚银币买到的安静，此刻有了能亲眼看见的样子。','你们夺来的笔尖可以把这次召令解除，也能把发令的人换成自己。解缚不能把他们被卖过的一夜变成从未发生。']}];

installEndings(campaign);
const visitIds=[...campaign.quests.flatMap(q=>q.nodeIds),...campaign.companions.map(c=>c.campScene),'interlude','council'];
campaign.scenes.hub.choices=[...new Set(visitIds)].filter(id=>campaign.scenes[id]).map(id=>({
  id:`visit_${id}`,label:`${campaign.scenes[id].arc||'终章'} · ${campaign.scenes[id].title}`,
  description:campaign.scenes[id].location||campaign.scenes[id].title,
  requires:all({sceneUnlocked:id},campaign.scenes[id].requires||{}),effects:{},next:id,repeatable:true
}));
export default campaign;
