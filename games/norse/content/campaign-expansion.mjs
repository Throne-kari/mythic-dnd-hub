// 三章扩写：只扩充原检查点，不依赖网络或私人存档。
const f=id=>({flag:id}),no=c=>({not:c}),all=(...v)=>({all:v}),any=(...v)=>({any:v});
const gold=n=>({resourceAtLeast:{gold:n}}),food=n=>({resourceAtLeast:{supplies:n}});
const merge=(...ps)=>{const o={};for(const p of ps)for(const [k,v]of Object.entries(p||{})){if(['flags','resources','relations','factions','quests'].includes(k))o[k]={...o[k],...v};else if(k==='unlockScenes')o[k]=[...(o[k]||[]),...v];else o[k]=v;}return o;};
const done=(id,next,e={})=>merge({flags:{[`${id}_done`]:true},unlockScenes:next?[next]:[]},e);
const opt=(id,label,description,effects={},extra={})=>({id,label,description,effects,next:'hub',once:true,...extra});
const sc=(id,chapter,arc,title,mapId,text,choices,requires)=>({id,chapter,arc,title,mapId,location:title,text,requires:all({chapterAtLeast:chapter},{sceneUnlocked:id},no(f(`${id}_done`)),requires||{}),choices});
const stage=(c,id,next,quest)=>{for(const o of c.scenes[id].choices){for(const e of [o.effects,o.check?.success?.effects,o.check?.failure?.effects].filter(Boolean)){e.quests={...e.quests,[quest]:'active'};e.unlockScenes=(e.unlockScenes||[]).filter(x=>x!=='council');if(!e.unlockScenes.includes(next))e.unlockScenes.push(next);}}};

