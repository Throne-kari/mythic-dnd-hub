import {ensureAftercare,aftercareOptions,aftercareSummary,aftercareEnding,remainingReward} from './maturity.mjs';
import {makeNPC} from './bestiary.mjs';
import {publishHandout} from './handouts.mjs';

const titles=['断索与火星','盐院里的空炉','退水道的灯','绳场上的价码','盐仓之夜','天亮以前'];
const maps=['S01','S02','S03','S04','S05','S06'];
const descriptions=[
 '稳住岸边滑车与车板小火，听清四名住户的处境，再决定是否接下救援。所有车桶为空，没有隐藏爆炸物。',
 '解救被木架卡住的布特鲁斯，检查冷座、两桶焦油和火绳。救人、撤料与修座可以同时成功；可选旧帆支线不影响通路。',
 '海侧北台和上方检修口都能接出阿黛拉。解释来意，安全搬出8磅铜盂；运输不等于替烬客决定住处。',
 '让达乌德知道仓里有人，处理唯一备用桶与点火棒，再决定奥东的去向。可以揭穿、拿走物资、谈退或战斗。',
 '按真实火情验收盐仓、救援和安置烬客。提前解决的危险保持解决；没有为了高潮添加的火种、敌军和人质。',
 '逐人点名，清点三桶与证据，再听当事人提出要求。共同使用、私人承接、全员离开或保留意见都能收束。'
];
const targetIds=['marta','yusuf','butrus','adela'];
const definitions={
 marta:{name:'玛尔塔',type:'commoner',location:'S02',x:32.5,y:12.5,training:'athletics',voice:'门我可以开；替别人答应的事，我不能替。'},
 yusuf:{name:'尤素夫',type:'commoner',location:'S01',x:12.5,y:17.5,training:'investigation',voice:'先找脚下能站的石头，再说勇敢。'},
 butrus:{name:'布特鲁斯',type:'commoner',location:'S02',x:22.5,y:12.5,training:'arcana',voice:'我捡到的是盂，不是它的一辈子。'},
 adela:{name:'阿黛拉',type:'commoner',location:'S03',x:7.5,y:2.5,training:'acrobatics',voice:'我跑得太快，没想好回来。但现在能想。'},
 hanna:{name:'汉娜',type:'commoner',location:'S01',x:2.5,y:22.5,training:'survival',voice:'我的船会回来接第二趟，石路也能走。'},
 odon:{name:'奥东',type:'odon',location:'S04',x:47.5,y:12.5,side:'enemy',voice:'你们不知道它值多少。'},
 dawud:{name:'达乌德',type:'guard',location:'S04',x:22.5,y:12.5,voice:'我答应搬废木，没答应把人也当废木。'},
 loyal1:{name:'奥东忠从甲',type:'bandit',location:'S04',x:37.5,y:7.5,side:'enemy'},
 loyal2:{name:'奥东忠从乙',type:'bandit',location:'S04',x:57.5,y:17.5,side:'enemy'},
 sami:{name:'萨米',type:'commoner',location:'S04',x:82.5,y:7.5,voice:'木片上记了工，工钱还没到手。'},
 worker2:{name:'临时工',type:'commoner',location:'S04',x:82.5,y:22.5},
 ember:{name:'烬客',type:'ember',location:'S03',x:2.5,y:7.5,voice:'不是货。先说去哪。'}
};
const defaults={people:'unknown',fire:'prepared',ember:'unsettled',odon:'active',proof:'unknown',compact:'none',withdrawn:false};
export function ensureCampaign(s){
 const p=s.campaign||={};p.facts||={};for(const [k,v] of Object.entries(defaults))if(p.facts[k]===undefined)p.facts[k]=v;
 p.chapters||={};p.nodes||={};p.npcs||={};p.items||={};p.promises||=[];p.rewards||={};p.endings||={};p.milestoneLevel=3;p.fireZones||=[];p.notes||=[];
 p.startedAt??=s.time||0;
 for(const [id,d] of Object.entries(definitions))p.npcs[id]||={id,name:d.name,location:d.location,x:d.x,y:d.y,status:'尚未确认',attitude:d.side==='enemy'?'可交涉':'可交谈',met:false,safe:false};
 p.items.basin||={id:'basin',name:'镇火铜盂（8磅）',holder:'adela',location:'S03',weight:8};
 p.items.kit||={id:'kit',name:'Healer’s Kit',holder:'party',count:10};
 ensureAftercare(s);
 s.actors||=[];s.inventory||=[];s.journal||=[];s.log||=[];s.flags||={};s.locations||={};s.gold??=0;s.time??=0;s.logSeq??=0;
 return p;
}
const F=s=>ensureCampaign(s).facts;
const N=(s,id)=>ensureCampaign(s).npcs[id];
const A=(s,id)=>s.actors.find(a=>a.npcId===id)||N(s,id)?.actor;
const alive=(s,id)=>A(s,id)?!A(s,id).dead:N(s,id)?.status!=='死亡';
const controlled=a=>!!a&&(a.conditions?.some(c=>c.startsWith('昏迷')||['unconscious','incapacitated','paralyzed','stunned'].includes(c))||a.effects?.some(e=>['unconscious','incapacitated','paralyzed','stunned','banished'].includes(e.condition)));
const responsive=(s,id)=>alive(s,id)&&(A(s,id)?.hp??4)>0&&!controlled(A(s,id));
const noCombat=s=>!s.combat;
const physical=s=>['S02','S05','S06'].includes(s.scene)?'warehouse':s.scene;
const samePlace=(one,two)=>one===two||['S02','S05','S06'].includes(one)&&['S02','S05','S06'].includes(two);
const mark=(s,id)=>{const n=N(s,id);if(n)n.met=true;};
function record(s,text){ensureCampaign(s).notes.push({text,time:s.time});if(s.campaign.notes.length>100)s.campaign.notes.shift();}
function promise(s,id,text,status='待履行'){const p=ensureCampaign(s);const old=p.promises.find(x=>x.id===id);if(old){old.text=text;old.status=status;}else p.promises.push({id,text,status});}
function finish(s,n,text){const p=ensureCampaign(s);p.chapters[n]={...(p.chapters[n]||{}),visited:true,completed:true,outcome:text};if(!s.journal.some(j=>j.sourceChapter===n))s.journal.push({sourceChapter:n,title:`第${n}景 · ${titles[n-1]}`,text});}
function grant(s,id,name,extra={}){const p=ensureCampaign(s);if(!p.items[id])p.items[id]={id,name,holder:'party',...extra};if(!s.inventory.includes(name))s.inventory.push(name);return p.items[id];}
function removeFromMaps(s,id){s.actors=s.actors.filter(a=>a.npcId!==id);for(const loc of Object.values(s.locations))if(loc.actors)loc.actors=loc.actors.filter(a=>a.npcId!==id);}
function relocate(s,id,location,{safe,position,status}={}){
 const n=N(s,id);if(!n)return;const a=A(s,id);if(a)n.actor=structuredClone(a);removeFromMaps(s,id);n.location=location;delete n.locationLabel;if(safe!==undefined)n.safe=safe;if(status)n.status=status;
 if(position)[n.x,n.y]=position;if(n.actor){n.actor.location=location;if(position)[n.actor.x,n.actor.y]=position;}
 if(samePlace(location,s.scene)&&n.actor&&!n.actor.departed){const copy=structuredClone(n.actor);copy.x=n.x;copy.y=n.y;s.actors.push(copy);}
}
const shoreSpots={marta:[32.5,22.5],yusuf:[12.5,17.5],butrus:[7.5,12.5],adela:[7.5,7.5]};
function rescue(s,id,ctx){const n=N(s,id);if(!alive(s,id)){ctx.say(`${n.name}已经死亡；可以搬出遗体并继续救其他人，不能把死亡改写为获救。`);return false;}mark(s,id);relocate(s,id,'S01',{safe:true,position:shoreSpots[id],status:'已脱险，岸屋照看'});n.locationLabel='汉娜的岸屋 / 岸边安全石地';ctx.say(`${n.name}沿已确认的石路到岸屋；0HP者仍须急救或治疗，安全判定按真实生命状态。可返回岸边继续治疗。`);return true;}
function neutral(s,ids,status='停手'){for(const id of ids){const n=N(s,id);if(!n||!alive(s,id))continue;n.status=status;n.attitude='愿意停手';if(n.actor)n.actor.side='neutral';for(const a of s.actors)if(a.npcId===id)a.side='neutral';}if(!s.actors.some(a=>a.side==='enemy'&&a.hp>0&&!a.dead&&!a.departed))s.combat=null;}
function materials(s){const x=F(s);return !!(x.firecord&&x.tarWarehouseA&&x.tarWarehouseB&&x.tarRopeyard);}
function canContain(s){const x=F(s);return materials(s)&&(x.odon!=='active'||(x.ignitersSeized||x.ignitersSoaked)&&x.warehouseWatch)&&x.dawudStopped;}
function reconcile(s){
 const p=ensureCampaign(s),x=p.facts;
 const people=targetIds.map(id=>({n:N(s,id),a:A(s,id)}));
 if(people.some(({a,n})=>a?.dead||n.status==='死亡'))x.people='dead';
 else if(people.every(({a,n})=>n.safe&&(a?.hp??4)>0||n.safe&&a?.hp===0&&a.stable))x.people='safe';
 else x.people=people.some(({n})=>n.met)||x.infoKnown?'missing':'unknown';
 const od=A(s,'odon');if(od?.dead)x.odon='dead';
 if(A(s,'ember')?.dead)x.ember='destroyed';
 if(x.fire!=='destroyed'){
  if(p.fireZones.length)x.fire='burning';
  else if(canContain(s))x.fire='contained';
  else if(x.fire==='burning')x.fire='prepared';
 }
 return x;
}
function progressTime(s,minutes,ctx){
 s.time+=minutes/60;const x=F(s);x.elapsedMinutes=(x.elapsedMinutes||0)+minutes;
 if(x.elapsedMinutes>=30&&!N(s,'adela').safe&&alive(s,'adela')&&!x.tideWarned){x.tideWarned=true;ctx.say('公开预告：平台边已经湿了，阿黛拉把铜盂系向石角。她仍站得住；上方格栅与海侧绳路仍可救援。');}
 if(x.elapsedMinutes>=40&&!N(s,'adela').safe&&alive(s,'adela')&&!x.adelaSelfHelp){x.adelaSelfHelp=true;N(s,'adela').status='沿北台自救，仍待接应';ctx.say('阿黛拉敲击格栅，自行走向较高的石角求援；没有自动溺亡。');}
}
function useAt(s,a,ctx,x,y,r=7.5){ctx.near(a,x,y,r);ctx.utilize(a);}
function publish(s,id){return publishHandout(s,id);}
function hearPeople(s,ctx){for(const id of targetIds.filter(id=>responsive(s,id)&&N(s,id).safe))ctx.say(`${N(s,id).name}：“${definitions[id].voice}”`);}
function gatherSurvivors(s,ctx){const spots={marta:[22.5,27.5],yusuf:[27.5,17.5],butrus:[32.5,17.5],adela:[37.5,17.5]};for(const id of targetIds){const n=N(s,id);if(!n.safe||!alive(s,id))continue;relocate(s,id,'S06',{safe:true,position:spots[id]});n.locationLabel='北门安全石地 / 公开交接';}ctx.say('已经脱险的幸存者与需要抬行的伤员来到北门安全石地；可在场正常治疗。仍困在别处、失踪或已死亡者保留真实位置，没有为点名而瞬移回来。');}
function allConsent(s){return targetIds.every(id=>N(s,id).safe&&responsive(s,id));}
function emptyFire(s,ctx){ensureCampaign(s).fireZones=[];F(s).beamWarning=false;reconcile(s);ctx.say(F(s).fire==='destroyed'?'明火已灭；已损毁的盐仓主体不会因灭火恢复。':'已处理的明火熄灭，危险区撤销。仍需检查三桶火具与后续点火机会。');}
const c=(id,label,text,run,when=()=>true,extra={})=>({id,label,text,run,when,...extra});
const W=s=>['S02','S05'].includes(s.scene);

