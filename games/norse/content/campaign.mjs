import {expandCampaign} from './campaign-expansion.mjs';
// 盐峡湾 v3：独立原创短篇战役。人物、地名承接 v2；新冲突与机制均为本作原创。
// 本模块只有数据和纯构造函数，不访问网络、磁盘、凭据或模型。
const flag = id => ({flag:id});
const not = value => ({not:value});
const all = (...value) => ({all:value});
const any = (...value) => ({any:value});
const money = gold => ({resourceAtLeast:{gold}});
const food = supplies => ({resourceAtLeast:{supplies}});
const relation = (id,n=1) => ({relationAtLeast:{[id]:n}});
const finished = id => any({questState:{[id]:'done'}},{questState:{[id]:'failed'}});
const merge = (...parts) => {
  const out={};
  for(const p of parts.filter(Boolean)) for(const [key,value] of Object.entries(p)) {
    if(['resources','relations','factions','flags','quests'].includes(key)) out[key]={...(out[key]||{}),...value};
    else if(key==='unlockScenes') out[key]=[...(out[key]||[]),...value];
    else out[key]=value;
  }
  return out;
};
const finish = (id,next,effects={}) => merge({flags:{[`${id}_done`]:true},unlockScenes:next?[next]:[]},effects);
const choice = (id,label,description,effects={},extra={}) => ({id,label,description,effects,next:'hub',once:true,...extra});
const step = (id,arc,title,location,mapId,text,choices,extra={}) => ({id,arc,title,location,mapId,text,requires:all({sceneUnlocked:id},not(flag(`${id}_done`))),choices,...extra});
const result = (text,effects,next='hub') => ({text,effects,next});