export function expandCampaign(c){
  c.version='3.1.0';c.subtitle='三章 · 三条交织主线 · 二十四种由行动兑现的结局';c.initialState.chapter=1;c.initialState.flags.party_longboat=true;
  c.prologue+=' 这一冬还未到最难的一夜。粮仓之外有活人等待申辩，解冻之后有新的土地等待选择；三件事不会由一份好看的报告替你们做完。';
  c.chapters=[
    {id:1,title:'冰封之湾',summary:'取回能核的物件，辨清活人证据，按住眼前潮闸。',objectives:[{id:'oath1',label:'取得臂环或旧约摹样',requires:f('A3_done')},{id:'mist1',label:'决定下行或走活证据路线',requires:f('B3_done')},{id:'stone1',label:'处理第一轮潮闸险情',requires:f('C3_done')}],completion:all(f('A3_done'),f('B3_done'),f('C3_done'))},
    {id:2,title:'借名之火',summary:'粮确实发给谁，证人确实去哪里，春种确实还剩什么；之后选定你们愿先承担的责任。',objectives:[{id:'oath2',label:'解决护船队、港外债与弗里盖尔的船',requires:f('A6_done')},{id:'mist2',label:'处理雾姊旧信、徒弟与印稿',requires:f('B6_done')},{id:'stone2',label:'安置六人后处理春种',requires:f('C6_done')},{id:'mandate',label:'在春议接受一项优先使命',requires:f('mandate_set')}],completion:all(f('A6_done'),f('B6_done'),f('C6_done'),f('mandate_set'))},
    {id:3,title:'春潮之上',summary:'三条线都须实际交割；春议押船留任、交船护证或拆船留乡的投入不可重用，并持续改变代价与去处。',objectives:[{id:'oath3',label:'兑现湾口的权力安排',requires:f('A9_done')},{id:'mist3',label:'兑现证人、纪念与雾桥的去向',requires:f('B9_done')},{id:'stone3',label:'兑现春潮中的土地与生计',requires:f('C9_done')}],completion:all(f('A9_done'),f('B9_done'),f('C9_done'))}
  ];
  for(const id of ['A1','A2','A3','B1','B2','B3','C1','C2','C3'])c.scenes[id].chapter=1;
  for(const id of ['A4','A5','B4H','B4L','B5','C4','C5']){c.scenes[id].chapter=2;c.scenes[id].requires=all(c.scenes[id].requires,{chapterAtLeast:2});}
  for(const id of ['camp_frig','camp_hagna','camp_solveig'])c.scenes[id].chapter=1;
  stage(c,'A5','A6','oath');stage(c,'B5','B6','mist');stage(c,'C5','C6','stone');
  const at=(id,k)=>c.scenes[id].choices.find(o=>o.id===k);
  c.scenes.A4.text=[
    '托吉尔把断桩放在环边。西格丽德要粮入公仓，内里要三年卸货权。弗里盖尔从工具袋里摸出一封被铰钉磨薄的信：妹妹芮芙替他找了一季船匠活，船明晨走。他的拇指反复压着信上那道旧折。',
    '“两趟栏。”他把两枚钉放在桌上，又放下船票，“她那边，一季活。”过了半晌，他说自己愿与两名渔民留到解冻，但要你们看着那张会过期的票答话。若不接这份排班，港口便另雇人；今晚仍能先把人带回火边。'
  ];
  for(const k of ['rotation','truth']){delete at('A4',k).effects.resources;Object.assign(at('A4',k).effects.flags,{frig_delayed_departure:true,frig_missed_berth:true});at('A4',k).description+=' 弗里盖尔当面答应两趟，代价是错过明晨赴西岸见妹妹与做工的船。';}
  at('A4','seize').description='你们能夺下眼前门钥，却没有凭四人的刀长期征粮的力量。护船队仍要薪饷，后面必须真正结盟或退让。';
  c.scenes.A4.text.push('护船队长托拉把斧背敲在门框上：“门钥好抢。下一夜谁守？我的人已经三个月没领足钱。”她不会因内里的印失了颜色就改为无偿服从你们。');
  at('A3','witness').requires=all(f('debt_evidence'),gold(2));at('A3','witness').effects.resources={gold:-2};at('A3','witness').description='付清护船人尚欠的两枚离岸工钱，得旧环；这是有限雇钱，不买他们的余生。';
  c.scenes.A3.choices.splice(1,0,opt('paper_witness','请伊尔莎准许的空白画押纸作见证','护船人看见账房要他们替假誓收工，愿先交环、回船向雇主索薪。',done('A3','A4',{flags:{old_ring:true,guard_deposition:true},factions:{ring:1}}),{requires:f('witness_network')}));
  c.scenes.A2.choices.push(opt('dock_compare','把港务账亭的印角摹样与补页相对','需实际调查港务账亭。可认出同一块缺角印，不必靠猜货箱。',done('A2','A3',{flags:{debt_evidence:true,paper_origin:true,dock_record_used:true}}),{requires:f('explored_harbor-ledger')}));
  at('C2','crew').requires=f('dock_helpers');at('C2','crew').label='请领过工钱的船工改来运这一车木';at('C2','crew').description='需A1已出工钱救粮。木料能到，船工便赶不上修西岸船；A6须另修，不能让同一批人同时做两份工。';at('C2','crew').effects.flags.dock_crew_diverted=true;
  c.scenes.B3.text=[
    '雾桥上没有脚步的回声，只有别人刚说过的话从水底回来。霍格娜叮嘱：“桥不会造新句。若听见自己尚未开口的回答，就是湿纸里的东西在借你嘴。”桥栏的字要从倒影逆读，正看只会绕回灯屋。',
    '雾姊把最后一份干粮放给守灯人。索尔维格的双面摹纸也能点成反字灯，烧掉它便不再有那张图。更深处，一团缠着纪念纸的影子反复念“他自愿”。下去可以问卡里；回去仍有活人和岩坡可查。'
  ];
  at('B3','walk').description='留一份行粮给守灯人，沿逆读的桥栏下行。';at('B3','living').description='带已有证据回灯屋。没有听见亡者的话，也仍能纠正活人的假纸。';
  c.scenes.B3.choices.push(opt('reflection_lamp','把双面拓纸点成反字灯，循倒影过桥','得到下行道路；两张拓纸的核对图被烧去，后面不能再用它省下闸料。',done('B3','B4H',{flags:{went_hel:true,rubbing_burned:true}}),{requires:f('rubbing_compared')}));
  at('C3','measured_repair').requires=all(at('C3','measured_repair').requires,no(f('rubbing_burned')));
  c.scenes.B4H.text=[
    '卡里坐在一根被水磨白的梁下。“我喊过伊尔莎，她没抓住。我没见谁推石头。”他说完却没接父亲托来的护符。“别又放回我床头。我死前就在攒路钱，我本来要走。”',
    '他骗父亲说愿继承山里的活，怕父亲连最后一个冬天也睡不着。如今新纪念纸把他写成甘愿留下、甘愿死去的人。他请你们把那封未寄的出行信交给父亲，哪怕父亲宁可只听有人害了他。“别用我的命，替别人留住孩子。”'
  ];
  for(const o of c.scenes.B4H.choices)o.effects.flags.kari_departure_letter=true;
  c.scenes.B4L.text.push('旧护符的夹层里有一张未寄的路费清单。它能证明卡里曾筹划离乡，却不能说明他最后想让父亲听见哪句话。赫瑞德愿不愿打开它，须回村再问。');
  for(const o of c.scenes.B4L.choices)o.effects.flags.unopened_route_list=true;
  at('B2','coerce').description='托拉肯把伊尔莎的病母列入护送船的免征名单，换一份能压住争端的画押。伊尔莎拒绝，你们仍可强逼；只保这一位病母，不是替全湾免债。';
  at('B2','coerce').effects.flags.witness_mother_pass=true;
  at('B5','blame').description='账房愿撤掉赫瑞德这一户的新增粮利，并把伊尔莎母亲送上护送船，换你们坚持假指控。父亲必须听见这份交换；伊尔莎将被迫离村。';
  Object.assign(at('B5','blame').effects.flags,{hred_debt_cancelled:true,witness_mother_pass:true});
  c.scenes.B5.text.push('赫瑞德听见报价，习惯地多摆了一只碗，指尖碰到碗沿才把它收回。他摸摸空粮桶，又看门外伊尔莎的旧鞋。“撤我家的……就我家？”誊手点头。他嘴唇动了动，没说出儿子的名字。');
  c.scenes.C4.text=[
    '六个棚工在高台屋檐下拧衣。斯万希尔德攥着母亲留下的网梭，坚持明年还要在这里晒网；哈康背着一把裂柄锻锤，西岸铁铺有师傅愿收他，他不肯让“回乡”再替自己作一次决定。另四人分别把床铺画在木片两边。',
    '屋主玛伦愿借半间高屋到解冻，屋里的少年阿尔夫海因平安添灯。先问六人：住下、去高路亲戚家、登有接收人的船，都各自选。斯万会带走自己的梭子，哈康会把锤留下修柄；付同一笔票钱不让他们忽然有同一种愿望。'
  ];
  at('C4','west').description='付六枚实际船票：四名愿去西岸的成年人登船，斯万与一名同伴由玛伦留住。到达各自接收人处才记为安置。';
  at('C4','west').effects.flags.svan_stayed=true;at('C4','west').effects.flags.hakon_west=true;
  c.scenes.C4.text[0]+='哈康把师傅预付的个人船票摊开：接收人就是那位师傅，这张票不从你们共同钱袋出。';
  at('C4','high_road').description='沿高路送四人到亲戚石屋，哈康持师傅预付的个人票转去西岸，斯万带网梭留玛伦屋里。放弃今夜复工换这一趟护送。';
  at('C4','high_road').effects.flags.hakon_west=true;at('C4','high_road').effects.flags.svan_stayed=true;
  c.scenes.A1.choices.find(o=>o.id==='shore').description='沿浅滩拾两筐，行粮柴料+2；第三筐仍在船外，打捞权归船主。';
  c.scenes.C2.text[0]=c.scenes.C2.text[0].replace('；它们不是芬里尔','');
  c.scenes.C3.choices.find(o=>o.id==='rush').description='力量DC13：旧榫撑过试水或折断。失败便开侧闸，失去锻棚这一冬的原产量。';
  c.scenes.C3.text.push('炉脚压着一角印有“他自愿”的黑帆纸，三枚旧钉在冷盐水里发出同一句细响。拿纸隔开一枚，它就停；再放回去，又重复原句。弗里德芙让人别用它报明天的潮，它从来只会重说纸上已有的话。');
  c.scenes.A6=sc('A6',2,'盐与铁','托拉还没有领到下一夜的薪','harbor',[
    '托拉把六只空薪袋摆成一排，最边上那人的靴底用鱼线缝着。她点两只袋：“这两人夜岗。”又点四只：“他们天亮换。八枚补齐，到解冻我带人走。”锻工也肯带盾，弗里德芙先问谁来保炉、谁先修她家那扇漏风门。',
    '燕尾仍架在桩上，最后一根弯肋至少要五个人同时套榫。弗里盖尔摸到一处逆纹，没看你们：“我想坐自己的船去。不是再上她门口讨一份活。我还没回信。”他自己选择等燕尾；已经应下修栏的人还多误过一班西岸船。若船工去了林道，这里另缺两份料；全队彻夜帮他，便没有人再去雇盾、护索尔或守种。托吉尔在另一边铺开废内田的地凭。'
  ],[
    opt('guard','付八枚，雇托拉六人守仓至解冻','获得有薪护船队；没有这类实际联盟，夺仓者无法长期强制配给。',done('A6','spring_mandate',{resources:{gold:-8},flags:{guard_alliance:true},factions:{sail:1},relations:{frig:-1}}),{requires:gold(8)}),
    opt('crafters','以保炉与修三家门为价，接受锻工盾队','需锻棚仍安全。获得有条件的锻工盟友；春潮若拆炉，这份支持会终止。',done('A6','spring_mandate',{flags:{craft_alliance:true,forge_priority_promised:true},factions:{ring:1}}),{requires:f('forge_safe')}),
    opt('frig_boat','把全队这一夜用来修燕尾，由弗里盖尔定下春潮启航','现料只在船工未改派时够用。他亲口说“春潮我掌舵”，当夜不再轮班；此刻仍泊岸，航程随后兑现。放弃本节点护卫与内田方案。',done('A6','spring_mandate',{flags:{frig_voyage:true,frig_departure_promised:true,boat_refitted:true,maintenance_crews:false,night_crew_spent:true,frig_delayed_departure:false},relations:{frig:2}}),{requires:no(f('dock_crew_diverted'))}),
    opt('frig_boat_late','另出两份料彻夜修船，请弗里盖尔亲定春潮的船期','需船工已改派与两份料。他答应春潮掌舵，当夜不再轮班；燕尾仍泊岸待启航。放弃盾队、内田与维护队护人守种。',done('A6','spring_mandate',{resources:{supplies:-2},flags:{frig_voyage:true,frig_departure_promised:true,boat_refitted:true,maintenance_crews:false,night_crew_spent:true,frig_delayed_departure:false},relations:{frig:2}}),{requires:all(f('dock_crew_diverted'),food(2))}),
    opt('land','凭可核原账换托吉尔的废内田，清这一笔外债','获得可作安置或赎港的实地凭单；代价是旧共有地不再无主，弗里盖尔的船仍待修。',done('A6','spring_mandate',{flags:{inland_grant:true,creditor_receipt:true},factions:{ring:-1}}),{requires:any(f('debt_evidence'),f('testimony_public'),f('stone_honest'))}),
    opt('yield','让黑帆继续守门，不再争仓外的指挥','没有盟军便不假装统治。港约可重谈，已经分出的粮保留；你们不再新征用已自由的人。',done('A6','spring_mandate',{flags:{port_yielded:true,creditor_receipt:true,forced_labor_order:false},factions:{sail:1}}))
  ]);
  const dockVoice=c.scenes.A6.text[0];
  const shipVoice=(missed,diverted)=>
    (missed?'弗里盖尔把过期船票压在燕尾的船肋上，指腹顺着一处逆纹刮了又刮。“芮芙以为我在路上。我给她的信，才写了名字。”两趟栏确实留住了他，明晨那份船匠活也已被另一人接去。':'燕尾的最后一根弯肋得五个人同时套榫。弗里盖尔自己留在船边，不肯把工具交上别人的货舱：“我想坐自己的船去。见芮芙时，手里有活，不是又去借一份。”他还没答应新的修栏。')+
    (diverted?'被改派去林道的船工错过了这一趟，还须另出两份料。':'现料已够，只缺今夜五双一同稳住船肋的手。')+
    '全队帮他便放弃这一夜另雇盾、护索尔或守种的机会。托吉尔在另一边铺开内田地凭，等人回答。';
  c.scenes.A6.text=[dockVoice,shipVoice(false,false)];
  c.scenes.A6.textVariants=[
    {requires:all(no(f('frig_missed_berth')),f('dock_crew_diverted')),text:[dockVoice,shipVoice(false,true)]},
    {requires:all(f('frig_missed_berth'),no(f('dock_crew_diverted'))),text:[dockVoice,shipVoice(true,false)]},
    {requires:all(f('frig_missed_berth'),f('dock_crew_diverted')),text:[dockVoice,shipVoice(true,true)]}
  ];
  c.scenes.B6=sc('B6',2,'雾中回声','雾姊也有一封改过的话','hel',[
    '索尔把旧信放到灯下。霍格娜先伸手去刮“愿”字，刀尖刚碰纸便停了。“两枚。”她盯着纸口，“我收了他两枚。”索尔问那句话是不是卡里说的，她把刀放到桌外：“没有。我没问。”那封写着“愿留家中”的慰语，后来到了黑帆誊手手里。',
    '索尔偷回了刻印木，护船人要带他抵工。门外水声逼近，人、厚稿、整灯只能带两件。霍格娜把旧信往自己袖里收了半寸，又推回来：“这张也印？”她不再看索尔。若印，丧礼上还肯请她的人会少下去；若维护队来护人，另一边的种车便少了守夜者。'
  ],[
    opt('admit','让她亲读旧慰语，把路信交给愿意开封的父亲','带人和原稿，只剩残灯座，不能再束回声作潮钟。霍格娜失去丧礼工；索尔独自随货队离谷一季。',done('B6','spring_mandate',{flags:{archive_preserved:true,hagna_admitted:true,hred_heard_wish:true,echo_vessel:true,echo_vessel_damaged:true,apprentice_exiled:true},relations:{hagna:1},factions:{ring:-1}})),
    opt('hide','把维护人手用于护走索尔与愿来避风的证人','需真实维护队尚未改派。人安全，整套印稿来不及带；同一队不能再帮春种守车。',done('B6','spring_mandate',{flags:{witnesses_safe:true,crew_spent:true,archive_lost:true,echo_vessel:true,apprentice_safe:true}}),{requires:all(f('maintenance_crews'),no(f('crew_spent')),no(f('frig_voyage')))}),
    opt('print','凭已核碑稿或实际查过的雾厅笔记，连雾姊的错误一起印','带人和印稿，灯只余残座。霍格娜失去丧礼工；索尔跟印工离谷，不能同时留在她身边。',done('B6','spring_mandate',{flags:{archive_preserved:true,press_network:true,hagna_admitted:true,echo_vessel:true,echo_vessel_damaged:true,apprentice_printer:true},relations:{solveig:1,hagna:1}}),{requires:any(f('stone_honest'),f('explored_hel-witness'))}),
    opt('bargain','以账房留稿换索尔免征和一箱止痢药','需已与黑帆成交。人获豁免与药，刻印由账房控制；霍格娜不能拿回那封旧信的流向。',done('B6','spring_mandate',{flags:{medicine_contract:true,witnesses_safe:true,press_seized:true,echo_vessel:true,apprentice_safe:true},factions:{sail:1},relations:{hagna:-1}}),{requires:any(f('lie_maintained'),f('harbor_charter'),f('cargo_sold'))}),
    opt('lantern','带上整套灯具，先护索尔从旧雾路退到灯屋','零费用；索尔脱险，稿纸散失。霍格娜私下认错，未逼父亲当众听信；灯能装回声，也能封桥。',done('B6','spring_mandate',{flags:{archive_lost:true,echo_vessel:true,hagna_admitted:true,apprentice_safe:true}}))
  ]);
  c.scenes.C6=sc('C6',2,'第六行','盐咬过的种子','forge',[
    '斯万倒出发白的种，指甲掐开一粒，里头尚有一点青。盐进过网棚就得先洗，侧闸开着就不能照旧下麦。哈康寄来的木尺搁在种袋上，袋底还有一张索尔维格自己写的“常固”。',
    '索尔维格用带盐粒的指甲圈住“常”字。“这一笔，错了。”她没刮，“留下。旁边写此季。”冬学堂已收回讲席，学徒明日要交工具。她把木尺横过案角：“清水两桶，先试十粒。你们保哪袋？我量土。”'
  ],[
    opt('wash','拿两份行粮换清水与筛床，保耐盐的少数种','留下盐地可种的种子；索尔维格留下量土，失去冬学堂讲席的收入。',done('C6','spring_mandate',{resources:{supplies:-2},flags:{salt_seed:true,seed_commons:true,solveig_lost_chair:true}}),{requires:food(2)}),
    opt('crew','让尚未改派的维护队守车筛种','需真有空出的维护人手。保盐种；索尔的护送若先占这队，就不能再选。',done('C6','spring_mandate',{flags:{salt_seed:true,seed_commons:true,crew_spent:true,solveig_lost_chair:true}}),{requires:all(f('maintenance_crews'),no(f('crew_spent')),no(f('frig_voyage')))}),
    opt('buy','付八枚买黑帆新种，签来春十分之一收成','获得能在高地成活的种；种债真实存在，黑帆因此取得春粮的分成。',done('C6','spring_mandate',{resources:{gold:-8},flags:{seed_bonded:true,seed_tithe:true,solveig_lost_chair:true},factions:{sail:1}}),{requires:gold(8)}),
    opt('float','留好可携的种箱：有燕尾便核两座，或取雪车浮箱','需已修好仍泊岸的燕尾，或已调查覆雪粮车。有船则由弗里盖尔同意两箱占座；只有浮箱便先留岸上，之后仍须筹船。',done('C6','spring_mandate',{flags:{seed_flotilla:true,solveig_lost_chair:true}}),{requires:any(f('boat_refitted'),f('explored_forest-seed'))}),
    opt('hill','把仍活的少数种送到高路，放弃今春低地复工','保高地种，旧锻棚与低田不能同时复原。有没有可住的内田仍须看真实地凭。',done('C6','spring_mandate',{flags:{hill_seed:true,solveig_lost_chair:true}})),
    opt('fuel','承认这一批已不能作粮，收为守夜引火料','春种计划失败，种袋改作柴；人已安置，后面还可选择撤乡、守灯或大改水道。',done('C6','spring_mandate',{flags:{seed_failed:true,seed_fuel:true,solveig_lost_chair:true}}))
  ]);
  c.scenes.spring_mandate=sc('spring_mandate',2,'春议','三个人把三样东西放在桌上','thing',[
    '西格丽德放下仓钥，赫瑞德放下儿子的路信，斯万放下网梭。三个人都望向你们抵港时的长船。那是你们自己的船：可押给各户作任期担保，可改作证人住船，也可拆船骨修堤建屋，三件不能同时做。',
    '选守港，便留下一个冬天，船押在公共桩上；选护证人，船舱让给索尔和愿走的证人，队伍成为护航人；选故土，亲手拔下龙首，今后离湾须另找船。另两条线仍要完成，但不能再拿同一条船许第二次诺。'
  ],[
    opt('power','把自有长船押给湾户，答应留下守一冬任期','船不能出售；它可抵一部分赎港款。证人安置与春潮工程仍需各自的物与人，退权将失去押船。',done('spring_mandate',null,{flags:{mandate_set:true,priority_power:true,party_longboat:false,party_ship_bonded:true,party_stays_harbor:true},unlockScenes:['A7','B7','C7']})),
    opt('memory','把自有长船改成证人住船，队伍负责护航','船不再装你们的货。它能成为独立印稿与避风的实际居处，土地工程不再能用这条船的木。',done('spring_mandate',null,{flags:{mandate_set:true,priority_memory:true,party_longboat:false,witness_ship:true,party_keeps_witnesses:true},unlockScenes:['A7','B7','C7']})),
    opt('homeland','拆自有长船，交船骨作修堤与建屋的料','不可逆失去自己的出海船。船料可省下后面两项安置／工程的实际料，若要迁海须先修好燕尾。',done('spring_mandate',null,{flags:{mandate_set:true,priority_homeland:true,party_longboat:false,party_ship_dismantled:true,ship_beams:true},unlockScenes:['A7','B7','C7']}))
  ],all(f('A6_done'),f('B6_done'),f('C6_done')));

  addFinalChapter(c);
  c.companions.find(x=>x.id==='frig').reactions.push(
    {requires:all(f('frig_delayed_departure'),no(f('frig_withdrew'))),stance:'错过赴西岸的船与船匠活，留下履行两趟；妹妹芮芙的信还在工具袋里。'},
    {requires:f('frig_voyage'),stance:'燕尾修好后仍泊岸。他自己定下春潮赴西岸并掌舵，当夜不再轮班，也不再是可同时调用的维护人手。'},
    {requires:f('seed_flotilla_launched'),stance:'燕尾已到同意接收的西岸，他亲自掌舵、见到妹妹芮芙。种箱占去两座，他不再留湾修栏。'}
  );
  c.companions.find(x=>x.id==='hagna').reactions.push(
    {requires:all(f('hagna_admitted'),no(f('hagna_withdrew'))),stance:'承认自己也曾售过慰语，失去旧丧礼雇工；仍愿选择怎样保护索尔与灯路。'},
    {requires:f('hel_local_gate_sealed'),stance:'本地雾桥已封，她失去一部分旧行当，不能再带人往返。'},
    {requires:all(f('tide_echo_bound'),no(f('hagna_withdrew'))),stance:'炉边潮钟由弗里德芙自愿守一季。霍格娜不承担守钟，仍要求她原先给过的话不越过已准范围。'}
  );
  c.companions.find(x=>x.id==='solveig').reactions.push(
    {requires:all(f('solveig_lost_chair'),no(f('solveig_withdrew'))),stance:'冬学堂收回讲席，她留下量盐土，既缺收入也仍愿以实物纠正旧读。'},
    {requires:f('solveig_field_school'),stance:'她在田炉边开量尺桌，失去的名师讲席没有复原，却有了愿到现场的新学徒。'}
  );
  rebuildHub(c);
}