function commonWarehouseOptions(s){return [
 c('survey','查看炉间、后门与木架','公开线索：冷座被拆、后门两桶焦油、梁脚火绳、阿黛拉泥印。',(s,a,ctx)=>{const x=F(s);x.warehouseSurvey=true;x.coldSeatKnown=true;x.firecordKnown=true;x.tarKnown=true;x.adelaRoute=true;for(const id of ['marta','butrus'])mark(s,id);publish(s,'H02');publish(s,'H03');ctx.say('两条证据线都在：示意砖和拆座痕迹；拒售便笺和目击证词。玛尔塔指出检修口；任何一位证人无法说话，实物仍可读。绳场还存一桶，仓里处理过的两桶不会复现。');},s=>!F(s).warehouseSurvey),
 c('warn','告知住户纵火准备，安排出口','玛尔塔同意先撤人；北门与后门都畅通。',(s,a,ctx)=>{F(s).residentsWarned=true;mark(s,'marta');if(responsive(s,'marta'))ctx.say('玛尔塔：“先点四个名字。我通知街坊，钥匙留给能看守的人。”');else ctx.say('门内布局、后墙实物和剩余证人仍让通知与救援继续。');},s=>!F(s).residentsWarned),
 c('lever','两人配合杠杆与垫木，救出陶匠','西棚备有杠杆；两名能行动的PC都须在木架7.5尺内，合作自动成功。',(s,a,ctx)=>{ctx.near(a,22.5,12.5,7.5);const helper=s.actors.find(t=>t.side==='party'&&t.id!==a.id&&!t.dead&&t.hp>0&&!controlled(t)&&Math.max(Math.abs(t.x-22.5),Math.abs(t.y-12.5))<=7.5);if(!helper)throw Error('需要另一位能行动的同伴实际站在木架7.5尺内；也可选明确邀请住户帮忙的方案。');ctx.utilize(a);F(s).rackRemoved=true;F(s).rescuedButrus=true;rescue(s,'butrus',ctx);},s=>!F(s).rackRemoved,{at:{x:22.5,y:12.5,range:7.5}}),
 c('leverlocals','请玛尔塔或尤素夫到木架旁配合杠杆','先说明支点与垫木，由仍能行动且愿帮忙的住户实际到场。',(s,a,ctx)=>{ctx.near(a,22.5,12.5,7.5);const id=['marta','yusuf'].find(id=>responsive(s,id)&&(samePlace(N(s,id).location,s.scene)||N(s,id).safe));if(!id)throw Error('玛尔塔与尤素夫均不能到场帮忙；可让另一PC靠近或提出其他实际办法。');if(!samePlace(N(s,id).location,s.scene))progressTime(s,5,ctx);const n=N(s,id);const oldSafe=n.safe;relocate(s,id,s.scene,{position:[17.5,12.5],safe:false,status:'在木架旁协助杠杆'});ctx.utilize(a);F(s).rackRemoved=true;F(s).rescuedButrus=true;rescue(s,'butrus',ctx);if(oldSafe)rescue(s,id,ctx);ctx.say(`${n.name}实际扶住支点与垫木，架子稳稳抬开；不是让地图另一端的人隔空提供Help。`);},s=>!F(s).rackRemoved&&noCombat(s),{at:{x:22.5,y:12.5,range:7.5}}),
 c('lift','独力快速抬架','运动DC12；失败只是架子未动，可换杠杆合作。',(s,a,ctx)=>{useAt(s,a,ctx,22.5,12.5);if(ctx.check(a,'athletics',12)){F(s).rackRemoved=true;F(s).rescuedButrus=true;rescue(s,'butrus',ctx);}else ctx.say('架子未动，没有追加伤害。杠杆、垫木和帮手都仍在。');},s=>!F(s).rackRemoved,{at:{x:22.5,y:12.5,range:7.5}}),
 c('escort','护送玛尔塔与已自由的住户去岸屋','北门石路不需船票；被卡木架者须先移架。',(s,a,ctx)=>{if(alive(s,'marta'))rescue(s,'marta',ctx);if(F(s).infoKnown&&alive(s,'yusuf'))rescue(s,'yusuf',ctx);if(F(s).rackRemoved&&alive(s,'butrus'))rescue(s,'butrus',ctx);F(s).residentsWarned=true;},s=>!N(s,'marta').safe||F(s).rackRemoved&&!N(s,'butrus').safe),
 c('cord','剪断可见火绳，清理梁脚焦油','安全位置用工具或水处理，一个Utilize直接生效。',(s,a,ctx)=>{useAt(s,a,ctx,42.5,42.5);F(s).firecord=true;F(s).beamTarRemoved=true;ctx.say('整根火绳剪断浸湿，梁脚洗净并隔离。它不会在离场后接回。');},s=>!F(s).firecord,{at:{x:42.5,y:42.5,range:7.5},combat:true}),
 c('barrels','盖紧并移开仓后两桶焦油','搬到离干木20尺的石地并交街坊看管；不新增第三个仓桶。',(s,a,ctx)=>{useAt(s,a,ctx,42.5,52.5);F(s).tarWarehouseA=true;F(s).tarWarehouseB=true;grant(s,'warehouse-tar','仓后两桶焦油',{holder:'街坊石地保管',count:2});ctx.say('仓里这两桶已盖紧、搬到隔离石地。绳场唯一备用桶仍须核实。');},s=>!F(s).tarWarehouseA||!F(s).tarWarehouseB,{at:{x:42.5,y:52.5,range:7.5},combat:true}),
 c('coldseat','按图修好湿石冷座','四砖、浅盆、盐水齐备；花10分钟自动完成，铜盂可稍后回来。',(s,a,ctx)=>{useAt(s,a,ctx,7.5,52.5);progressTime(s,10,ctx);F(s).coldSeat=true;ctx.say('隔热底石放平，盐水留在外围，木布离炉家至少两尺，通风与自行离开的方向保留。普通热炭试放稳定。');},s=>!F(s).coldSeat&&noCombat(s),{at:{x:7.5,y:52.5,range:7.5}}),
 c('evidence','保存便笺、实物与具体证词','抄录拒售内容、后墙布置和仍能说话者的见闻，交见证人留存。',(s,a,ctx)=>{F(s).proof='secured';grant(s,'evidence','纵火事实与证词记录',{holder:'party',kind:'evidence'});ctx.say('证据已安全保存；它说明具体事实，不保证将来定罪。纸张不是唯一渠道，活人的记忆不会被火自动抹去。');},s=>F(s).warehouseSurvey&&F(s).proof!=='secured'),
 c('canvas','可选：缝在帆里的名字','帮玛尔塔卷好旧帆并完成最后几针；约8分钟。',(s,a,ctx)=>{progressTime(s,8,ctx);F(s).canvasSaved=true;grant(s,'extra-rope','汉娜借出的备用绳',{borrowed:true});promise(s,'canvas','汉娜最后一趟转交写着船工名字的旧帆','已落实');ctx.say('“若你见到我的屋门，告诉他们，我还记得门的颜色。”旧帆被卷到安全处。它带来便利，没有锁住主线。');},s=>!F(s).canvasSaved&&noCombat(s)),
 c('watch','请知情的街坊守住开放的出口与火具','先告知危险；达乌德停工后自愿接手，禁止新的纵火。',(s,a,ctx)=>{if(!F(s).dawudStopped)throw Error('先让达乌德获知仓内有人，或在开放提议中落实其他实际看守。');F(s).warehouseWatch=true;promise(s,'watch','达乌德与知情街坊看守已隔离火具，保持两门能从内开启','已落实');ctx.say('达乌德同意看守，说明自己也参与过搬运，愿作见证；他不是免费的战斗随从。');},s=>F(s).dawudStopped&&!F(s).warehouseWatch),
 c('dawud','让来核实的达乌德亲眼看见住户与使用痕迹','不去绳场也能拆穿“空仓”说法；事实充分无需说服骰。',(s,a,ctx)=>{mark(s,'dawud');F(s).dawudStopped=true;F(s).warehouseWatch=true;neutral(s,['sami','worker2']);ctx.say('达乌德：“这里有人住。我停工，也让临时工离开火具。”他指出绳场还有唯一一桶与两支点火棒，愿帮忙看守仓门。');},s=>F(s).warehouseSurvey&&!F(s).dawudStopped)
 ];}

