import {advanceParty} from './progression.mjs';
import {makeNPC} from './bestiary.mjs';
import {createWorldly} from './worldly.mjs';

const titles=['青蒲渡的假军令','山祠借路','西岐城下','一封信出西岐','风里带回的消息','风吼阵前','汜水关前的酒席','今夜开关','北门摘剑','幡下各有归路','朝歌最后一夜','封神之后'];
const levels=[3,4,5,6,7,8,9,9,10,11,12,12];
const maps=['FERRY','B003','B004','B005','B006','B007','B008','B008','B009','B010','B011','FERRY'];
const descriptions={
 1:'十二名旅人和两车口粮等着过河。先查军令、找粮，或让陶七带你们绕行。',
 2:'程简摊开北山图：“把孟平和两个帮手接回来。陶七的车要还。”石叔正在祠门外煮茶。',
 3:'麦亭院里，鲁青与两名帮手仍在修桥撑。两车共二十四包粮药尚未运走；守官岑岳、副官费安、术士祝槐各有打算。',
 4:'公函请沈砚联系自愿修护与勘察的人手。青石驿有人查信，西侧山脊仍能绕行；合法传讯同样算送达。',
 5:'程简转交当日本路撤离凭据。顾行舟、回风石场与白石亭各有消息，先去哪里由你们决定。',
 6:'董全与长嘶、回响守住北口。黑幡升起时应战，黑幡落下，这一场约战便罢；三条退出道路都看得见。',
 7:'韩荣在关外凉棚摆了酒席：“盐在手边。若嫌话难听，也先吃两口。”韩升在意军饷与尊严，韩变在意居民和道路。',
 8:'门内烧着一锅热汤，门外亮着另一盏灯。今夜落实席上的条件：愿走的人先走，程简和四名交接吏再来。',
 9:'另三路已摘下三口剑。北门阁内的真绝仙剑是最后支点，普通挂扣离地四尺；取下即破阵，归属和脱离仍由你们完成。',
 10:'定光把六魂幡卷在膝上：“你们能决定那口剑交给谁，我也想决定这面幡还拿来做什么。”赤炉客与烛尾在石沟另一侧等答复。',
 11:'朝歌后营尚未撤净。三位异客准备夜袭；可以当面截住、分开谈退，或者先把营地的人撤往安全处。',
 12:'天亮以后，旧事终于有空落在桌上。选你们在意的短场面，再让每个人决定最后一个镜头。'
};
const npcSets={
 2:[['shishu','石叔'],['meng','孟平'],['meng-a','孟平的帮手甲'],['meng-b','孟平的帮手乙'],['lisan','厉三']],
 3:[['lu','鲁青'],['lu-a','鲁青的帮手甲'],['lu-b','鲁青的帮手乙'],['cen','岑岳'],['fei','费安'],['zhu','祝槐']],
 4:[['shen','沈砚'],['xu','许照'],['du','杜衡']],
 5:[['gu','顾行舟'],['feng','冯迟'],['garg-1','脊角'],['garg-2','缺耳']],
 6:[['dong','董全'],['air-1','长嘶'],['air-2','回响']],
 7:[['hanrong','韩荣'],['hansheng','韩升'],['hanbian','韩变'],['guard-1','韩家近卫甲'],['guard-2','韩家近卫乙']],
 8:[['hanrong','韩荣'],['hansheng','韩升'],['hanbian','韩变'],['guard-1','韩家近卫甲'],['guard-2','韩家近卫乙']],
 9:[['golem','北门石像'],['stalker','无形客']],
 10:[['ding','长耳定光仙'],['efreeti','赤炉客'],['fire','烛尾']],
 11:[['daji','妲己'],['huxi','胡喜媚'],['wang','王贵人']]
};
export function ensureCampaign(s){
 s.campaign||={};const p=s.campaign;p.facts||={};p.chapters||={};p.nodes||={};p.npcs||={};p.items||={};p.promises||=[];p.rewards||={};p.endings||={};p.gate||={door:'locked',bridge:'raised',bridgeWork:0,southRoad:false};p.milestoneLevel||=3;
 if(s.flags?.chapter1Done){p.chapters[1]||={completed:true,outcome:'十二名旅人安全过河'};p.milestoneLevel=Math.max(4,p.milestoneLevel);p.npcs.ahe||={id:'ahe',name:'阿禾',status:s.flags.ahe?'获救':'尚未获救',attitude:s.flags.ahe?'友好':'未知'};}
 return p;
}
const f=s=>ensureCampaign(s).facts;
const npc=(s,id)=>ensureCampaign(s).npcs[id];
function setNPC(s,id,status,attitude){const n=npc(s,id);if(!n||n.actor?.dead||n.actor?.departed||n.status?.includes('死亡')||n.status==='已放逐'||n.status==='离开'&&['停战','已交接'].includes(status))return;if(status)n.status=status;if(attitude)n.attitude=attitude;for(const a of s.actors)if(a.npcId===id&&!a.dead){if(status==='离开'||status==='获救'||status==='停战'||status==='已交接')a.side='neutral';}}
function neutralize(s,ids){for(const id of ids)setNPC(s,id,'停战','愿意交谈');if(!s.actors.some(a=>a.side==='enemy'&&a.hp>0&&!a.dead))s.combat=null;}
function promise(s,id,text){const p=ensureCampaign(s);if(!p.promises.some(x=>x.id===id))p.promises.push({id,text,status:'待履行'});}
function fulfill(s,id){const p=ensureCampaign(s).promises.find(x=>x.id===id);if(p)p.status='已履行';}
const partyHolds=(s,item)=>item&&(item.holder==='party'||s.actors.some(a=>a.side==='party'&&a.id===item.holder));
function transferItem(s,id,holder){const item=ensureCampaign(s).items[id];if(!item)return;item.holder=holder;if(partyHolds(s,item)&&!item.destroyed){if(!s.inventory.includes(item.name))s.inventory.push(item.name);}else s.inventory=s.inventory.filter(name=>name!==item.name);}
function grant(s,id,name,extra={}){const p=ensureCampaign(s);if(p.items[id])return;p.items[id]={id,name,holder:'party',...extra};transferItem(s,id,p.items[id].holder);}
function reward(s,key,gold){const p=ensureCampaign(s),paid=Number(p.rewards[key])||0;if(gold<=paid)return;p.rewards[key]=gold;s.gold+=gold-paid;}
function finish(s,n,text,{gold=0,key=`chapter-${n}`,level=levels[Math.min(n,11)]}={}){const p=ensureCampaign(s);if(p.chapters[n]?.completed)return;p.chapters[n]={completed:true,outcome:text};reward(s,key,gold);p.milestoneLevel=Math.max(p.milestoneLevel,level);advanceParty(s,p.milestoneLevel);s.journal.push({title:`第${n}回 · ${titles[n-1]}`,text});}
function potions(s,key,count){const p=ensureCampaign(s);if(p.rewards[key])return;p.rewards[key]=true;s.actors.filter(a=>a.side==='party').slice(0,count).forEach(a=>a.potions=(a.potions||0)+1);}
const c=(id,label,text,run,when=()=>true,extra={})=>({id,label,text,run,when,...extra});
const facts=(s,keys)=>keys.every(k=>f(s)[k]);
const noBattle=s=>!s.combat;
const defeated=(s,ids)=>ids.every(id=>{const a=s.actors.find(a=>a.npcId===id);const n=npc(s,id);return a? a.dead||a.hp<=0||a.departed||a.side==='neutral':n&&(n.actor?.dead||n.actor?.departed||['死亡','离开','停战','被俘','被俘／失能','已交接'].includes(n.status));});
const speechBlocked=/^(?:昏迷|失能|麻痹|石化|震慑|放逐|unconscious\b|incapacitated\b|paralyzed\b|petrified\b|stunned\b|banished\b)/i;
const canSpeakActor=(s,a)=>!a.dead&&!a.departed&&(a.hp===undefined||a.hp>0)&&!(a.conditions||[]).some(c=>speechBlocked.test(String(c)))&&!(a.effects||[]).some(e=>(!e.expiresAt||e.expiresAt>s.time)&&speechBlocked.test(String(e.condition||'')));
const canTalk=(s,id)=>{const a=s.actors.find(a=>a.npcId===id),n=npc(s,id);return a?canSpeakActor(s,a):!!n&&(!n.actor||canSpeakActor(s,n.actor))&&!n.status?.includes('死亡')&&!['离开','被俘／失能'].includes(n.status)&&!speechBlocked.test(String(n.status||''));};
const gateControlled=s=>defeated(s,['hansheng','hanbian','guard-1','guard-2']);
const atSafeEdge=s=>s.actors.filter(a=>a.side==='party'&&!a.dead).every(a=>a.x<15||a.y<15||a.x>145||a.y>125);
const {matureChoices,matureAfterChoice,matureConsequences,matureDescription,initializeWorldly}=createWorldly({c,f,ensureCampaign,grant,transferItem,partyHolds,promise,fulfill,reward,potions,neutralize,canTalk,noBattle,recordEnding});
function readCampaignState(s){const read={...s,campaign:structuredClone(s.campaign||{})};ensureCampaign(read);return read;}
function check(s,a,ctx,key,skill,dc,success,failure){if(f(s)[key+'Tried'])throw new Error('同一说辞已经尝试过；可以换一个具体条件或走另一条路。');f(s)[key+'Tried']=true;const n=ctx.check(a,skill,dc);if(n){success();return true;}ctx.log('story',failure);return false;}
function settleGate(s,ctx){const p=ensureCampaign(s),x=f(s);if(!x.passengersSafe||!x.gateHandover||!(p.gate.southRoad||(p.gate.door==='open'&&p.gate.bridge==='lowered')||x.permanentRoute))throw new Error('还需完成自愿离关、实际交接和可持续通路。');reward(s,'gate-advance',200);reward(s,'gate-balance',800);grant(s,'weapon2','军中精良武器 +2',{kind:'weapon',magic:2,weaponType:'待持有人选定'});grant(s,'stones','传讯石一对',{kind:'stones',ends:['party','party'],usedDay:null});for(const id of ['hanrong','hansheng','hanbian','guard-1','guard-2'])setNPC(s,id,'已交接','依约离关');finish(s,7,'酒席协议已兑现；汜水关完成交接。',{key:'gate-complete',level:10});finish(s,8,'愿走者先安全离关，程简与四名交接吏接管关防；普通道路持续开放。',{key:'gate-complete',level:10});fulfill(s,'han-safe');ctx.log('story','第四幕结清共 1,000 GP，并交付一件 +2 武器和完整一对传讯石。门桥、人物和物品保持实际状态。');}