function rebuildHub(c){
  const nodes=c.quests.filter(q=>!q.optional).flatMap(q=>q.nodeIds);
  c.scenes.hub.choices=[...nodes,...c.companions.map(x=>x.campScene),'spring_mandate','council'].map(id=>({id:id==='council'?'final_council':`visit_${id}`,label:`${c.scenes[id].arc} · ${c.scenes[id].title}`,description:c.scenes[id].location||c.scenes[id].title,requires:all({sceneUnlocked:id},c.scenes[id].requires||{}),next:id,effects:{},repeatable:true}));
}

function addFinalChapter(c){
  const oldCharter=c.scenes.A4.choices.find(o=>o.id==='charter');oldCharter.effects.flags.charter_signed=true;
  const groups={A:[],B:[],C:[]};
  const branches=[
    {k:'power_commons',g:'A',dir:'assembly',title:'三把仓钥',map:'thing',need:all(f('grain_common'),f('archive_preserved')),action:'把原账留在三户桌上，铸三把互不替人的仓钥',price:'须已建公共粮源并保住可核原稿；领粮户自己轮值，谁都不取得永久征工权。',facts:{federated_store:true},text:[
      '西格丽德带着原账进庭，没有带内里的誊手。玛伦把第一把钥挂在自己腰上，第二把给管夜火的渔民，第三把压在原页下。她们不肯让一把总钥再留在外来者手里。',
      '托吉尔只答应在解冻前核两次仓，不肯替下一代签字。弗里盖尔把修好的铰钉交给玛伦，能否去西岸仍按他真实那条船。你们须把仓里的粮、值夜和认错的办法一项一项交出去。'
    ],ending:['三把钥匙没有锁住同一只手。原账与印稿各留一份，领粮户能指出哪一行写错，守户能拒绝未经问过的下一次差事。仓门首次不靠一名强者活着才开。','你们若已押船守港，那条船便守在公共桩上，任期没有随着终章结束；若它已另有用途，三户也照着实际交接轮值。这样的春天少了绝对效率，也少了一把可以轻易抢走全湾的总钥。']},
    {k:'power_refuge',g:'A',dir:'assembly',title:'新住民的长凳',map:'thing',need:all(f('witnesses_safe'),any(f('sheltered'),f('resettled'))),action:'请新住民本人入庭，把两张真实席位留给他们',price:'须证人已获保护、六人的去处已落实。旧守户让出两席；新来者的声音不再只在求粮时被听见。',facts:{newcomers_seated:true},text:[
      '斯万把网梭放在空凳上，哈康捎来的裂柄锤放在另一张。他不愿回来任职，便由愿留下的成年棚工伊杜娜自己坐下；一把旧物不算替远行人投票。',
      '老守户少了两席，托吉尔把祖父坐过的长凳挪开半尺。他要求新住民也核夜火与修路，玛伦答应把条目写成每季可重议。已经被护送的人如今能改变屋里做出的决定。'
    ],ending:['两名新住民有了真实席位，过冬不再只是让他们暂时待在门内。旧守户失去一部分独断权，新来的人也承担可数的夜火与修路，不能只以受难为名永久免问。','斯万有了发言的位置，哈康仍按自己的愿望往西岸做工。他留下的锤没有替他投票。你们的船与任期依春议的承诺留下，港湾的“我们”却已包括原来只被称为门外六人的人。']},
    {k:'power_buyout',g:'A',dir:'bargain',title:'烧掉的独占条',map:'harbor',need:all(f('harbor_charter'),any(gold(16),f('inland_grant'),f('party_ship_bonded'))),action:'以真金、内田或押船兑清港权，取回独占条',price:'需已经签过港约。现金赎回16枚；可交真实内田，或守港押船加8枚。钱、地与船不能赎回后仍完整留在自己名下。',facts:{port_redeemed:true,harbor_charter:false},text:[
      '内里把独占条摊在潮湿的船板上，只认实际到账或能交付的地与船，不认一席感动人的话。托拉当场数钱，或看守户移交地凭，最后才让开封蜡盒。',
      '西格丽德把烧到一半的条子从火里夹出，留一角作已结清的凭证。若交的是内田，新的高地村便少了那块地；若交的是船，来年的出海也不再属于你们。她不把赎回写成从来没有签过。'
    ],ending:['独占卸货权已被实物兑清，小船重新有了不经过黑帆秤的泊位。内里收走了实钱、内田或押船之一；他失去垄断，却没有凭一句“公道”被抹掉真实承担过的船险。','被拿去赎港的那样东西确实不在原主手中。你们不能同时向高地住民许下已交出去的田，也不能把已作偿价的船再许给证人。自由港的代价不是一座好看的碑，而是一份所有人能点清的交割。']},
    {k:'power_treaty',g:'A',dir:'bargain',title:'种粮换潮路',map:'harbor',need:all(f('seed_bonded'),any(f('harbor_charter'),f('cargo_sold'),f('port_yielded'))),action:'把黑帆种债与湾口卸货合成有限互市约',price:'需真买过黑帆春种、且黑帆仍有一项港口权或已售货。免去独占，来春十分之一收成仍归船主。',facts:{mutual_trade:true,harbor_charter:false},text:[
      '内里不肯放弃全部利润，却愿用独占条换来春的种粮分成。斯万问若种子不活怎么算，他第一次把“按实收、不借下一代”写在自己的印边。',
      '托拉改守公用泊位，护船人领的是这一季的工资。黑帆仍在湾里，火塘也仍在湾里；两边须共同面对歉收，不能再把所有风险塞进别人的冬粮。'
    ],ending:['黑帆失去独占泊位，获得只按实际收成计的十分之一。每艘船与每块种田都留下可核条目，坏收成不再自动长成下一代的债，商人仍能从来春挣到钱。','这不是把外来者赶净的胜利。湾里要与内里一同生活，种粮人也要看见分成从自己粮里装船。你们兑现了春议的实际投入，留下的是可重议的往来，而非一次誓言把利益永远缝平。']},
    {k:'power_split',g:'A',dir:'assembly',title:'两岸各自的钟',map:'harbor',need:all(any(f('forest_closed'),f('weir_open')),f('grain_common'),f('new_oath')),action:'由已同意轮仓的各户，按断路与水线分两岸开门',price:'需真实公共粮源、各户已立有限新约，且林道冬闭或侧闸已开。组织者同意分权，不能凭空分掉别人的仓。',facts:{two_shores:true},text:[
      '断路把两边的修栏时辰都拖长了。托吉尔把旧总钟搬到北岸，西格丽德在南岸挂一只旧锅；两边按不同潮线开仓，不再等一声从风里听不清的钟。',
      '有亲人分住两岸，争的第一件事便是渡人的费用。你们让两份账互留副本，约明人和信不收港税，货则各自核。旧共同体变小了，谁负责哪一段终于不再靠一个含混的名字。'
    ],ending:['北岸敲钟，南岸敲锅，两边各有能开门的人。断路与侧闸没有被一纸和解变成桥，夜火和粮账按真实距离分成两份，彼此仍交换副本。','亲人要多过一段水，商船要多核一道秤。分湾没有消除争端，却使一个岸上的富户不能再借全湾之名征另一个岸的工。你们为春议押出的船或木料按原承诺留下，这个决定不再把它许到两边同时使用。']},
    {k:'power_saltcrown',g:'A',dir:'command',title:'领过薪的盾墙',map:'thing',need:all(f('ration_rule'),f('guard_alliance')),action:'让托拉按已付薪饷结盾阵，执行强制配给与宵禁',price:'必须真实夺仓并雇到六名护船人。命令有了武力来源；他们只守已付的钱与期限，不成为无限军队。',facts:{ration_regime:true},text:[
      '托拉把六人的薪袋一一摆在仓门前，再令他们举盾。西格丽德第一次必须在领粮前报出家里成年人的姓名；有人肯换稳定配给，有人把碗翻过来。',
      '弗里盖尔若已退出，不会出现在执行队里。玛伦要求夜里仍准送病人，托拉等你们一句明令。你们得到的不是所有人的同意，而是一支确实领过薪、也可能在到期后放下盾的队伍。'
    ],ending:['配给与宵禁真实实施，仓里的粮按你们的名册发。六名护船人的工资给命令添了重量，反对者也清楚地看见该到哪一扇门申诉，或该从哪条小路离湾。','这份权力有薪期、有粮期，也有被迫上工的人。弗里盖尔是否离开、霍格娜是否拒绝、索尔维格是否撤名，仍各按他们真实经历；他们的缺席不能被一句天下太平补回。你们若押船留任，下一冬便须亲身面对盾墙后的反抗。']},
    {k:'power_protector',g:'A',dir:'command',title:'炉边的紧急名册',map:'forge',need:all(f('craft_alliance'),f('forge_safe'),any(f('witnesses_safe'),f('false_accusation'))),action:'按保炉承诺组织锻工盾队，设只到解冻的护持名册',price:'需真实锻工联盟与安全锻棚。证人保护或已有诬告使治安争端无法回避；锻工获得优先修门，其他户排在后面。',facts:{craft_protectorate:true},text:[
      '锻工把锤挂在盾后，先抬来自己三家的门。托吉尔不喜欢这份偏序，却承认没有现成的人手能守每条夜路。名册写明到解冻散队，不写为“从此”。',
      '伊尔莎的名字是否被诬告过，旁听人都记得。你们须容许受影响的人在守卫之外另找见证，不把眼前的治安危机变成洗净旧错的借口。若随后拆了炉，锻工也会照明说过的条件离队。'
    ],ending:['有条件的锻工护持取代了一个常任港主。夜路得到巡守，炉边三家先修好门，其他户因此付出等待；“临时”被刻成到解冻的日期，而非一枚永不退出的印。','这份秩序的底座是炉火与有限约，炉若拆掉、优先修门若不兑现，盟友便会散去。受保护的证人或被诬告的人仍各有自己的去处；你们不能拿守住道路证明过去所有指控都对。']},
    {k:'power_depart',g:'A',dir:'either',title:'没有总钥的旅人',map:'harbor',need:all(any(f('grain_common'),f('grain_delivered'),f('ration_rule'),f('oath_failed')),any(f('sheltered'),f('resettled'))),action:'让总钥留在湾户，撤去已发或未接的征工提案',price:'须已经明确粮仓结果与六人的实际去处。粮已分出的不追回；春议押过船便失押船，今后不再以队伍名义征粮。',facts:{key_relinquished:true,forced_labor_order:false},failed:true,text:[
      '西格丽德把总钥放在湾户桌边。曾拿过的人交回，从未接过的人明确拒领。托拉核清自己的薪期，内里收回能指明的货，托吉尔把没能成立的新保划掉。',
      '若你们曾押船担任期，船便留下抵那份未做完的守港；若船已给证人或拆作梁，便按原去处留在那里。队伍可以离开，欠下的实物与已经救成的人都不会随脚印一同消失。'
    ],ending:['总钥留在湾户，队伍退出以自身名义征粮的支配。已经发出的粮仍在领粮者手里，没有为挽回面子再索回来；未成的复约由湾里人继续争。','押船守港而退任的人失去了船，许船护证的人留下船舱，拆船建屋的人只带走龙首上的一枚钉。离开有真实代价，也有停止扩大命令的自由。来春若再来，你们须以客人的身份敲门。']},
    {k:'memory_court',g:'B',dir:'public',title:'有边界的证席',map:'thing',need:all(f('living_proof'),f('archive_preserved'),no(f('coerced_witness')),no(f('false_accusation')),no(f('witness_exiled')),any(f('new_oath'),f('creditor_receipt'))),action:'请自愿证人与原稿持有人分别发言，核定具体赔偿',price:'须活证、原稿与庭上可承认的约或地凭俱在，且从未逼证、诬告或放逐伊尔莎。公开更正不能自动召她回来。',facts:{limited_court:true},text:[
      '伊尔莎只说自己没拉住绳，布兰德只指两种纸的齿口，赫瑞德读完儿子的路费清单。三种话没有被并成一张全知的脸。内里与雾姊各认自己曾写出的句子。',
      '索赔按哪份假纸造成哪笔新增债来核，既有粮利与伪造利息分开。赫瑞德必须在听不见凶手名字的安静里坐完这一场；伊尔莎随时可以不再答一个越过自己所见的问题。'
    ],ending:['证席没有找到一个被藏起来的推石者，找到了能指认的新利息、假纪念和具体受害人。赔偿沿实存账页结，不沿谁哭得更响结，伊尔莎也没有为父亲的悲伤再认一次罪。','赫瑞德要面对儿子曾计划离开的事实，霍格娜要面对自己写过的慰语。你们若已把船给证人，它将带着原稿与愿走的人继续护航；若另有使命，庭议留下自己的持有人，不能等冒险者永远回来主持。']},
    {k:'memory_archive',g:'B',dir:'public',title:'纸比一座厅走得远',map:'harbor',need:all(f('press_network'),f('stone_honest')),action:'把原读、更正与雾姊旧信分装成三份流动稿',price:'须已建印稿网与诚实碑文。护证使命用自有住船载稿；其他使命须另出一份行粮给搬运人与第一程。',facts:{travelling_archive:true},text:[
      '索尔把三捆纸分别交给三名船工，故意没有让它们都登同一艘船。索尔维格的错读与更正并排，霍格娜的旧慰语也留下名字。学堂收走的讲席不再是她们唯一能说话的地方。',
      '赫瑞德问能否少印儿子的路信，索尔把那一页抽出，只留获准的行程事实。更正要传得远，仍不等于所有私话都该上船。你们把纸送走之后，便不能随意收回每个读者的判断。'
    ],ending:['三份稿离开不同的泊位，旧读与更正没有再被磨平。索尔成为流动印工，索尔维格失去的讲席没有原位返还，她却有了学堂门外的读者；霍格娜也不能再把旧错藏在只有自己保管的抽屉里。','公开带来争论与新的抄错，不带来随时抹除的权。你们交出的船若载着证人，它要继续走那些愿接稿也愿核稿的岸；无论何人执港，想把一场死只印成一种用途，都比从前难了。']},
    {k:'memory_exile',g:'B',dir:'public',need:all(f('false_accusation'),f('guard_alliance')),title:'护送船上的替罪者',map:'harbor',action:'让已领薪的护船队执行流放，保住那份撤债交换',price:'须真有假指控和有薪护船队。伊尔莎被押离；母亲得到护送，赫瑞德只这一户的新增利息被撤。',facts:{scapegoat_deported:true},failed:true,text:[
      '伊尔莎上船时没有再求你们读一遍原稿，只把未签过的空纸塞给母亲。托拉按已领的钱押送，护船人不必相信案子才会把板搭到岸边。',
      '赫瑞德的粮桶终于装满，他站在岸上，说不出“替我儿子”四个字。撤去的是他这一户新增的利息，活下去的也是具体一位病母；离乡的罪却落在一个没有推石的人身上。'
    ],ending:['护送船带走了无辜的伊尔莎，账房撤掉赫瑞德这一户新增粮利，也把她的病母平安送往接收人。两件好处都真实，假指控也真实，不能拿其中一件冲销另一件。','赫瑞德留下粮而失去继续把自己只看作受害父亲的安稳。你们若已许船护证，船舱也无法把已经押走的人自动赎回；下一次有人问起原案，海上的空白纸会比纪念碑更难回答。']},
    {k:'memory_father',g:'B',dir:'shelter',need:all(f('kari_departure_letter'),f('hred_heard_wish')),title:'父亲拆下床头的护符',map:'thing',action:'由赫瑞德自己拆开路信，交还儿子曾要的离乡名字',price:'须亲至雾厅带回未寄信，并在旧慰语被揭开后把信交给父亲。不是复生，也不能拿不下行的推论替代。',facts:{father_released_son:true},text:[
      '赫瑞德把护符从儿子空床头拆下来，读到“芮芙那里或有船工活”时停了很久。“他连想走都怕我挨冷。”父亲没有因为你们说了真话便立即感激。',
      '他亲手把旧继业册合起，允许把纪念改为卡里曾计划去的海岸，而非替全湾赴死。霍格娜不再替他补一句好听的话；你们也不把这个迟到的准许冒充卡里能够收到的赎回。'
    ],ending:['护符离开了空床，继业册不再替死人留一个必须回来的位置。赫瑞德第一次把“我想他留下”与“他愿意留下”分开，仍会在某些清晨忘记自己已经分过。','卡里没有因此复生，也没有被写成愿意死亡的人。他死前想去的海岸成为家属同意的纪念去处；你们交出的住船若仍护人，便将这段被允许的名字带去那里，不能替父亲保证从此不再悲伤。']},
    {k:'memory_sanctuary',g:'B',dir:'shelter',need:all(f('witnesses_safe'),any(f('sheltered'),f('resettled'))),title:'灯屋不问作证的回报',map:'hel',action:'把获保护的人安顿进有接收者的灯屋与船舱',price:'须人已获保护、住处已落实。住船或拆船梁可直接承接；守港使命另出两份料，不能把同一船再许一遍。',facts:{witness_sanctuary:true},text:[
      '玛伦带来两床干毡，索尔在门楣刻一盏小灯。住进来的人可以沉默、可以离开，不须每晚重复一次受害经过来偿还屋顶。伊尔莎是否愿来，仍按她实际有没有被你们逼过。',
      '赫瑞德送了一桶粮，没有要求换儿子的最后一句话。霍格娜把自家旧雇钱也放下，接下来少一份丧礼工便少吃一点；屋里的安全不能只靠她一句不值钱的愿望。'
    ],ending:['灯屋与住船有了实际床铺，获保护的人不再必须在庭上不断出示自己的痛苦。沉默仍可住宿，愿走的人也可带自己的名字离开；被逼过的伊尔莎没有被你们自动写成和解的见证。','供粮、修门和护航各有真承担者。你们若已交船护证，队伍今后靠护航而非载货谋生；若船早拆成梁，灯屋便吃掉那些梁，土地工程少一份同样的料。庇护是会持续花掉日子的生活。']},
    {k:'memory_mercy',g:'B',dir:'shelter',need:all(f('lie_maintained'),f('medicine_contract')),title:'带药箱的慰语',map:'thing',action:'按账房留稿约发药，并公开承担那句安慰是假话',price:'须卖过纪念假话并换到实际药箱。药能治病，稿仍由账房控制，无法以善意收回。',facts:{mercy_fiction_instituted:true},text:[
      '病母的痢疾缓下来，药箱里一格格空了。账房用同一辆车送来新纪念稿：卡里仍被写作甘愿留下的人。赫瑞德摸着儿子的护符，没有说自己不知道。',
      '你们在发药桌前承认这句是活人写的慰语，不再谎称来自雾厅；内里却只同意在下一批印角加一行小字。已有的纸还在各家墙上，好处与假话一起成为这项安排的根。'
    ],ending:['真实的止痢药进了病人的身体，虚假的纪念仍挂在墙上。新增的小字承认慰语由活人所作，没有使已经读过它的人一夜忘记。账房控制着药与印稿，队伍承担的是明知有错仍借它救眼前病人的责任。','霍格娜是否再与你们同行取决于她真实的选择，不能凭一箱药恢复同意。赫瑞德知道自己用什么换到这一冬，下一批药断了时，也不再能把所有决定推给一个早已死去的孩子。']},
    {k:'memory_gate',g:'B',dir:'either',need:all(f('echo_vessel'),any(f('weir_open'),f('forge_safe'),f('salt_channel_cleansed'))),title:'最后一盏灯倒进水里',map:'hel',action:'放弃未能筹齐的公开／庇护案，以灯座封本地雾桥回路',price:'须实际带回灯座与可用侧闸、净渠水或炉温。可从任何未实施计划退到此案；代价是永久失去这段往返雾路。',facts:{hel_local_gate_sealed:true},text:[
      '鲁娜按先前留下的灯座图把灯倒置，水里第一次没有复出她刚说的话。残灯也能完成这一步，只是倒下以后再不能拿它装回声。索尔若在身边，自愿抽掉归路的一根绳；若已远行，便由鲁娜做完。',
      '赫瑞德站在桥外，没有再要求借道多问一次。你们封住能被假纸反复牵动的这段路，也失去再来听卡里的可能。活人将靠留下的纸、记忆和可公开承认的未知继续说话。'
    ],ending:['本地雾桥不再给活人往返，湿纸里的借名回声也失去反复寻找嘴唇的路径。这里并没有裁决所有死者的归处，只是人们自己关掉一扇会让悲伤与谎言共同进出的门。','赫瑞德不能再请雾姊替他多问一次，霍格娜失去旧行当的一部分，也可能终于另谋生计。你们护人所用的船仍须照承诺走；从此每一份报告更依赖活人的诚实，封桥不会替你们保管这份诚实。']},
    {k:'memory_echo',g:'B',dir:'threshold',need:all(f('echo_vessel'),no(f('echo_vessel_damaged')),f('forge_safe'),no(f('forge_dismantled')),no(f('undertaking_homeland_dismantle'))),title:'会回答旧话的潮钟',map:'forge',action:'把完整灯具接进炉边潮钟，只让它重复已录的话',price:'须保住整灯与安全炉，且未把炉预留拆除。选此案即保留炉心，之后不能再把同一炉拆去净渠。',facts:{tide_echo_bound:true},text:[
      '完整灯具在炉边亮出一圈冷光，潮钟只在水压推到旧刻痕时重复已录的一句。埃里克反复试它，故意问明日会不会有人死；钟只答昨天已经说过的话。',
      '弗里德芙自己提出留一季守钟，代价是错过南岸更好的炉工。旧灯图要求留说话人、时间与同意范围；霍格娜若已退出，不会被叫回来替新器具背书。你们拿到可用的怪异之物，也留下不断有人误听为预言的危险。'
    ],ending:['潮钟成为一件会重说旧话的器具，不能预知，能把旧水位与旧警告带到下一班人耳边。完整灯具和安全炉共同养着它，弗里德芙用一季在场、放弃南岸新工的时间照看。','已经有人把冷光叫作神谕，埃里克则把不能回答的问题贴在旁边。你们保留了怪异力量，没有把它洗成无害工具；霍格娜退出的决定仍有效，卡里的名字也没有因此成为任人役使的灵魂。']},
    {k:'homeland_wetland',g:'C',dir:'land',need:all(f('salt_seed'),any(f('weir_open'),f('rubbing_compared'),f('tide_notes'))),title:'让盐水有自己的田',map:'forge',action:'拆低闸一段，按实测改为耐盐小田与蓄潮泽',price:'须真实保盐种与潮线。拆船使命用已交船骨；其他使命需两份料。旧锻棚减产，不能同时算原水道已复原。',facts:{salt_wetland_restored:true,weir_open:true,forge_reduced:true},text:[
      '斯万把第一把盐种撒在一段曾铺木板的水边。你们拆下低闸，让水慢进慢出；新换过的榫若也在其中，就当面承认那笔已用过又不得不放弃的工。',
      '索尔维格不再用碑义说服种子。她按木尺与水痕划出可试种的窄条，余地留给潮。哈康若已去西岸，这里不替他留一间满产的铁铺；想留下的人从较小的粮与较大的水开始。'
    ],ending:['低地不再与潮争原来的每一寸，盐泽里出现一条可试种的田。旧闸拆去一段，锻棚减产，耐盐种也只许人们期待有限的一季；索尔维格在失去讲席后成为记录实测的量土人。','拆出的自有船骨若已交给这里，就沿泽边腐朽、支撑，而不再等着送你们回家。若材料另筹，护航与守港的旧承诺仍在。故乡活下来，却没有恢复成失灾以前的同一张地图。']},
    {k:'homeland_forge',g:'C',dir:'land',need:all(f('weir_repaired'),f('grain_common'),f('seed_commons'),f('archive_preserved')),title:'把锤与账都留在炉边',map:'forge',action:'把已修锻棚的工具交给实际做工者共同保管','price':'须闸已修、公共粮源与共同种在，并保有可核原稿。拆船使命可用船梁；其余使命另付两份料修工棚。',facts:{worker_forge_commons:true,solveig_field_school:true},text:[
      '弗里德芙把工具架上每把锤的旧记号擦清，再让工人各自认领保管。粮由公共仓来，种田占一段工时，不能再照原来的满炉产量许商队下一季。',
      '索尔维格在棚边开一张量尺桌，来的人先拿水痕与断榫，再谈旧字。她的学堂讲席没有自动回来，却有学徒愿把失掉的那份学费改作到场的工；哈康是否回来仍由西岸那封真实回信决定。'
    ],ending:['炉火和工具架由实际做工的人共同保管，公共粮与共同种让他们有资格拒绝以欠债之名加班。铁产少于商人最初许的满炉，田里的工也不能被当作不存在；这是一种肯承认产量上限的生计。','索尔维格办起量尺桌，失去的名师讲席被一所小而粗糙的田炉学校替代。你们交出的船梁成为棚屋的一部分，或另出的料填上相同缺口；没有同时保留那条船和这座工棚的两份漂亮账。']},
    {k:'homeland_trade',g:'C',dir:'land',need:all(f('seed_bonded'),f('inland_grant'),any(f('harbor_charter'),f('mutual_trade'))),title:'丰粮背后的第二道秤',map:'forest',action:'以未抵港债的真实内田建粮庄，按约交黑帆分成',price:'须已买春种、仍有黑帆港权或互市，且仍持真实内田。选案即把地交种粮户租用，不能延期后又拿它赎港。',facts:{bonded_granary_established:true},text:[
      '内里的新秤先到高田，种袋随后才到。每家拿种时听见同一句：只按实收计十分之一，不转下一代；有人觉得值得，有人把本想留下的种袋抱得更紧。',
      '斯万守着能长粮的地，托拉守着装分成的车。若港口已改互市，小船也能来买；若独占还在，黑帆的第二道秤便更重。你们给出的不是无代价的丰年，是一片已经有收成归属的田。'
    ],ending:['新种在高田站稳，粮庄让湾里第一次能看见下一年的剩余。黑帆的十分之一随车运走，种粮人不再能把全部产物自己留下，港约是否独占仍按此前实际结果。','这份富足有债、有秤，也有被明说的边界。索尔维格的田测可纠正坏种与坏水，不能替人们解除已经签过的分成；你们若拆船留乡，就要在自己的木梁下看见每年那一车粮离开。']},
    {k:'homeland_highland',g:'C',dir:'land',need:all(f('hill_seed'),f('inland_grant'),any(f('witnesses_safe'),f('archive_preserved'))),title:'内田上的新村门',map:'forest',action:'把未拿去赎港的真实内田交给愿迁来的各户',price:'须保高地种、仍持地凭且证人或原稿可核迁居。地给新住民便不能再抵一笔港债。',facts:{highland_village_founded:true,inland_grant:false,land_transferred:true},text:[
      '托吉尔沿旧田界走了一圈，拿掉自己祖父留下的无名界桩。愿迁来的各户分别点头，斯万只同意把冬网放进新屋，不肯说从此再不回潮岸。',
      '地凭交到新户手里，原稿与见证写明这里不再是随时能收回的借宿。高路远离海，也远离旧泊位；哈康留在西岸的工不能同时填上新村的铁匠缺。'
    ],ending:['新村建立在一块真实移交的内田上，高地种与迁居见证让人们不再只等屋主下一次心软。托吉尔失去祖地的一部分，港权赎价也少了一样可交换的实物。','斯万保留回海边织网的路，哈康的西岸工作留下一个尚待填补的匠位。你们拆下的船骨若用来立村门，海便从随时可走的门变成需要重新筹船才能到的远处；故乡向山里长出一个不同的名字。']},
    {k:'homeland_flotilla',g:'C',dir:'water',need:all(f('seed_flotilla'),f('frig_voyage'),f('boat_refitted')),title:'燕尾带走的种箱',map:'harbor',action:'由弗里盖尔掌燕尾，让各自愿意的人带浮箱去接收岸',price:'须真正放他修船离湾并保存可携种。自有长船若已拆，只剩燕尾的十二座，货与座位须取舍。',facts:{seed_flotilla_launched:true,frig_captain:true},text:[
      '弗里盖尔把最后一枚备用铰钉塞进工具袋，亲手松开船索。船肋轻响，他回身把燕尾十二个座位数给每个人听，种箱占掉其中两个；不能把全谷都写成已经上了这一条小船。',
      '斯万留在玛伦处，把一小把种托给愿去的人，哈康从西岸师傅那里等船。你们按名字核接收处与回信，不把离乡当作和留乡同一种胜利。芮芙会在岸边见到弟弟，也会见到他真正带来的陌生人。'
    ],ending:['燕尾抵达有接收人的岸，浮箱里的种与愿走的人得到真实去处。弗里盖尔成为掌舵者，妹妹芮芙见到活着的弟弟，而不是又一封替别人担工的信。斯万留了下来，迁居没有把她也写上船。','十二个座位意味着留下的货、留下的人和随后仍需安排的下一程。自有船若已拆作故土的梁，你们也必须接受这条小船的容量；新的海岸能开始生活，旧岸的闸与屋并未因此全部复原。']},
    {k:'homeland_dismantle',g:'C',dir:'water',need:all(f('bay_poisoned'),f('hagna_admitted'),no(f('undertaking_memory_echo')),no(f('tide_echo_bound')),any(f('ration_regime'),f('port_redeemed'),f('two_shores'))),title:'把炉心的借名钉拔出来',map:'forge',action:'停止锻棚，拔出接回声的借名钉，拆渠净盐水','price':'须淹损网棚、揭过假话并有真实改炉权，且未预留或造出潮钟。选案即封存炉心，不能再延期借它造钟。拆炉失去铁工生计。',facts:{forge_dismantled:true,forge_safe:false,craft_alliance:false,salt_channel_cleansed:true},text:[
      '盐渍从网棚一路连到炉下，旧借名钉在水里震响的，正是印稿曾反复说过的话。霍格娜认出自己给过这股声音的句子，没有再称它为天意。你们停止鼓风，拔钉、断渠，再把炉心抬出来。',
      '锻工收好锤离开，他们原本答应的是保炉，不是帮人拆掉自己的饭。斯万把第一张没沾新盐的网晾开，哈康却不能回来接一间已经拆空的铁铺。你们救回一条水路，真失去另一种生活。'
    ],ending:['炉心被抬走，借名钉不再替假话震响，晒网渠逐渐回到可洗可用的水。净水不是免费悔改：锻棚停止，保炉盟约终止，工匠带着锤去找别处的火。','斯万能再晾一张不带新盐的网，哈康若想返乡却找不到原先的铁铺。你们若已拆掉自己的船作料，这次不能又靠它送所有失业者走；必须在失去两种生计的岸上承担清水带来的另一种贫穷。']},
    {k:'homeland_reservoir',g:'C',dir:'water',need:all(f('forge_safe'),f('guard_alliance'),any(f('sheltered'),f('resettled'))),title:'被征作蓄潮盆的低地',map:'forge',action:'由有薪护船队清出低地，拆堤蓄潮保住上谷',price:'须真有护船队与安全炉，六名原棚工已另有去处。新征低田使三户失地，不因工程有效便视作他们自愿。',facts:{forced_tidal_basin:true,low_fields_flooded:true},text:[
      '托拉带着领过薪的人去敲三户田门。她们听过可能的潮位，仍不肯说把祖地变成蓄潮盆是自己的愿望。你们令队伍搬出能搬的器物，在水越堤前打开缺口。',
      '上谷锻棚没有被冲走，低地界桩却只剩一半露出水。六名原棚工早有实际屋顶，不被重新拖回险处；新失地的三户递来另一张账。工程成功不是赔偿已经付清。'
    ],ending:['蓄潮盆保住上谷与炉火，三户低田永久进水。护船队提供了执行的力量，田主的拒绝也被真实记录；他们没有因水退便自动认可征用，赔偿从此成为另一件可追的具体债。','此前安置的六人继续在实际屋顶下生活，新失地者也没有被一声“全谷得救”删去。你们拆船留乡时留下的木梁如今面对一片新水面，必须日常看见是谁的地让别人保住了火。']},
    {k:'homeland_watch',g:'C',dir:'either',need:all(any(f('salt_seed'),f('hill_seed'),f('seed_bonded'),f('seed_flotilla'),f('seed_failed')),any(f('sheltered'),f('resettled'))),title:'只够照这几扇门的火',map:'forest',action:'放弃全谷复工与春种扩张，把余种收作守夜引火料',price:'须已有真实的种或春种失败结果，且已落实六人去处。未来种粮与满炉计划被放弃，现有屋顶保住，不悄悄补回繁荣。',facts:{small_homeland_watch:true,seed_crop_abandoned:true,forge_expansion_abandoned:true},failed:true,text:[
      '斯万把余种移到火盆旁，先留下还能作纪念的一小把，其余逐夜作引火。玛伦数的不是下一年几仓粮，而是今晚哪几扇门必须有人看火。',
      '索尔维格没有要求他们为保住自己的讲席再去赌一场春种。她把失败记在尺边，领愿学的人量哪些屋还可住。哈康仍按真实船票去或留，低地的繁荣却不再被写成已经回来。'
    ],ending:['故乡缩成几扇轮流有人看火的门。队伍放弃扩种与满炉的许诺，种袋作引火，现有安置继续；这是一种保住眼前生活、承认失去来春增长的失败。','索尔维格失去的讲席没有被奇迹补回，她与愿意留下的人记录哪面墙还可支撑。你们若已拆掉出海船，就在这些门之间继续生活，不能在终章突然登上一条从未造好的船；想走的人仍需要另筹真实的下一程。']}
  ];
  const image={
    power_commons:'玛伦试完第三把钥，才把门推开：“别都挂我腰上。我也要睡。”',
    power_refuge:'伊杜娜先把长凳往火边挪了半掌，又推回去，抬眼问：“这回我可以说挪多少吗？”',
    power_buyout:'内里用缺口拇指在银边刮一下，忽然说：“去年冰裂吞了我弟弟半只船。这次总算有一条能划清的账。”',
    power_treaty:'内里把坏籽从秤盘拣出去：“坏的也算我的份。”斯万看着他拣完，才松开种袋。',
    power_split:'北岸钟声传过来时，南岸的旧锅刚好哑了一下；有人隔水笑骂它又冻住了。',
    power_saltcrown:'队尾一只空碗滚到托拉靴边，她先用脚挡住，再等你们决定还不还给那个人。',
    power_protector:'弗里德芙把散队的日期敲在自家门钉上：“这天以后，别举我的锤来敲别人的门。”',
    power_depart:'西格丽德用旧麻绳拴住总钥，没有抬头：“下回走客门。那边有热水。”',
    memory_court:'伊尔莎把旧绳往桌上推了一寸，停下：“到这里。我只记得这么长。”',
    memory_archive:'索尔拿沾墨的拇指压住第一捆纸的绳结，又赶紧擦掉，给不该被当作印的人名让出空处。',
    memory_exile:'病母把那张空白纸叠得极小，藏进女儿旧鞋的鞋垫；上船时，两人都没有再看岸上的碑。',
    memory_father:'赫瑞德把护符放回旧床头的浅印里，站了一会，又拿开，改挂到门边收来信的钉上。',
    memory_sanctuary:'第一位住客只问能不能吹灭床头灯。索尔点头，把问姓名的木片翻到背面。',
    memory_mercy:'发药桌上多摆的一只碗终于被赫瑞德收进柜里；量药的小杯，却留在他抬手就摸得到的地方。',
    memory_gate:'最后一声倒影散去以后，鲁娜又说了一个“走”字。水只响水的声音。',
    memory_echo:'埃里克在钟旁写下第一个问题——明日会怎样——又把整行圈住，留它永远答不出来。',
    homeland_wetland:'斯万把沾盐的手指在裙边擦净，终于肯把第一粒种放进湿泥：“这块，别再叫旧田了。”',
    homeland_forge:'索尔维格拿短炭头圈住一根榫：“先看它断在哪里。字等一等。”孩子与成年学徒一道蹲下看。',
    homeland_trade:'分成装车时，内里的秤盘一高一低，斯万等两边完全停稳，才用自己的指甲在账边压一个印。',
    homeland_highland:'旧田界桩没有劈柴，托吉尔把它横到新村门上；祖父的刻痕朝内，空的一面留给新来的人。',
    homeland_flotilla:'弗里盖尔在回信第一行写“船是我修的”，看了很久，才补上一句“也有人扶过船肋”。',
    homeland_dismantle:'最后一个锻工把锤头裹进旧围裙，留下木柄露在肩外；渠里的水声终于盖过了炉下的细语。',
    homeland_reservoir:'原田主仍在夜里把灯提到旧界桩旁，灯光先照见水，后照见对岸没有熄的炉。',
    homeland_watch:'夜班人听一粒余种在火里轻轻爆开，把一块小木片翻面，记下今夜已看过的第六扇门。'
  };
  for(const b of branches){b.ending[0]+=' '+image[b.k];b.text=b.text.map(p=>p.replaceAll('实际','').replaceAll('真实',''));}
  const buyout=branches.find(b=>b.k==='power_buyout');
  buyout.text[0]='内里从封蜡盒取出一块被冰割开的舱板，常用的算盘却收在它下面。“去年空返两趟。第三趟舱裂，我弟弟在水里扶了半夜。”他按住板缝，“十六枚。地凭也行。押船那份再添八。”托拉数完钱或接好地凭，他才将独占条移过板缝。';
  const father=branches.find(b=>b.k==='memory_father');
  father.text[0]='赫瑞德把护符从空床头拆下，顺手又放回那块浅浅的灰印，随后拿起。他读到“芮芙那里或有船工活”便停了，拇指在同一行蹭出一道亮痕。“他同我说，来春修北栏。”父亲这次没有把护符挂回去。';
  const basePlans={A:{assembly:'以各户议席重排仓与港',bargain:'拿真实财物与黑帆重谈',command:'把掌权所需的实际力量说清'},B:{public:'让原稿与证人在公开处各自说话',shelter:'先保护具体人和他们愿说的范围',threshold:'处理雾桥与回声本身'},C:{land:'给能活的种与愿住的人一块真地',water:'改变潮水、船或炉的位置',either:'缩小承诺，保现有屋顶与守夜'}};
  for(const [g,plans]of Object.entries(basePlans)){
    const arc=g==='A'?'盐与铁':g==='B'?'雾中回声':'第六行';
    c.scenes[`${g}7`]=sc(`${g}7`,3,arc,g==='A'?'春水前，谁有本事说了算':g==='B'?'灯照着谁，也就背向谁':'不是每个故乡都必须复原',g==='A'?'thing':g==='B'?'hel':'forge',[
      g==='A'?'托拉把空薪袋倒扣在桌上，西格丽德把仓钥放到袋外。筹到的盟友、已经让出的地与港、实际送来的人都在等一个能执行的安排。':g==='B'?'霍格娜把整灯或残灯摆在门槛上。原稿是否保住、索尔是否在场、父亲是否读过路信，都已经不能换成从未发生。':'斯万带种，哈康寄尺，弗里德芙带一枚拆下的榫。手里的材料已分过去，谁都不能再用同一条船许两个未来。',
      '春议的投入已经生效：押在港口的船、交给证人的船舱或拆下的船骨，各有实际去处。你们仍要把三条线做完，接下来只选择能够承担的办法。'
    ],Object.entries(plans).map(([dir,label])=>opt(dir,label,'先明确行动方向；下一处现场只提供已有物、人手与记录能支持的具体方案。',done(`${g}7`,`${g}8`,{flags:{[`${g}_plan_${dir}`]:true}})))) ;
    c.scenes[`${g}8`]=sc(`${g}8`,3,arc,g==='A'?'能拿上桌的代价':g==='B'?'一盏灯只能安在一处':'把下一季放在哪里',g==='A'?'thing':g==='B'?'hel':'forge',[
      '每份提案旁都摆着它实际需要的东西。缺的不是再讲一遍同样的话便会出现的人手；已送走的种、已给别人的地和已押出的船也不再空着。',
      '选定后就要付款、留物或交割，随后到单独的现场完成那一件事。若已无力复原全部，退去支配或缩小故乡也有实际做法，不能把没办成的事写成另一个胜利。'
    ],[]);
    c.scenes[`${g}8`].text={
      A:['托拉把坏靴搁到凳下，六只薪袋留在桌上。内里展开独占条，西格丽德在另一边按住仓钥。“我今晚去敲哪家的门？”托拉问，“到时让我拿什么说话？”','内里带着钱袋、地价和舟险来，西格丽德带着愿轮班的户名来。你们已经许出去的船也在岸上，各有去处。桌上的一笔要变成门外一夜，谁都在等你们把东西挪到该挪的那一边。'],
      B:['灯座旁摆着那封刮过“愿”字的信。霍格娜手里空了，索尔留下的刻刀却还压着纸角。鲁娜把刀背转过去，问：“先铺床，先开印，还是收灯？”','有人等一句可公开的话，有人只想先睡一个不被问话的夜。厚稿与灯具装不进同一只小箱的往事，谁都记得。筹不出原先想要的办法，还能把灯倒下去；只是这条雾路也会跟着合上。'],
      C:['斯万把活籽排成一行，坏籽排成另一行，两行之间搁着哈康寄来的木尺。索尔维格把地图挪远一点：“先说这袋落哪块土。别先给它起好名字。”','田界有人守，炉边有人等工钱，船梁也已经从一条船上拆下。你们可以把水放进地，也可以让人离开水边；若只够保这几扇门，便先把许过的满炉与丰收从纸上划掉。']
    }[g];
  }
  for(const b of branches){
    const stageId=`${b.g}9_${b.k}`,plan=b.dir==='either'?{}:f(`${b.g}_plan_${b.dir}`),chapterFlag=`${b.g}9_done`,quest=b.g==='A'?'oath':b.g==='B'?'mist':'stone';
    const setup={flags:{[`${b.g}8_done`]:true,[`undertaking_${b.k}`]:true},unlockScenes:[stageId]};
    const add=(id,need,extra={})=>c.scenes[`${b.g}8`].choices.push(opt(id,b.action,b.price,merge(setup,extra),{requires:all(plan,b.need,need||{})}));
    if(b.k==='power_buyout'){
      add('buyout_cash',gold(16),{resources:{gold:-16},flags:{charter_paid_cash:true}});
      add('buyout_land',f('inland_grant'),{flags:{inland_grant:false,charter_paid_land:true}});
      add('buyout_ship',all(f('party_ship_bonded'),gold(8)),{resources:{gold:-8},flags:{bonded_ship_transferred:true}});
    }else if(b.k==='memory_archive'){
      add(b.k,f('witness_ship'));add(`${b.k}_paid`,all(no(f('witness_ship')),food(1)),{resources:{supplies:-1}});
    }else if(b.k==='memory_sanctuary'){
      add(b.k,f('witness_ship'),{flags:{witness_ship_occupied:true}});
      add(`${b.k}_beams`,all(f('ship_beams'),no(f('ship_beams_used_for_land'))),{flags:{ship_beams_used_for_sanctuary:true}});
      add(`${b.k}_paid`,all(no(f('witness_ship')),any(no(f('ship_beams')),f('ship_beams_used_for_land')),food(2)),{resources:{supplies:-2}});
    }else if(['homeland_wetland','homeland_forge'].includes(b.k)){
      add(b.k,all(f('ship_beams'),no(f('ship_beams_used_for_sanctuary'))),{flags:{ship_beams_used_for_land:true}});
      add(`${b.k}_paid`,all(any(no(f('ship_beams')),f('ship_beams_used_for_sanctuary')),food(2)),{resources:{supplies:-2}});
    }else if(b.k==='homeland_highland')add(b.k,{}, {flags:{land_reserved_for_highland:true,inland_grant:false}});
    else if(b.k==='homeland_trade')add(b.k,{}, {flags:{land_reserved_for_granary:true,inland_grant:false}});
    else if(b.k==='homeland_dismantle')add(b.k,{}, {flags:{forge_reserved_for_dismantle:true}});
    else add(b.k);
    const final=done(stageId,'council',{flags:{[chapterFlag]:true,[`core_${b.k}`]:true,...b.facts},quests:{[quest]:b.failed?'failed':'done'}});
    c.scenes[stageId]=sc(stageId,3,b.g==='A'?'盐与铁':b.g==='B'?'雾中回声':'第六行',b.title,b.map,b.text,[opt('commit',b.action,'履行已经选择并付出代价的方案；该线结果正式成立。',final),opt('defer','先回长屋，做完另两件仍待的事','所留材料与已付的钱不会退回，方案暂不交割。',{}, {repeatable:true})],f(`undertaking_${b.k}`));
    groups[b.g].push(stageId);
    b.sceneId=stageId;
  }
  c.endings=branches.map((b,i)=>({id:b.k,title:b.title,text:b.ending,priority:100-i,requires:all(f(b.g==='A'?'priority_power':b.g==='B'?'priority_memory':'priority_homeland'),f(`core_${b.k}`)),coreFacts:[`core_${b.k}`,...Object.keys(b.facts)],setupSceneIds:[`${b.g}7`,`${b.g}8`,b.sceneId],causalRequirements:b.need,domain:b.g}));
  c.epilogues.push(...branches.map(b=>({id:`result_${b.k}`,title:b.title,requires:f(`core_${b.k}`),text:b.ending.join('\n\n')})));
  c.epilogues.push(
    {id:'mandate_power',title:'押在公共桩上的船',requires:f('party_ship_bonded'),text:'队伍把自有长船押给湾户并承诺任期。赎港或退任是否使船真正转手，按已经支付的方式记录；船不能又作证人住船或工程木。'},
    {id:'mandate_memory',title:'不再装队伍货的船舱',requires:f('witness_ship'),text:'自有长船改成证人住船，队伍承担护航。稿、人、种与座位按真实用途安排，土地工程须另筹同样的木。'},
    {id:'mandate_homeland',title:'拔下的龙首',requires:f('party_ship_dismantled'),text:'自有长船已经拆开，队伍失去原来的出海工具。船梁只能用于一次已经选择的庇护或土地工程；若要迁海，必须依实际修好的燕尾与接收岸。'}
  );
  c.epilogues.push(
    {id:'frig_missed_work',title:'一季没有补回的船匠活',requires:f('frig_missed_berth'),text:'弗里盖尔为自己答应的两趟修栏误过原班船，芮芙替他找的一季活被别人接去。后来即便修好燕尾，也没有把那份工倒补回去。'},
    {id:'frig_spring_departure',title:'说定春潮才走的燕尾',requires:all(f('frig_departure_promised'),no(f('seed_flotilla_launched'))),text:'其余交割结束后，弗里盖尔按自己定下的船期带工具启航去见芮芙。没有随船迁种的那条路线，也仍兑现他的离湾；他不在两处同时守栏。'}
  );
  c.scenes.council=sc('council',3,'终局','春潮已经到了门前','thing',[
    '仓钥、证人和土地各自有了已经实施的结果。桌上没有新开的价，只有押出的船、住进人的船舱或已经变成梁的船骨，提醒你们春议从来不是一句不用兑现的漂亮话。',
    '把最后的账交回实际持有人。你们接下的任期、护航或失船留乡会与最优先承担的那件结果一起进入来春，其余两条线的成败也完整留下。'
  ],[opt('close_book','交回真实账目，迎接已经造成的春潮','按独占投入与三线真实执行自动收束。此处不能换一张结局牌。',{}, {ending:true})],all(f('A9_done'),f('B9_done'),f('C9_done')));
  for(const [g,q]of [['A','oath'],['B','mist'],['C','stone']]){
    const quest=c.quests.find(x=>x.id===q);quest.nodeIds=[...[1,2,3,4,5,6,7,8].flatMap(n=>g==='B'&&n===4?['B4H','B4L']:[`${g}${n}`]),...groups[g]];
    quest.stages=Array.from({length:9},(_,i)=>({stage:i+1,chapter:Math.floor(i/3)+1,sceneIds:i===8?groups[g]:g==='B'&&i===3?['B4H','B4L']:[`${g}${i+1}`]}));
    quest.summary+=' 三章九个节拍，最后按实际交割完成或失败。';
  }
  c.worldStates=[
    {id:'bay_salt',requires:f('bay_poisoned'),mapId:'forge',summary:'盐水入晒网渠：网棚生计受损，六人已先撤到高处。'},
    {id:'side_gate',requires:f('weir_open'),mapId:'forge',summary:'侧闸打开：低地作业减产，高台可作临时宿处。'},
    {id:'new_pins',requires:f('weir_repaired'),mapId:'forge',summary:'新榫通过当季试水，仍须在来春复测。'},
    ...branches.filter(b=>b.g==='C'||b.k==='power_split'||b.k==='memory_gate').map(b=>({id:`world_${b.k}`,requires:f(`core_${b.k}`),mapId:b.map,summary:b.ending[0]}))
  ];
  c.expansionBranches=branches.map(({k,g,dir,need,sceneId,title})=>({id:k,line:g,plan:dir,requires:need,sceneId,title}));
  c.routeManifests=buildManifests(branches);
}