const chapterChoices={
 1:[
  c('brief','查看今夜行动速查','公开H06：救援、交涉、施法、撤离和拒绝都可行。',(s,a,ctx)=>{publish(s,'H06');ctx.say('四人目标可以同时实现。核心线索随合理观察给出，危险先预告，魔法按真实能力生效。');},s=>!s.journal.some(j=>j.sourceHandout==='H06')),
  c('rope','取绳系稳石桩与车轴','安全可达的绳头，不掷骰；汉娜维持另一头。',(s,a,ctx)=>{useAt(s,a,ctx,7.5,17.5,10);F(s).cartSecured=true;ctx.say('绳索拉住车轴，车轮被木楔卡住。尤素夫能自行离开车轴，滑车危险解除。');},s=>!F(s).cartSecured,{at:{x:7.5,y:17.5,range:10}}),
  c('water','取北墙清水，扑灭车板灯火','普通小火一桶水直接熄灭，所有车桶为空。',(s,a,ctx)=>{useAt(s,a,ctx,30,2.5,10);F(s).cartFireOut=true;ctx.say('车板干麻完全浇透。此灯不会离场后复燃，岸边小火不等于盐仓在烧。');},s=>!F(s).cartFireOut,{at:{x:30,y:2.5,range:10}}),
  c('bystanders','请汉娜和路人先拖开尤素夫','可以让可信的人接手救援；无人稳车则车入水、小艇可修。',(s,a,ctx)=>{F(s).cartSecured=true;F(s).cartFireOut=true;F(s).boatDamaged=true;rescue(s,'yusuf',ctx);ctx.say('汉娜与路人先把尤素夫拖开。车落水撞坏船头，火在水里熄灭；小艇需10分钟修，但陆路与救援绳照常可用。');},s=>!F(s).cartSecured||!F(s).cartFireOut),
  c('listen','听尤素夫与汉娜说明路线','四名住户、盐仓、两条水道路、绳场。线索不靠说服。',(s,a,ctx)=>{F(s).infoKnown=true;F(s).adelaRoute=true;mark(s,'yusuf');mark(s,'hanna');if(F(s).cartSecured)rescue(s,'yusuf',ctx);publish(s,'H01');ctx.say('“玛尔塔在仓里，布特鲁斯脚被木架卡住，阿黛拉抱铜盂去排水道。奥东的人打我，还在搬焦油。”海侧入口、上方检修口、5分钟外绳场全已标明；尤素夫不能说话时汉娜仍能带路。');},s=>!F(s).infoKnown),
  c('accept','接下救援与阻火，前往盐仓','全队40GP由住户自愿筹集，救人不以接任务为前提。',(s,a,ctx)=>{F(s).accepted=true;finish(s,1,'岸边事故已处理，四名住户与两条救援路线已明确。');ctx.say('你们约好先救人、再查纵火。旧护送工钱不拿来强迫接新任务；本场完成报酬全队40GP，和平解决同样认可。');},s=>F(s).cartSecured&&F(s).cartFireOut&&F(s).infoKnown&&!s.campaign.chapters[1]?.completed),
  c('repairboat','修好被撞的小艇','木板、夹具和汉娜的经验，花10分钟；仍有岸路。',(s,a,ctx)=>{progressTime(s,10,ctx);F(s).boatDamaged=false;ctx.say('船头夹板固定，小艇可以继续运伤者与铜盂。陆路未因修船关闭。');},s=>F(s).boatDamaged)
 ],
 2:[],
 3:[
  c('speak','报姓名，说明来接人而非拿货','阿黛拉配合；烬客能听懂通用语，没有口令或宗教检定。',(s,a,ctx)=>{mark(s,'adela');mark(s,'ember');F(s).adelaContact=true;F(s).emberTrust=true;ctx.say(responsive(s,'adela')?'阿黛拉：“先避开第三块松石。布特鲁斯还好吗？我可以自己走，你们递绳就好。”烬客：“不是货。先说去哪。”':'干台上的示意与泥印仍指向上方格栅；烬客可独立交流，救援和调查继续。');},s=>!F(s).adelaContact),
  c('upper','撬开上方检修盖，移走格栅杂物','从仓后30尺到检修口；用撬杠10分钟自动完成。',(s,a,ctx)=>{progressTime(s,10,ctx);F(s).upperOpen=true;F(s).adelaRouteClear=true;ctx.say('木盖和格栅打开，西端10尺石阶可通地表。无需船、飞行或特定NPC活着。阿黛拉可沿安全绳自行走出。');},s=>!F(s).upperOpen&&noCombat(s)),
  c('board','沿北台递安全绳，在松石上搭板','5分钟自动准备海侧路线；浅水与3尺窄台的困难地形不叠加。',(s,a,ctx)=>{useAt(s,a,ctx,32.5,2.5,10);progressTime(s,5,ctx);F(s).seaRouteSafe=true;F(s).adelaRouteClear=true;ctx.say('板跨过已指出的松石，安全绳固定在干岸。没有小艇也能沿石阶接应。');},s=>!F(s).seaRouteSafe&&noCombat(s),{at:{x:32.5,y:2.5,range:10}}),
  c('rescue','接出阿黛拉，交汉娜送岸屋','已有任一可靠路线时，合作救援自动成功。',(s,a,ctx)=>{if(!F(s).upperOpen)ctx.near(a,7.5,2.5,10);ctx.utilize(a);F(s).rescuedAdela=true;rescue(s,'adela',ctx);ctx.say('她不会为制造人质而折返回去；她愿稍后见师傅，也愿让烬客自己选择去处。');},s=>F(s).adelaRouteClear&&!N(s,'adela').safe&&alive(s,'adela'),{at:{x:7.5,y:2.5,range:10}}),
  c('carry','解释目的地，用湿布取出8磅铜盂','湿布后总重≤10磅；无须强制附加超重石盘。',(s,a,ctx)=>{if(!F(s).upperOpen)ctx.near(a,2.5,7.5,10);ctx.utilize(a);F(s).basinRecovered=true;F(s).emberTrust=true;const it=s.campaign.items.basin;it.holder=a.id;it.location='party';if(!s.inventory.includes(it.name))s.inventory.push(it.name);if(alive(s,'ember'))relocate(s,'ember','随队铜盂',{safe:true,status:'同意安全运输，住处待定'});ctx.say(alive(s,'ember')?'“说好了，不卖。木头会烧，水别灌进来。”铜盂包好湿布带出；可由烬客悬浮引路。运输成功保留，housed/free仍要到安全目的地得到接受。':'铜盂包好湿布带出，里面已无声音；烬客的真实死亡保留，不能把空盆记为安家。');},s=>(F(s).upperOpen||F(s).seaRouteSafe)&&!F(s).basinRecovered,{at:{x:2.5,y:7.5,range:10}}),
  c('magehand','用法师之手移出包好湿布的铜盂','30尺，≤10磅，不穿实体格栅；实际消耗Magic动作。',(s,a,ctx)=>{if(!a.spells?.includes('magehand'))throw Error('该角色未掌握法师之手。');ctx.near(a,2.5,7.5,30);if(!ctx.line(a,{x:2.5,y:7.5}))throw Error('实体墙或格栅挡路，先打开真实通路。');ctx.magic(a);F(s).basinRecovered=true;F(s).emberTrust=true;s.campaign.items.basin.holder=a.id;s.campaign.items.basin.location='party';if(alive(s,'ember'))relocate(s,'ember','随队铜盂',{safe:true,status:'同意由魔手运输，住处待定'});ctx.say('魔手托走8磅铜盂与湿布，没有搬动伤员。真实法术效果解决了搬运，不再要求额外检定。');},s=>F(s).adelaContact&&!F(s).basinRecovered,{at:{x:2.5,y:7.5,range:30}}),
  c('delegate','委托汉娜按已打开的路线接人、运盆','她有两条绳与岸路；把目的地和湿布方法讲清。',(s,a,ctx)=>{if(!alive(s,'hanna'))throw Error('汉娜已经死亡；可用真实仍在场的帮手，由主持裁定。');progressTime(s,10,ctx);if(alive(s,'adela')){rescue(s,'adela',ctx);F(s).rescuedAdela=true;}F(s).basinRecovered=true;F(s).emberTrust=true;s.campaign.items.basin.holder='汉娜';s.campaign.items.basin.location='岸屋';if(alive(s,'ember'))relocate(s,'ember','岸屋外隔热石盆',{safe:true,status:'已完成委托运输，住处待定'});promise(s,'hanna-rescue','汉娜按已打开路线接阿黛拉与铜盂到岸屋','已履行');ctx.say('合理委托已实际完成，不要求每位角色亲手走每一步。');},s=>F(s).adelaRouteClear&&(!N(s,'adela').safe||!F(s).basinRecovered)&&noCombat(s)),
  c('note','查看平台短便条，固定纵火线索','H04指明：后门两次搬完，绳场留一桶。无密码。',(s,a,ctx)=>{if(!F(s).upperOpen)ctx.near(a,7.5,2.5,10);F(s).waterwayNoteSeen=true;publish(s,'H04');F(s).ropeyardKnown=true;F(s).proof='secured';grant(s,'note','水道短便条 / 具体证词',{kind:'evidence'});ctx.say('三桶是公开总数：仓后两桶、绳场一桶。即使纸湿毁，焦油脚印、搬运记号与可陈述证词仍是线索。');},s=>!s.journal.some(j=>j.sourceHandout==='H04'),{at:{x:7.5,y:2.5,range:10}}),
  c('finish','确认人和铜盂实际去处，离开水道','阿黛拉已脱险或其伤亡已确证；可以留下已公开的未决事项。',(s,a,ctx)=>{finish(s,3,`阿黛拉：${N(s,'adela').status}；铜盂：${s.campaign.items.basin.holder}；烬客：${F(s).ember}。`);ctx.say('救援按真实生命状态记录；下一步可绳场、回仓或安排撤离。');},s=>(N(s,'adela').safe||!alive(s,'adela'))&&(F(s).basinRecovered||F(s).ember==='destroyed'))
 ],
 4:[
  c('explain','向达乌德讲清住户、伤者和学徒','有姓名、亲见伤者、便笺或仓里使用事实即可；无需说服。',(s,a,ctx)=>{mark(s,'dawud');mark(s,'odon');mark(s,'sami');mark(s,'worker2');F(s).dawudStopped=true;F(s).warehouseWatch=true;neutral(s,['sami','worker2']);ctx.say('达乌德：“我答应搬废木，没答应把人当废木。我停工，带临时工离开火具，愿去仓门看守。”奥东不能用一句话把他重新骗回。');},s=>!F(s).dawudStopped&&(F(s).infoKnown||F(s).warehouseSurvey||F(s).adelaContact)),
  c('verify','带达乌德去仓里亲眼核实','不靠说服的保底：10分钟往返，原有危险不重置。',(s,a,ctx)=>{progressTime(s,10,ctx);F(s).dawudStopped=true;F(s).warehouseWatch=true;mark(s,'dawud');neutral(s,['sami','worker2']);ctx.say('真实使用痕迹与住户去向已经核实。达乌德停止清场、留下具体证词。');},s=>!F(s).dawudStopped&&noCombat(s)),
  c('tar','盖桶、剪麻，控制唯一备用桶','南墙水桶可用；开放的工具可拿，不要求潜行当万能锁。',(s,a,ctx)=>{useAt(s,a,ctx,47.5,22.5);F(s).tarRopeyard=true;grant(s,'ropeyard-tar','绳场唯一焦油桶',{holder:'隔离石地',count:1});ctx.say('第三桶已盖住隔离，未燃火麻被浸湿。焦油不是爆炸物，现场不存在第四桶。');},s=>!F(s).tarRopeyard,{at:{x:47.5,y:22.5,range:7.5},combat:true}),
  c('igniters','取走两支点火棒与剩余引火物','北箱上公开可见；一个Utilize，靠近后实际取走。',(s,a,ctx)=>{useAt(s,a,ctx,47.5,2.5);F(s).ignitersSeized=true;grant(s,'igniters','两支点火棒与已浸湿火麻',{holder:'party'});ctx.say('奥东失去已配置的点火物；没有遥控命令、补给暗队和额外燃料。');},s=>!F(s).ignitersSeized,{at:{x:47.5,y:2.5,range:7.5},combat:true}),
  c('proof','当面核对并保存证词','拒售、后墙布置与“空仓”雇约分别说清，见证人记住。',(s,a,ctx)=>{F(s).proof='secured';F(s).odonClaimExposed=true;grant(s,'evidence','纵火事实与证词记录',{kind:'evidence'});ctx.say('搬运记号、看得见的火具、拒售争执和已经获得的见闻被分别登记。'+(responsive(s,'odon')?'奥东承认他知道仓里有人，仍夸称打捞份额包含铜盂。':'奥东当前不能答复，记录他的真实处境。')+(responsive(s,'dawud')?'达乌德说明自己只答应清理空仓。':'其受雇条件按已有见闻与实物核对。')+'证据说明具体事实，将来如何受理仍由当事人决定。');},s=>F(s).proof!=='secured'||!F(s).odonClaimExposed),
  c('deal','要求交火具、撤回主张，不带铜盂离开','达乌德停工且证据明确时基本退让自动成立；奥东自由离去记escaped。',(s,a,ctx)=>{if(!responsive(s,'odon'))throw Error('奥东现在不能自愿答复；可约束、急救或按实际伤亡处理。');F(s).tarRopeyard=true;F(s).ignitersSeized=true;F(s).odon='escaped';F(s).odonRenounced=true;neutral(s,['odon','loyal1','loyal2'],'同意退走');for(const id of ['odon','loyal1','loyal2'])if(alive(s,id))relocate(s,id,'离开现场，去向未控制',{status:'已离开',safe:true});promise(s,'odon-terms','奥东交出全部火具，公开撤回铜盂主张，不带走奇物','已履行');ctx.say('基本退让已经落实。允许离开不免除受害者的追究权；逃走的奥东不会在S05突然回来另点一把火。');},s=>F(s).dawudStopped&&F(s).proof==='secured'&&F(s).odon==='active'&&noCombat(s)),
  c('supervise','接受当众缴械与现场监督，约束奥东','达乌德、见证人与队伍落实看守；不是一句保证就写bound。',(s,a,ctx)=>{if(!F(s).dawudStopped||F(s).proof!=='secured')throw Error('先拆穿空仓说法并固定具体证据，才能取得这一自愿缴械条件。');if(!responsive(s,'odon'))throw Error('需先处理奥东的真实失能/死亡；制服后可用拘留行动。');F(s).odon='bound';F(s).tarRopeyard=true;F(s).ignitersSeized=true;F(s).warehouseWatch=true;neutral(s,['odon','loyal1','loyal2'],'缴械受监督');promise(s,'odon-watch','奥东缴械，由达乌德、街坊和队伍在石地实际看守，不能再实施纵火','已落实');ctx.say('刀与火具交出，达乌德带见证人在有退路的石地监督。奥东已受到可执行约束；没有自动判刑。');},s=>F(s).odon==='active'&&F(s).dawudStopped&&F(s).proof==='secured'&&noCombat(s)),
  c('bind','缴械并拘留已投降或失能的奥东','靠近实际目标，用绳具看守；死者仍记dead。',(s,a,ctx)=>{const od=A(s,'odon');if(od?.dead)throw Error('奥东已经死亡，不能改成被拘留。');if(od&&od.hp>26&&!controlled(od)&&od.side!=='neutral')throw Error('他仍在反抗；先达成退让、制服或控制。');if(od)ctx.near(a,od.x,od.y,7.5);ctx.utilize(a);F(s).odon='bound';F(s).ignitersSeized=true;F(s).tarRopeyard=true;neutral(s,['odon','loyal1','loyal2'],'拘留，火具缴清');ctx.say('奥东及仍在现场的忠从交出武器与火具。实际死亡、失能和已逃人员分别保留。');},s=>F(s).odon==='active'&&(A(s,'odon')?.hp<=26||A(s,'odon')?.side==='neutral'||controlled(A(s,'odon'))),{combat:true}),
  c('acceptsurrender','接受奥东停手，开放退路','他≤26HP、忠从倒下或队伍两人倒地时提出；不剥夺玩家继续行动。',(s,a,ctx)=>{neutral(s,['odon','loyal1','loyal2'],'停战缴械');F(s).tarRopeyard=true;F(s).ignitersSeized=true;F(s).odon='bound';F(s).dawudStopped=true;F(s).warehouseWatch=true;ctx.say('双方停手，火具缴出。达乌德挡开追击、打开救治与撤离路，奥东在现场监督下等待处置。');},s=>F(s).surrenderOffered&&F(s).odon==='active',{combat:true}),
  c('wait','明知风险，暂不阻止奥东带已知火具去后门','公开后果：他带唯一备用桶和点火棒离场，仍有一次完整拦截机会。',(s,a,ctx)=>{F(s).odonApproaching=true;F(s).ignitionWarned=true;for(const id of ['odon','loyal1','loyal2'])if(alive(s,id))relocate(s,id,'S05',{position:id==='odon'?[37.5,52.5]:id==='loyal1'?[42.5,47.5]:[32.5,52.5],status:'正接近后门，尚未点火'});ctx.say('他们沿真实道路带着已知物资往后门走。北门仍通；现在回仓阻拦、取走火具、撤人或放弃建筑，都有行动机会。');},s=>F(s).odon==='active'&&!F(s).ignitersSeized&&!F(s).ignitersSoaked&&!F(s).tarRopeyard&&!F(s).odonApproaching&&noCombat(s)),
  c('finish','清点绳场实际结果，返回盐仓','和平、制服、避开或已公开的离场动向都照事实记录。',(s,a,ctx)=>{finish(s,4,`达乌德${F(s).dawudStopped?'已停工':'尚待核实'}；奥东${F(s).odon}；备用桶${F(s).tarRopeyard?'已控制':'尚未控制'}。`);ctx.say('可以回仓验收、安置烬客与讨论去留；未解决威胁不会被章节完成按钮悄悄抹掉。');},s=>F(s).odon!=='active'||F(s).ignitersSeized&&F(s).tarRopeyard||F(s).odonApproaching)
 ],
 5:[
  c('audit','逐项验收三桶、梁脚、两门与看守','确认已经做到的事；无隐藏“漏了一点”检定。',(s,a,ctx)=>{reconcile(s);if(!canContain(s))throw Error('尚未齐全：'+pending(s).filter(t=>t.includes('火')||t.includes('桶')||t.includes('奥东')).join('；'));F(s).fireCertified=true;ctx.say('三桶盖紧隔离，火绳剪湿，梁脚清理，北门后门能从内开启；没有继续点火者。盐仓可安全使用，防火成功永久成立。');},s=>F(s).fire!=='destroyed'&&materials(s)&&!s.campaign.fireZones.length&&!F(s).fireCertified),
  c('halt','在后门令已知纵火者停手、缴清火具','守仓者有证据且达乌德知情时，对方接受退让，仍可不战。',(s,a,ctx)=>{if(!F(s).dawudStopped||F(s).proof!=='secured')throw Error('先让达乌德亲见住户或固定证据，再提出这一基本退让。');F(s).odon='bound';F(s).ignitersSeized=true;F(s).tarRopeyard=true;F(s).warehouseWatch=true;neutral(s,['odon','loyal1','loyal2'],'后门缴械受监督');ctx.say('后门的已知火具缴清，奥东留在有见证的监督下。没有新增点火者。');},s=>F(s).odonApproaching&&F(s).odon==='active'&&noCombat(s)),
  c('evacuate','沿开放北门把仍在仓内的住户撤到岸屋','木架须先移；水道未知者另救，不能一键假定全员安全。',(s,a,ctx)=>{for(const id of targetIds){const n=N(s,id);if(n.safe)continue;if(samePlace(n.location,s.scene)&&alive(s,id)&&(id!=='butrus'||F(s).rackRemoved))rescue(s,id,ctx);}F(s).evacuationRoute=true;F(s).evacuationDestination='汉娜熟悉的岸屋，北门石路';ctx.say('岸屋与北门石路已落实，小艇可分两趟运物。仍在水道或不明去向者必须逐名确认，不能被撤仓按钮掩去。');},s=>targetIds.some(id=>!N(s,id).safe&&samePlace(N(s,id).location,s.scene)&&alive(s,id))),
  c('watchignition','在安全石地等待，允许已预告的点火发生','明确选择不拦截；只点现有后门焦油，不产生额外桶。',(s,a,ctx)=>{if(F(s).fire==='contained'||F(s).ignitersSeized||F(s).ignitersSoaked||F(s).odon!=='active')throw Error('危险已被解除，没有可执行点火者，不能为了剧情复燃。');if(!F(s).odonApproaching)throw Error('尚无已预告、真实在场的点火行动。');s.campaign.fireZones=[{id:'beam',x:42.5,y:40,w:5,h:5,kind:'fire',label:'后门梁脚焦油火',warned:true}];F(s).fire='burning';F(s).beamWarning=true;F(s).firecordKnown=true;ctx.say('奥东用实际火具点燃后门梁脚。木梁开始烧，西棚有烟，北门开放。梁架开裂已预告：至少每位角色一个完整回合可撤开、支撑或灭火；不会立刻坍落杀人。');},s=>F(s).odonApproaching&&F(s).odon==='active'&&!F(s).ignitersSeized&&!F(s).ignitersSoaked&&!s.campaign.fireZones.length&&F(s).fire!=='contained'&&F(s).fire!=='destroyed'&&noCombat(s)),
  c('extinguish','用湿砂、湿帆覆盖后门5尺火区','一个Utilize直接处理这处火，先靠近安全边缘。',(s,a,ctx)=>{useAt(s,a,ctx,42.5,42.5,10);emptyFire(s,ctx);F(s).firecord=true;F(s).beamTarRemoved=true;},s=>s.campaign.fireZones.length>0,{at:{x:42.5,y:42.5,range:10},combat:true}),
  c('abandon','撤开人群，任已起火的盐仓燃尽','明确放弃建筑，先确认仓中无人被留在危险处；30分钟后主体无法使用。',(s,a,ctx)=>{const trapped=targetIds.filter(id=>alive(s,id)&&!N(s,id).safe&&samePlace(N(s,id).location,s.scene));if(trapped.length)throw Error('仍有未脱险者：'+trapped.map(id=>N(s,id).name).join('、')+'。先给出真实救援或当面明确放弃，由主持按现场因果处理。');progressTime(s,30,ctx);s.campaign.fireZones=[];F(s).fire='destroyed';F(s).warehouseYielded=true;F(s).odon='escaped';neutral(s,['odon','loyal1','loyal2'],'离场');for(const id of ['odon','loyal1','loyal2'])if(alive(s,id))relocate(s,id,'火后离场，去向未控制',{status:'已离开'});ctx.say('街坊清空相邻空地，火不自动吞城。盐仓主体损毁、今夜不能使用；已经安全的人仍然安全，不补死人。');},s=>F(s).fire==='burning'&&noCombat(s)),
  c('house','请烬客试住修好的炉家，明确照看与离开方式','完好铜盂或耐热石盆、湿石冷座、2尺隔离；符合愿望自动同意，可提前完成。',(s,a,ctx)=>{if(!alive(s,'ember'))throw Error('烬客已经死亡，不能自动复生。');useAt(s,a,ctx,7.5,52.5);F(s).ember='housed';F(s).emberConsent=true;relocate(s,'ember',s.scene,{safe:true,position:[7.5,52.5],status:'自愿安居修复炉家'});s.campaign.items.basin.holder='炉间冷座';s.campaign.items.basin.location=s.scene;neutral(s,['ember'],'已安居');promise(s,'ember-home','自愿轮班照看冷座，保留烬客自行离开的方向','已落实');ctx.say('它指出一块过近的旧布，移开后绕石槽一圈：“可以住。”安家现在已经真实完成；仓外尚未处理的纵火准备仍须继续解决。');},s=>F(s).coldSeat&&F(s).basinRecovered&&F(s).ember==='unsettled'&&['prepared','contained'].includes(F(s).fire)&&!s.campaign.fireZones.length&&noCombat(s),{at:{x:7.5,y:52.5,range:7.5}}),
  c('free','护送烬客去120尺外石滩独立安家','岸路与船都可到；高于水线、石盆隔热、防风石、清浮木，由它接受。',(s,a,ctx)=>{if(!alive(s,'ember'))throw Error('烬客已经死亡，不能写成自由。');progressTime(s,10,ctx);F(s).ember='free';F(s).emberConsent=true;relocate(s,'ember','离木屋120尺的无植被石滩',{safe:true,status:'同意石滩独立安家'});s.campaign.items.basin.holder='烬客';s.campaign.items.basin.location='石滩';neutral(s,['ember'],'自愿独立安家');promise(s,'ember-free','安全石盆高于当夜水线，烬客可拒绝转卖，双方同意后再与陶匠合作','已落实');ctx.say('它看过高平台、防风石和清开的浮木：“这里。自己住。”它承诺不伤来访者；这同样支持共同守仓结局。');},s=>F(s).basinRecovered&&F(s).ember==='unsettled'&&noCombat(s)),
  c('embertalk','先听烬客与当事人表达意见','可选择协商、离开或战斗；先预告它会自卫。',(s,a,ctx)=>{F(s).emberDiscussion=true;ctx.say('烬客：“别卖。木头会烧。水别灌进来。”仍能表达的布特鲁斯希望它活，阿黛拉希望它自己决定；他们不会因你有不同看法就自动成为敌人。');},s=>F(s).basinRecovered&&F(s).ember==='unsettled'&&!F(s).emberDiscussion),
  c('emberfight','明确选择消灭烬客，让旁人撤开后进入敌对','这是可选战斗；无死亡爆炸，冷伤易伤，退开20尺停攻可停手。',(s,a,ctx)=>{let em=s.actors.find(t=>t.npcId==='ember');if(!em){const n=N(s,'ember');if(n.actor?.dead)throw Error('烬客已经死亡。');em=n.actor?structuredClone(n.actor):makeNPC('ember','ember','烬客',12.5,52.5,'enemy');em.x=12.5;em.y=52.5;em.location=s.scene;em.side='enemy';s.actors.push(em);n.location=s.scene;n.x=12.5;n.y=52.5;}em.side='enemy';F(s).emberHostile=true;ctx.say('旁人沿北门撤开。烬客缩火预警后自卫，只攻击正在强迫它的人。现在可按通常先攻行动；停手退20尺或摆出安全冷座，它会停下。');},s=>F(s).basinRecovered&&F(s).ember==='unsettled'&&F(s).emberDiscussion&&!F(s).emberHostile&&noCombat(s)),
  c('emberstop','停止攻击，全队退开20尺，请烬客停手','实际距离满足后停战，生命与已用资源保留。',(s,a,ctx)=>{const em=s.actors.find(t=>t.npcId==='ember');if(!em||em.dead)throw Error('烬客不在场或已经死亡。');if(!s.actors.filter(t=>t.side==='party'&&t.hp>0&&!t.dead).every(t=>Math.max(Math.abs(t.x-em.x),Math.abs(t.y-em.y))>=20))throw Error('仍有同伴在它20尺内；先实际退开。');neutral(s,['ember'],'停手，住处待谈');F(s).emberHostile=false;ctx.say('它停止追击，缩回铜盂。没有追杀倒地者；以后可继续安家或选择离开。');},s=>F(s).emberHostile&&alive(s,'ember'),{combat:true}),
  c('finish','点四人姓名，核对仓体与烬客，再去天亮交接','未决事项原样保留，可进入开放结局；不新增灾难。',(s,a,ctx)=>{reconcile(s);finish(s,5,`四人：${F(s).people}；仓库：${F(s).fire}；烬客：${F(s).ember}；奥东：${F(s).odon}。`);ctx.say(F(s).people==='safe'&&F(s).fire==='contained'&&['housed','free'].includes(F(s).ember)?'四个人都在安全处，木梁没有再烧，炉家或石滩已经稳定。你们把三件事都办到了。':'完成的救援与防火照常有效，未决事项带到公开交接；可以先补做，也可以明确以开放结果结束。');},noCombat)
 ],
 6:[
  c('gather','逐名点人，听仍能表达者提出要求','H05逐件发出；伤重者保留工具与权利，亡者不被代言。',(s,a,ctx)=>{F(s).finalRollCall=true;publish(s,'H05');gatherSurvivors(s,ctx);hearPeople(s,ctx);for(const id of targetIds)ctx.say(`${N(s,id).name}：${N(s,id).location}；${A(s,id)?.dead?'死亡':(A(s,id)?.hp??4)===0?(A(s,id)?.stable?'0HP已稳定，仍需照顾':'0HP未稳定，立即急救'):'生还'}。`);ctx.say('只听仍能当面表达者确认要求；失能或缺席者的工具与权利保留，不能替他们同意出售。实际做过的授权另行记下。');},s=>!F(s).finalRollCall),
  c('sharedterms','逐项商定共同使用的安全分工','当事人愿意继续：门内开启、火具隔离、轮班照看、安全退出。',(s,a,ctx)=>{if(!allConsent(s))throw Error('四人须生还脱险且能真实表达同意；伤重者保留权利，不由一次骰代签。');F(s).sharedTerms=true;promise(s,'shared-plan','玛尔塔与尤素夫轮看出口，布特鲁斯教冷座，阿黛拉参与轮班；火具由知情街坊隔离，谁想退出可先取工具','已同意');ctx.say('四人分别答复并同意这项分工；玩家无需接管仓库，没有人必须放弃姓名、信仰或手艺。');},s=>F(s).finalRollCall&&F(s).people==='safe'&&F(s).fire==='contained'&&['housed','free'].includes(F(s).ember)&&!F(s).sharedTerms),
  c('shared','公开确认共同守仓','四人已逐一同意，安全分工与火灵去处落实。',(s,a,ctx)=>{if(!allConsent(s))throw Error('尚有不能表达同意者。');F(s).compact='shared';ctx.say('钥匙挂回大家知道的钉子上。共同使用的约定被当面复述，烬客的自愿住处保留。');},s=>F(s).sharedTerms&&F(s).fire==='contained'&&['housed','free'].includes(F(s).ember)&&F(s).compact!=='shared'),
  c('privateoffer','提出由本队临时照看，原住户自愿退出','归还全部工具、实际协助搬去岸屋、保留房地权利；不买卖缺席仓主房产。',(s,a,ctx)=>{if(!allConsent(s))throw Error('不能替死亡、失能或不在场权利人承诺退出。');F(s).privateOffer=true;ctx.say('玛尔塔同意把今晚保管交接给愿担责者，尤素夫保有小舟；布特鲁斯、阿黛拉同意携工具去岸屋。补偿为本队实际搬运、修补工具和代寻下处，今晚使用安排不冒充永久产权。');promise(s,'private-move',F(s).toolsReturned?'工具已通过本队实际劳动或已约定合作者完成点交；原住户权利保留':'队伍归还原住户工具、小舟和帆，并实际落实搬运；原有权利保留',F(s).toolsReturned?'已履行':'待履行');},s=>F(s).finalRollCall&&F(s).people==='safe'&&F(s).fire==='contained'&&F(s).ember!=='unsettled'&&!F(s).privateOffer),
  c('private','公开确认私人临时承接','四人此前已明确同意，工具与搬运实际兑现。',(s,a,ctx)=>{if(!allConsent(s))throw Error('尚有当事人无法确认同意。');F(s).compact='private';F(s).privateCustodian=a.name;ctx.say(`${a.name}代表本队接今晚照看，原住户保留工具与未来主张。这是已同意的现阶段使用安排，不是永久出售。`);},s=>F(s).privateOffer&&F(s).toolsReturned&&F(s).fire==='contained'&&F(s).ember!=='unsettled'&&F(s).compact!=='private'),
  c('evacuate','四人共同选择今夜离开，到岸屋安顿','逐人同意，北门石路已确认；小艇只负责伤者或分趟运物。',(s,a,ctx)=>{if(!allConsent(s))throw Error('四人须脱险且能表达自愿撤离；失能者按此前真实授权保留权利，由主持另行裁定。');F(s).compact='evacuated';F(s).evacuationRoute=true;F(s).evacuationDestination='汉娜熟悉的岸屋，沿北门石路';for(const id of targetIds){relocate(s,id,'S01',{safe:true,position:shoreSpots[id],status:'自愿撤离，岸屋安顿'});N(s,id).locationLabel='汉娜的岸屋 / 岸边安全石地';}if(F(s).fire==='burning')promise(s,'fire-handover','街坊已知火区，清空相邻空地，队伍将仍在燃烧的危险如实交接','已通知');ctx.say('最后一次点名，四个名字都有人应答。未来可回来主张工具与使用权，不要求永久放弃。仍在燃烧的火如实通知，烬客实际去处另记。');},s=>F(s).finalRollCall&&F(s).people==='safe'&&F(s).compact!=='evacuated'),
  c('open','保留共同安排，不替当事人决定生活','救援与防火成功保留；分别记录工具与去处。',(s,a,ctx)=>{F(s).compact='none';F(s).arrangementDeferred=true;ctx.say('众人决定先照顾人、保存工具，之后再谈使用安排。没有签约不会撤销已经成功的行动。');},s=>F(s).finalRollCall&&!F(s).arrangementDeferred),
  c('justice','如实交接奥东与证据，保留受害者决定权','拘留、逃走、死亡分别说明，不虚构今夜完整法庭。',(s,a,ctx)=>{F(s).responsibilityHeard=true;ctx.say(`奥东：${F(s).odon}；证据：${F(s).proof}。${F(s).odon==='dead'?'尸体、亲友与未付工钱均照实际记录，死亡不自动替代赔偿。':F(s).odon==='escaped'?'他已离开控制，证词仍可继续追索；本夜不会秘密回来毁掉成功。':'实际看守和未来向有权受理者陈述由当事人继续决定。'}见证不保证定罪，也不替受害者放弃追究。`);},s=>F(s).finalRollCall&&!F(s).responsibilityHeard),
  c('epilogue','为所选角色留一个具体尾声','说他归还什么、向谁道谢、带走什么；不强制留下、转信或悔悟。',(s,a,ctx)=>{s.campaign.endings[a.id]={actor:a.id,name:a.name,status:a.dead?'死亡':a.hp===0?'等待治疗':'生还',destination:'由玩家自行叙述的小事',items:Object.values(s.campaign.items).filter(i=>i.holder===a.id).map(i=>i.name)};ctx.say(`${a.name}留下自己的最后一个小镜头。已有人回应的邀请、保有的工具与未完承诺按实际保存。`);},s=>F(s).finalRollCall),
  c('final','核对事实，读本夜主结局并保存','按E0→E1→E2→E3→E4→E5，其他事实叠入尾声；本场不自动升到高等级。',(s,a,ctx)=>finalize(s,ctx),s=>F(s).finalRollCall&&!s.campaign.ended&&noCombat(s))
 ]
};