export const campaign = {
  id:'norse-saltfjord-broken-oaths-v3',
  version:'3.0.0',
  title:'盐峡湾：断誓之冬',
  subtitle:'三份约，三条路；一场由活人承担的冬天。',
  prologue:'今年的海先结了一层薄冰，粮船却迟到了。旧臂环还在灰顶丘中，石南谷仍记着卡里落石而死的那一天，三窗谷那块未完的碑又添了新雪。有人把三件旧事串成了一张收债的纸。你们带着二十四枚共同金钱来到盐峡湾，能改变的，是眼前这一季。',
  startScene:'prologue',
  initialState:{resources:{gold:24,supplies:8,potions:4},relations:{frig:0,hagna:0,solveig:0},factions:{hearth:0,ring:0,sail:0},flags:{},quests:{oath:'active',mist:'active',stone:'active',frig:'active',hagna:'active',solveig:'active'},unlockScenes:['prologue']},
  resourceLabels:{gold:'共同金钱',supplies:'行粮与柴料',potions:'治疗药水'},
  statLabels:{str:'力量',dex:'敏捷',con:'体质',int:'智力',wis:'感知',cha:'魅力'},
  party:[
    {id:'p1',name:'阿斯格尔',role:'守誓战士 · 前卫救援',bio:'湾地护路人。会扛木梁，也知道什么时候该把盾放低。'},
    {id:'p2',name:'莉芙',role:'峡湾游侠 · 牵制远射',bio:'修网人出身。她总先找门闩、绳结，以及第二条离开的路。'},
    {id:'p3',name:'鲁娜',role:'渡灵祭司 · 治疗护持',bio:'给活人包扎，替亡者照灯。她不把悲伤当作别人欠下的债。'},
    {id:'p4',name:'埃里克',role:'符文术士 · 识读封路',bio:'成年誊录者。他会把“亲眼见过”和“听人说过”写在纸的两边。'}
  ],
  companions:[
    {id:'frig',name:'弗里盖尔',role:'修栏人 · 火塘同盟',faction:'hearth',description:'已经成年的弗里盖尔曾被旧约当作担保。如今他带着自己的工具来，愿意做有限的工作；任何人都不能替他决定留下。',stance:'愿支持共同粮仓和自愿轮班；反对以欠粮之名强派劳动。',campScene:'camp_frig',portrait:'frig',reactions:[{requires:flag('frig_withdrew'),stance:'已带工具退出强制配给的执行队，不接受被命令劳动。'},{requires:flag('grain_common'),stance:'愿按已谈妥的有限轮班修栏；下一次仍须重新问本人。'},{requires:flag('frig_refused_order'),stance:'拒绝以受助为由交出劳动；愿继续讨论具体、自愿的新约。'},{requires:flag('frig_limits_heard'),stance:'你们听过他的工作范围，他愿见证有限轮班。'}]},
    {id:'hagna',name:'霍格娜“雾姊”',role:'引路人 · 环誓守户之外',faction:null,description:'她认识去雾厅的旧路，也认识那种想把死者请来替自己赢一场争论的眼神。她可以拒绝作伪证，却不会收回已经给出的事实。',stance:'支持有限、可追出处的证词；拒绝拿亡者的沉默当同意。',campScene:'camp_hagna',portrait:'hagna',reactions:[{requires:flag('hagna_withdrew'),stance:'停止为你们引新路，也拒绝替假纪念稿背书；旧证据仍保留。'},{requires:flag('name_cleared'),stance:'愿继续见证有限真话，不把死者的沉默当成新誓。'},{requires:flag('hagna_warned'),stance:'已经警告不会为修饰过的亡者话作证。'},{requires:flag('hagna_limits_heard'),stance:'公开范围已说清，她愿提供不必下行的活证据路线。'}]},
    {id:'solveig',name:'索尔维格',role:'碑读客 · 独立见证',faction:null,description:'她的拓纸边角被火烤卷过。她承认自己的第一份读法有误，最不愿见的是别人用她的更正卖一份永安保证。',stance:'支持公开读法的分歧与当季实测；会为明知虚假的碑文撤去自己的名字。',campScene:'camp_solveig',portrait:'solveig',reactions:[{requires:flag('solveig_withdrew'),stance:'已从永安碑撤名，并保留能揭示不同读法的原拓。'},{requires:flag('stone_honest'),stance:'愿以自己的名字核对本季实测与更正。'},{requires:flag('false_reading'),stance:'拒绝给永久保证署名，仍允许核对既有原拓。'},{requires:flag('solveig_correction_kept'),stance:'愿继续核稿，把旧读与更正一并留给后来人。'}]}
  ],
  factions:[
    {id:'hearth',name:'火塘同盟',leader:'西格丽德',description:'渔户、修网人和借粮户围着三口火塘结成的互助。缺钱，懂潮水，最怕一张新账把他们的孩子也算进去。',goal:'粮先过冬，劳动由本人答应。'},
    {id:'ring',name:'环誓守户',leader:'托吉尔',description:'守着旧桩、山路和替班名册的人。他们怕空话，也怕承担维护的人再次被忘掉。',goal:'谁出料、谁替班、约到哪一天，都须说清。'},
    {id:'sail',name:'黑帆账房',leader:'内里',description:'商人内里带来了迟到的粮船和一群受雇护船人。他肯冒冰来送粮，也想把这一冬的风险换成长久的港权。',goal:'以粮作本，取得湾口独占卸货权。'}
  ],
  quests:[
    {id:'oath',title:'盐与铁：谁欠谁一个冬天',summary:'粮船抵港，旧债却在一夜间长出新利息。查账、取环、立约，决定粮仓由谁开门。',nodeIds:['A1','A2','A3','A4','A5'],failCondition:'A5放任冻仓离湾会令本线失败；失败仍可继续其他两线。',stakes:'粮食、港权、有限劳动与夺权。'},
    {id:'mist',title:'雾中回声：死者不替谁作保',summary:'一张纪念卡里的纸说他自愿死去。追问活人，走访雾厅，决定这句话将由谁收回。',nodeIds:['B1','B2','B3','B4H','B4L','B5'],failCondition:'B5明知不实仍指控猎伴会令本线失败，并关闭诚实证人援助。',stakes:'丧亲、证言、掩盖与勒索。'},
    {id:'stone',title:'第六行：给谁留一扇门',summary:'三窗谷将碑上的旧字当成潮闸的保票。取得木料、处理闸火、安置六名成年人，写下这一季实际做到的事。',nodeIds:['C1','C2','C3','C4','C5'],failCondition:'C5替失修潮闸刻永安保证会令本线失败；空行与撤离均是合法收束。',stakes:'工程、迁居、污染与公共谎言。'},
    {id:'frig',title:'同伴 · 工具归谁',summary:'听弗里盖尔说出他愿做和不愿做的事。',nodeIds:['camp_frig'],optional:true},
    {id:'hagna',title:'同伴 · 灯不买死人',summary:'和雾姊约定，哪一句话可以带回火塘。',nodeIds:['camp_hagna'],optional:true},
    {id:'solveig',title:'同伴 · 更正的一笔',summary:'决定如何对待索尔维格承认的错误。',nodeIds:['camp_solveig'],optional:true}
  ],
  scenes:{
    prologue:step('prologue','序幕','一张被海水泡过的收据','盐峡湾 · 登岸石','harbor',[
      '桨叶敲碎薄冰。湾口没有迎客的角声，只有搬运人把一只空桶倒扣在火边。桶底钉着一张新纸：欠粮者，入冬以工抵偿；死者已替诸户立过誓。落款是一枚黑帆印。',
      '西格丽德把温水和干巾递给你们。她没有先求援，只问：“你们要把自己的名字写在哪一边？”托吉尔在长屋门前候着；石南谷的赫瑞德抱着儿子的旧护符；索尔维格把两张互相矛盾的拓纸压在膝上。',
      '这些人有旧事，你们没有被补写成过去的英雄。今晚以前，三条路都能走；做完一件事，仍能回港换另一条。'
    ],[
      choice('land','把自己的船绳系在公共桩上','抵港，接下三份可以分别处理的请求。',finish('prologue','hub',{unlockScenes:['A1','B1','C1','camp_frig','camp_hagna','camp_solveig'],flags:{landed:true}}))
    ]),
    hub:{id:'hub',arc:'盐峡湾',title:'三条路，同一场冬天',location:'盐峡湾 · 灰顶长屋',mapId:'harbor',text:[
      '火塘上挂着三只铁锅。一只煮鱼骨，一只煮燕麦，最后一只只烧着水。墙边分别放着账册、护符和拓纸；有人从哪条路归来，就把真实带回的东西放到哪一边。',
      '粮仓、雾路和三窗谷可以交错处理。已经保住的人不会在另一条路上被重新判死；送来的木料、揭开的谎话和交出去的港权都会留下。'
    ],choices:[],repeatable:true},
    A1:step('A1','盐与铁','仓门上的盐','盐峡湾 · 冻仓外','harbor',[
      '黑帆粮船终于抵港，船腹却擦破了，三筐粮浮在冰水边。护船人守着仓门，说他们还没领到工钱，任何人不能先开仓。西格丽德的手指冻得握不住账绳。',
      '内里愿把打捞的粮算作自己的货，用八枚钱买断你们这一趟。他没掩饰利润：“我付得起把货带来；你们付得起让下一艘也来么？”弗里盖尔盯着不远处的公共桩，桩上新钉的抵工纸没有问过借粮人。'
    ],[
      choice('salvage','付两枚工钱，合力捞起三筐粮','共同金钱−2，行粮柴料+4；渔户愿意协助后续装卸。',finish('A1','A2',{resources:{gold:-2,supplies:4},factions:{hearth:1},flags:{cargo_saved:true,dock_helpers:true}}),{requires:money(2)}),
      choice('shore','绕到浅滩，先拾回能站着搬的两筐','安全慢行，行粮柴料+2；第三筐归船主自行打捞，无人被额外判死。',finish('A1','A2',{resources:{supplies:2},flags:{cargo_saved:true}})),
      choice('sell','收下内里的八枚钱，把打捞权卖给他','共同金钱+8；内里多一批可售粮，火塘同盟不再免费提供这一批船工。',finish('A1','A2',{resources:{gold:8},factions:{sail:1,hearth:-1},relations:{frig:-1},flags:{cargo_sold:true}}))
    ]),
    A2:step('A2','盐与铁','烛泪后面新添的字','盐峡湾 · 布兰德账房','thing',[
      '布兰德把原册放在灯下，手掌盖住借粮户名。旧页上的烛泪没有被刮掉；新收据却绕着烛泪留下的位置整齐补出一行利息。旧缺页不能证明谁害过谁，但两种纸的齿口合不上。',
      '“新利息不是我写的。”他承认旧账也有糊涂处，愿逐户认账，不肯拿邻人的饥饿替自己挡问。内里的誊手正在门外等一份可带去庭上的说法。'
    ],[
      choice('extract','逐行对照，只带获准的数额与纸口摹样','得到可核摘录；借粮户姓名留在布兰德手里。',finish('A2','A3',{flags:{debt_evidence:true,privacy_kept:true},relations:{solveig:1},factions:{ring:1}})),
      choice('read_all','把整页举到窗前，当众念出粮债户名','证据当场可见；户名也已公开。没有人因此失去食物，但弗里盖尔不愿替此事背书。',finish('A2','A3',{flags:{debt_evidence:true,debt_names_public:true},relations:{frig:-1},factions:{hearth:-1}})),
      choice('blackmail','让誊手带话：付十二枚，今夜不把拼页公之于众','共同金钱+12；保留拼页证据，立下勒索事实。黑帆仍可被挑战，但会揭出这笔钱。',finish('A2','A3',{resources:{gold:12},flags:{debt_evidence:true,blackmail:true},relations:{solveig:-1,hagna:-1},factions:{sail:-2}})),
      choice('guess','只查纸缝，赶在誊手出门前判断新页来处','智力 DC12；成功认出船货纸，失败只认出补页，仍能继续。',{}, {check:{stat:'int',dc:12,success:result('纸纤维带着船用防潮油。新页出自黑帆货箱；布兰德保留了原页供人复核。',finish('A2','A3',{flags:{debt_evidence:true,paper_origin:true}})),failure:result('灯油熏黑了纸边，你没认出出自哪只货箱。两页齿口不合仍是亲见；庭上可以说“补页”，不能指名伪造者。',finish('A2','A3',{flags:{debt_evidence:true,origin_unproved:true}}))}})
    ]),
    A3:step('A3','盐与铁','丘门没有要你跪下','灰顶丘 · 旧供台','mound',[
      '丘门边有两排足迹：一排属于来添灯的人，另一排带着黑帆护船人的新铁钉。供台上的臂环是旧约的实物，不能拿它证明新添的利息。门内两名护船人说，他们奉命“保管”环，直到借粮户肯抵工。',
      '托吉尔留下的见证绳还系在门闩上。出示来意，护船人愿交出环、带着自己的雇钱回船；强夺也可以，只是这里的伤不会因为你们叫它公道便消失。提尔把手作质的老故事仍被人讲，丘门没有要求任何人照做。'
    ],[
      choice('witness','出示账目摘录，请两名护船人当面交环','取回旧环，护船人自由离开；不额外征用丘中物品。',finish('A3','A4',{flags:{old_ring:true,guards_released:true},factions:{ring:1}}),{requires:flag('debt_evidence')}),
      choice('leave_ring','把环留在供台，只抄下旧约范围','得到旧约摹样；无实物作押，也能另立有限维护之约。',finish('A3','A4',{flags:{old_terms:true,ring_left:true},relations:{frig:1}})),
      choice('fight','拔兵刃，赶走占住丘门的护船人','可选战斗。胜利得环；败退失去取环机会；撤退仍能凭旧约摹样到庭。',{}, {combat:'mound_raiders'})
    ],{sourceRefs:['N01']}),
    A4:step('A4','盐与铁','不是把另一个人放进狼嘴','盐峡湾 · 环誓庭','thing',[
      '托吉尔把环的位置空出来，另放一根断桩。“旧话说质押，不说谁都能押别人。”西格丽德带来愿意搬粮的人；内里带来一份换取三年卸货权的粮单。两份都真能让仓门开，却让不同的人决定来年的价。',
      '弗里盖尔把工具袋放在脚边。他愿修栏两次，前提是每次替班者都已答应；他不愿再作一个人留在山上的担保。若已拿到卡里证言，黑帆纸上的“死者立誓”也可在此当面撤掉。'
    ],[
      choice('rotation','把可核旧约与新排班分开，逐人询问两次修栏','需要旧环或摹样。成立有限轮班；行粮柴料+2，下一条工程线有真实维护人手。',finish('A4','A5',{resources:{supplies:2},flags:{maintenance_crews:true,new_oath:true},relations:{frig:1},factions:{hearth:1,ring:1}}),{requires:any(flag('old_ring'),flag('old_terms'))}),
      choice('truth','拿出获准证词，拆掉“卡里替全湾立誓”的假纸','需要公示证词或活证人链；停止强派工，连账房也须重新报价。已经收过的售谎钱仍有来处。',finish('A4','A5',{flags:{maintenance_crews:true,new_oath:true,dead_pledge_retracted:true,lie_maintained:false,lie_retracted:true},relations:{hagna:1,frig:1},factions:{hearth:2,sail:-1}}),{requires:any(flag('testimony_public'),flag('living_proof'))}),
      choice('charter','接受三年卸货专权，换内里先开粮仓','不花现钱；仓门即开，港权在本季之后仍受黑帆约束。内里只取得卸货权，无权替人决定劳动。',finish('A4','A5',{resources:{supplies:4},flags:{harbor_charter:true},factions:{sail:2,hearth:-1},relations:{frig:-1}})),
      choice('seize','把原账压在盾下，宣布由你们接管仓钥','夺权路线。行粮柴料+4；弗里盖尔拒绝帮你们强派劳动，账房与守户转为敌对立场。',finish('A4','A5',{resources:{supplies:4},flags:{grain_seized:true,forced_labor_order:true},relations:{frig:-3,solveig:-1},factions:{hearth:-2,ring:-2,sail:-2}})),
      choice('adjourn','不签任何新保，护送各户先退回火塘','零资源也可走。仓仍未开，已有救助与证据保留，下一步可付工、谈粮或放弃。',finish('A4','A5',{flags:{oath_unsettled:true}}))
    ],{sourceRefs:['N01']}),
    A5:step('A5','盐与铁','钥匙必须交给一只真手','盐峡湾 · 粮仓内外','harbor',[
      '仓门开到一半，冰把下沿顶住。西格丽德说她愿接钥，但要把每一筐领粮写明；内里也肯给你们船工，他要纸上已谈好的权。若你们只留下命令，护船人便要听谁的刀更近。',
      '炉边一名成年渔民问：“明天你们走了，我找谁开门？”这次没有古老的狼替任何人回答。'
    ],[
      choice('commons','把钥匙交给愿意轮值的三户，分粮而不扣人','需要已立有限新约或当面撤掉亡者抵工纸。本线完成；公共仓支持三窗谷安置。',finish('A5',null,{flags:{grain_common:true},quests:{oath:'done'},unlockScenes:['council'],relations:{frig:1},factions:{hearth:2}}),{requires:any(flag('new_oath'),flag('dead_pledge_retracted'))}),
      choice('paid_crews','付八枚开仓与运送工钱，再把钥匙交回各户','共同金钱−8；不必签港权，也能完成粮仓线并留下自愿维护人手。',finish('A5',null,{resources:{gold:-8},flags:{grain_common:true,maintenance_crews:true},quests:{oath:'done'},unlockScenes:['council'],factions:{hearth:1,ring:1}}),{requires:money(8)}),
      choice('merchant','按已签卸货权交钥，令黑帆先按约发粮','需要三年港约。本线完成；粮真正发出，来年卸货权仍受约束。',finish('A5',null,{flags:{grain_delivered:true},quests:{oath:'done'},unlockScenes:['council'],factions:{sail:1}}),{requires:flag('harbor_charter')}),
      choice('rule','保留仓钥，以你们的名义安排欠粮人上工','需要已经夺仓。黑暗线完成；粮未消失，但劳动与配给由你们强制安排。弗里盖尔离开执行队。',finish('A5',null,{flags:{ration_rule:true,frig_withdrew:true},quests:{oath:'done'},unlockScenes:['council'],relations:{frig:-3},factions:{hearth:-2}}),{requires:flag('grain_seized')}),
      choice('leave','把未签的纸留在门缝，离开冻仓','本线失败：仓没有成为公共粮源。先前救起的粮与已经自由的人保留，其他两线继续。',finish('A5',null,{flags:{oath_failed:true},quests:{oath:'failed'},unlockScenes:['council']}))
    ]),
    B1:step('B1','雾中回声','第二次写死卡里的人','石南谷 · 赫瑞德火塘','thing',[
      '赫瑞德把一张新印的纪念纸放在旧护符旁。旧纸只说卡里死于落石，新纸却说：“他自愿赴死，为全湾换粮。”纸角有黑帆印，下一行正是借粮户抵工的凭由。',
      '“我没有买他活回来。”父亲把六枚路钱推近，“我只不要他们再用他开一次仓门。”他知道落石本来是意外，猎伴没有拉住；你们要查的是谁正在挪用这件死，不是另造一个杀人者。'
    ],[
      choice('expenses','收下六枚，只答应核清纸的来处','共同金钱+6；明确不以钱买结论，不擅自公开猎伴身份。',finish('B1','B2',{resources:{gold:6},flags:{hred_expenses:true,limited_report:true}})),
      choice('refuse','留下路钱，仍答应把亲见和猜测分开','不收款也能取得护符与纪念纸摹样。',finish('B1','B2',{flags:{limited_report:true},relations:{hagna:1}})),
      choice('promise_blame','先许诺找一个人认罪，拿钱再说','共同金钱+6；这句许诺被父亲记住，雾姊反对用结论带路，后续仍可公开更正。',finish('B1','B2',{resources:{gold:6},flags:{promised_culprit:true},relations:{hagna:-2}}))
    ]),
    B2:step('B2','雾中回声','坡上还有一个活人','石南谷 · 断石坡','forest',[
      '猎伴伊尔莎坐在松根上，指节上留着当年拉绳的旧伤。她没有推石头，也没有救住卡里。她肯说自己见过什么，不肯让名字被印成谁该抵命的凭据。',
      '坡面新近又松了一角，切口与旧纪念纸记的一致。伊尔莎还带来一张黑帆誊手请她画押的空纸；誊手曾说：“写成自愿，大家都好过冬。”她没有签。'
    ],[
      choice('consent','由她决定具名范围，记下空白纸与落石位置','得到活证据，可在庭上拆除死者抵工纸；伊尔莎愿为有限记录再次作证。',finish('B2','B3',{flags:{living_proof:true,witness_network:true},relations:{hagna:1},factions:{hearth:1}})),
      choice('trace','不带她名字，只比对誊手纸与纪念纸','智力 DC12；失败仍保留无推石证据，但无法认出誊手用纸。',{}, {check:{stat:'int',dc:12,success:result('纸口、油纹与同一块磨损印角相合。没有她的名字，也能说明同一账房重写了纪念。',finish('B2','B3',{flags:{living_proof:true,witness_anonymous:true}})),failure:result('两张纸被雨浸得太重，印角没法相认。自然落石的缺口和她未签的空纸仍在，足够阻止无证指控。',finish('B2','B3',{flags:{physical_evidence:true,witness_anonymous:true}}))}}),
      choice('coerce','逼她按你们写好的话画押，声称她看见内里害人','得到一份虚假画押；伊尔莎收回今后的自愿协助，雾姊将据实指出矛盾。',finish('B2','B3',{flags:{coerced_witness:true,witness_network:false},relations:{hagna:-3,frig:-1},factions:{hearth:-1}}))
    ]),
    B3:step('B3','雾中回声','黄金桥影下的岔路','石南谷 · 雾路入口','hel',[
      '霍格娜带你们停在水声前。雾里有一线像金色桥面的光；她说赫尔莫德的老故事里，守桥者莫德古丝问过来者的姓名和去处。她没有说那便是全体死者都要遵守的一张路图。',
      '“可以下去，问卡里愿意留给父亲哪句话。也可以只凭活人证据回去。”渡口边，一团被湿纸卷住的影子反复念着新纪念文。它是本地谎话惊起的回声，不是女神赫尔。雾姊不会要你们以身体或记忆买路。'
    ],[
      choice('walk','分出一份行粮给留守人，循旧路进雾厅','行粮柴料−1；跟随本作原创的雾路下行，问话不自动等于复生。',finish('B3','B4H',{resources:{supplies:-1},flags:{went_hel:true}}),{requires:food(1)}),
      choice('living','把灯转回山路，只用活人能够核对的证据','零资源也能继续。没有听见亡者的话，不能在归村后补造它。',finish('B3','B4L',{flags:{stayed_living:true}})),
      choice('silence_echo','击散反复念假纸的借名之影，再向厅走','可选战斗。胜利通往雾厅；败退或逃离转回活证据路线，主线继续。',{}, {combat:'borrowed_echo'})
    ],{sourceRefs:['N02']}),
    B4H:step('B4H','雾中回声','亡者没有多看见一寸','雾厅 · 低梁下','hel',[
      '厅里没有审判席。卡里坐在低梁下，手停在一只空杯旁。他说：“我喊过伊尔莎。她没有抓住我。我没看见谁推石头。”那些话没有变成一个新凶手，也没有替那张抵工纸开脱。',
      '他愿父亲听见这一段，也愿你们公开一句：“我没有答应替任何人死。”他不愿私下最后的呼喊被刻成供人反复观看的场面。霍格娜把两句话分别记下：“给谁看，便带到谁那里。”'
    ],[
      choice('public','只带获准的两句：未见推石，未曾替湾立誓','得到可公开的有限证词；可用于粮仓庭议，不把雾厅当作无所不知的裁判。',finish('B4H','B5',{flags:{testimony_public:true,kari_words:true},relations:{hagna:2},factions:{ring:1}})),
      choice('father','把获准的话只交父亲，不将雾中经历当公共武器','得到私下证词；可用活人证据纠正纪念纸，无法凭此按钮公开亡者私话。',finish('B4H','B5',{flags:{testimony_private:true,kari_words:true},relations:{hagna:1}})),
      choice('invent','口头答应，却决定回村后写成卡里自愿献身','记录明知歪曲。不会获得虚假的神谕或法术加成；下一场可收回，也可为账房继续谎言。',finish('B4H','B5',{flags:{planned_dead_lie:true,kari_words:true},relations:{hagna:-3,solveig:-1}}))
    ]),
    B4L:step('B4L','雾中回声','没有下行，也有一句真话','石南谷 · 灯下旧案','thing',[
      '雨把你们的斗篷滴成一小洼水。霍格娜没有代念厅里未曾听见的话，只把空白画押纸、石坡摹样和纪念纸排开。伊尔莎是否允许具名，仍按她已经说出的范围。',
      '你们知道卡里的死有自然落石的痕迹，没有足够证据指控猎伴；也知道新纪念文没有来自家人的授权。你们不知道卡里最后愿说什么。承认这块空白，比让亡者替自己发言更费力。'
    ],[
      choice('limited','写明亲见与未知，请家属更正新纪念纸','得到可核的活人报告；这份报告足以质疑抵工纸，不谎称见过亡者。',finish('B4L','B5',{flags:{living_proof:true,limited_truth:true},relations:{hagna:1,solveig:1}})),
      choice('silence','只给父亲看证据，暂不替全谷下结论','保留私下报告，仍能办纪念、拒绝无证指控。',finish('B4L','B5',{flags:{testimony_private:true,limited_truth:true}})),
      choice('forge','以雾姊的名义补写一段“亡者自愿”的话','伪造证词留有记录；雾姊不会因此同意，也不会在下一场替你们背书。',finish('B4L','B5',{flags:{planned_dead_lie:true,forged_hagna:true},relations:{hagna:-3,solveig:-2}}))
    ]),
    B5:step('B5','雾中回声','把一句话还给说话的人','石南谷 · 归村火塘','thing',[
      '赫瑞德先把新纪念纸的黑帆印撕掉，随后停手：“剩下的，也要看你们真带回了什么。”他想念儿子，但没有拿这份想念强迫伊尔莎认罪。内里的誊手在门边等着——若全谷仍信自愿献身，抵工纸便容易得多。',
      '你们可交有限报告，可请父亲主持一次没有神判的纪念，也可把已知不实的话卖给账房。谎言不会召来神罚；它会落在随后被迫上工、被写错名字的人身上。'
    ],[
      choice('correct','公开可核的有限结论，撤下自愿献身与抵工的说法','需要公开证词或活人报告。本线完成；已自愿的证人可继续帮助，不恢复受胁证人的同意。此前许错结论也在此更正。',finish('B5',null,{flags:{name_cleared:true,lie_retracted:true,promised_culprit:false,planned_dead_lie:false},quests:{mist:'done'},unlockScenes:['council'],relations:{hagna:1},factions:{hearth:1,sail:-1}}),{requires:any(flag('testimony_public'),flag('living_proof'))}),
      choice('mourning','只作父亲获准的纪念，明确没有新凶手','本线完成；私话留在火塘边，未公开的证词不能自动给另一条线使用。',finish('B5',null,{flags:{quiet_memorial:true},quests:{mist:'done'},unlockScenes:['council'],relations:{hagna:1}})),
      choice('sell_lie','收十二枚，准许账房继续印“自愿献身”','共同金钱+12。本线以政治谎言完成；证人拒绝支持该稿，雾姊停止替你们引新路，仍不抹去旧证据。',finish('B5',null,{resources:{gold:12},flags:{lie_maintained:true,dead_lie_sold:true,hagna_withdrew:true,witness_network:false},quests:{mist:'done'},unlockScenes:['council'],relations:{hagna:-3},factions:{sail:2,hearth:-1}})),
      choice('blame','明知没有推石证据，仍把猎伴写成凶手','本线失败；无辜的伊尔莎被迫离村，今后不提供自愿证言。后续粮仓和安置仍可继续。',finish('B5',null,{flags:{false_accusation:true,witness_exiled:true,hagna_withdrew:true,witness_network:false},quests:{mist:'failed'},unlockScenes:['council'],relations:{hagna:-4,frig:-2},factions:{hearth:-2}}))
    ]),
    C1:step('C1','第六行','两张拓纸都不肯变成保票','三窗谷 · 大路碑','forest',[
      '索尔维格和老赫立尔夫把两张拓纸摊在石上。一处模糊字，她先前读作“常固”，他却读作“此季”。两人肯让你们逐字比对，谁也没有拿出一张神的标准答案。',
      '山下新铸的潮闸正借“常固”招工。商队愿花十枚买一季署明分歧的摹稿，也愿花更多钱买一句没有分歧的保证。索尔维格低头看旧稿：“我会更正那一笔。你们打算让更正走多远？”'
    ],[
      choice('compare','并列两张摹样，把读法与实测分开','得到潮线资料；后续能按原物修闸，索尔维格愿继续核稿。',finish('C1','C2',{flags:{rubbing_compared:true},relations:{solveig:1},factions:{ring:1}})),
      choice('license','让两位碑读客各自签有限授权，售出注明分歧的季稿','共同金钱+10；两张原拓和本人说话权保留，商队只获这一季的文字稿。',finish('C1','C2',{resources:{gold:10},flags:{rubbing_compared:true,licensed_excerpt:true},factions:{sail:1}})),
      choice('certainty','收十八枚，删掉分歧，把旧字写成永久安全','共同金钱+18；明知证据不足仍作保证。索尔维格撤去自己名字，后续还能当面更正。',finish('C1','C2',{resources:{gold:18},flags:{false_reading:true},relations:{solveig:-3},factions:{sail:2,ring:-1}})),
      choice('listen','先不抄也不卖，只听两位讲清楚哪里看不清','零成本取得有限潮线资料，不因不抄而阻断救助。',finish('C1','C2',{flags:{tide_notes:true}}))
    ]),
    C2:step('C2','第六行','木头不是从一句咒语里来的','余烬脊 · 三户林缘','forest',[
      '枯木户肯借雪橇，牧场户肯让出一段路，抬木的巨族一家却问今冬羊吃什么。三家各有自己的物，打一架不能把另一家的答应也算上。黑树下有两头饿狼盯着露在雪上的肉袋；它们不是芬里尔。',
      '你们可拿一份行粮换这一趟运输，若粮仓线已留下维护人手，也可请已到场的成年人按谈好的工轮搬运。没有木料仍能冬闭此路，先把人送到石屋；那会失去直通港口的便道。'
    ],[
      choice('trade','以一份行粮换雪橇与这一趟运木','行粮柴料−1；木料到达潮闸，不把三户变成永久帮工。',finish('C2','C3',{resources:{supplies:-1},flags:{wood_secured:true,forest_passage:true},factions:{ring:1}}),{requires:food(1)}),
      choice('crew','请已自愿排班的维护人手按这一趟约搬木','需要粮仓线已有维护队。木料到闸，便道可供之后搬粮与安置。',finish('C2','C3',{flags:{wood_secured:true,forest_passage:true,crew_used:true},relations:{frig:1}}),{requires:flag('maintenance_crews')}),
      choice('wolves','护住雪橇，打退逼近搬运路的两头饿狼','可选战斗。胜利保木；败退失去这一车木；逃离则冬闭便道，三种结果都能继续处理潮闸。',{}, {combat:'forest_wolves'}),
      choice('close','竖起冬闭标记，和三户一道撤回石屋','零资源路线。没有木料，便道冬闭；不制造新的死者，不撤销之前保住的粮。',finish('C2','C3',{flags:{forest_closed:true,wood_unavailable:true}}))
    ]),
    C3:step('C3','第六行','盐水与炭火中间','三窗谷 · 潮闸锻棚','forge',[
      '潮水撞在铁页外，火星从锻棚梁下落下来。弗里德芙指出两根需要更换的榫；如果木料已到，修好当季支撑有把握。若没有，侧闸仍可手动打开，放弃一块作业地，让水走原沟。',
      '锻工另提一个更快的办法：把盐水改送渔户的晒网棚，保住火炉与现成木料。“你们若说是诸神要的，他们会听。”索尔维格把那张抄有旧字的纸卷起来。此刻水往哪边走，不由碑文决定。'
    ],[
      choice('repair','用到场木料换榫，按两位工人的指挥试闸','需要实到木料。行粮柴料−2；当季闸稳、晒网棚保全，工人没有许诺永久安全。',finish('C3','C4',{resources:{supplies:-2},flags:{weir_repaired:true,forge_safe:true,net_sheds_safe:true},relations:{solveig:1},factions:{ring:1,hearth:1}}),{requires:all(flag('wood_secured'),food(2))}),
      choice('measured_repair','请愿意继续核稿的索尔维格依两次潮线重新排支撑','需木料、可核潮线与索尔维格仍愿合作。她指出可少换的一根料，行粮柴料只扣1；关系不能被支付或兑换。',finish('C3','C4',{resources:{supplies:-1},flags:{weir_repaired:true,forge_safe:true,net_sheds_safe:true,measured_supports:true},factions:{ring:1}}),{requires:all(flag('wood_secured'),any(flag('rubbing_compared'),flag('tide_notes')),relation('solveig',1),not(flag('solveig_refused_erasure')),food(1))}),
      choice('open','打开侧闸，放弃作业地，先让水从旧沟退走','零资源可靠方案。保人和晒网棚；锻棚今冬不能恢复原产量，可借空出来的高台安置人。',finish('C3','C4',{flags:{weir_open:true,forge_reduced:true,net_sheds_safe:true}})),
      choice('rush','在水位抬高前抢装旧榫','力量 DC13；成功暂稳，失败旧料折断并改开侧闸。失败前进，不补造死亡。',{}, {check:{stat:'str',dc:13,success:result('旧榫撑过了试水。你们在支架上刻下“只到解冻”的记号，不能把临时支撑说成永安。',finish('C3','C4',{flags:{weir_temporary:true,forge_safe:true}})),failure:result('旧榫在水压下折断，众人退上高台，及时打开侧闸。锻棚减产；幸存者与已经送到的木料保留。',finish('C3','C4',{flags:{weir_open:true,forge_reduced:true,repair_failed:true}}))}}),
      choice('divert','把盐水导向晒网棚，声称这是一份必要牺牲','行粮柴料+3来自保住的锻棚库存；六名棚工先撤到高处，无新死亡，渔具与生计受损。',finish('C3','C4',{resources:{supplies:3},flags:{bay_poisoned:true,forge_safe:true,forced_sacrifice:true},relations:{frig:-2,solveig:-2},factions:{hearth:-3,sail:1}}))
    ]),
    C4:step('C4','第六行','门前数得清的六个人','三窗谷 · 高台石屋','thing',[
      '六名成年棚工把湿衣搭在门外，没有一支看不见尽头的人潮。屋主愿借半间高屋到解冻，修补两处裂榫的劳动另约，不拿住宿换身体或无限服役。少年阿尔夫海因平安坐在屋内添灯，不替成年人签字。',
      '若公共粮仓已经开了，西格丽德送来的那一筐够他们先住。若侧闸已开，高台空锻棚也能挡风。另有黑帆船愿载他们西去，前提是他们各自愿意走；内里会把票钱记在你们现有的钱袋上。'
    ],[
      choice('grain_shelter','用公共粮仓实际送来的粮，与屋主约到解冻','需要公共粮源。六人当夜住下，不再从队伍扣第二份粮。',finish('C4','C5',{flags:{sheltered:true,communal_grain_used:true},factions:{hearth:1},relations:{frig:1}}),{requires:flag('grain_common')}),
      choice('food_shelter','拿出两份行粮，与屋主约两处有限修补','行粮柴料−2；六人安置，春日只清两处真实修补，不变成无限劳役。',finish('C4','C5',{resources:{supplies:-2},flags:{sheltered:true,repair_promise:true},factions:{hearth:1}}),{requires:food(2)}),
      choice('forge_shelter','把侧闸高台清成临时宿处，自己轮班守火','需要侧闸已经打开。零资源再扣；六人有屋顶，锻棚不能同时按满产量写回。',finish('C4','C5',{flags:{sheltered:true,forge_shelter:true},factions:{hearth:1}}),{requires:flag('weir_open')}),
      choice('west','付六枚船票，由愿意西去的六人各自决定登船','共同金钱−6；六名成年人自愿迁居，原屋未获修复，已到西岸才记为送达。',finish('C4','C5',{resources:{gold:-6},flags:{resettled:true,displaced:true,west_arrival:true},factions:{sail:1}}),{requires:money(6)}),
      choice('high_road','护送六人沿高路到守户石屋，放弃今夜复工作业','零资源可靠撤离。六人平安到接收人处；直路与原住处仍未恢复。',finish('C4','C5',{flags:{resettled:true,displaced:true,high_road_used:true},factions:{ring:1}}))
    ]),
    C5:step('C5','第六行','第六行留给来春读','三窗谷 · 大路碑前','forest',[
      '老赫立尔夫把錾子递给索尔维格，又把一块空白小石递给你们。“碑上能写的，比人的一生短。”六名棚工的真实去向已经写在旁边的木片上；名字只刻本人准的。',
      '内里还愿花十二枚，买一句“此湾永安”。若这季闸稳，他想把当季写成永远；若闸开着或盐水进了网棚，他更需要那句话。索尔维格可以帮你们刻实测与限期，或者留下那一行。她不会替明知不实的保证署名。'
    ],[
      choice('season','刻实测、去向与到解冻的期限，公开承认先前更正','本线完成。有限真话与空白都不保证未来；先前错读在此撤回，已造成的晒网损失仍在。',finish('C5',null,{flags:{stone_honest:true,false_reading:false,reading_corrected:true},quests:{stone:'done'},unlockScenes:['council'],relations:{solveig:2},factions:{ring:1}})),
      choice('witnesses','请获准的活证人逐人核字，再刻这一季做到的事','需要自愿证人网络；本线完成，证词没有被拿来替工程担保。',finish('C5',null,{flags:{stone_honest:true,public_witnesses:true,false_reading:false},quests:{stone:'done'},unlockScenes:['council'],relations:{hagna:1,solveig:1},factions:{hearth:1,ring:1}}),{requires:flag('witness_network')}),
      choice('blank','第六行留空，旁边只保留真实去向木片','本线完成。留白不会撤销已救者，也不会触发隐藏惩罚；未修的闸仍按实际未修记录。',finish('C5',null,{flags:{stone_blank:true},quests:{stone:'done'},unlockScenes:['council'],relations:{solveig:1}})),
      choice('lie','收十二枚，仍刻“此湾永安”，借碑压下质疑','共同金钱+12；本线失败，公共谎言确实刻出。索尔维格撤名，去向与潮闸实情不会因此改写。',finish('C5',null,{resources:{gold:12},flags:{stone_lie:true,solveig_withdrew:true},quests:{stone:'failed'},unlockScenes:['council'],relations:{solveig:-4},factions:{sail:2,ring:-2}}))
    ]),
    camp_frig:step('camp_frig','同伴','工具袋放在门的哪边','盐峡湾 · 修网火塘','harbor',[
      '弗里盖尔把一枚旧钉子磨成新的铰钉，故意坐在离门最近的凳上。“我可以留下修两次栏，也可以跟你们走。两件事都要我自己说。”他看见你们在算粮，却先把工具袋口扎紧。',
      '他想要的不是谁替他称量过去受了多少苦，而是下次缺人时，别人会先来问他。友情、相互照看或到此为止，都不改变账册和救援的资格。'
    ],[
      choice('ask','请他把愿意做的两次修栏写明，并保留改约的权利','弗里盖尔愿在自愿轮班方案中作见证；关系+1，有限帮助不会变成可花用的人情。',finish('camp_frig',null,{relations:{frig:1},flags:{frig_limits_heard:true},quests:{frig:'done'}})),
      choice('friend','以朋友相待，约好忙完一起回海边，不替他决定去留','关系+1；没有亲密换情报或资源，既有劳动仍另问本人。',finish('camp_frig',null,{relations:{frig:1},flags:{frig_friendship:true},quests:{frig:'done'}})),
      choice('command','说受过帮助的人应把一季劳动交给你们','弗里盖尔拒绝这项新命令，关系−2；他继续保有工具与离开的自由。',finish('camp_frig',null,{relations:{frig:-2},flags:{frig_refused_order:true},quests:{frig:'done'}}))
    ]),
    camp_hagna:step('camp_hagna','同伴','灯不买死人','石南谷 · 雾姊灯屋','hel',[
      '霍格娜修一盏破灯。灯芯短了，她便把碟子垫高，没有说这是命运对谁的考验。“有人付钱，只想听一句能让他睡着的话。”她问你们准备怎样把不知道带回去。',
      '门上挂着一只空杯。她不把空杯叫作灵魂的价，也不以亲近来换过路；这段谈话可以很短，仍能把公开范围说清楚。'
    ],[
      choice('limits','承认有限证词也有价值，不让她代替死者同意','关系+1；雾姊愿给一条不必向亡者索取答案的路。',finish('camp_hagna',null,{relations:{hagna:1},flags:{hagna_limits_heard:true},quests:{hagna:'done'}})),
      choice('uncertain','直说害怕空手回来，请她指出活人还能查什么','关系+1；承认恐惧不会失去协助资格。',finish('camp_hagna',null,{relations:{hagna:1},flags:{hagna_trust:true},quests:{hagna:'done'}})),
      choice('use','说只要结果有用，死人的话可以修得更好听','关系−2；她拒绝为改写作证，已给出的真实材料仍保留。',finish('camp_hagna',null,{relations:{hagna:-2},flags:{hagna_warned:true},quests:{hagna:'done'}}))
    ]),
    camp_solveig:step('camp_solveig','同伴','更正的一笔','三窗谷 · 碑下棚','forest',[
      '索尔维格在旧拓纸上留了一个细圈，没有把原字刮掉。“要是只把新答案写得很整齐，下一人就不知道我错在哪里。”她把两张纸重新包好，雨还在棚顶敲。',
      '她愿意听不同读法，也愿意在实物面前改口；她不愿把一次改口变成商人手里的另一枚印。你们的回应会让她决定，之后还要不要用自己的名字替稿。'
    ],[
      choice('keep_trace','请她保留原读、更正和依据，愿意一起向工人说明','关系+1；她愿继续核稿，原纸仍由两位读客各自持有。',finish('camp_solveig',null,{relations:{solveig:1},flags:{solveig_correction_kept:true},quests:{solveig:'done'}})),
      choice('disagree','提出另一读法，但同意让实测决定闸能撑多久','关系+1；不同意碑义不妨碍合作，没有唯一神谕答案。',finish('camp_solveig',null,{relations:{solveig:1},flags:{solveig_respected_dispute:true},quests:{solveig:'done'}})),
      choice('erase','要她刮掉旧读，免得损害你们所卖保证的价','关系−2；她保留原稿并拒绝这项改写，证据没有被你们一句命令抹去。',finish('camp_solveig',null,{relations:{solveig:-2},flags:{solveig_refused_erasure:true},quests:{solveig:'done'}}))
    ]),
    council:step('council','终局','解冻前，最后一次开门','盐峡湾 · 春分长屋','thing',[
      '冰尚未开，长屋先开了门。墙边留下你们实际带回的物：可能是臂环，可能是摹样，也可能只有一张写明没办成的纸。六名棚工的去向不再悬着，卡里的名字却未必因此写对。',
      '人们要的不是你们替诸神解释这个冬天，而是把仓钥、港约、未完的修补和已经传出去的话交代清楚。选一件你们确已做到、也愿承担来春后果的事，作为这段旅途的最后一行。'
    ],[
      choice('commons','把三口火塘的轮值表留到来春','公共粮仓、诚实碑文与已更正的纪念相互支持；谁都不能借此永久命令人。',{}, {requires:all(flag('grain_common'),flag('stone_honest'),flag('name_cleared'),not(flag('lie_maintained')),not(flag('false_accusation')),not(flag('forced_labor_order'))),ending:'common_spring'}),
      choice('charter','把已发粮与三年港约一同挂上墙','粮曾真正发出，垄断也不会在结局里自动消失。',{}, {requires:all(flag('harbor_charter'),flag('grain_delivered')),ending:'leased_spring'}),
      choice('crown','把仓钥与永安碑都留在你们手里','需要强制配给与公共谎言。黑暗统治以两件真实权力为根，拒绝服从者会离开。',{}, {requires:all(flag('ration_rule'),flag('stone_lie')),ending:'salt_crown'}),
      choice('correct_debt','公开勒索所得的来处，接受其后仍须清的账','曾勒索、后来以诚实刻字更正。承认不自动偿清过去，原主可继续要求具体归还。',{}, {requires:all(flag('blackmail'),flag('stone_honest')),ending:'debt_in_daylight'}),
      choice('west_lights','把真实报告与迁居去向一同交给西岸船','需要已经自愿迁居的六人和有限真实报告；旧家没有恢复，新的去处已经到达。',{}, {requires:all(flag('displaced'),any(flag('name_cleared'),flag('limited_truth'))),ending:'westward_lights'}),
      choice('blank','让空行和一次安静纪念一起留下','需要空碑与安静纪念；不公开私话仍能过冬，空白不会凭空补好旧闸。',{}, {requires:all(flag('stone_blank'),flag('quiet_memorial')),ending:'unwritten_thaw'}),
      choice('cold','按实际已完成与未完成的事，接受这一季的冷和平','任何三条主线都已收束即可。失败、局部救助与尚未清的争端按原样留下。',{}, {ending:'cold_peace'})
    ],{requires:all({sceneUnlocked:'council'},finished('oath'),finished('mist'),finished('stone'))})
  },
  battles:{
    mound_raiders:{id:'mound_raiders',name:'丘门护船人',mapId:'mound',enemies:[{kind:'raider',x:7,y:4},{kind:'raider',x:8,y:9}],next:'hub',victory:finish('A3','A4',{flags:{old_ring:true,mound_won:true},factions:{sail:-1,ring:-1}}),defeat:finish('A3','A4',{flags:{old_terms:true,mound_retreat:true},factions:{ring:-1}}),escape:finish('A3','A4',{flags:{old_terms:true,mound_escape:true}}),outcomeText:{victory:'护船人放下武器退向船边。你们取得臂环，也把在丘门动武的事实带回庭上；其他供物不归你们。',defeat:'你们在门外败退，失去这一趟取环的机会。守丘人让伤者离开，托吉尔仍愿核旧约摹样；粮仓线没有断。',escape:'你们收起武器退回见证绳外。环留在丘中，旧约范围已抄明，另拟担保仍可到庭。'}},
    borrowed_echo:{id:'borrowed_echo',name:'借名之影',mapId:'hel',enemies:[{kind:'wraith',x:7,y:3}],next:'hub',victory:finish('B3','B4H',{flags:{went_hel:true,echo_silenced:true}}),defeat:finish('B3','B4L',{flags:{stayed_living:true,echo_retreat:true}}),escape:finish('B3','B4L',{flags:{stayed_living:true,echo_escaped:true}}),outcomeText:{victory:'湿纸从影中散落，重复的假话终于停下。霍格娜领你们进雾厅；击散回声没有赐予死人全知。',defeat:'灯熄了一盏，霍格娜把伤者拉回岸边。你们没听见卡里说话，转而整理活证据；这条主线仍有结论。',escape:'你们离开念纸的影子，带着原有证据回灯屋。未下行就不补造亡者证言。'}},
    forest_wolves:{id:'forest_wolves',name:'雪橇边的饥狼',mapId:'forest',enemies:[{kind:'wolf',x:10,y:6},{kind:'wolf',x:11,y:7}],next:'hub',victory:finish('C2','C3',{flags:{wood_secured:true,forest_passage:true,wolves_driven:true}}),defeat:finish('C2','C3',{flags:{wood_unavailable:true,forest_closed:true,wood_lost:true}}),escape:finish('C2','C3',{flags:{wood_unavailable:true,forest_closed:true,forest_escape:true}}),outcomeText:{victory:'狼退进林子，雪橇继续下山。这一车木真的到了闸边，巨族一家只履行这一趟约。',defeat:'众人退向高地，雪橇滑入沟中，木料未能运到。人已撤回，潮闸还可开侧口，失木没有变成终局锁。',escape:'你们带走搬运人，把标记改为冬闭。木料留在林缘，之后走高路安置人。'}}
  },
  endings:[
    {id:'common_spring',title:'换班之春',text:['仓钥轮过三只不同的手，账上每一筐粮都有去向。弗里盖尔修完约好的两次栏，第三次缺人时，人们重新来问他。','卡里的名字没有被用来要求另一人吃苦。碑边写着这一季的水位与限期；它没有许诺永安，下一季仍有人愿意来量。'],priority:90},
    {id:'leased_spring',title:'租来的春天',text:['黑帆照约发了粮，湾里过了冬。解冻以后，新来的小船才知道三年的卸货权意味着每一筐鱼都要多走一道秤。','你们救回的事没有失效，签出的权也没有消失。来春若想改约，须有人拿出新的船、粮和愿意担的风险。'],priority:70},
    {id:'salt_crown',title:'盐冠',text:['仓门只认你们的钥，碑上永安的两个字被反复拿来堵住询问。粮依然发出，却由命令决定谁先领、谁先上工。','弗里盖尔带着自己的工具走了。索尔维格留下未刮的旧稿，霍格娜不再给新路。你们得到了一个可供统治的冬天，也使有人开始寻找离湾的船。'],priority:100},
    {id:'debt_in_daylight',title:'见光的债',text:['勒索的钱不再藏在“替大家好”的话里。你们把来处说清，账房也把可指认的数目留给受影响的人。承认没有自动变成偿还。','至少这次碑上保留了更正，原稿没有烧掉。愿意继续核对的人能看见你们在哪一步改了口，仍可要求把具体的债一笔一笔清掉。'],priority:80},
    {id:'westward_lights',title:'向西带灯',text:['六名成年人各自选了新的床铺和接收人。有人想家，有人庆幸终于离开，谁也没被一句“他们去了西边”从故事里抹掉。','关于卡里的有限报告随船同行。它没有替旧屋挡住潮水，却让新岸边的人知道：这个冬天，并非所有离开都叫作被神选中。'],priority:60},
    {id:'unwritten_thaw',title:'空行解冻',text:['第六行没有字，父亲的火塘边也没有供人传抄的最后呼喊。木片仍记着每个已经到达的去处，留白没有撤销这些实际结果。','春来时，未修的榫仍要修，闭着的路仍须再议。人们可以继续争论碑义，不必替一份从未答应的神谕流血。'],priority:50},
    {id:'cold_peace',title:'这一季的冷和平',text:['把已经做成的事留在已经做成的地方：救起的粮没有再沉下去，自由离开的人没有被旧约重新押回。没开成的仓、没撤掉的假话和没修好的闸也一并留下。','盐峡湾没有因一次旅途便和解。来春若有人再来，必须从这些真实后果出发，而非从一张把所有人都写成英雄的白纸开始。'],priority:0}
  ],
  epilogues:[
    {id:'public_grain',title:'仓钥',requires:flag('grain_common'),text:'公共仓按自愿轮值发粮。三窗谷是否已经用到那一筐，只按实际住宿方案记，不再扣一次队伍的粮。'},
    {id:'port_charter',title:'港约',requires:flag('harbor_charter'),text:'黑帆保有三年独占卸货权。粮食到账不是永久港权已赎回的证明；新来的小船仍须面对这份约。'},
    {id:'forced_work',title:'弗里盖尔的工具袋',requires:flag('frig_withdrew'),text:'弗里盖尔退出了配给执行队。他自己的工具、名字与自由都没有成为你们夺仓后的战利品。'},
    {id:'sealed_store',title:'未开的仓',requires:flag('oath_failed'),text:'这次没有建成公共粮源。早先打捞的粮仍归真实持有人，没签的抵工纸也没有因你们离开便自动失效。'},
    {id:'living_record',title:'被更正的纪念',requires:flag('name_cleared'),text:'纪念纸撤下了自愿献身和借名抵工的说法。报告有清楚出处，仍不能说明见证者未曾看到的事。'},
    {id:'sold_dead',title:'雾姊不再领新路',requires:flag('dead_lie_sold'),text:'你们曾收钱放行不实纪念稿。后来即使在庭上撤回，已经发出的稿与收过的款仍有来处；霍格娜仍可拒绝替你们引新路。'},
    {id:'coerced_signature',title:'一张受迫的画押',requires:flag('coerced_witness'),text:'伊尔莎被逼画过一张与亲见不符的纸。更正公共结论不自动恢复她的信任或新授权，受迫画押也不能充作自愿证人网络。'},
    {id:'exiled_witness',title:'伊尔莎离村',requires:flag('witness_exiled'),text:'伊尔莎因无证指控被迫离村。落石没有变成谋杀，你们的指控却真实改变了一个活人的去处。'},
    {id:'salt_sheds',title:'晒网棚',requires:flag('bay_poisoned'),text:'六名棚工活了下来，盐水毁坏的网具与生计没有在解冻时自动恢复。保住锻棚的收益来自这次被强加的牺牲。'},
    {id:'side_weir',title:'侧闸',requires:flag('weir_open'),text:'打开的侧闸保住了撤离与高台。锻棚今冬减产；若高台改作宿处，就不能又把同一地段写成满产作坊。'},
    {id:'repaired_weir',title:'潮闸',requires:flag('weir_repaired'),text:'新榫撑过了当季试水。这是到解冻前的实测结果，春水上涨之后仍须检查。'},
    {id:'new_roof',title:'当夜的屋顶',requires:flag('sheltered'),text:'六名成年棚工在当夜得到屋顶。已约好的两处修补按有限范围结清，住宿不成为永久劳役。'},
    {id:'new_shore',title:'真实的去处',requires:flag('displaced'),text:'六名成年人平安到了各自同意的接收处。原住处没有因此恢复，他们也没有被一句迁居从故事里删除。'},
    {id:'false_stone',title:'索尔维格的名字',requires:flag('stone_lie'),text:'索尔维格从永安碑撤了名，原拓仍在。刻出的保证会被人看见；石头不能替你们把不实变真。'},
    {id:'blackmail_money',title:'十二枚钱的来处',requires:flag('blackmail'),text:'账房仍记着那十二枚勒索款。后来的善举与更正不自动清偿这笔可具体追问的钱。'},
    {id:'named_debtors',title:'已经被念出的姓名',requires:flag('debt_names_public'),text:'债户姓名确已在窗前被念出。后来的摘录可以遮名，却无法假装那一次公开没有发生。'}
  ],
  codex:[
    {id:'myth_pledge',title:'老故事：提尔与芬里尔',category:'神话原典',text:'《散文埃达》的叙述里，提尔以手作质，芬里尔在束缚后咬下他的手。本作不把这段神话当作人间必须模仿的誓法，也不给自伤奖励。',sourceRefs:['N01']},
    {id:'myth_hel',title:'老故事：赫尔莫德下行',category:'神话原典',text:'《散文埃达》记赫尔莫德经过莫德古丝所守的桥，求巴尔德尔归来。卡里、霍格娜与本作雾路是原创，没有复写那段神话的复生条件。',sourceRefs:['N02']},
    {id:'myth_guest',title:'老话：火、水与干巾',category:'诗歌原典',text:'《高人之言》有为远来者供火、食物、水与巾的诗句。本作以登岸待客回应这个母题；火塘同盟与具体互助制度均为原创。',sourceRefs:['N03']},
    {id:'original_boundary',title:'盐峡湾不是史实地名',category:'创作说明',text:'三条任务线、人物、三派、粮价、潮闸和具体庭议都是本作原创。巨族不是D&D种族的历史等号；原典并不证明古代所有人遵守同一种冥界或誓约制度。',sourceRefs:[]}
  ],
  sourceRefs:[
    {id:'N01',title:'Snorri Sturluson, Gylfaginning XXV / XXXIV, Arthur G. Brodeur 译（1916）',url:'https://sacred-texts.com/neu/pre/pre04.htm',scope:'仅核提尔作质与芬里尔束缚母题；不推广为历史誓法。'},
    {id:'N02',title:'Gylfaginning XLIX, Brodeur 译（1916）',url:'https://sacred-texts.com/neu/pre/pre04.htm',scope:'仅核赫尔莫德、守桥者与求巴尔德尔回归段；卡里与雾路为原创。'},
    {id:'N03',title:'Hávamál 3–4, Henry A. Bellows 译（1923）',url:'https://sacred-texts.com/neu/poe/poe04.htm',scope:'仅核待客火食水巾的诗歌母题，不据此复原制度。'}
  ],
  contentNotes:{rating:'成熟责任冲突；非露骨',protectedMinor:'阿尔夫海因始终平安，不死亡、不残疾、不质押，不参与成人关系。',relationships:'同伴均成年。友情、恋爱或不展开私人关系不改变情报和救援资格；关系数字只表示公开立场，不可兑换劳动或物权。',adaptation:'v3独立演进，不导入v2私人存档，不默认玩家已经完成旧三弧；旧意外死因保持不变，新阴谋发生于事后的纪念与收债。',runtime:'本地原创CRPG数据，不声称完整实现SRD，不自动代施D&D复生或亡者交谈法术。'},
};

