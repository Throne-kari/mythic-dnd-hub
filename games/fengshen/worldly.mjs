import {createIntrigue, exclusiveRelief, patronAccount, independentAccount} from './intrigue.mjs';
// Authored extension to the actual twelve-chapter v0.2 campaign.
// Only facts already chosen or revealed are stored in the shared room state.
export function createWorldly(api) {
 const {c,f,ensureCampaign,grant,transferItem,partyHolds,promise,fulfill,reward,potions,neutralize,canTalk,noBattle,recordEnding}=api;
 const {intrigueChoices,intrigueConsequences,intrigueDescription}=createIntrigue(api);
 const spent=(s,n)=>{if(!Number.isFinite(s.gold)||s.gold<n)throw Error(`队伍资金不足 ${n} GP；没有扣款，可换另一条路。`);s.gold-=n;};
 const note=(s,title,text)=>s.journal.push({title,text});
 const once=(s,k)=>!f(s)[k];
 const unallocated=s=>Number(f(s).supplies||0)>0&&!f(s).supplyPolicy;
 const clinic=s=>Number(f(s).supplyCivil||0)>=12;
 const army=s=>Number(f(s).supplyArmy||0)>=6;
 const clinicReady=s=>clinic(s)&&canTalk(s,'worldly-yu');
 const armyReady=s=>army(s)&&canTalk(s,'worldly-engineers');
 const witnessConsents=(s,id)=>{if(!canTalk(s,id))return false;const a=s.actors.find(t=>t.npcId===id)||ensureCampaign(s).npcs[id]?.actor;return !a||!((a.conditions||[]).some(c=>/^(?:魅惑|支配|charmed\b|dominated\b)/i.test(String(c)))||(a.effects||[]).some(e=>(!e.expiresAt||e.expiresAt>s.time)&&(/^(?:charmed|dominated)$/.test(e.condition||'')||e.charm||e.controlled)));};
 const held=s=>{const i=ensureCampaign(s).items['relief-reserve'];return partyHolds(s,i)&&!i.destroyed?Number(i.count||0):0;};
 function allocate(s,policy){const x=f(s),n=Number(x.supplies||0);if(n<=0||x.supplyPolicy)throw Error('尚无未分配的真实粮药。');x.supplyPolicy=policy;x.supplyCivil=policy==='civil'?12:0;x.supplyArmy=policy==='army'?n:policy==='civil'?n-12:0;grant(s,'relief-reserve','追回粮药待支配包',{kind:'relief',count:policy==='reserve'?n:0,holder:policy==='reserve'?'party':'已按单交付'});note(s,'粮药交割单',`实际追回 ${n} 包：民诊 ${x.supplyCivil}，军需 ${x.supplyArmy}，队伍留存 ${policy==='reserve'?n:0}。原救援与追回报酬照付。`);}
 function donateHeld(s,n,destination){const i=ensureCampaign(s).items['relief-reserve'];if(held(s)<n)throw Error(`队伍实际持有的待支配粮药不足 ${n} 包。`);i.count-=n;if(!i.count)transferItem(s,i.id,'已交付');f(s)[destination]=Number(f(s)[destination]||0)+n;}
 const hanPresent=s=>canTalk(s,'hanbian');
 function settleClaims(s,ctx,method){f(s).claimsSettled=true;f(s).claimsMethod=method;fulfill(s,'han-review');neutralize(s,['claim-1','claim-2']);ctx.say('复核确认：旧日合法军饷、已救者和已成通路不撤回。争议只针对新加的限名附件；封签依法解除，留下已核副账。仅仍在场且清醒的护卫参与见证，真实伤亡不改写。');grant(s,'han-counterledger','北门已核守务副账',{kind:'document'});}
 function initializeWorldly(s,n){const p=ensureCampaign(s);if(n===3)p.npcs['worldly-yu']||={id:'worldly-yu',name:'余萤（成年医官）',status:'在民诊',attitude:'独立合作',revealedChapter:3};if(n===6&&army(s))p.npcs['worldly-engineers']||={id:'worldly-engineers',name:'粮药工兵组',status:'在替代路营地',attitude:'依实物交割合作',revealedChapter:6};}
 const appointment=(s,a,id,title,stipend,duty)=>{recordEnding(s,a,title);ensureCampaign(s).endings[a.id].appointment={id,title,stipend,duty};ensureCampaign(s).endings[a.id].lastScene=`${a.name}愿意接受${title}；封卷时领取 ${stipend} GP 签约预支，并承担：${duty}。封卷前仍可改选归路。`;};
 function matureChoices(s){const x=f(s),ch=s.chapter,out=[];
  if(ch===3){
   out.push(c('supplyCivil','交十二包给民诊，余包给军需','实际消耗追回粮药；不扣原基础报酬。第六回民诊可回赠两瓶药，第十一回可协助撤营。',(s,a,ctx)=>{allocate(s,'civil');ctx.say('医官余萤把十二包逐一入账，不许军需把民诊姓名抄成征发名单。其余交程简军需，两个去处都具名签收。');},s=>unallocated(s)&&f(s).supplies>=12&&noBattle(s)));
   out.push(c('supplyArmy','把追回粮药全交军需','实际全部交付；至少六包可换第六回工兵引路与第九回一次守务酬劳，民诊不因此被追夺既有物资。',(s,a,ctx)=>{allocate(s,'army');ctx.say('程简承认军需优先会让前线更快动起来；余萤仍按原有存粮开诊，但这批新物资不能同时算给两处。');},s=>unallocated(s)&&noBattle(s)));
   out.push(c('supplyReserve','保留追回粮药，日后自己决定交付','不自动兑换金币；实物按包入队伍物件，第六回仍可捐十二包给民诊或六包给工兵。',(s,a,ctx)=>{allocate(s,'reserve');ctx.say('程简照付原追回报酬，把实物列为待支配救济物资。保留不是侵吞裁定；下一次交割仍须写清包数。');},s=>unallocated(s)&&noBattle(s)));
  }
  if(ch===6){
   out.push(c('supplyLateCivil','交留存的十二包给余萤民诊','扣实际十二包；解锁本回两瓶治疗药水与第十一回撤营协助。',(s)=>donateHeld(s,12,'supplyCivil'),s=>held(s)>=12&&!clinic(s)&&noBattle(s)));
   out.push(c('supplyLateArmy','交留存的六包给工兵','扣实际六包；本回替代山路工时从四小时降为两小时，第九回可领一次八十 GP 守务酬劳。',(s)=>donateHeld(s,6,'supplyArmy'),s=>held(s)>=6&&!army(s)&&noBattle(s)));
   out.push(c('clinicAid','领取民诊自愿回赠的两瓶治疗药水','条件：此前实际交足十二包，余萤真实可合作；不再扣 GP。两瓶分入前两名队员，限领一次。',(s,a,ctx)=>{potions(s,'worldly-clinic-two',2);x.clinicAid=true;ctx.say('余萤：“救人不是投名状。这两瓶是我们备得出的回礼。”药水按真实数量加入，不替你们恢复其他资源。');},s=>clinicReady(s)&&once(s,'clinicAid')&&noBattle(s)));
   out.push(c('engineerAid','请已获粮药的工兵勘出替代路','条件：军需实际收到至少六包且工兵组可合作；勘察半小时。原有公开撤阵与法师之手路线照常有效。',(s,a,ctx)=>{s.time+=.5;x.engineerAid=true;ctx.say('工兵在已知替代山路上标出两处软土并先铺板。选择替代通路时只需再花两小时；选正常撤阵不收回这份帮助。');},s=>armyReady(s)&&once(s,'engineerAid')&&noBattle(s)));
  }
  if(ch===7||ch===8){
   out.push(c('hanPublic','韩家附约：公开军饷与民伤补偿单','另付队伍六十 GP（民伤二十、北门解除雇约四十），不挪原欠饷。第九回可请无形客按已付酬劳终止差事。名单只含自愿签收者。',(s,a,ctx)=>{spent(s,60);x.hanPact='public';grant(s,'han-public','韩家公开补偿收据',{kind:'document',holder:'party'});promise(s,'han-public-audit','韩家与程简在第九回复核六十 GP 新补偿用途，不以谢恩名册征发居民');ctx.say('韩荣愿保住家门名声，韩变坚持保留民伤一栏。两人的欲望不尽相同，但收据可核，原离关与军饷协议照旧。');},s=>f(s).hanTerms&&!f(s).hanPact&&noBattle(s)));
   out.push(c('hanNamed','韩家附约：限具名签署者承担责任','当场零 GP；保护未签居民的姓名。第九回须复核新增附件：查账一小时，或六十 GP 争议押金，或交涉 DC15；不连坐、不交人。',(s,a,ctx)=>{x.hanPact='named';grant(s,'han-named','韩家限名责任附约',{kind:'document'});promise(s,'han-review','第九回复核限名附约，责任只及自愿具名且有具体行为的签署者；不以居民作抵押');ctx.say('韩升不肯认整关人的罪，韩变也不愿让民户姓名流入军册。你们把责任限在本人行为；文吏须按原句抄录，第九回共同复核。');},s=>f(s).hanTerms&&!f(s).hanPact&&noBattle(s)));
   out.push(c('hanOrdinary','不签额外附约，只照原交关协议','零 GP、无新增承诺。继续原有军饷、居民自由与护送条件；不取得本扩展的北门合作。',(s,a,ctx)=>{x.hanPact='ordinary';ctx.say('韩荣收回附页；已经谈成的安全离关、合法军饷与私物自留逐项照办。');},s=>f(s).hanTerms&&!f(s).hanPact&&noBattle(s)));
  }
  if(ch===9){
   out.push(c('hanPublicCall','按公开收据付清无形客终止酬劳','已在韩家附约预付四十 GP；本次不再扣钱。韩变须实际生还并能回话，无形客须仍能交谈；石像和真剑挂扣不受影响。',(s,a,ctx)=>{x.hanPublicUsed=true;neutralize(s,['stalker']);fulfill(s,'han-public-audit');grant(s,'han-counterledger','北门已核守务副账',{kind:'document'});ctx.say('韩变送来两处签收的实账；无形客核对四十 GP 已付，同意结束本次工作。他没有替你们破墙或操控石像。');},s=>x.hanPact==='public'&&hanPresent(s)&&canTalk(s,'stalker')&&!x.hanPublicUsed&&noBattle(s)));
   out.push(c('hanAuditAlone','公开收据的签署人缺席，向账吏自行核销','只核销已付四十 GP；花一小时取得副账，不假借死者或离开者发话。可再用原有交涉取剑。',(s,a,ctx)=>{s.time++;x.hanPublicUsed=true;fulfill(s,'han-public-audit');grant(s,'han-counterledger','北门已核守务副账',{kind:'document'});ctx.say('账吏核验原收据，补偿不被没收，也不伪造韩变的在场。无形客仍按实际状态处理。');},s=>x.hanPact==='public'&&!hanPresent(s)&&!x.hanPublicUsed&&noBattle(s)));
   if(x.hanPact==='named'&&!x.claimsSettled){
    out.push(c('claimsRead','读出新封签，要求护卫出示原件','直接揭示争议：军务书记魏简把“本人具体行为”删成“签署者担保全部军情”。护卫先封附页，不抓居民，不夺已得真剑。',(s,a,ctx)=>{x.claimsRead=true;ctx.say('两名护卫想拿一桩追责交差，未敢声称旧安全承诺无效。魏简愿用更大的问责范围换一次升迁；韩家的副本留下了删改痕迹。现在争的是这份新附件的效力。');},s=>!x.claimsRead&&noBattle(s)));
    out.push(c('claimsInvestigate','比对限名附约与韩家副本','调查 DC15；成功撤封，失败花一小时补查但原件仍交到手，不锁死。失败后可用已查原件撤封，或付押金、绕行。',(s,a,ctx)=>{x.claimsProbe=true;const ok=ctx.check(a,'investigation',15);if(ok)settleClaims(s,ctx,'调查核清');else{s.time++;x.claimsEvidence=true;ctx.say('抄手先把缺页当成丢失。你们花一小时找齐原副本，取得可直接复核的删改证据；护卫暂不合作，取剑和绕行照常开放。');}},s=>x.claimsRead&&!x.claimsProbe&&noBattle(s)));
    out.push(c('claimsEvidence','出示补查所得原件，撤销被改附件','已付过一小时调查成本；不再掷骰、不交 GP。合法原约与原安全承诺不变。',(s,a,ctx)=>settleClaims(s,ctx,'出示原件'),s=>x.claimsEvidence&&noBattle(s)));
    out.push(c('claimsTalk','劝护卫按本人行为问责，别替文吏背锅','说服 DC15；成功撤封，失败新增半小时等待，不再反复刷同一说辞；仍能查账、交押金或沿原入口取剑。',(s,a,ctx)=>{x.claimsTalk=true;if(ctx.check(a,'persuasion',15))settleClaims(s,ctx,'交涉撤封');else{s.time+=.5;ctx.say('护卫怕回营受责，仍不肯撤封，半小时交涉已经过去。原件、押金和开放的北入口仍可用；无人被作为人质。');}},s=>x.claimsRead&&!x.claimsTalk&&noBattle(s)));
    out.push(c('claimsEscrow','交六十 GP 争议押金，先撤封后核账','立即扣六十 GP；封卷前完成复核可全退。押金买时间，不购买免责，也不替人认罪。',(s,a,ctx)=>{spent(s,60);x.claimsDeposit=60;settleClaims(s,ctx,'押金暂结');promise(s,'han-refund','第十二回出示限名原约与北门副账，退回六十 GP 争议押金');},s=>x.claimsRead&&!x.claimsDeposit&&noBattle(s)));
    out.push(c('claimsBypass','走原北入口与封签点分开行动','零 GP，无骰；放弃这次护卫合作，新增半小时绕行。两护卫留在西侧封签点，不加入石像守剑范围；主目标和原一千 GP 不变。',(s,a,ctx)=>{s.time+=.5;x.claimsBypassed=true;ctx.say('小队沿原本开放的北入口进院。护卫只守其封签点；争议附页与待复核承诺仍在，后续可在封卷前付一小时核账。');},s=>x.claimsRead&&!x.claimsBypassed&&noBattle(s)));
    out.push(c('claimsBreak','准备以武力穿过封签点，进入先攻','自愿风险：两名 Scout 护卫改为敌对，院内原石像与无形客仍按原卡参战。不能用这一按钮直接击倒或结清争议；可按真实回合撤退，伤势和消耗保留。',(s,a,ctx)=>{x.claimsHostile=true;for(const g of s.actors.filter(t=>['claim-1','claim-2'].includes(t.npcId)))g.side='enemy';ctx.say('护卫放下封签笔，拔出武器。北入口仍在，争议文书也没有因开战成为已核实的事实。');ctx.start();},s=>x.claimsRead&&!x.claimsBypassed&&!x.claimsHostile&&s.actors.some(t=>['claim-1','claim-2'].includes(t.npcId)&&t.hp>0&&!t.dead)&&noBattle(s)));
   }
   out.push(c('armyFee','为获得补给的工兵核对北门守务','此前军需至少收到六包粮药且工兵组仍可合作；花一小时完成实地交班图，取得八十 GP 新劳务酬劳，限一次。魏简有偿附报未撤回时，工兵不另发独立委托。',(s,a,ctx)=>{s.time++;x.armyFee=true;reward(s,'worldly-army-fee',80);grant(s,'north-shift','北门工兵交班图',{kind:'document'});ctx.say('这是已完成勘察的劳务费，另列于原破阵一千 GP 之外。图上只写实际守备、挂扣和开放入口，不给任何穿墙特权。');},s=>armyReady(s)&&!patronAccount(s)&&!x.armyFee&&noBattle(s)));
  }
  if(ch===10){
   const ready=s=>f(s).dingHeard&&f(s).bannerPlan&&!f(s).testimony&&noBattle(s);
   out.push(c('testimonyPublic','请定光逐字核稿并公开本人证言','须定光在世、清醒且未受魅惑或支配，自愿可交谈；扣四十 GP 抄印，半小时。只公开他同意的本人经历；十二回可自愿任公开稽核官并接受年度公开审查。',(s,a,ctx)=>{spent(s,40);s.time+=.5;x.testimony='public';grant(s,'ding-testimony','定光已核公开证言',{kind:'document',holder:'公共抄本'});ctx.say('定光删去了一个未同意具名的旧友。公开的文字说明谁以战令逼他回阵，也记下他曾依附权位的自利；幡的真实归属不因证言改变。');},s=>ready(s)&&witnessConsents(s,'ding')));
   out.push(c('testimonyCustody','经定光同意，把核稿原件交军议保管','须本人清醒、未受魅惑或支配。零 GP，半小时；新增承诺：终局向本人复核保管及公开范围。十二回可任军议录事；若改任公开稽核，需七十五 GP 归档公开费。',(s,a,ctx)=>{s.time+=.5;x.testimony='custody';grant(s,'ding-testimony','定光核稿证言原件',{kind:'document',holder:'沈砚（军议保管）'});promise(s,'testimony-review','第十二回向定光或本人指定的见证人复核军议证言保管与公开范围；不借保管权逼人任职');ctx.say('沈砚把不准自行增名的条款写在封口。军议能先处置战令，却也能决定谁先看见原件；这份权力因此留下明确的复核责任。');},s=>ready(s)&&witnessConsents(s,'ding')));
   out.push(c('testimonyOwn','只记录小队自己看见的事，不征用本人经历','零 GP、无新增身份奖励；定光可拒绝讲述，失能或亡者不被代言。仍获原一千 GP、披风和十二级成长。',(s,a,ctx)=>{x.testimony='own';grant(s,'party-deposition','小队具名现场记录',{kind:'document'});ctx.say('记录把目击与推断分开。定光的未说之事保持未说；你们可继续原本的任职、回家与行旅结局。');},ready));
  }
  if(ch===11){
   out.push(c('clinicEvac','请余萤带民诊队接应北侧撤营','此前十二包真实民诊交付，余萤与诊所仍可合作；独家运力委任须已交接退出。再花十分钟实际解除夜袭目标；原半小时自行撤营始终可选。',(s,a,ctx)=>{s.time+=1/6;x.clinicEvac=true;x.campSafe=true;x.nightStopped=true;neutralize(s,['daji','huxi','wang']);ctx.say('民诊队接过伤员，小队沿原北路护送。十分钟后最后一车进入灯火，三妖失去当夜夜袭目标；已死者没有回来帮忙。');},s=>clinicReady(s)&&!exclusiveRelief(s)&&!x.nightStopped&&noBattle(s)));
  }
  if(ch===12){
   out.push(c('hanFinalReview','补做限名附件终审','尚未撤封或押金暂结者：花一小时出示原约核清，无检定、不追夺既有救援与报酬。已交六十 GP 押金全额退回一次。',(s,a,ctx)=>{s.time++;x.claimsFinal=true;x.claimsSettled=true;fulfill(s,'han-review');if(x.claimsDeposit&&!x.claimsRefund){s.gold+=x.claimsDeposit;x.claimsRefund=true;fulfill(s,'han-refund');}ctx.say('魏简删改的附页不再能作为问责依据；护卫签了更正。退款沿实际押金入队伍资金，旧关民不必为结局再受一次审。');},s=>x.hanPact==='named'&&!x.claimsFinal&&(!x.claimsSettled||x.claimsDeposit)&&noBattle(s)));
   out.push(c('testimonyReview','按核稿范围复核军议保管','零 GP，半小时；保留军议原件，履行终局复核承诺。不会自动把私稿公开。',(s,a,ctx)=>{s.time+=.5;x.testimonyReviewed=true;fulfill(s,'testimony-review');ctx.say(canTalk(s,'ding')?'定光核对封签与阅卷簿，确认原件没有新增姓名。他仍能拒绝任职或亲密关系。':'按原件指定见证范围复核封签；只记实际可核事项，不伪造亡者或离开者的同意。');},s=>x.testimony==='custody'&&!x.testimonyReviewed&&noBattle(s)));
   out.push(c('testimonyRelease','按事前约定办理证言公开归档','须已复核；扣七十五 GP 归档费。仅公开原先获准的文字，交付公共抄本；开放公开稽核官资格，原件去向可追。',(s,a,ctx)=>{spent(s,75);x.testimonyReleased=true;transferItem(s,'ding-testimony','公共档案（原核准范围）');ctx.say('归档费逐笔入公开簿，不买新的证言。军议不能用新头衔强迫定光补写或具名别人。');},s=>x.testimony==='custody'&&x.testimonyReviewed&&!x.testimonyReleased&&noBattle(s)));
   out.push(c('officePublic','个人结局：接受公开稽核官的具体职书','条件：已核公开证言，或军议证言已依约归档；限责专报、魏简有偿附报须先撤回。封卷时领一百五十 GP 预支；义务：每年两次公开账目，不得私删民伤证词。可改选回家。',(s,a)=>appointment(s,a,'public-auditor','任朝歌公开稽核官',150,'每年两次公开账目，保留民伤异议原文；职权不及强迫证人发言'),s=>(x.testimony==='public'||x.testimonyReleased)&&independentAccount(s)&&noBattle(s)));
   out.push(c('officeMilitary','个人结局：接受军议录事的具体职书','条件：军议证言已复核且仍依约保管。封卷时领二百五十 GP 预支；义务：三十日内交阅卷名册给证言本人或指定见证人，不擅增阅卷者。',(s,a)=>appointment(s,a,'military-clerk','任军议录事',250,'三十日内交阅卷名册给证言本人或原指定见证人；新增阅卷须按封签同意范围'),s=>x.testimony==='custody'&&x.testimonyReviewed&&!x.testimonyReleased&&noBattle(s)));
   out.push(c('officeRelief','个人结局：接受民诊补给理事的具体职书','条件：确实交过十二包民诊粮药，独家运力与魏简排异议附报已退出。封卷时领一百 GP 预支；义务：每季公开粮药实物账。其他人可自由归家，不取消已获救援。',(s,a)=>appointment(s,a,'relief-steward','任民诊补给理事',100,'每季公开粮药包数与去向，不得把就诊名单改为征发名册'),s=>clinic(s)&&!exclusiveRelief(s)&&!patronAccount(s)&&noBattle(s)));
  }
  return [...out,...intrigueChoices(s)];
 }
 function matureAfterChoice(s,a,id,ctx){const x=f(s);
  initializeWorldly(s,s.chapter);
  if(s.chapter===3&&id==='close'&&!x.supplyPolicy&&x.supplies){grant(s,'relief-reserve','追回粮药待支配包',{kind:'relief',count:x.supplies,holder:'party'});x.supplyPolicy='reserve';ctx.say('没有代替队伍捐出物资：追回粮药按实际包数留存，第六回仍可分配。');}
  if(s.chapter===6&&id==='alternative'&&x.engineerAid){s.time-=2;ctx.say('工兵已先行铺板，替代路本次实际施工为两小时；此前半小时勘察不返还。');}
  if(s.chapter===10&&id==='close'&&!x.testimony){x.testimony='unasked';ctx.say('未另取个人证言，也不默认为同意公开；原回目奖励已经照付。');}
  if(s.chapter===12&&id==='final'){
   const p=ensureCampaign(s);
   for(const e of Object.values(p.endings))if(e.appointment){const q=e.appointment;reward(s,`worldly-office-${e.actor}`,q.stipend);grant(s,`office-${e.actor}`,`${q.title}职书`,{kind:'appointment',holder:e.actor});promise(s,`office-duty-${e.actor}`,`${e.name}自愿接受职务：${q.duty}`);ctx.say(`${e.name}的${q.title}确认：${q.stipend} GP 预支已到账；${q.duty}。`);}
   // Re-read final facts for every ending, including characters who chose home
   // before the party corrected an account or accepted a later appointment.
   for(const e of Object.values(p.endings)){e.consequences=matureConsequences(s);e.promises=p.promises.filter(q=>q.status!=='已履行').map(q=>q.text);e.items=Object.values(p.items).filter(i=>!i.destroyed&&(i.holder===e.actor||i.holder==='party')).map(i=>i.name);}
  }
 }
 function matureConsequences(s){const x=f(s),out=[];
  if(x.supplyPolicy)out.push(`粮药实账：民诊 ${x.supplyCivil||0} 包，军需 ${x.supplyArmy||0} 包，队伍现持 ${held(s)} 包；${x.clinicAid?'已领两瓶民诊回礼':'未领民诊回礼'}${x.clinicEvac?'，已协助撤营':''}${x.armyFee?'；工兵八十 GP 劳务已付':''}。`);
  if(x.hanPact&&x.hanPact!=='patron')out.push(x.hanPact==='public'?`韩家公开附约：六十 GP 已付；${x.hanPublicUsed?'北门收据已核':'第九回可按条件核销'}。`:x.hanPact==='named'?`韩家限名附约：${x.claimsSettled?'新附件已复核／暂结':'仍待复核，不连坐居民'}；押金 ${x.claimsDeposit||0} GP${x.claimsRefund?' 已退':' 未退（若有）'}。`:'韩家仅维持原交关协议，无新增附约收益或义务。');
  if(x.testimony)out.push(x.testimony==='public'?'证言：定光已核准公开本人经历，可自愿接受公开稽核职务。':x.testimony==='custody'?`证言：军议原件${x.testimonyReviewed?'已复核':'待复核'}${x.testimonyReleased?'，已按原范围公开归档':'，未自动公开'}；任职与否由本人决定。`:'证言：只保留实际记录，无补取秘密、无强制身份。');
  return [...out,...intrigueConsequences(s)];
 }
 function matureDescription(s){const x=f(s);if(s.chapter===3)return ' 程简与医官余萤都在等这批新粮药：交给谁会改变后续可请的援手，追回和救人的原报酬照付。';if(s.chapter===7||s.chapter===8)return ' 韩家提出两份额外附约：公开补偿要现款，限名保护不具名者但要后续复核；也可只守原交关协议。';if(s.chapter===9&&x.hanPact==='named')return ' 西侧两名护卫只封新附件；他们不控制阁院真剑和北入口。查明、交涉、押金或绕行均可推进。';if(s.chapter===10)return ' 你们可另外询问本人是否愿意作证；公开或军议保管各有可见成本，不问、不说都不削减原奖励。';if(s.chapter===12)return ' 具体新职务由既有交割与证言决定；先看职书义务，封卷前可改选其他归路。';return '';}
 return {matureChoices,matureAfterChoice,matureConsequences,matureDescription:s=>matureDescription(s)+intrigueDescription(s),initializeWorldly};
}