export const chapterChoices={
 2:[
  c('tea','与石叔喝茶，问清救人办法','孟平三人在后院；铜铃落在东侧排水沟。石叔拿回原铃、在中院门外敲旧节奏，守卫便归位。',(s,a,ctx)=>{f(s).bellKnown=true;ctx.say('石叔：“救人的坐这边。铃在沟沿下六尺，守卫不出中院追人。水渠和护坡树，咱们也得留着。”');}),
  c('borrow','借陶七的木板、绳索与运木车','借用后可稳妥搭板接人；需要归还。',(s)=>{grant(s,'tao-loan','陶七借出的木板、绳索与运木车',{borrowed:true});promise(s,'tao-return','归还陶七的木板、绳索与运木车');}),
  c('bell','绕东侧小径，以绳钩取回铜铃','小径不经过中院。沿沟边固定绳索，取六尺下的普通铜铃。',(s,a,ctx)=>{s.time+=1/6;f(s).bell=true;grant(s,'bell','山祠铜铃',{holder:'shishu',kind:'local-signal'});ctx.say('绳钩把两磅重的铜铃带回沟沿。它只对应本祠守卫的旧命令。');},s=>f(s).bellKnown&&!f(s).bell),
  c('recall','把铃交石叔，敲响召回信号','仍能听见的本地守卫停止拦路。',(s,a,ctx)=>{f(s).shrineClear=true;neutralize(s,['shrine-armor-1','shrine-armor-2','shrine-sword-1','shrine-sword-2']);ctx.say('铜甲与飞剑回到两侧壁龛，中院道路开放。');},s=>f(s).bell&&!f(s).shrineClear),
  c('boards','和孟平搭板、架梯，从东侧接人','稳妥合作二十分钟；不必进入守卫中院。',(s,a,ctx)=>{s.time+=1/3;f(s).craftsmen=true;for(const id of ['meng','meng-a','meng-b'])setNPC(s,id,'获救','友好');ctx.say('三位工匠自己搬板、沿梯越过后墙，平安走到祠外。守卫仍守原处。');},s=>!f(s).craftsmen&&noBattle(s)),
  c('escort','从已开放的中院接出三位工匠','守卫归位或已经失去阻止能力。',(s)=>{f(s).craftsmen=true;for(const id of ['meng','meng-a','meng-b'])setNPC(s,id,'获救','友好');},s=>!f(s).craftsmen&&(f(s).shrineClear||defeated(s,['shrine-armor-1','shrine-armor-2','shrine-sword-1','shrine-sword-2']))),
  c('road','谈定窄车分批、护树护渠与修桥人手','孟平愿意修不压水渠的小桥。明确条件即可借路。',(s,a,ctx)=>{f(s).mountainRoad=true;promise(s,'north-road','北山使用窄车分批通行，保护护坡树和水渠，并由孟平安排修桥');ctx.say('石叔点头：“人和路都能照看，就走。”北山窄车路获准使用。');},s=>f(s).craftsmen&&!f(s).mountainRoad),
  c('lisan','在山脚说明铜铃只是本祠信号器','石叔、孟平和在山脚失去作用的铜铃都能作证。',(s,a,ctx)=>{f(s).lisanHeard=true;check(s,a,ctx,'lisan','persuasion',12,()=>{f(s).lisanGone=true;setNPC(s,'lisan','离开','认栽');},'厉三还要 20 GP 误工钱；可以支付、沿西侧平坡绕开，或拒绝后交战。');},s=>f(s).craftsmen&&!f(s).lisanHeard),
  c('pay','付厉三 20 GP，明确不再纠缠','已给过的钱不会重复支付。',(s)=>{if(s.gold<20)throw new Error('队伍资金不足 20 GP。');s.gold-=20;f(s).lisanGone=true;setNPC(s,'lisan','离开','收钱离开');},s=>f(s).lisanHeard&&!f(s).lisanGone),
  c('fork','护工匠沿西侧平坡绕过厉三','路口有公开绕路，不要求接受勒索。',(s,a,ctx)=>{s.time+=1/3;f(s).lisanGone=true;ctx.say('三位工匠先退到平坡，随后与你们沿西路回接济处。厉三没有得到铜铃。');},s=>f(s).craftsmen&&!f(s).lisanGone),
  c('return','归还借物，带工匠回接济处','接回三人便完成主目标；借路改变下一回入口。',(s,a,ctx)=>{const loan=ensureCampaign(s).items['tao-loan'];if(partyHolds(s,loan)){transferItem(s,'tao-loan','陶七');fulfill(s,'tao-return');}if(f(s).mountainRoad)potions(s,'road-potions',2);finish(s,2,`三位工匠平安归来；${f(s).mountainRoad?'北山窄车路借成，护树护渠承诺保留':'继续使用青蒲渡'}。`,{gold:150});ctx.say('程简付清全队 150 GP。下一回从实际取得的山路或渡口补给线开始。');},s=>f(s).craftsmen&&noBattle(s))
 ],
 3:[
  c('observe','从高坡或工房后窗观察','能直接看见人、粮药与祝槐身边的法术。',(s,a,ctx)=>{f(s).maitingSeen=true;ctx.say(f(s).mountainRoad?'孟平带你们到北侧高坡。':'陶七熟悉的渡工把你们带到工房东后窗。');ctx.say('祝槐的兵影只环绕本人十五尺，最多十分钟。鲁青三人可自己移开后窗木撑；粮药共二十四包。');}),
  c('waitguard','在法术范围外等十分钟','货物一小时后才准备转运；等待使已用的一次护卫灵正常结束。',(s,a,ctx)=>{s.time+=1/6;f(s).guardiansExpired=true;const z=s.actors.find(x=>x.npcId==='zhu');if(z){z.spellUses.guardians=0;z.concentration=null;}ctx.say('祝槐的兵影散去，今天那一次护卫灵已经用完。');},s=>!f(s).guardiansExpired),
  c('feian','向费安出示民用货单，请他退出扣押','他认为扣药与扣工匠超出了查兵械差事。',(s,a,ctx)=>{f(s).feiOut=true;neutralize(s,['fei']);ctx.say('费安让开工房一侧，答应不因民用救济物资继续动手。');},s=>!f(s).feiOut&&canTalk(s,'fei')),
  c('deal','接受岑岳条件：留下六包粮、修完桥撑','二十分钟普通工作后，生还工匠和其余十八包物资离开。',(s,a,ctx)=>{s.time+=1/3;f(s).luRescued=true;f(s).supplies=18;f(s).maitingDeal=true;for(const id of ['lu','lu-a','lu-b'])setNPC(s,id,'获救','友好');neutralize(s,['cen','fei','zhu','maiting-scout-1','maiting-scout-2']);ctx.say('岑岳按约收下六包粮，其余物资与实际生还工匠出门，伤亡不重置。');},s=>!f(s).maitingDeal&&canTalk(s,'cen')),
  c('counter','用 30 GP 代粮，与岑岳还价','说服 DC15；失败后仍可接受原条件或走后窗。',(s,a,ctx)=>{if(s.gold<30)throw new Error('队伍资金不足 30 GP。');check(s,a,ctx,'cenCounter','persuasion',15,()=>{s.gold-=30;s.time+=1/3;f(s).luRescued=true;f(s).supplies=24;f(s).maitingDeal=true;for(const id of ['lu','lu-a','lu-b'])setNPC(s,id,'获救','友好');neutralize(s,['cen','fei','zhu','maiting-scout-1','maiting-scout-2']);},'岑岳仍要留下六包粮食；原条件和后窗仍可选。');},s=>!f(s).maitingDeal&&!f(s).cenCounterTried&&canTalk(s,'cen')),
  c('window','从东后窗接鲁青三人离开','工匠可自己移开木撑；费安退开或外侧接应都能成立。',(s,a,ctx)=>{s.time+=1/6;f(s).luRescued=true;for(const id of ['lu','lu-a','lu-b'])setNPC(s,id,'获救','友好');ctx.say('三人从无栏后窗来到芦苇小径，向码头撤离。物资尚按原处保留。');},s=>!f(s).luRescued&&noBattle(s)),
  c('take','从已控制的货棚取回二十四包粮药','击退或说退守货者后才能搬货。',(s)=>{f(s).supplies=24;},s=>!f(s).maitingDeal&&defeated(s,['cen','zhu','maiting-scout-1','maiting-scout-2'])),
  c('dispatch','查看账房里的传令表','具体时段能让下一回茶棚哨位真正空出。',(s,a,ctx)=>{f(s).dispatch=true;grant(s,'dispatch','青石驿传令表');ctx.say('送簿时段与一条通向白石亭的岔路被记入手札。');},s=>f(s).maitingDeal||defeated(s,['maiting-scout-1','maiting-scout-2'])),
  c('close','带实际救回的人和物返回西岐','人、粮药分别结算；留在敌方且活着者以后可在石场寻找。',(s,a,ctx)=>{if(!f(s).luRescued)for(const id of ['lu','lu-a','lu-b']){if(npc(s,id)?.status!=='获救')setNPC(s,id,'被扣','等待救援');}const rescued=settleLuRescue(s);reward(s,'maiting-supplies',f(s).supplies===24?100:f(s).supplies?50:0);finish(s,3,`鲁青一行实际获救 ${rescued}/3 人，其余伤亡与被扣去向分别保留；取回 ${f(s).supplies||0}/24 包物资；${f(s).dispatch?'查明传令时段':'未取得传令表'}。`);ctx.say('程简按实际成果支付报酬。部分救援先付 100 GP，后来接回其余人只补足到 200 GP；已死者不重置。');},noBattle)
 ],
 4:[
  c('letter','读清真实公函与回联安排','沈砚可自由决定援手；请求已描述清楚。',(s,a,ctx)=>{f(s).letterRead=true;ctx.say('“西岐程简请联系自愿修护与勘察人手，请回复接济处。”沈砚的身份由见过他的程简说明。');}),
  c('ridge','沿西侧山脊绕过青石驿','多用两小时，不加额外怪物。',(s,a,ctx)=>{s.time+=2;f(s).atShen=true;ctx.say('山脊小路绕过整座驿院，栖霞观前的木尺正在晒太阳。');},s=>!f(s).atShen),
  c('verify','公开公函、留相同抄本，给许照查验说法','所请人手自愿参加，明确是修护与勘察。',(s,a,ctx)=>{f(s).xuPass=true;neutralize(s,['xu','du','post-scout']);ctx.say('许照在簿上写“已验”，杜衡把门前的道路让开。');},s=>!f(s).xuPass),
  c('privacy','只许读信，不留副本','说服 DC17；失败可以接受同行见证或改走山脊。',(s,a,ctx)=>check(s,a,ctx,'xuPrivacy','persuasion',17,()=>{f(s).xuPass=true;neutralize(s,['xu','du','post-scout']);},'许照提议派一名弓手同行到观里听真实答复；也可留下抄本或绕路。'),s=>!f(s).xuPass&&!f(s).xuPrivacyTried),
  c('witness','接受弓手同行见证这封信','听到沈砚答复后，弓手自行回驿。',(s,a,ctx)=>{f(s).xuPass=true;f(s).xuWitness=true;neutralize(s,['xu','du','post-scout']);ctx.say('弓手收起弓，答应只见证这一封信的性质。');},s=>!f(s).xuPass),
  c('north','从已放行或已控制的驿院北门赴栖霞观','茶棚弓手不凭空传到院中。',(s)=>{s.time+=1;f(s).atShen=true;},s=>!f(s).atShen&&(f(s).xuPass||defeated(s,['xu','du','post-scout']))),
  c('deliver','向沈砚递交或口述求援，听取明确回复','信原件、副本和准确口述同样有效。',(s,a,ctx)=>{f(s).messageDelivered=true;setNPC(s,'shen','已接到求援','友好');ctx.say('沈砚：“收到。我联系愿来的修护和勘察人手，回消息给程简。”');},s=>f(s).atShen&&!f(s).messageDelivered),
  c('close','向程简报告已送达','同目标同报酬，方法不改变奖励。',(s,a,ctx)=>{finish(s,4,'求援已送到沈砚，并取得明确回联答复。',{gold:400});ctx.say('全队取得 400 GP。顾行舟的归来成为第三幕入口。');},s=>f(s).messageDelivered&&noBattle(s)),
  c('abandon','明确结束送信差事，请程简另作安排','不付成功报酬；第三幕从失联信使开始。',(s,a,ctx)=>{f(s).messageAbandoned=true;finish(s,4,'小队结束本次送信；程简另派人联络，下一幕从冯迟失联开始。');ctx.say('已给的药水不用退还。未送达这一事实保留。');},s=>!f(s).messageDelivered&&noBattle(s))
 ],
 5:[
  c('report','听顾行舟说明亲见的阵场','他能以 Primordial 翻译，愿在安全阵门外协助。',(s,a,ctx)=>{f(s).guReport=true;f(s).translator=true;grant(s,'rope','攀云绳 · Rope of Climbing',{kind:'rope',length:60,hp:20,maxHp:20});ctx.say('顾行舟分清亲见与猜测：危险来自两只风灵和一位施法者；他交给小队唯一一条攀云绳。');}),
  c('quarry','去回风石场，先看清台架与退路','二十尺高台有牢固木梁，旧棚有梯，北缓坡可接近。',(s,a,ctx)=>{f(s).quarrySeen=true;s.time+=.5;if(s.scene!=='B006')ctx.enter('B006');ctx.say('冯迟和仍被扣且活着的工匠按实际去向留在台架上；两只石像鬼是否还在，沿用各自伤势与退约。');},s=>!f(s).quarrySeen||s.scene!=='B006'),
  c('pay','付总共 60 GP，请两只放人并退出守阵','只付一次；两只的离开会减少第六回敌人。',(s,a,ctx)=>{if(s.gold<60)throw new Error('队伍资金不足 60 GP。');s.gold-=60;f(s).quarryRescue=true;for(const id of ['garg-1','garg-2'])setNPC(s,id,'离开','已结清');neutralize(s,['garg-1','garg-2']);rescueQuarry(s);ctx.say('脊角收下两只事先分好的工钱，缺耳把台架旁的路让开；二者退出本次守阵。');},s=>f(s).quarrySeen&&!f(s).quarryRescue),
  c('release','由顾行舟翻译，约定放人、撤阵且不追猎','说服 DC15；失败后仍可付钱、接人或交战。',(s,a,ctx)=>check(s,a,ctx,'gargPeace','persuasion',15,()=>{f(s).quarryRescue=true;promise(s,'garg-safe','小队不追猎已离场的脊角与缺耳');for(const id of ['garg-1','garg-2'])setNPC(s,id,'离开','依约退出');neutralize(s,['garg-1','garg-2']);rescueQuarry(s);},'两只仍要工钱，但没有伤害被扣者。梯绳、北缓坡和战斗路线仍可用。'),s=>f(s).quarrySeen&&f(s).translator&&!f(s).quarryRescue&&!f(s).gargPeaceTried),
  c('ladder','从北缓坡架梯，接应台架上的人','敏捷（隐匿）DC14；失败被发现，仍保留交涉与战斗。',(s,a,ctx)=>check(s,a,ctx,'quarrySneak','stealth',14,()=>{f(s).quarryRescue=true;rescueQuarry(s);s.time+=1/6;},'缺耳看见了梯子，要求先把工钱说清；没有处决人质。'),s=>f(s).quarrySeen&&!f(s).quarryRescue&&!f(s).quarrySneakTried),
  c('free','从失去阻拦能力的石场接走被扣者','伤势与死者继续保留。',(s)=>{f(s).quarryRescue=true;rescueQuarry(s);},s=>f(s).quarrySeen&&!f(s).quarryRescue&&defeated(s,['garg-1','garg-2'])),
  c('observe','去白石亭，看阵场并听清降幡旧约','不必先救冯迟才知道关键线索；切换至风吼阵场景。',(s,a,ctx)=>{s.time+=.5;if(s.scene!=='B007')ctx.enter('B007');f(s).windObserved=true;f(s).flagKnown=true;ctx.say('北台阶、南侧挂扣和三条出口都可看见。董全确认：“黑幡落，此场便罢。”风灵也可以当面提出结束援助。');},s=>!f(s).windObserved||s.scene!=='B007'),
  c('plan','记录办法与集合处，结束侦察','已有报告、营救或现场观察任一成果即可进入下一回。',(s,a,ctx)=>{finish(s,5,`${f(s).quarryRescue?'被扣者已经接回；':'石场营救仍可在撤阵协议中处理；'}已准备${f(s).flagKnown?'降幡／交谈':'直接观阵交谈'}，在白石亭集合。`);ctx.say('本回不重复结算 600 GP；整幕通路落实后再付。');},s=>f(s).guReport||f(s).quarryRescue||f(s).windObserved)
 ],
 6:[
  c('terms','在阵外向董全出示本路当日撤离保证','交还平民与征用物，拆旗撤至东山口，当日本路不追击。',(s,a,ctx)=>{f(s).windTerms=true;promise(s,'dong-safe','依当日本路授权护送董全和幸存从者携私物撤到东山口，返还平民和征用物');ctx.say('董全听完明确条件：“此路约战已毕，各自收兵——这句话，我认。”');}),
  c('agree','按公开条件谈妥撤阵','具体条件已经满足，不再用额外骰点推翻成交。',(s,a,ctx)=>{f(s).windStopped=true;neutralize(s,['dong','air-1','air-2','garg-1','garg-2']);ctx.say('董全示意收阵，两位风灵放下手臂。被扣者与征用物进入交接。');},s=>f(s).windTerms&&!f(s).windStopped),
  c('spirits','由顾行舟翻译，请两位风灵结束援助','给出北路与不追猎的实际保证。',(s,a,ctx)=>{f(s).windStopped=true;promise(s,'air-safe','给长嘶与回响留出北路，不追猎撤离者');neutralize(s,['dong','air-1','air-2','garg-1','garg-2']);ctx.say('长嘶展开双臂，再指向北路。回响与他一同结束援助，董全承认旧约。');},s=>f(s).translator&&!f(s).windStopped),
  c('flag','到板台南缘解下普通黑幡','挂扣 (110,50)，在台上四尺高；先上板台或以真实飞行触及，再用一个运用动作。',(s,a,ctx)=>{ctx.near(a,110,50,5);if(!(a.x>=100&&a.x<=120&&a.y>=30&&a.y<=50)&&!a.fly&&!a.effects?.some(e=>e.flySpeed))throw new Error('挂扣离地十四尺；先从北台阶上板台，或用真实飞行／远程操作触及。');ctx.utilize(a);f(s).windStopped=true;neutralize(s,['dong','air-1','air-2','garg-1','garg-2']);ctx.say('黑幡落下。这一场约战照原约结束，守阵者不重新升旗。');},s=>!f(s).windStopped,{combat:true}),
  c('flaghand','以法师之手解开可见挂扣降幡','挂扣 (110,50)，在三十尺内且有真实视线时操作。',(s,a,ctx)=>{if(!a.spells?.includes('magehand'))throw new Error('该角色未掌握法师之手。');ctx.near(a,110,50,30);if(!ctx.line(a,{x:110,y:50}))throw new Error('实体墙挡住了挂扣；先到看得见的位置。');ctx.magic(a);f(s).windStopped=true;neutralize(s,['dong','air-1','air-2','garg-1','garg-2']);ctx.say('魔手解开普通绳扣，黑幡落下，此场约战按原约结束。');},s=>!f(s).windStopped,{combat:true}),
  c('victory','接管已经失去守备能力的阵场','本路由小队真正解决。',(s)=>{f(s).windStopped=true;},s=>!f(s).windStopped&&defeated(s,['dong','air-1','air-2'])),
  c('escort','交接人和征用物，护撤离者到东山口','保存实际生死与伤势；和平与战斗同目标同酬。',(s,a,ctx)=>{rescueQuarry(s);fulfill(s,'dong-safe');fulfill(s,'air-safe');f(s).northOpen=true;finish(s,6,'北口通路开放；被扣者和征用物完成交接，撤离者按约离开。',{gold:600,key:'wind-total'});ctx.say('第三幕总报酬 600 GP 一次结清。北路真正开放，幸存且守约的董全可作一次引见。');},s=>f(s).windStopped&&noBattle(s)),
  c('alternative','与军方落实替代山路，不再争夺此阵','调度车工半日实地清理绕行，承认北口仍被封锁。',(s,a,ctx)=>{s.time+=4;f(s).alternateWind=true;finish(s,6,'军方与车工清理并接管替代山路，安全通路已实际落实；北口风吼阵仍在。',{gold:600,key:'wind-total'});ctx.say('补给改走实地开通的山路，第三幕收束。阵场、旧敌与伤势没有被清空。');},noBattle)
 ],
 7:[],8:[],
 9:[
  c('survey','听道行说明阁院、挂扣与守卫界限','真剑约三磅、阁墙挡视线，屋顶不通阁内。',(s,a,ctx)=>{f(s).swordSurvey=true;ctx.say('石像只守阁院和周围三十尺；无形客能说 Common，重视酬劳和约定。摘下的就是真剑。');}),
  c('stalker','向无形客提出取剑后结束本次工作','说服 DC15；失败仍可取剑、撤退和战斗。',(s,a,ctx)=>check(s,a,ctx,'stalkerDeal','persuasion',15,()=>{setNPC(s,'stalker','离开','接受终止工作');neutralize(s,['stalker']);},'无形客仍要履行眼前差事。他没有自动追踪或跨位面索命的能力。'),s=>!f(s).stalkerDealTried),
  c('take','在阁内解开挂扣，取下真绝仙剑','挂扣在 (120,100)；触及后一个运用动作。',(s,a,ctx)=>{ctx.near(a,120,100,7.5);if(!ctx.line(a,{x:120,y:100}))throw new Error('阁墙挡住了挂扣，先进入阁内可触及的位置。');ctx.utilize(a);f(s).swordTaken=true;grant(s,'sword3','真绝仙剑 · 长剑 +3',{kind:'weapon',weaponType:'长剑',magic:3,holder:a.id});ctx.say('真剑离开阵位，诛仙阵最后支点被你们解除。剑真实地握在手里，仍需让同伴安全脱离。');},s=>!f(s).swordTaken,{combat:true}),
  c('magehand','以法师之手解扣并搬起真剑','在看得见 (120,100) 挂扣、三十尺内操作三磅物件。',(s,a,ctx)=>{if(!a.spells?.includes('magehand'))throw new Error('该角色未掌握法师之手。');ctx.near(a,120,100,30);if(!ctx.line(a,{x:120,y:100}))throw new Error('阁墙挡住了挂扣，法师之手不能隔墙取剑。');ctx.magic(a);f(s).swordTaken=true;grant(s,'sword3','真绝仙剑 · 长剑 +3',{kind:'weapon',weaponType:'长剑',magic:3,holder:a.id});ctx.say('魔手将剑脱扣；真剑离位，阵已破。');},s=>!f(s).swordTaken,{combat:true}),
  c('secure','携真剑从已控制的阁院撤离','守卫失去阻拦能力，或全队沿任一真实退路到达地图边缘。',(s,a,ctx)=>{f(s).swordSecure=true;s.combat=null;ctx.say('真剑没有再回到阵位。同伴与剑一同离开守备区域，已用资源保留。');},s=>f(s).swordTaken&&(defeated(s,['golem','stalker'])||atSafeEdge(s)),{combat:true}),
  c('keep','保留真剑并报告破阵','不要求交给名人；同一口剑只结算一次。',(s,a,ctx)=>{finish(s,9,'玩家取下真绝仙剑并使其不再归位，破阵成果和宝剑归属均已确认。',{gold:1000});ctx.say('全队取得 1,000 GP，升至 11 级；宝剑沿当前真实持有人保存。');},s=>f(s).swordSecure&&noBattle(s)),
  c('deposit','自愿把真剑交给沈砚保管，约定不复位','交出由玩家决定，破阵成果仍成立。',(s,a,ctx)=>{const sword=ensureCampaign(s).items.sword3;if(!partyHolds(s,sword))throw new Error('先确认真剑的实际持有人；不能交出已不在队伍手里的剑。');transferItem(s,'sword3','沈砚');promise(s,'sword-keeping','沈砚保管真绝仙剑，不将其放回阵位');finish(s,9,'真绝仙剑由沈砚依约保管，不再回到阵位。',{gold:1000});ctx.say('沈砚接下真剑，并说清保管安排。');},s=>f(s).swordSecure&&noBattle(s))
 ],
 10:[
  c('listen','听定光说明拒令与担心','他不愿再以幡逼退阵者参战，也想自己选择去处。',(s,a,ctx)=>{f(s).dingHeard=true;ctx.say('定光：“我放下它，谁替我把话讲完？若你们也拿它逼我走呢？”六魂幡只是一件七充能、需共鸣的恐惧魔杖。');},s=>canTalk(s,'ding')),
  c('fallen','照看已经倒下的定光，保管现场的幡','不把失能或死亡写成自愿交宝；实际充能与去向保留。',(s,a,ctx)=>{f(s).dingHeard=true;f(s).bannerPlan=true;f(s).coercionStopped=true;const item=ensureCampaign(s).items.banner;if(item&&!item.destroyed&&item.holder==='ding')transferItem(s,'banner',a.id);ctx.say('定光的实际伤亡保留。你们停止本路以幡胁迫，记录现场保管人，再向追索者作明确答复。');},s=>!canTalk(s,'ding')&&!f(s).bannerPlan&&!s.actors.find(a=>a.npcId==='ding')?.departed),
  c('keepding','由定光留幡，自由决定归山或留师门','明确停用本次胁迫，并由他亲口答复追索者。',(s,a,ctx)=>{f(s).bannerPlan=true;f(s).coercionStopped=true;transferItem(s,'banner','ding');ctx.say('定光卷好幡，答应亲口说明拒令，并选择自己的去处。');},s=>f(s).dingHeard&&!f(s).bannerPlan&&canTalk(s,'ding')),
  c('receive','请定光自愿交幡，由小队保管','交出不等于即刻共鸣；充能继续沿用。',(s,a,ctx)=>{f(s).bannerPlan=true;f(s).coercionStopped=true;transferItem(s,'banner',a.id);ctx.say('定光把唯一那件六魂幡交到你手中。原充能和共鸣状态保留，新持有人可在短休中重新共鸣。');},s=>f(s).dingHeard&&!f(s).bannerPlan&&canTalk(s,'ding')),
  c('seal','征得定光同意，将幡封存给沈砚','法宝不复制，追索者仍须取得真实答复。',(s)=>{f(s).bannerPlan=true;f(s).coercionStopped=true;transferItem(s,'banner','沈砚');},s=>f(s).dingHeard&&!f(s).bannerPlan&&canTalk(s,'ding')),
  c('destroy','与定光说明后，以工具毁掉真正的幡柄','主动且无干扰时花实际时间处理；永远失去这一件物品。',(s,a,ctx)=>{s.time+=1/6;f(s).bannerPlan=true;f(s).coercionStopped=true;ensureCampaign(s).items.banner.destroyed=true;transferItem(s,'banner',null);ctx.say('布尾与木质幡柄一同处理，真实魔法物品已经毁坏，不会补发第二件。');},s=>f(s).dingHeard&&!f(s).bannerPlan&&noBattle(s)&&canTalk(s,'ding')),
  c('answer','向追索者明确拒令、实际保管与安全安排','定光仍能交谈时由本人答复；失能或死亡则如实说明，不替亡者说话。',(s,a,ctx)=>{f(s).pursuitStopped=true;neutralize(s,['efreeti','fire']);if(canTalk(s,'ding'))promise(s,'ding-meeting','在双方认可的安全地点让定光说明自己的经历，去留由本人决定');ctx.say('仍在场的追索者收到明确答复，接受不再以幡逼人参战并停止本路追索；伤亡、离开与保管人沿实际保存。');},s=>f(s).bannerPlan&&!f(s).pursuitStopped&&(canTalk(s,'efreeti')||canTalk(s,'fire'))),
  c('returnbanner','双方同意由赤炉客带幡回去，公开取消胁迫','只在真实持有人同意时办理；改变用途同样成功。',(s,a,ctx)=>{f(s).bannerPlan=true;f(s).coercionStopped=true;f(s).pursuitStopped=true;transferItem(s,'banner','赤炉客');neutralize(s,['efreeti','fire']);ctx.say('赤炉客当面承诺本次不以幡逼人返阵、停止抓人，定光按实际状态保留去向。');},s=>f(s).dingHeard&&!f(s).pursuitStopped&&!ensureCampaign(s).items.banner?.destroyed&&canTalk(s,'efreeti')),
  c('victory','确认追索方已退出，保留实际幡归属','击败、放逐或谈退都承认真实结果。',(s)=>{f(s).pursuitStopped=true;},s=>f(s).bannerPlan&&defeated(s,['efreeti','fire'])&&!f(s).pursuitStopped),
  c('close','落实停幡停追与保管安排，向沈砚回报','和平解决同报酬，幡的选择不影响披风。',(s,a,ctx)=>{grant(s,'cape','传送披风 · Cape of the Mountebank',{kind:'cape',usedDay:null});finish(s,10,`本路胁迫与追索已停止；六魂幡${ensureCampaign(s).items.banner.destroyed?'已毁':`由 ${ensureCampaign(s).items.banner.holder} 保管`}。`,{gold:1000});ctx.say('全队取得 1,000 GP 和一件传送披风，升至 12 级。已有法宝、伤势与承诺继续。');},s=>f(s).bannerPlan&&f(s).pursuitStopped&&noBattle(s))
 ],
 11:[
  c('brief','询问夜袭目标、三妖真形与撤营路线','三者是 Fiend；英雄药水使武器穿刺对妲己格外有效。',(s,a,ctx)=>{f(s).nightBrief=true;ctx.say('妲己抗魔强，但并非免疫所有法术伤害；受祝福者的武器穿刺是其弱点。胡喜媚与王贵人没有她的抗魔或复生。北侧撤营路可用。');}),
  c('expose','凭真实接触、证词与公开交谈揭穿伪装','已知真相即给出对话；不强制一次骰检锁住线索。',(s,a,ctx)=>{f(s).fiendsKnown=true;ctx.say('三妖承认眼前这场夜袭的来意。王贵人看向离城的路，胡喜媚先问妲己是否要带她们一起走。');}),
  c('wang','给王贵人独自退走的道路，明确不再袭营','她可以独立决定，不要求先打倒妲己。',(s,a,ctx)=>{f(s).wangOut=true;neutralize(s,['wang']);setNPC(s,'wang','离开','停止夜袭');ctx.say('王贵人从南侧退出，没有飞行或额外变形阶段。');},s=>f(s).fiendsKnown&&!f(s).wangOut&&canTalk(s,'wang')),
  c('huxi','让胡喜媚带愿同行者离开，不伤退营平民','说服 DC15；失败可撤营、交战或另谈。',(s,a,ctx)=>check(s,a,ctx,'huxiDeal','persuasion',15,()=>{f(s).huxiOut=true;neutralize(s,['huxi']);setNPC(s,'huxi','离开','停止夜袭');},'胡喜媚仍等妲己的决定，但没有封住撤营道路。'),s=>f(s).fiendsKnown&&!f(s).huxiOut&&!f(s).huxiDealTried&&canTalk(s,'huxi')),
  c('daji','以停止当夜追击换三妖自行离开','让目标已经落空、同伴已有退意成为真实谈判条件。',(s,a,ctx)=>{f(s).nightStopped=true;neutralize(s,['daji','huxi','wang']);for(const id of ['daji','huxi','wang'])setNPC(s,id,'离开','当夜停袭');ctx.say('妲己确认这次不再袭营。她与愿同行者按真实行动离开，未同行者各选退路。');},s=>f(s).fiendsKnown&&(f(s).campSafe||f(s).wangOut&&f(s).huxiOut)),
  c('evacuate','组织后营沿北路撤到灯火接应处','花半小时落实撤离，取消原定夜袭目标；不宣称已杀三妖。',(s,a,ctx)=>{s.time+=.5;f(s).campSafe=true;f(s).nightStopped=true;neutralize(s,['daji','huxi','wang']);ctx.say('最后一辆伤员车进入接应灯火，空营失去突袭价值。三妖放弃本次夜袭，去向依实际记录保留。');},noBattle),
  c('victory','确认在场三妖已失去继续突袭的能力','妲己本地死亡后在九狱复生，两名 Lamia 无此特质。',(s,a,ctx)=>{f(s).nightStopped=true;for(const id of ['daji','huxi','wang']){const a=s.actors.find(x=>x.npcId===id);if(a?.dead&&id==='daji')setRestored(s,id,'九狱复生');}ctx.say('当夜袭营危机解除，各人的死亡、放逐和离开分别保存。');},s=>defeated(s,['daji','huxi','wang'])&&!f(s).nightStopped),
  c('close','向后营报告当夜危机解除','全队 2,000 GP；未用英雄药水继续保留。',(s,a,ctx)=>{finish(s,11,'当夜袭营已停止，三妖分别去向和仍需解除的诅咒保留。',{gold:2000,level:12});ctx.say('程简结清全队 2,000 GP。朝歌天亮，下一回给每个人留下自己的结局。');},s=>f(s).nightStopped&&noBattle(s))
 ],
 12:[
  c('promises','赴约：谈起一路仍在意的承诺','只回应真正选中的旧事，未完成的约定继续保存，不自动全部结清。',(s,a,ctx)=>{const p=ensureCampaign(s);f(s).epPromises=true;const pending=p.promises.filter(x=>x.status!=='已履行');ctx.say(pending.length?'仍待回应的约定：'+pending.map(x=>x.text).join('；')+'。由你们选一件在意的事谈下去，其余保持原状态。':'没有临时补来的债务；众人谈起一路守过的话。');}),
  c('meal','在朝歌分粮处帮一顿饭','解除夜袭后的日常场景，保留身边真实的人。',(s,a,ctx)=>{f(s).epMeal=true;ctx.say('一口锅终于不必赶着熄火。每个人说起自己想请谁来吃这一顿饭。');}),
  c('ferry','回渡口与仍在的旧友坐下','陶七、阿禾和工匠是否出现沿用生死与去向。',(s,a,ctx)=>{f(s).epFerry=true;const loan=ensureCampaign(s).items['tao-loan'];if(loan?.borrowed&&partyHolds(s,loan)){transferItem(s,'tao-loan','陶七');fulfill(s,'tao-return');}ctx.say('旧桌又添了座位；只请回活着且愿联络的旧人。仍在队伍手里的借物实际归还，已失去的物件不凭空补回。');}),
  c('invitation','谈一个真实邀请，决定接不接受','归山、留任、回家和改条件都能成立。',(s,a,ctx)=>{f(s).epInvite=true;ctx.say('邀请只是一项可以答复的邀请。接受、拒绝或先回家，决定权仍在每位角色手里。');}),
  c('memorial','在封神台外告别或纪念亡者','不自动复活，不强迫任何活人先死或受封。',(s,a,ctx)=>{f(s).epMemorial=true;ctx.say('你们留下一个想让人记住的细节。亡者是否愿意回来、是否愿谈神职，分别记录。');}),
  c('meeting','约定下次见面与传讯石两端归属','原来的一对石头继续按真实持有人和次数使用。',(s,a,ctx)=>{f(s).epMeeting=true;ctx.say('下次可以在第一场春雨，也可以在几年之后。宝物不会因故事结束被自动收回。');}),
  c('endhome','个人结局：回家，在人间继续生活','保存当前生死、物件与一路经历。',(s,a)=>recordEnding(s,a,'回家在人间生活')),
  c('endmountain','个人结局：归山修行','归山不收走职业能力或已有法宝。',(s,a)=>recordEnding(s,a,'归山修行')),
  c('endservice','个人结局：自愿留下任职','是否接受具体职务由本人决定。',(s,a)=>recordEnding(s,a,'自愿留下任职')),
  c('endtravel','个人结局：继续行旅，与旧友相约','真剑、幡、披风与承诺都保存实际去向。',(s,a)=>recordEnding(s,a,'继续行旅')),
  c('endmemory','个人结局：纪念、告别，或自愿讨论受封','适用于亡者；不自动改变死亡或复生事实。',(s,a)=>recordEnding(s,a,a.dead?'留下一段告别与自愿的神职愿望':'自愿讨论封神台外的邀请')),
  c('final','合上最后一页','每名队员已有一个个体结局后保存整条战役。',(s,a,ctx)=>{finish(s,12,'六幕十二回结束。每位角色的实际状态、选择、物件与仍愿继续的承诺已保存。',{level:12});ensureCampaign(s).ended=true;ctx.say('渡口的灯、开着的门和留下的名字，都是这一桌实际走过的路。');},s=>s.actors.filter(a=>a.side==='party').every(a=>ensureCampaign(s).endings[a.id]))
 ]
};

