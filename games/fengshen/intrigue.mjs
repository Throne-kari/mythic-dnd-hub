// Optional, disclosed contracts in the existing campaign; no alignment score.
export const boughtRecord = s => s.campaign?.facts?.ledgerDisposition === 'bought' && !s.campaign.facts.ledgerCorrected;
export const exclusiveRelief = s => !!s.campaign?.facts?.reliefExclusive && !s.campaign.facts.reliefContractEnded;
export const patronAccount = s => s.campaign?.facts?.hanPact === 'patron' && !s.campaign.facts.patronExposed;
export const independentAccount = s => !boughtRecord(s) && !patronAccount(s);

export function createIntrigue(api) {
 const {c,f,ensureCampaign,grant,promise,fulfill,reward,canTalk,noBattle,recordEnding}=api;
 const spend=(s,n)=>{if(!Number.isFinite(s.gold)||s.gold<n)throw Error(`队伍资金不足 ${n} GP；合同未更改，也没有扣款。`);s.gold-=n;};
 function correctLedger(s,a,ctx){spend(s,80);s.time+=f(s).ledgerAudit ? .5 : 1;f(s).ledgerCorrected=true;fulfill(s,'ledger-exclusive');grant(s,'ledger-correction','撤回限责专报的公开更正',{kind:'document'});ctx.say('退回的是梁嵩付给小队的八十 GP。小队撤回自己签过的限责文字，原账据、已救者及已追回粮食一项不改；梁嵩失去了独家使用这份专报的条件。');}
 function exposePatron(s,a,ctx){spend(s,260);s.time++;f(s).patronExposed=true;fulfill(s,'patron-account');grant(s,'han-counterledger','北门已核守务副账',{kind:'document'});grant(s,'patron-correction','魏简附报撤回与退款回执',{kind:'document'});ctx.say('二百 GP 退还委任金，六十 GP 付补印与异议登记。小队公开撤回自己签的选择性附报，军务书记魏简的删录权限停止；新民伤异议可进入这份新账。韩家旧安全约、军饷与已完成护送从未作废。');}
 function endExclusive(s,a,ctx){spend(s,180);s.time+=.5;f(s).reliefContractEnded=true;fulfill(s,'relief-exclusive');ctx.say('一百八十 GP 委任金退回，半小时完成班次交接。小队可以重新为民诊安排额外运力；原有诊疗、已赠药水和实际物资没有被倒扣。');}
 function intrigueChoices(s){const x=f(s),out=[],ch=s.chapter;
  if(ch===1&&!x.ledgerDisposition&&(s.flags.ledger||s.flags.grainEvidence)&&noBattle(s)){
   out.push(c('ledgerOpen','把现有假令账据留成可核对的公副本','零 GP，半小时抄录；只写物证和小队亲见，不公开未同意者姓名。第四回可请自愿急递送真实求援；原救人与渡河奖励照旧。',(s,a,ctx)=>{s.time+=.5;x.ledgerDisposition='open';grant(s,'ledger-public','假令账据公副本',{kind:'document'});ctx.say('账据留给多方核对。阿禾是否愿意作证另由本人决定，不能拿获救换他的姓名。');}));
   out.push(c('ledgerBought','收梁嵩八十 GP，签只追渡口差役的专报','立得八十 GP；小队承诺暂不查雇主。不会删原账或夺回粮食。第四回失去新增独立急递合作；第十二回公开稽核职书须先退八十 GP、撤回限责报告。',(s,a,ctx)=>{x.ledgerDisposition='bought';reward(s,'intrigue-ledger',80);grant(s,'ledger-exclusive','梁嵩付酬的限责专报',{kind:'document',holder:'梁嵩账房'});promise(s,'ledger-exclusive','小队收八十 GP，签署只追渡口执行人、暂不查雇主的专报；可退委任金公开撤回');ctx.say('梁嵩要保的是自己背后雇主的货路，不是曹斗的性命。八十 GP 已到账，小队的签名也留在有偿限责文字上；事实与他希望人相信的解释从此分开。');}));
  }
  if((ch===2||ch===5)&&x.ledgerDisposition&&!x.ledgerAudit&&noBattle(s))out.push(c('ledgerAudit','追查专报背后的委任与账款','调查 DC13；成功半小时查清，失败多花半小时仍取得委任副本，不锁线索。查明后第四回更正只需半小时；第五回也能补查，为终局留凭据。',(s,a,ctx)=>{const ok=ctx.check(a,'investigation',13);s.time+=ok?.5:1;x.ledgerAudit=true;grant(s,'broker-contract','梁嵩委任副本',{kind:'document'});ctx.say('副本显示梁嵩用自己的商行资金买小队的限责解释。山祠与信仰并未因此受他控制；查明一条利益关系，也不等于所有人都属于它。');}));
  if((ch===4||ch===12)&&boughtRecord(s)&&noBattle(s))out.push(c('ledgerCorrect','退还八十 GP，公开撤回限责专报',`扣八十 GP，${x.ledgerAudit?'半':'一'}小时核对更正；失去早先有偿买断收益，恢复新增独立合作资格。更正小队的报告，不抹去真实过往。`,correctLedger));
  if(ch===4&&!x.messageDelivered&&!boughtRecord(s)&&(x.ledgerDisposition==='open'||x.ledgerCorrected)&&canTalk(s,'shen')&&noBattle(s))out.push(c('independentRelay','请见过公账的自愿急递送求援并带回回复','零 GP，半小时；只送原真实求援，沈砚仍须实际能回话。完成送达而不假称小队亲至观中；原合法传讯、原路与四百 GP 同奖。',(s,a,ctx)=>{s.time+=.5;x.messageDelivered=true;x.independentRelay=true;grant(s,'relay-reply','沈砚给自愿急递的回联答复',{kind:'document'});ctx.say('急递带回沈砚愿联系修护与勘察人手的明确回复。公账让对方肯以自己的班次帮这一趟忙，没有人因此欠私人关系。');}));
  if(ch===6&&!x.reliefExclusive&&noBattle(s))out.push(c('reliefExclusive','接受梁嵩独家运力委任，领取一百八十 GP','立得一百八十 GP，卖的是小队后续运力；第十一回不再能请民诊组织新增撤营协作，普通半小时撤营仍可行。已救者与两瓶回礼不收回。可退全数、花半小时交接退出。',(s,a,ctx)=>{x.reliefExclusive=true;reward(s,'intrigue-relief-exclusive',180);promise(s,'relief-exclusive','梁嵩一百八十 GP 买断小队这段后续运力，未解除前不为民诊组织额外撤营班次；可退全款交接退出');ctx.say('梁嵩抢的不是这回的胜负，是以后谁能先叫到车与护卫。余萤照样开诊、兑现已经答应的回礼，却不肯在小队另有独家委任时替他们承诺一支撤营队。');}));
  if([6,11,12].includes(ch)&&exclusiveRelief(s)&&noBattle(s))out.push(c('reliefExit','退回独家运力委任，重新安排自由班次','扣一百八十 GP，半小时实际交接；恢复民诊新增撤营协作与补给理事资格，仍须原先十二包交割及真实合作人。资金不足可保留委任，按原北路自行撤营。',endExclusive));
  if((ch===7||ch===8)&&x.hanTerms&&!x.hanPact&&noBattle(s))out.push(c('hanPatron','收魏简二百 GP，签只录军功的新附报','立得二百 GP；新附报排除民伤异议，不改原军饷、居民去留或护送约。第九回失去独立工兵八十 GP 委托；公开稽核、民诊理事职书有利益冲突。可花二百六十 GP、一小时撤回。',(s,a,ctx)=>{x.hanPact='patron';reward(s,'intrigue-han-patron',200);grant(s,'patron-account','魏简选择性附报委任',{kind:'document'});promise(s,'patron-account','小队收二百 GP，签只录新军功、不收新民伤异议的附报；不影响此前合法军饷、居民自由及护送，可退二百另付六十补印更正');ctx.say('魏简把钱称作“协办酬劳”。韩变指出不收异议与没有异议是两回事；他仍照旧约放人，却不会把自己的副账借给这份附报作证。小队得到现款，书记得到一份能用来争官的签名。');}));
  if(ch===9&&patronAccount(s)&&!x.patronProbe&&noBattle(s))out.push(c('patronProbe','核查魏简如何使用小队签名','调查 DC15；成功直接取得删录副本，失败多花半小时仍取得副本。原真剑与入口不受影响；核查不自动退款，也不替小队选择是否揭露。',(s,a,ctx)=>{const ok=ctx.check(a,'investigation',15);if(!ok)s.time+=.5;x.patronProbe=true;grant(s,'patron-proof','魏简删录异议的实际副本',{kind:'document'});ctx.say('书记把小队名字写在“无民伤异议”的封面。附页里却有被退回的新增申诉。没有撤回旧日救援，发生的是新责任被有意挡在公账外。');}));
  if(ch===9&&patronAccount(s)&&x.patronProbe&&!x.patronSealed&&noBattle(s))out.push(c('patronSeal','明知删录，仍确认这份有偿附报','不再领第二笔钱；保留已得二百 GP，同时承担不收新异议的公开责任。独立工兵不付新增委托，公开稽核和民诊理事暂不可兼任；终局可接受权臣账房职书或退出。',(s,a,ctx)=>{x.patronSealed=true;grant(s,'patron-seal','小队确认的选择性附报',{kind:'document'});ctx.say('韩变收起自家的副账，不再为此附报背书。魏简的账局保留委任；他们愿意给小队职位，条件正是继续决定哪些人的损失能进账。');}));
  if((ch===9&&x.patronProbe||ch===12)&&patronAccount(s)&&noBattle(s))out.push(c('patronExpose','退委任金并补印更正，公开新民伤异议','扣二百六十 GP（二百退款、六十补印），一小时；恢复独立工兵新增委托及公账职务资格。原军饷、安全协议、宝剑和基础报酬不变；不能改写已经发生的选择。',exposePatron));
  if(ch===12&&patronAccount(s)&&noBattle(s))out.push(c('officePatron','个人结局：接受魏简账局的附报总办职书','条件：有偿附报尚未撤回。封卷时领四百 GP；继续受理军功、拒收新民伤异议，独立稽核与民诊理事不能兼任。责任进入结局。可选回家、行旅或先退约更正。',(s,a,ctx)=>{recordEnding(s,a,'任魏简账局附报总办');const e=ensureCampaign(s).endings[a.id];e.appointment={id:'patron-clerk',title:'任魏简账局附报总办',stipend:400,duty:'每季向魏简账局交军功附报，拒收新增民伤异议；不得同时以独立稽核或民诊理事身份为该账背书'};e.lastScene=`${a.name}接受附报总办委任，封卷时领四百 GP；新民伤异议继续被挡在这份公账外，韩家不提供独立副账背书。`;ctx.say('职书把利益和职责写在同一面。接受者可以拥有舒适与影响力，也须在结局里承认被自己排除的申诉。其他队员仍各选自己的归路。');}));
  return out;
 }
 function intrigueConsequences(s){const x=f(s),out=[];
  if(x.ledgerDisposition)out.push(x.ledgerDisposition==='open'?'假令账据留公副本；未以姓名或救援换取证词。':x.ledgerCorrected?'限责专报已退八十 GP 并公开更正；有偿选择的记录保留。':'限责专报八十 GP 已收、未撤回；小队暂不查雇主，独立急递及公开稽核存在利益冲突。');
  if(x.reliefExclusive)out.push(exclusiveRelief(s)?'独家运力一百八十 GP 已收、委任仍在；民诊新增撤营协作及补给理事不可用，原自行撤营仍可行。':'独家运力委任已退一百八十 GP 并交接；民诊新增协作可按原实物与合作条件恢复。');
  if(x.hanPact==='patron')out.push(x.patronExposed?'魏简有偿附报已退二百 GP、另付六十 GP 更正；新民伤异议重新可登记，独立委托恢复。':`魏简二百 GP 附报${x.patronSealed?'经小队再次确认':'尚未撤回'}：新民伤异议被排除；独立工兵新增八十 GP 委托、公账稽核及民诊理事暂不可用。旧安全约与基础奖励保留。`);
  return out;
 }
 const descriptions={1:' 有人愿意花现钱购买你们对假令责任的解释：物证可以公开，也可以被选择性引用。',2:' 工程、借物和铜铃各有主人。若接过有偿专报，可查出究竟是谁在买自己的解释。',4:' 自愿急递只为可核公账提供新增帮忙；买断专报可退约更正，原查信、绕行和合法传讯仍成立。',5:' 顾行舟给出的亲见报告仍可靠；小队也可以补查早先的委任，让隐瞒成为可面对的事实。',6:' 商人愿先付钱买断你们以后的运力。现款确实有用，代价是第十一回不能同时调来民诊撤营队。',7:' 魏简另愿付钱购买一份排除新民伤异议的附报；钱和未来独立合作不能同时全取。',8:' 同一份附报跟随实际交接；居民照旧约自由离关，新增责任由签字者承担。',9:' 书记使用签名的方式可被查明。保住委任金、公开更正或先完成取剑，都有具体结果。',10:' 本人拒绝作证、保留秘密与已发生的背叛可以同时成立；失能与法术控制不能代替自愿同意。',11:' 被提前买断的运力会在此刻缺席；可退约调度，也可自行沿原北路撤营，不以新灾难惩罚此前救人。',12:' 官职与富足可以来自有选择的账目。原本的回家、归山和行旅仍可行，未履行责任会留在每个人结局里。'};
 return {intrigueChoices,intrigueConsequences,intrigueDescription:s=>descriptions[s.chapter]||''};
}