function sceneOptions(s,ctx){const n=maps.indexOf(s.scene)+1;const out=[...(chapterChoices[n]||[])];if(W(s))out.unshift(...commonWarehouseOptions(s));if(n===2)out.push(chapterChoices[5].find(o=>o.id==='house'));return [...out.filter(o=>!['wages','tools'].includes(o.id)),...aftercareOptions(s,{progress:minutes=>progressTime(s,minutes,ctx),say:text=>ctx.say(text)})];}
function readState(s){const copy=structuredClone(s);ensureCampaign(copy);reconcile(copy);return copy;}
export function initializeChapter(s,n){const p=ensureCampaign(s);if(!Number.isInteger(n)||n<1||n>6)throw Error('本冒险只有六景。');p.nodes[n]||='arrival';p.chapters[n]||={visited:true,completed:false};p.chapters[n].visited=true;for(const [id,d] of Object.entries(definitions))if(samePlace(N(s,id).location,s.scene)&&(!['odon','loyal1','loyal2'].includes(id)||s.scene==='S04'||F(s).odonApproaching))mark(s,id);}
export function campaignOptions(source){
 const s=readState(source),p=s.campaign;if(p.ended)return [];
 const opts=sceneOptions(s).filter(o=>o.when(s)&&(!s.combat||o.combat)).map(({id,label,text,combat,at})=>({id:`c${maps.indexOf(s.scene)+1}:${id}`,label,text,combat:!!combat,...(at?{at}:{} )}));
 if(!s.combat){
  const next=maps.indexOf(s.scene)+2;if(next<=6&&F(s).infoKnown)opts.push({id:'campaign:next',label:`前往第${next}景 · ${titles[next-1]}`,text:'保留所有人物、火源、资源与已完成行动；未处理目标仍会在任务中列出。'});
  if(F(s).infoKnown)for(let i=0;i<6;i++)if(maps[i]!==s.scene)opts.push({id:`route:${maps[i]}`,label:`改走 · ${titles[i]}`,text:'场景可调序；真实路线开放，未救者与未处理危险不会自动解决。'});
  opts.push({id:'campaign:withdraw',label:'明确退出本次委托并收束',text:'保留已经完成的帮助；未知者仍写未确认，不自动救出或判死。'});
 }
 return opts;
}
export function campaignChoice(s,a,id,ctx){
 ensureCampaign(s);if(!['campaign:next','campaign:withdraw'].includes(id)&&!id?.startsWith('route:')&&!/^c[1-6]:/.test(id))return false;
 if(s.campaign.ended)throw Error('本夜已经收束，可由主持另开后续或继续查看档案。');
 if(a.dead||a.hp<=0)throw Error('该角色现在不能采取行动；先按真实规则急救或恢复。');
 if(id==='campaign:withdraw'){if(s.combat)throw Error('先按实际退路脱离遭遇。');F(s).withdrawn=true;ctx.log('choice',`${a.name}明确退出本次委托。`);finalize(s,ctx);return true;}
 if(id==='campaign:next'||id.startsWith('route:')){
  if(s.combat)throw Error('先处理当前遭遇或实际撤退。');const scene=id==='campaign:next'?maps[maps.indexOf(s.scene)+1]:id.slice(6);if(!maps.includes(scene))throw Error('未知场景。');if(!F(s).infoKnown)throw Error('先听清路线与住户处境。');syncNPCs(s);s.chapter=maps.indexOf(scene)+1;initializeChapter(s,s.chapter);ctx.enter(scene);initializeChapter(s,s.chapter);ctx.say(descriptions[s.chapter-1]);return true;
 }
 const n=maps.indexOf(s.scene)+1;if(!id.startsWith(`c${n}:`))throw Error('该行动不属于当前场景。');const key=id.split(':')[1],o=sceneOptions(s,ctx).find(q=>q.id===key&&q.when(s)&&(!s.combat||q.combat));if(!o)throw Error('这个行动当前不可用。');
 ctx.log('choice',`${a.name}：${o.label}`);o.run(s,a,ctx);s.campaign.nodes[n]=key;syncNPCs(s);reconcile(s);const ledger={source:'aftercare',title:'夜火余账 · 公开事实',text:aftercareSummary(s).join('\n')};const old=s.journal.find(j=>j.source==='aftercare');if(old)Object.assign(old,ledger);else s.journal.push(ledger);return true;
}
export function syncNPCs(s){
 const p=ensureCampaign(s);for(const a of s.actors.filter(a=>a.npcId)){const n=p.npcs[a.npcId];if(!n)continue;n.actor=structuredClone(a);n.actor.location=s.scene;n.x=a.x;n.y=a.y;n.location=s.scene;n.met=true;if(a.dead){n.status='死亡';n.safe=false;}else if(a.hp<=0)n.status=a.stable?'0HP已稳定，待照看':'0HP未稳定，须急救';else if(controlled(a))n.status='失能，尚不能表达';else if(n.status==='死亡'){n.status='真实恢复生还，须重新确认安全';n.safe=false;}else if(n.status.startsWith('0HP')||n.status==='失能，尚不能表达')n.status=n.safe?'已治疗，安全照看':'生还，在场';else if(n.status==='尚未确认')n.status='在场';}
 const x=p.facts,od=A(s,'odon'),loyalDead=['loyal1','loyal2'].some(id=>A(s,id)?.dead||A(s,id)?.hp===0),down=s.actors.filter(a=>a.side==='party'&&(a.hp<=0||a.dead)).length;
 if(x.odon==='active'&&(od?.hp<=26||loyalDead||down>=2))x.surrenderOffered=true;
 reconcile(s);
 if(x.warehouseSurvey&&x.rackRemoved&&!p.chapters[2]?.completed)finish(s,2,'盐仓布局、纵火布置与两条救援路线已查明；布特鲁斯已脱离木架，其他进展照事实保存。');
}
export function campaignEncounter(s,id,templates={}){
 const p=ensureCampaign(s);return Object.entries(definitions).flatMap(([npcId,d])=>{
  const n=p.npcs[npcId];if(!samePlace(n.location,id)||n.actor?.departed||n.status==='已离开')return [];
  let a=n.actor?structuredClone(n.actor):templates[d.type]?{...structuredClone(templates[d.type]),id:npcId,npcId,type:d.type,name:d.name,x:n.x,y:n.y,hp:templates[d.type].maxHp,side:d.side||'neutral',conditions:[],effects:[],reaction:true,death:[0,0],controller:'local'}:makeNPC(d.type,npcId,d.name,n.x,n.y,d.side||'neutral');
  a.npcId=npcId;a.id=npcId;a.x=n.x;a.y=n.y;a.location=id;a.controller='local';a.death||=[0,0];a.conditions||=[];a.effects||=[];
  if(d.type==='commoner'){a.deathSaves=true;a.vital=targetIds.includes(npcId)||npcId==='hanna';a.training=d.training;a.skills={...(a.skills||{}),[d.training||'survival']:2};a.skillAdvantages=d.training?[d.training]:[];}
  if(['odon','loyal1','loyal2'].includes(npcId)&&(p.facts.odon!=='active'||n.status.includes('停')||n.status.includes('缴械')||n.status.includes('拘留')))a.side='neutral';
  if(npcId==='ember'&&!p.facts.emberHostile)a.side='neutral';n.actor=structuredClone(a);return [a];
 });
}
export const chapterStart=n=>maps[n-1];
export function firstChapterFinished(s){finish(s,1,'岸边事故已处理，路线已明确。');}
export function safeRest(s){const x=F(s);return !s.combat&&N(s,'adela').safe&&N(s,'butrus').safe&&!s.campaign.fireZones.length&&(x.fire==='contained'||x.fire==='destroyed'||x.firecord&&x.tarWarehouseA&&x.tarWarehouseB);}