// 枢纽始终返回当前可进入节点；已完成节点不会以另一选项重复发奖。
const mainNodeIds=campaign.quests.filter(q=>!q.optional).flatMap(q=>q.nodeIds);
campaign.scenes.hub.choices=[
  ...mainNodeIds.map(id=>({id:`visit_${id}`,label:`${campaign.scenes[id].arc} · ${campaign.scenes[id].title}`,description:campaign.scenes[id].location,requires:all({sceneUnlocked:id},not(flag(`${id}_done`))),next:id,effects:{},once:false,repeatable:true})),
  ...campaign.companions.map(c=>({id:`visit_${c.campScene}`,label:`与${c.name}谈谈`,description:c.stance,requires:all({sceneUnlocked:c.campScene},not(flag(`${c.campScene}_done`))),next:c.campScene,effects:{},once:false,repeatable:true})),
  {id:'final_council',label:'三线收束 · 解冻前最后一次开门',description:'三条主线均已完成或失败后，按真实结果选择终局。',requires:all(finished('oath'),finished('mist'),finished('stone')),next:'council',effects:{},once:false,repeatable:true}
];

// 按低到高排列；运行核心采用最后一项符合条件的真实立场。
for(const companion of campaign.companions) companion.reactions.reverse();
const endingRequirements={
  common_spring:all(flag('grain_common'),flag('stone_honest'),flag('name_cleared'),not(flag('lie_maintained')),not(flag('false_accusation')),not(flag('forced_labor_order'))),
  leased_spring:all(flag('harbor_charter'),flag('grain_delivered')),
  salt_crown:all(flag('ration_rule'),flag('stone_lie')),
  debt_in_daylight:all(flag('blackmail'),flag('stone_honest')),
  westward_lights:all(flag('displaced'),any(flag('name_cleared'),flag('limited_truth'))),
  unwritten_thaw:all(flag('stone_blank'),flag('quiet_memorial')),
  cold_peace:all(finished('oath'),finished('mist'),finished('stone'))
};
for(const ending of campaign.endings) ending.requires=endingRequirements[ending.id];
expandCampaign(campaign);

export default campaign;