function recordEnding(s,a,destination){const p=ensureCampaign(s);p.endings[a.id]={consequences:matureConsequences(s),actor:a.id,name:a.name,status:a.dead?'死亡':a.hp===0?'等待救治':'生还',destination,items:Object.values(p.items).filter(i=>!i.destroyed&&(i.holder===a.id||i.holder==='party')).map(i=>i.name),promises:p.promises.filter(x=>x.status!=='已履行').map(x=>x.text),lastScene:`${a.name}${a.dead?'的同伴记起':'选择'}：${destination}。`,time:new Date().toISOString()};}
function setRestored(s,id,status){const n=npc(s,id);if(n){n.status=status;n.attitude='本地遭遇结束';}}
function settleLuRescue(s){const rescued=['lu','lu-a','lu-b'].filter(id=>npc(s,id)?.status==='获救'&&!npc(s,id)?.actor?.dead).length;reward(s,'lu-rescue',rescued===3?200:rescued>0?100:0);f(s).luRescued=rescued===3;return rescued;}
function rescueQuarry(s){setNPC(s,'feng','获救','友好');for(const id of ['lu','lu-a','lu-b'])if(npc(s,id)?.status==='被扣')setNPC(s,id,'获救','友好');settleLuRescue(s);f(s).quarryDiagram=true;}