// Called only after the engine has validated and actually cast a spell.
// Explicit scene objects respond to real effects; closed barrels do not teleport.
export function applyEnvironmentalSpell(s,a,key,options={},ctx){
 if(key!=='createwater')return false;
 const p=ensureCampaign(s),x=p.facts,origin={x:Number.isFinite(options.x)?options.x:a.x,y:Number.isFinite(options.y)?options.y:a.y},half=15+2.5*Math.max(0,(options.slot||1)-1);
 const inside=(xx,yy)=>Math.abs(xx-origin.x)<=half&&Math.abs(yy-origin.y)<=half;
 if(s.scene==='S01'&&inside(22.5,17.5)){x.cartFireOut=true;ctx?.say('造水术的雨淋透车板，灯火真实熄灭；车本身仍需系绳或拖开。');}
 if(['S02','S05'].includes(s.scene)){
  const before=p.fireZones.length;p.fireZones=p.fireZones.filter(z=>!inside(z.x+z.w/2,z.y+z.h/2));
  if(before!==p.fireZones.length)ctx?.say('指定30尺立方内的暴露后门火焰被造水术扑灭，没有额外灭火检定。');
  if(inside(42.5,42.5)&&inside(37.5,57.5)){x.firecord=true;x.firecordSoaked=true;ctx?.say('雨覆盖整段暴露火绳，火绳已经浸透失效。封闭焦油桶仍须搬离，仓体损失不会复原。');}
  if(!p.fireZones.length)x.beamWarning=false;
 }
 if(s.scene==='S04'&&inside(47.5,2.5)){x.ignitersSoaked=true;ctx?.say('北箱上暴露的火麻与点火棒已经浸透，暂失点火作用；没有把封闭焦油桶自动处理掉。');}
 reconcile(s);return true;
}