function buildManifests(branches){
  const proofs={
    power_commons:[['grain_common','A5'],['archive_preserved','B6']],power_refuge:[['witnesses_safe','B6'],['sheltered','C4']],
    power_buyout:[['charter_signed','A4'],['charter_paid_cash','A8']],power_treaty:[['seed_bonded','C6'],['port_yielded','A6']],
    power_split:[['grain_common','A5'],['new_oath','A4'],['weir_open','C3']],power_saltcrown:[['ration_rule','A5'],['guard_alliance','A6']],
    power_protector:[['craft_alliance','A6'],['forge_safe','C3'],['witnesses_safe','B6']],power_depart:[['grain_common','A5'],['sheltered','C4']],
    memory_court:[['living_proof','B2'],['archive_preserved','B6'],['new_oath','A4']],memory_archive:[['press_network','B6'],['stone_honest','C5']],
    memory_exile:[['false_accusation','B5'],['guard_alliance','A6']],memory_father:[['kari_departure_letter','B4H'],['hred_heard_wish','B6']],
    memory_sanctuary:[['witnesses_safe','B6'],['sheltered','C4']],memory_mercy:[['dead_lie_sold','B5'],['medicine_contract','B6']],
    memory_gate:[['echo_vessel','B6'],['weir_open','C3']],memory_echo:[['echo_vessel','B6'],['forge_safe','C3']],
    homeland_wetland:[['salt_seed','C6'],['weir_open','C3']],homeland_forge:[['weir_repaired','C3'],['grain_common','A5'],['seed_commons','C6'],['archive_preserved','B6']],
    homeland_trade:[['seed_bonded','C6'],['inland_grant','A6'],['charter_signed','A4']],homeland_highland:[['hill_seed','C6'],['inland_grant','A6'],['archive_preserved','B6']],
    homeland_flotilla:[['seed_flotilla','C6'],['frig_voyage','A6'],['boat_refitted','A6']],homeland_dismantle:[['bay_poisoned','C3'],['hagna_admitted','B6'],['ration_regime','A9_power_saltcrown']],
    homeland_reservoir:[['forge_safe','C3'],['guard_alliance','A6'],['sheltered','C4']],homeland_watch:[['hill_seed','C6'],['sheltered','C4']]
  };
  const configs={
    power_commons:{A7:'assembly',A8:'power_commons'},
    power_refuge:{B6:'hide',A7:'assembly',A8:'power_refuge'},
    power_buyout:{A4:'charter',A5:'merchant',C4:'food_shelter',A7:'bargain',A8:'buyout_cash'},
    power_treaty:{A4:'charter',A5:'merchant',A6:'yield',C4:'food_shelter',C6:'buy',A7:'bargain',A8:'power_treaty'},
    power_split:{A7:'assembly',A8:'power_split'},
    power_saltcrown:{A4:'seize',A5:'rule',A6:'guard',C4:'food_shelter',A7:'command',A8:'power_saltcrown'},
    power_protector:{C3:'repair',A6:'crafters',B6:'hide',A7:'command',A8:'power_protector'},
    power_depart:{},
    memory_court:{B7:'public',B8:'memory_court'},
    memory_archive:{B6:'print',B7:'public',B8:'memory_archive'},
    memory_exile:{B5:'blame',A6:'guard',B6:'lantern',B7:'public',B8:'memory_exile'},
    memory_father:{B3:'walk',B4:'public',B7:'shelter',B8:'memory_father'},
    memory_sanctuary:{B6:'hide',B7:'shelter',B8:'memory_sanctuary'},
    memory_mercy:{B5:'sell_lie',B6:'bargain',B7:'shelter',B8:'memory_mercy'},
    memory_gate:{},
    memory_echo:{C3:'repair',B6:'lantern',B7:'threshold',B8:'memory_echo'},
    homeland_wetland:{C6:'wash',C7:'land',C8:'homeland_wetland'},
    homeland_forge:{C3:'repair',C6:'wash',C7:'land',C8:'homeland_forge'},
    homeland_trade:{A4:'charter',A5:'merchant',C4:'food_shelter',C6:'buy',C7:'land',C8:'homeland_trade'},
    homeland_highland:{C7:'land',C8:'homeland_highland'},
    homeland_flotilla:{A6:'frig_boat',C6:'float',C7:'water',C8:'homeland_flotilla'},
    homeland_dismantle:{C3:'divert',A4:'seize',A5:'rule',A6:'guard',C4:'food_shelter',C6:'fuel',A7:'command',A8:'power_saltcrown',C7:'water',C8:'homeland_dismantle'},
    homeland_reservoir:{C3:'repair',A6:'guard',C6:'fuel',C7:'water',C8:'homeland_reservoir'},
    homeland_watch:{}
  };
  return branches.map(b=>{
    const v={A1:'salvage',A2:'extract',A3:'paper_witness',B1:'refuse',B2:'consent',B3:'living',B4:'limited',C1:'compare',C2:'trade',C3:'open',A4:'rotation',A5:'commons',A6:'land',B5:'correct',B6:'admit',C4:'grain_shelter',C5:'season',C6:'hill',A7:'command',A8:'power_depart',B7:'threshold',B8:'memory_gate',C7:'either',C8:'homeland_watch',...configs[b.k]};
    const seq=[['prologue','land'],['A1',v.A1],['B1',v.B1],['C1',v.C1],['A2',v.A2],['B2',v.B2],['C2',v.C2],['A3',v.A3],['B3',v.B3],['C3',v.C3],[v.B3==='walk'?'B4H':'B4L',v.B4],['A4',v.A4],['A5',v.A5],['C4',v.C4],['B5',v.B5],['C5',v.C5],['A6',v.A6],['B6',v.B6],['C6',v.C6],['spring_mandate',b.g==='A'?'power':b.g==='B'?'memory':'homeland']];
    for(const g of ['A','B','C']){const action=v[`${g}8`];const outcome=action.startsWith('buyout_')?'power_buyout':action.replace(/_paid$|_beams$/,'');seq.push([`${g}7`,v[`${g}7`]],[`${g}8`,action],[`${g}9_${outcome}`,'commit']);}
    seq.push(['council','close_book']);
    const majorFacts=proofs[b.k].map(([flag,sourceScene])=>({flag,sourceScene,sourceChoice:seq.find(([id])=>id===sourceScene)?.[1],sourceExpected:true}));
    return {id:b.k,sequence:seq,expect:{endingId:b.k,coreFacts:[`core_${b.k}`],finalFacts:b.facts,majorFacts,missionFact:b.g==='A'?'party_ship_bonded':b.g==='B'?'witness_ship':'party_ship_dismantled',causalRequirements:b.need,allStageFlags:['A9_done','B9_done','C9_done']}};
  });
}