function gateChoices(s){const p=ensureCampaign(s),x=f(s),out=[
 c('terms','分别听韩荣、韩升、韩变的底线','先走后接、依法结饷、私物自留、公械不入民居。',(s,a,ctx)=>{f(s).hanTerms=true;ctx.say('韩荣要真实接手者与离关顺序；韩升要军饷和尊严；韩变要居民自由去留、军械绕开民居。首批拟走十七人，接关五人，实际名单可随自愿选择改变。');}),
 c('wages','由双方见证按原账结清军饷','库中实物足够；公物移交，私物随人。',(s,a,ctx)=>{f(s).wages=true;ctx.say('欠饷在原账签收，韩升与两名近卫不再为此阻路。');},s=>f(s).hanTerms&&!f(s).wages),
 c('civilians','确认居民自选去留，军械封存于军用区域','不把万刃车与武装队伍塞进民居。',(s)=>{f(s).civilians=true;neutralize(s,['hanbian']);},s=>f(s).hanTerms&&!f(s).civilians),
 c('agreement','请程简和四名交接吏当面认约','愿走者先到安全处，再入关点交；玩家亲自护送。',(s,a,ctx)=>{f(s).hanAgreement=true;promise(s,'han-safe','依约先护愿走者安全离关，结清军饷、私物自留，再由程简等五人接管关防和公共军械');neutralize(s,['hansheng','hanbian','guard-1','guard-2']);ctx.say('父子认可明确安排，愿走者收拾私物，韩荣回居所等候。');},s=>facts(s,['hanTerms','wages','civilians'])&&!f(s).hanAgreement),
 c('inspect','查看门锁、木闩和独立吊桥绞盘','门和桥各自保存：锁闩不妨碍转绞盘。',(s,a,ctx)=>{f(s).gateInspected=true;ctx.say(`门：${ensureCampaign(s).gate.door}；桥：${ensureCampaign(s).gate.bridge}。门内操作点 (85,60)，绞盘 (95,45)，桥需两个运用动作。`);}),
 c('unlock','请已同意交接的韩升用钥匙解除锁闩','和平时直接操作，不额外刷骰。',(s)=>{ensureCampaign(s).gate.door='unbarred';},s=>f(s).hanAgreement&&ensureCampaign(s).gate.door==='locked'),
 c('key','取用已投降或倒下的韩升所持钥匙','按其实际位置拿到原钥匙，再解开门内这一套锁闩。',(s,a,ctx)=>{const h=s.actors.find(x=>x.npcId==='hansheng');if(!h||h.departed)throw new Error('钥匙不在眼前，仍可用工具、法术或南便道。');ctx.near(a,h.x,h.y,7.5);ctx.utilize(a);ensureCampaign(s).gate.door='unbarred';ctx.say('原钥匙解除门锁，木门仍需单独推开，吊桥状态不变。');},s=>!f(s).hanAgreement&&ensureCampaign(s).gate.door==='locked'&&defeated(s,['hansheng'])&&s.actors.some(a=>a.npcId==='hansheng'&&!a.departed),{combat:true}),
 c('pick','靠近门内用盗贼工具开锁','敏捷工具 DC15；失败可用钥匙、敲击术或从南路绕行。',(s,a,ctx)=>{ctx.near(a,85,60,7.5);ctx.utilize(a);if(a.class!=='Rogue')throw new Error('预设队伍中燕归持有盗贼工具。');check(s,a,ctx,'gatePick','sleight',15,()=>{ensureCampaign(s).gate.door='unbarred';},'铁锁仍在，木闩和门保持原状；绞盘与南路仍可处理。');},s=>ensureCampaign(s).gate.door==='locked'&&!f(s).gatePickTried,{combat:true}),
 c('open','从内侧推开重门','解除锁闩后一个运用动作；桥不会一起落下。',(s,a,ctx)=>{if(!f(s).hanAgreement)ctx.near(a,85,60,7.5);ctx.utilize(a);ensureCampaign(s).gate.door='open';ctx.say('重门敞开。吊桥继续保持独立状态。');},s=>ensureCampaign(s).gate.door==='unbarred',{combat:true}),
 c('bridge','转动绞盘，继续放桥','绞盘在 (95,45)，总共两个运用动作，可由不同角色接手。',(s,a,ctx)=>{if(!f(s).hanAgreement)ctx.near(a,95,45,10);ctx.utilize(a);const g=ensureCampaign(s).gate;g.bridgeWork=Math.min(2,g.bridgeWork+1);g.bridge=g.bridgeWork===2?'lowered':'half';ctx.say(g.bridge==='lowered'?'桥面放平并扣住保险。':'吊桥降到中途，尚不能作正常步行桥面。');},s=>ensureCampaign(s).gate.bridge!=='lowered',{combat:true}),
 c('south','请四名自愿留关工匠清理南便道','从维修经费付工钱，半日清理十尺宽旧道。',(s,a,ctx)=>{s.time+=4;ensureCampaign(s).gate.southRoad=true;ctx.say('四名本地留关工匠清出可持续使用的南道，未强迫归乡工匠返工。');},s=>!ensureCampaign(s).gate.southRoad&&noBattle(s)),
 c('aftermath','控制门区后落实居民去留与合法军饷','击退、投降或离开的守方不再阻路；伤者、死者与自愿留下者分别记录。',(s,a,ctx)=>{f(s).civilians=true;f(s).wages=true;f(s).gateAftermath=true;promise(s,'han-safe','控制门区后保护实际在世的愿走者，结清合法军饷，公械点交而私物自留');ctx.say('门区已经不再交锋。仍愿离开的人与伤者在安全处等候，不补出已死或已经离开的同伴。');},s=>gateControlled(s)&&noBattle(s)&&!f(s).hanAgreement&&!f(s).gateAftermath),
 c('passengers','亲自护送愿走者到关外安全处','按实际在世和自愿的人员离关，不补满十七人。',(s,a,ctx)=>{f(s).passengersSafe=true;ctx.say('实际愿走的生还者与伤者走到安全岔路；合法军饷和私物按真实交接保留，死者不被补回。');},s=>(f(s).hanAgreement||f(s).gateAftermath)&&!f(s).passengersSafe&&(ensureCampaign(s).gate.southRoad||ensureCampaign(s).gate.door==='open'&&ensureCampaign(s).gate.bridge==='lowered'||f(s).permanentRoute)),
 c('handover','通知程简等五人入关，点交关防公械','先行者安全后再入关。',(s)=>{f(s).gateHandover=true;},s=>f(s).passengersSafe&&!f(s).gateHandover),
 c('settle','确认交关、通路与人员安排，结清第四幕','总共 1,000 GP、一件 +2 武器和一对传讯石，只领一次。',(s,a,ctx)=>settleGate(s,ctx),s=>f(s).passengersSafe&&f(s).gateHandover&&!ensureCampaign(s).chapters[8]?.completed),
 c('close','席散，带着已谈成的条件去门区','第七回仍 9 级；门桥、同一批人物和用过的能力延续。',(s,a,ctx)=>{finish(s,7,'酒席已告一段落，已接受的条件与分歧转入实际交关。',{level:9});ctx.say('韩荣回居所，原来那两名近卫带路。第八回不会刷新另一组守方。');},s=>s.chapter===7&&noBattle(s))
 ];return out;}