// Fire is an ordinary, explicitly marked environmental encounter. This hook does
// not move time for table discussion or create new fire sources.
export function applyCampaignHazards(s,a,ctx,phase='move'){
 const p=ensureCampaign(s),x=p.facts;
 if(phase==='start'){p.hazardHits={};p.beamWarnedRound=s.combat?.round??1;return;}
 if(!p.fireZones.length){p.hazardHits={};return;}
 const inside=(t,r)=>t.x>=r.x&&t.x<r.x+r.w&&t.y>=r.y&&t.y<r.y+r.h;
 if(a&&!a.dead&&p.fireZones.some(z=>inside(a,z))){
  p.hazardHits||={};const stamp=s.combat?`${s.combat.round}`:`outside-${s.revision}`;
  if(p.hazardHits[a.id]!==stamp){p.hazardHits[a.id]=stamp;ctx.log('rule',`${a.name}进入或结束回合于已标明的高热格：敏捷DC12，每人每轮至多一次。`);if(!ctx.save(a,1,12))ctx.hurt(a,ctx.roll('1d6').total,'fire');}
 }
 if(phase==='end'&&s.combat&&x.beamWarning&&!x.beamCollapsed){
  p.beamWarnedRound??=s.combat.round;
  if(s.combat.round>p.beamWarnedRound){
   const fall={x:42.5,y:40,w:10,h:5,kind:'difficult',label:'已预告落梁 / 困难地形',difficult:true};x.beamCollapsed=true;x.beamWarning=false;p.debris||=[];p.debris.push(fall);
   ctx.say('持续受火的梁脚断落到已预告的10×5尺范围。所有人已获得一个完整回合；本处只结算一次，留下可绕行的困难地形，不压埋或封死出口。');
   for(const t of [...s.actors].filter(t=>!t.dead&&inside(t,fall))){
    if(!ctx.save(t,1,12)){ctx.hurt(t,ctx.roll('1d6').total,'bludgeoning');t.prone=true;}
    else {for(const [dx,dy] of [[0,-5],[-5,0],[0,5],[5,0]]){const candidate={x:t.x+dx,y:t.y+dy};if(inside(candidate,fall)||p.fireZones.some(z=>inside(candidate,z)))continue;try{ctx.validPosition(t,candidate);t.x=candidate.x;t.y=candidate.y;break;}catch{}}}
   }
  }
 }
 syncNPCs(s);
}

const endingTexts={
 E0:{title:'把路让给别人',text:'你们没有接下今夜所有的重量。已经做过的事留下了效果，没做的事也有名字。海岸仍有人奔走，天亮时，这段故事会有人从另一头继续讲。'},
 E1:{title:'共同守仓',text:'第一缕晨光照进院子时，门从里面打开。四个人都在，名字都点过，湿石上的火已经安静。钥匙挂回所有人知道的钉子，旁边添了新的约定。阿黛拉望向炉间，或远处石滩，等一个小小声音回答：“可以住。”'},
 E2:{title:'一扇重新认人的门',text:'盐仓的门还在，开门的人换了安排。工具一件件交还，承诺当面说清，谁留下、谁走，不再由一场火替他们决定。你们救下的是明天仍能各走一步的人。'},
 E3:{title:'全员离岸',text:'小艇没有一趟装完所有东西，所以它回来了一次。北面的石路上人扶着人走，最后一次点名，四个名字都有人应答。房子可能仍站着，也可能只剩黑色轮廓；没人需要为了证明勇敢重新走回火里。'},
 E4:{title:'余烬后的清晨',text:'天亮照见昨夜没有保住的东西。有人数着剩下的工具，有人再没有可以回答的声音；那些名字不会被一个“至少”带过去。但确实完成的帮助仍在，明天第一件事由仍在这里的人决定。'},
 E5:{title:'还没有说完的话',text:'灯还没有全部熄下，话也还没说完。完成的行动仍然有效，剩下的事不会因为天亮自动得到答案。空凳留给还没回来的人；也许只差一次诚实谈话，也许还有一条必须重新走的路。'}
};
export function endingFor(source){const s=readState(source),x=s.campaign.facts;if(x.withdrawn===true||x.withdrawn==='true')return {id:'E0',...endingTexts.E0};if(x.people==='safe'&&x.fire==='contained'&&['housed','free'].includes(x.ember)&&x.compact==='shared')return {id:'E1',...endingTexts.E1};if(x.people==='safe'&&x.fire==='contained'&&['housed','free','destroyed'].includes(x.ember)&&x.compact==='private')return {id:'E2',...endingTexts.E2};if(x.people==='safe'&&x.compact==='evacuated')return {id:'E3',...endingTexts.E3};if(x.people==='dead'||x.fire==='destroyed')return {id:'E4',...endingTexts.E4};return {id:'E5',...endingTexts.E5};}
function pending(s){const x=F(s),out=[];for(const id of targetIds){const n=N(s,id),a=A(s,id);if(a?.dead)out.push(`${n.name}确认死亡，照顾幸存者并记录后果`);else if(!n.safe)out.push(`确认${n.name}脱险与实际去处`);else if(a?.hp===0&&!a.stable)out.push(`立即稳定或治疗${n.name}`);}if(!x.firecord)out.push('剪断后门火绳并清理梁脚');if(!x.tarWarehouseA||!x.tarWarehouseB)out.push('隔离仓后两桶火具');if(!x.tarRopeyard)out.push('处理绳场唯一备用桶');if(x.fire==='burning')out.push('扑灭现有火区或明确交接撤离');if(x.odon==='active'&&!x.ignitersSeized&&!x.ignitersSoaked&&x.fire!=='contained')out.push('制止奥东继续取得点火机会');if(x.ember==='unsettled')out.push('向烬客落实获其接受的安全住处');if(x.compact==='none')out.push('后续使用安排仍保留');return out;}
function finalize(s,ctx){
 syncNPCs(s);const p=ensureCampaign(s),x=p.facts,ending=endingFor(s);p.ending={...ending,facts:structuredClone(x),people:targetIds.map(id=>({id,name:N(s,id).name,location:N(s,id).locationLabel||N(s,id).location,status:N(s,id).status,hp:A(s,id)?.hp??4,dead:!!A(s,id)?.dead,stable:!!A(s,id)?.stable})),pending:pending(s),time:new Date().toISOString()};p.ended=true;
 if(p.rewards.completion===undefined&&x.accepted&&!x.withdrawn){const balance=remainingReward(s);p.rewards.completion=balance;s.gold+=balance;ctx.say(`全队报酬总额40GP，已预支${p.aftercare.advance}GP，天亮实付${balance}GP。和平、救援和协商不比击杀少拿奖励；本场仍为3级。`);}
 p.ending.consequences=aftercareEnding(s,ending.id);p.ending.text+='\n\n'+p.ending.consequences.join('\n');const ledger=s.journal.find(j=>j.source==='aftercare');if(ledger)ledger.text=aftercareSummary(s).join('\n');for(const line of p.ending.consequences)ctx.say(line);
 finish(s,6,`${ending.id} · ${ending.title}。四人：${x.people}；仓体：${x.fire}；烬客：${x.ember}；安排：${x.compact}。`);ctx.say(`${ending.id} · ${ending.title}\n${ending.id==='E3'&&(!alive(s,'hanna')||x.boatDamaged)?'北面的石路上，人扶着人走。最后一次点名，四个名字都有人应答。身后的房子可能仍站着，也可能只剩黑色轮廓；此刻没人需要为了证明勇敢重新走回火里。':ending.text}`);for(const person of p.ending.people)ctx.say(`${person.name}：${person.dead?'死亡':person.hp===0?(person.stable?'已稳定，仍需照看':'未稳定，立即急救'):person.status}；${person.location}。`);
 if(x.ember==='destroyed')ctx.say('炉盆里没有声音。有人难过，有人松一口气；这个决定会被记住，没有安慰性复生。');if(x.fire==='contained'&&x.people==='safe'&&x.compact==='none')ctx.say('救援与防火成功；后续使用安排保留。');if(p.ending.pending.length)ctx.say('仍需回应：'+p.ending.pending.slice(0,4).join('；')+'。');
}
export function campaignView(source){
 const s=readState(source),p=s.campaign,x=p.facts,n=maps.indexOf(s.scene)+1||s.chapter||1;
 const objectives={1:[['cart','稳住滑车',x.cartSecured],['lamp','扑灭车板灯火',x.cartFireOut],['routes','听清四人位置与两条路线',x.infoKnown]],2:[['butrus','移架救出布特鲁斯',x.rackRemoved],['sources','处理仓后两桶与火绳',x.firecord&&x.tarWarehouseA&&x.tarWarehouseB],['seat','修好安全冷座',x.coldSeat]],3:[['adela','接出阿黛拉并确认安全',N(s,'adela').safe],['basin','安全取出或委托运输铜盂',x.basinRecovered]],4:[['workers','让达乌德停止危险清场',x.dawudStopped],['tools','控制备用桶和点火物',x.tarRopeyard&&x.ignitersSeized],['odon','记录奥东真实去向',x.odon!=='active']],5:[['people','四位目标生还并脱险',x.people==='safe'],['fire','确认仓区安全或实际损毁',x.fire==='contained'||x.fire==='destroyed'],['ember','烬客获得真实结局',x.ember!=='unsettled']],6:[['roll','逐名核对位置、生命与意见',x.finalRollCall],['compact','记录当事人的安排',x.compact!=='none'||x.arrangementDeferred],['final','保存本夜主结局',p.ended]]};
 return {chapter:n,title:titles[n-1],entryLevel:3,milestoneLevel:3,node:p.nodes[n]||'arrival',description:descriptions[n-1],objectives:(objectives[n]||[]).map(([id,label,done])=>({id,label,status:done?'完成':'进行中'})),npcs:Object.values(p.npcs).filter(q=>q.met).map(q=>({id:q.id,name:q.name,status:q.status,attitude:q.attitude,location:q.locationLabel||q.location,mapLocation:q.location,hp:q.actor?.hp??(q.id==='odon'?52:q.id==='ember'?22:['dawud','loyal1','loyal2'].includes(q.id)?11:4),maxHp:q.actor?.maxHp,safe:q.safe,dead:!!q.actor?.dead})),items:Object.values(p.items).filter(i=>i.id!=='basin'||x.infoKnown).map(i=>({...i})),promises:p.promises,completed:!!p.chapters[n]?.completed,canAdvance:n<6&&!s.combat,chapters:maps.map((id,i)=>({id,number:i+1,title:titles[i],visited:!!p.chapters[i+1]?.visited,completed:!!p.chapters[i+1]?.completed})),facts:{...x},fireSources:[{id:'warehouse-a',label:'仓后焦油桶一',resolved:!!x.tarWarehouseA},{id:'warehouse-b',label:'仓后焦油桶二',resolved:!!x.tarWarehouseB},{id:'ropeyard',label:'绳场唯一备用桶',resolved:!!x.tarRopeyard},{id:'firecord',label:'后门火绳 / 梁脚',resolved:!!x.firecord}],fireZones:p.fireZones,pending:pending(s),ending:p.ending||null,endings:Object.values(p.endings),ended:!!p.ended,options:campaignOptions(s)};
}