export function initializeChapter(s,n){const p=ensureCampaign(s);initializeWorldly(s,n);p.nodes[n]||='arrival';for(const [id,name] of npcSets[n]||[])p.npcs[id]||={id,name,status:'在场',attitude:'可交谈'};if(n===3)potions(s,'maiting-start',2);if(n===4)potions(s,'letter-start',2);if(n===7)reward(s,'gate-advance',200);if(n===10&&!p.items.banner)grant(s,'banner','六魂幡 · Wand of Fear',{kind:'wand',holder:'ding',charges:7,maxCharges:7,attuned:'ding',lastDawn:Math.floor((s.time-6)/24)});if(n===11)grant(s,'heroism','英雄药水',{kind:'heroism',count:2});}

export function campaignOptions(s){s=readCampaignState(s);const p=s.campaign;if(s.chapter===1){return p.chapters[1]?.completed?[{id:'campaign:next',label:'前往第二回 · 山祠借路',text:'升至四级，保留伤势与消耗。'}]:matureChoices(s).filter(o=>o.when(s)).map(({id,label,text})=>({id:`c1:${id}`,label,text,combat:false}));}
 if(p.ended)return [];
 const list=[...(s.chapter===7||s.chapter===8?gateChoices(s):chapterChoices[s.chapter]||[]),...matureChoices(s)];
 const out=list.filter(o=>!(s.chapter===5&&['pay','release','ladder','free'].includes(o.id)&&s.scene!=='B006')&&o.when(s)&&(!s.combat||o.combat)&&(!p.chapters[s.chapter]?.completed||s.chapter===12&&o.id.startsWith('end'))).map(({id,label,text,combat})=>({id:`c${s.chapter}:${id}`,label,text,combat:!!combat}));
 if(p.chapters[s.chapter]?.completed&&s.chapter<12)out.push({id:'campaign:next',label:`进入第${s.chapter+1}回 · ${titles[s.chapter]}`,text:'沿用人物、物品、承诺与资源。'});
 return out;
}
function runCampaignChoice(s,a,id,ctx){
 if(ensureCampaign(s).ended)throw Error('本桌已封卷；如需改结局，请由主持使用撤销或先保存另一份战役。');
 const p=ensureCampaign(s);if(id==='campaign:next'){if(!p.chapters[s.chapter]?.completed||s.chapter>=12)throw new Error('本回还有尚未收束的目标。');if(s.combat)throw new Error('先处理当前遭遇。');syncNPCs(s);s.chapter++;initializeChapter(s,s.chapter);ctx.enter(maps[s.chapter-1]);ctx.say(descriptions[s.chapter]);if(s.chapter===8&&p.chapters[8]?.completed)ctx.say('前回已经交关成功。门桥保持原样，成果与报酬不再重复。');return true;}
 if(!id?.startsWith(`c${s.chapter}:`))return false;initializeChapter(s,s.chapter);const list=[...(s.chapter===7||s.chapter===8?gateChoices(s):chapterChoices[s.chapter]||[]),...matureChoices(s)];const option=list.find(o=>`c${s.chapter}:${o.id}`===id&&!(s.chapter===5&&['pay','release','ladder','free'].includes(o.id)&&s.scene!=='B006')&&o.when(s)&&(!s.combat||o.combat));if(!option)throw new Error('该选项当前不可用，请刷新局面。');if(a.dead&&!(s.chapter===12&&['endmemory','final'].includes(option.id)))throw new Error('亡者可记录自己的纪念与自愿受封意愿；其他行动先按真实规则恢复。');if(p.chapters[s.chapter]?.completed&&!(s.chapter===12&&option.id.startsWith('end')))throw new Error('本回已经收束。');ctx.log('choice',`${a.name}：${option.label}`);p.nodes[s.chapter]=option.id;option.run(s,a,ctx);matureAfterChoice(s,a,option.id,ctx);syncNPCs(s);return true;
}
export function campaignChoice(s,a,id,ctx){return runCampaignChoice(s,a,id,ctx);}
export function campaignView(s){s=readCampaignState(s);const p=s.campaign;const objectiveDefs={
 1:[['travellers','让十二名旅人安全渡河',!!s.flags.chapter1Done]],2:[['craftsmen','接回孟平与两名帮手',f(s).craftsmen],['route','说明山路是否借到',!!p.chapters[2]?.completed]],3:[['people','救回鲁青与两位帮手',f(s).luRescued],['goods',`粮药：${f(s).supplies||0} / 24 包`,f(s).supplies===24]],4:[['message','把求援传给沈砚并说明回联方式',f(s).messageDelivered]],5:[['plan','带回报告、营救或观察所得',p.chapters[5]?.completed]],6:[['route','落实北口或替代安全通路',p.chapters[6]?.completed]],7:[['terms','谈定可执行的离关与交接办法',f(s).hanAgreement]],8:[['people','愿走者安全离关',f(s).passengersSafe],['handover','关防公共军械完成交接',f(s).gateHandover],['route','留下可持续使用的道路',p.gate.southRoad||p.gate.door==='open'&&p.gate.bridge==='lowered'||f(s).permanentRoute]],9:[['sword','真剑离开阵位',f(s).swordTaken],['secure','同伴与真剑安全脱离争夺',f(s).swordSecure]],10:[['banner','停用本次胁迫并定下幡的去向',f(s).bannerPlan],['pursuit','让本路追索实际停止',f(s).pursuitStopped]],11:[['night','解除当夜袭营危机',f(s).nightStopped]],12:s.actors.filter(a=>a.side==='party').map(a=>[a.id,`${a.name}的个人结局`,!!p.endings[a.id]])};
 const visibleIds=new Set(Object.keys(npcSets).filter(n=>+n<=s.chapter).flatMap(n=>npcSets[n].map(([id])=>id)));if(p.npcs.ahe)visibleIds.add('ahe');for(const n of Object.values(p.npcs))if(n.revealedChapter<=s.chapter)visibleIds.add(n.id);for(const id of ['claim-1','claim-2'])if(p.npcs[id])visibleIds.add(id);
 return {chapter:s.chapter,title:titles[s.chapter-1],entryLevel:levels[s.chapter-1],node:p.nodes[s.chapter]||'arrival',description:descriptions[s.chapter]+matureDescription(s),consequences:matureConsequences(s),objectives:(objectiveDefs[s.chapter]||[]).map(([id,label,done])=>({id,label,status:done?'完成':'进行中'})),npcs:Object.values(p.npcs).filter(n=>visibleIds.has(n.id)).map(({id,name,status,attitude})=>({id,name,status,attitude})),items:Object.values(p.items).filter(i=>!['ding'].includes(i.holder)||s.chapter>=10).map(({id,name,holder,charges,attuned,count,destroyed,kind,ends})=>({id,name,holder,charges,attuned,count,destroyed,kind,ends})),promises:p.promises,completed:!!p.chapters[s.chapter]?.completed,canAdvance:!!p.chapters[s.chapter]?.completed&&s.chapter<12,milestoneLevel:p.milestoneLevel,gate:s.chapter>=7?{...p.gate}:null,endings:s.chapter===12?Object.values(p.endings):[],ended:!!p.ended,options:campaignOptions(s)};
}
export function syncNPCs(s){const p=ensureCampaign(s);for(const a of s.actors.filter(a=>a.npcId)){const n=p.npcs[a.npcId]||={id:a.npcId,name:a.name,status:'在场',attitude:'可交谈'};n.actor=structuredClone(a);n.actor.location=s.scene;if(a.dead)n.status=a.restoration?`本地死亡；${a.restoration}`:'死亡';else if(a.hp<=0||a.conditions?.some(c=>c.startsWith('昏迷')))n.status='被俘／失能';else if(a.side==='enemy'&&!['离开','获救','已交接'].includes(n.status))n.status='在场';}}
const rosters={
 B003:[['armor','shrine-armor-1','山祠铜甲甲',27.5,57.5],['armor','shrine-armor-2','山祠铜甲乙',42.5,62.5],['sword','shrine-sword-1','山祠飞剑甲',32.5,42.5],['sword','shrine-sword-2','山祠飞剑乙',37.5,42.5]],
 B004:[['captain','cen','岑岳',47.5,27.5],['knight','fei','费安',97.5,72.5],['priest','zhu','祝槐',72.5,92.5],['scout','maiting-scout-1','账房弓手',102.5,27.5],['scout','maiting-scout-2','院内弓手',87.5,72.5]],
 B005:[['mage','xu','许照',72.5,62.5],['berserker','du','杜衡',62.5,112.5],['scout','post-scout','驿内弓手',87.5,37.5]],
 B006:[['gargoyle','garg-1','脊角',52.5,92.5],['gargoyle','garg-2','缺耳',72.5,62.5]],
 B007:[['druid','dong','董全',112.5,42.5],['air','air-1','长嘶',62.5,72.5],['air','air-2','回响',107.5,72.5],['gargoyle','garg-1','脊角',42.5,72.5],['gargoyle','garg-2','缺耳',142.5,42.5]],
 B008:[['gladiator','hansheng','韩升',102.5,62.5],['mage','hanbian','韩变',132.5,32.5],['knight','guard-1','韩家近卫甲',102.5,82.5],['knight','guard-2','韩家近卫乙',92.5,32.5]],
 B009:[['golem','golem','北门石像',107.5,52.5],['stalker','stalker','无形客',122.5,92.5]],
 B010:[['mage','ding','长耳定光仙',82.5,67.5,'neutral'],['efreeti','efreeti','赤炉客',132.5,57.5],['fire','fire','烛尾',132.5,97.5]],
 B011:[['rakshasa','daji','妲己',152.5,37.5],['lamia','huxi','胡喜媚',157.5,57.5],['lamia','wang','王贵人',132.5,37.5]]
};
export function campaignEncounter(s,id,templates){const p=ensureCampaign(s);if(s.chapter===12)return [];return [...(rosters[id]||[]),...(id==='B009'&&s.chapter===9&&f(s).hanPact==='named'&&!f(s).claimsSettled?[['scout','claim-1','异议护卫甲',32.5,22.5,'neutral'],['scout','claim-2','异议护卫乙',42.5,22.5,'neutral']]:[])].flatMap(([type,npcId,name,x,y,side='enemy'])=>{const n=p.npcs[npcId];if(n&&['死亡','离开','获救','停战','已交接','已放逐'].some(t=>n.status===t)||n?.actor?.dead||n?.actor?.departed)return [];let a;if(n?.actor){a=structuredClone(n.actor);a.x=x;a.y=y;}else if(templates[type]){a={...structuredClone(templates[type]),id:npcId,npcId,type,name,x,y,hp:templates[type].maxHp,side,conditions:[],reaction:true,death:[0,0],controller:'local',spellUses:{}};}else a=makeNPC(type,npcId,name,x,y,side);if(s.chapter>=7&&f(s).hanAgreement&&['hansheng','hanbian','guard-1','guard-2'].includes(npcId))a.side='neutral';return [a];});}
export function firstChapterFinished(s){const p=ensureCampaign(s);p.chapters[1]={completed:true,outcome:`十二名旅人安全渡河；阿禾${s.flags.ahe?'获救':'尚待救援'}，赃粮${s.flags.grain?'追回':'留在仓中'}。`};p.milestoneLevel=4;p.npcs.ahe={id:'ahe',name:'阿禾',status:s.flags.ahe?'获救':'尚未获救',attitude:s.flags.ahe?'友好':'未知'};advanceParty(s,4);}
export const chapterStart=n=>maps[n-1];
export function safeRest(s){return s.scene==='FERRY'||s.scene==='B001'&&s.flags.ahe||!!s.campaign?.chapters?.[s.chapter]?.completed||[2,4,5,7,8,12].includes(s.chapter)&&!s.combat;}
