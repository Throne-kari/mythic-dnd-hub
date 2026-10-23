// 原创结局：第十四节实缴并锁定方案，第十五节授权执行，重心由第二章的舟契决定。
const f=id=>({flag:id}), no=c=>({not:c}), all=(...v)=>({all:v}), any=(...v)=>({any:v});
const food=n=>({resourceAtLeast:{supplies:n}}), gold=n=>({resourceAtLeast:{gold:n}});
const need=(...ids)=>all(...ids.map(f));

export const endingBranches=[
  {id:'land_commons',domain:'A',title:'没有王主的第一垄',action:'把王田与种粮交给已立约的各户',price:'行粮−2作开垄工食；队伍与旧王族都放弃王田私租。',requires:all(need('grain_common','assembly_charter'),food(2)),payment:{resources:{supplies:-2}},facts:{common_land:true,royal_rent_abolished:true},tone:'明亮而艰难',sourceRefs:['CE01'],text:[
    '费尔加把王庭的量地绳剪成等长的三段。每段交给一组已经签过共同粮契的人，土地不随队伍的离开回到王座，也不因某户出力较多便变成他们可以卖掉别人的产业。',
    '穆伊琳从第一垄拔出那根原先通向王座的荆根。断根没有替人犁地，工食也只够眼前的开垄。你们要把已付的口粮送到田头，并亲口撤去王田私租，才算完成这场交接。'
  ],ending:[
    '春草在没有王印的垄沟里长出来。共同粮契成为分地与留种的依据，王庭失去向这片地永久收租的权力。有人嫌分得太少，有人要求多留一块牧地；他们第一次可以在不向王座下跪的桌前争执。',
    '费尔加没有成为替你们收税的新主人。他把断绳挂在田屋门上，自己只领答应做的那一段修路。穆伊琳仍会在旱季沉默，土地的生机也仍需要人手；这个结局留下的是能被活人改写的分配办法。'
  ]},
  {id:'land_bounded_crown',domain:'A',title:'要先被拒绝的王',action:'将淬过的荆冠交给受季约约束的王庭',price:'共同金钱−4付首季田工；王庭须交出任意征工与增税之权。',requires:all(need('king_compact','crown_tempered'),gold(4)),payment:{resources:{gold:-4}},facts:{bounded_crown:true,royal_commands_reviewable:true},tone:'和解',sourceRefs:['CE01','CE03'],text:[
    '荆冠上的倒刺仍在，内圈却衬了已经淬定的银箍。费尔加先读出王约里第一句允许拒绝的条目，原来被当成违誓的人才敢抬头看王座。',
    '田工等到四枚工钱落袋才去接灌渠的绳。穆伊琳要求的不是一张光洁的王脸，而是下一次欠收时谁先少吃、谁可以说不。你们把这两项权从王手里剥出，冠才可以戴上。'
  ],ending:[
    '荆冠重新有了佩戴者，王命却第一次可以被拒绝、搁置和当面复议。下一季的田工已经领薪，若王庭要再开新渠，就须再次说明粮与工钱的来处。王权保住了调度与守土，也失去了把任何异议叫成叛誓的便利。',
    '费尔加留在王庭，却在盾内刻下那句拒令条款。臣民仍会犯错，王也仍会偏袒；银箍不会替人主持公道。它只让下一次扯下王冠的人，不必先把自己说成推翻整个天地的罪人。'
  ]},
  {id:'land_partition',domain:'A',title:'断冠的两片土地',action:'按已经勘定的地界拆开王土，交割两份土地权',price:'毁去断冠最后的继承印；队伍放弃将两地重新合为私领的请求。',requires:need('land_partition','crown_broken'),payment:{},facts:{two_land_compacts:true,crown_inheritance_ended:true},tone:'苦涩的自由',text:[
    '碎冠被放到两块界石之间。旧王庭坚持保留丘上的墓地，田户要求低地的水渠不再向城门交税；两边的要求没有被一声团结盖过去。',
    '你们把勘过的界绳分别钉进土里，连同渡渠和丧葬通行的条目一起交出。费尔加剪断最后一根系住两枚继承印的线，承认从此没有一个人能借整片土地的名字向两边同时发令。'
  ],ending:[
    '一顶荆冠的土地分成两份契约。丘上的墓路不收通行粮，低地的收成不再先送进王城；那些跨界的水、亲族和旧怨，则必须在两张桌之间慢慢处理。分土没有抹掉彼此需要，给了双方拒绝被一个中心吞下的权力。',
    '穆伊琳在两块界石旁各留一根嫩枝，没有宣布哪一边才配叫故乡。费尔加往返修一条双方共用的桥，桥修好以后仍要分别问两边是否准许他的下一件事。碎冠从此不能再合法地拼成一份私有遗产。'
  ]},
  {id:'land_seasons',domain:'A',title:'一年里让出的半扇门',action:'将已留种的王田按人间与丘民的季节分别开放',price:'行粮−1送进交界仓；人间王庭放弃异界时段的独占收成。',requires:all(need('sidhe_treaty','harvest_seed'),food(1)),payment:{resources:{supplies:-1}},facts:{seasonal_land_treaty:true,otherworld_share_due:true},tone:'奇异的共存',sourceRefs:['CE02'],text:[
    '潮上使者把同一粒麦子放在两只碗中：人间看见种皮，丘民看见一颗正在衰老的星。双方终于肯承认，另一只碗里并不是自己尚未拿走的财产。',
    '界仓的粮先送进去，田门上的季绳才松开。人间保有春种与秋收，丘民取得约定时段的过境与地息；谁都不能在自己不当值时留下锁，或叫另一边的时间替自己的贪心加速。'
  ],ending:[
    '麦田一年里有两种光。人间依旧在自己的季节播种，丘民在说定的夜段经过田埂、取走地息，王庭再也不能把整年的收成许给同一个债主。人们获得了可活下去的田，也学会在某些夜里关上自家的窗。',
    '席芙拉会在每次换季前核对路绳，她不肯再被当成能替所有归来者签字的人。马纳南的使者维持这条具体潮路，既没有接管土地，也没有保证永远丰收。两种生活被允许相邻，各自仍要支付相邻的代价。'
  ]},
  {id:'land_marrow',domain:'A',title:'骨灰也要交租',action:'将已役使的尸耕队永久编入王田粮额',price:'把粮仓与埋骨地交给同一把王钥；取消亡者退出劳作的最后一道封令。',requires:need('marrow_fields','grain_hoarded'),payment:{},facts:{corpse_serfdom:true,burial_tied_to_rent:true},tone:'黑暗',sourceRefs:['CE01'],text:[
    '收割队从墓门里出来，空眼窝里塞着写有田号的蜡。活人第一次可以坐在屋里等粮，却得先向王仓证明自家坟里还有能用的骨头；不够完整的遗骸会被拼给邻田。',
    '梅尔把一张尚未盖印的停役令压在你们面前。只要印落在粮额上，亡者便不能再靠安葬结束服役。你们须把停役令亲手划掉，让埋葬、继承与每日的面包成为同一条服从的链。'
  ],ending:[
    '王田连年多收，墓地从此没有真正休耕的季节。亡者被按骨架完整程度编入劳役，断手换新钩，磨尽的骨灰掺进下一垄，连一场葬礼也必须先结清王仓规定的欠额。活人吃到了丰年，也失去了让亲人安静腐朽的权力。',
    '粮袋上的王印盖过墓碑上的姓名。拒绝交出遗骸的家庭被扣粮，偷埋一截指骨成了夜里要以性命守住的秘密。梅尔不再为王田誊录任何名字；他带走能带走的原稿，留下的执行者会继续把尸身称作产额。'
  ]},
  {id:'land_thorn_king',domain:'A',title:'活在每根荆棘里的王',action:'将队伍的统治名接进已武装的土地荆根',price:'以队伍永久不得撤回的王名作冠核；放弃以普通旅人身份离开这片土地。',requires:need('thorn_armed','root_title'),payment:{},facts:{living_thorn_monarchy:true,party_bound_to_roots:true},tone:'黑暗',text:[
    '荆根伸进王座时没有索要敌人的血，先向握有土地权的你们张开空心。穆伊琳指出，冠核一旦有了主名，每道围篱都能听懂命令；想离开的王，也会在每条路上遇见自己的手。',
    '费尔加把盾放在门外。他不会替这份权力说它得到了所有人的答应。你们要亲口把队伍的统治名送进冠核，然后命令第一根荆棘抓住一个已拒绝迁地的成年田主，才能使王命真正沿土地运行。'
  ],ending:[
    '荆棘学会了队伍的声音。它们抓住拒税者的脚踝，穿过闭锁的门，按王命把田界向外推；反抗者即使逃出城，也还站在能够认出他们的土地上。王庭不再需要一支足够大的军队，围篱、树根和每个灌渠口都成了它的手。',
    '代价也钻进了王者自身。你们听见每一把砍根的斧子，走不出地界，不能再把沉重的权力留给下一任便一走了之。穆伊琳不再以人的样子坐席，她的脸在根皮下越来越像一枚印；被统治者则学会在夜里给荆棘撒盐。'
  ]},
  {id:'land_winter',domain:'A',title:'丰仓之内，没有来春',action:'把停止的季节钉在王田边界，以独占粮仓统治永冬',price:'封掉边境最后一条开放的换季口；余粮仅按王庭名册配给。',requires:need('stopped_season','grain_hoarded'),payment:{},facts:{winter_demesne:true,seasons_held_hostage:true},tone:'黑暗',text:[
    '王仓里的粮不再生虫，田外的霜也不再解。守卫捧着仍有香气的面包站在门前，让每个领粮人先交出藏种的小袋。粮不会坏，新的粮便也不能长出来。',
    '你们要把最后一枚换季钉打进石堤，封住外面春风能吹进的缺口。席芙拉认得这样的安稳：屋子永远年轻，人却再也到不了下一天想去的地方。她拒绝替王庭数第一个领粮队。'
  ],ending:[
    '永冬保住了满仓，毁掉了不靠王仓也能活下去的明年。土地停在霜里，发芽成为被禁止的事故，领粮名册决定谁能继续温暖地呼吸。反对者的处罚不必流血，只需从下一轮配给上划掉一行。',
    '城里的人最终不再问今年是哪一年，只问王仓还承不承认自己的名字。边境外有春汛，有会衰老的亲人；边境内每一袋完好的麦子都替你们延长一日统治。席芙拉离开配给厅，仍在找能把一个真实季节偷渡进来的裂缝。'
  ]},
  {id:'land_departure',domain:'A',title:'带走种袋的人',action:'撤下王田主张，交出掌土权，保留眼前的人与种',price:'零资源可行；放弃以队伍之名复土收租，已有尸役、夺粮或损失不会自动撤销。',requires:{},payment:{},facts:{party_land_claim_ended:true,land_restoration_failed:true},failed:true,tone:'失落',text:[
    '穆伊琳把一小把能认出的土放在袋底，问你们还要不要替整片土地许下复原。田户已经有人离开，有人仍等着欠粮；他们没有因这次退让就忽然得到新屋。',
    '你们把掌土的印从自己的行装里取出，交回能继续照看种与界石的人。若先前夺粮、役尸或封季，留下的局面仍须由实际的掌权者面对；此刻能做成的是停止再用队伍的名扩大占领。'
  ],ending:[
    '队伍放弃复土为王，留下种袋与掌土的印。失去的王田没有在终章里重生，先前形成的粮政与劳役仍按实际行动留下；那些已经得到安置的人也保有自己的屋顶，没有被拿来为一次失土陪葬。',
    '有人带着种走向别处，有人留在旧地等下一个不肯许诺一切的组织者。穆伊琳的土在袋底干成细粉，费尔加不再为队伍征地。你们从复原故国的主角退成了会被后来人追问、也可能被拒之门外的旅人。'
  ]},
  {id:'time_ferry',domain:'B',title:'每次只渡过一个今天',action:'将归锚与渡船誓约接成有时限的往返航路',price:'行粮−1补首航；归来者保有拒绝再入异界的权，渡次不出售为永久通行权。',requires:all(need('return_anchor','ferry_pledge'),food(1)),payment:{resources:{supplies:-1}},facts:{measured_ferry:true,return_choice_retained:true},tone:'明亮',sourceRefs:['CE02'],text:[
    '席芙拉把绳头先系在自己腰上，要求掌舵者说清这趟何时回、若潮误了要停在哪一岸。潮上使者把银枝压在水面，枝影只标出一趟航程，没有覆盖整片海。',
    '第一航的口粮装进船，不从队伍旧舟上凭空再拆一块板。你们向等渡的人逐一交代路时与回锚，让不愿再冒险的人离开队列；剩下的人才上船。'
  ],ending:[
    '银潮间开出一条能够来回、却不能任意挥霍的航路。每航有自己的时限、回锚与粮，不愿再入异界的归来者可以留下。亲人终于可以约一个会到达的探望日，而不是拿终生等待去买一场永恒盛宴。',
    '席芙拉留下做第一季引航，按自己的姓名领薪，下一季可以离任。她失去的七十年没有倒流，今日却第一次不再只是被旧日吞下的补偿。马纳南的使者收起银枝，之后每一趟仍要有人看潮。'
  ]},
  {id:'time_mortal',domain:'B',title:'七十年，留在身体里',action:'按时间实测解开滞龄，让有名册的归来者逐年重返凡时',price:'行粮−1作缓龄屋首夜食宿；销毁以陌生人寿年来替换的提案。',requires:all(need('time_measure','return_roster'),food(1)),payment:{resources:{supplies:-1}},facts:{mortal_time_accepted:true,foreign_years_rejected:true},tone:'成熟的哀伤',sourceRefs:['CE02'],text:[
    '银盆里的影子比席芙拉苍老。实测绳告诉你们，缺失的岁月可以被分段接回，不能变成从未失去；名册中的每个人都先听见自己将承担多少，不再以一个总数代替身体。',
    '你们要把借寿页从盆边抽走，按已量过的节拍松开滞龄结。有人决定留下灰发，有人请求更慢的一段，任何人都不能用另一户尚未答应的人来填空。'
  ],ending:[
    '归来者开始在自己的身体里承担缺失的年月。缓龄屋逐段解开滞结，白发、旧伤和迟到的衰老有了可以照顾的节拍；没有一张陌生人的寿命被拿来让他们继续年轻。那些已经逝去的亲人也没有被一同从墓里拉回。',
    '席芙拉剪掉一缕发白的头发，给早已成年的后辈看，后者拿来一把适合她新手劲的刨刀。她依旧会失去余下的年岁，第一次能用余下的年岁做自己的东西。银潮退远，七十年成为身上可说出的历史。'
  ]},
  {id:'time_generations',domain:'B',title:'把空椅子搬出祖屋',action:'以航路原档与归来名册承认两代人各自的家',price:'交出按旧婚约与旧田契逐走现住者的请求；档案留给两代共同保管。',requires:need('route_archive','return_roster'),payment:{},facts:{generational_settlement:true,old_claims_renegotiated:true},tone:'苦甜',text:[
    '席芙拉找到自己旧屋门框上的刨痕，屋里却住着会认这道刨痕的后辈。她曾经的爱人已经安葬，现住者也不是偷走她人生的冒名者。',
    '你们把航路原档与名册放在同一桌，让归来者以本人身份领回尚存的财物，也让后代保有已经活过的生活。那张准备逐走现住者的旧田令要先撕掉，双方才肯把椅子挪近。'
  ],ending:[
    '归来者重新拥有姓名与亲属位置，却不能凭七十年前的一纸婚约把后辈的婚姻和居处全部赶走。两代人按航路原档分清继承与可返还的物，旧屋不再靠一场幻想中的昨日决定谁能进门。',
    '席芙拉没有收回原来那张婚床，她在后院搭起一间船工棚，门口多放一把给后辈的刨凳。迟到的团聚有些亲近，也有无法弥合的陌生；家第一次容得下一个真实归来的人，而非永远空着的椅子。'
  ]},
  {id:'time_sealed',domain:'B',title:'最后一潮，不留下一张票',action:'毁去门钥或锁死已关闭的潮门，停止跨界招徕',price:'毁掉本地重开潮门的钥记；已经留在另一岸的人不会凭此自动归来。',requires:any(f('gate_key'),f('tide_closed')),payment:{},facts:{local_tide_sealed:true,no_reopening_key:true},tone:'决绝',sourceRefs:['CE02'],text:[
    '潮上使者不阻拦你们折钥，只让你们看清名单上哪些人已经回到岸边、哪些名字仍在另一侧。银潮关上以后，不会再派一艘船把未完成的等待漂亮地补齐。',
    '席芙拉把最后一根引航绳从石缝里抽出来。你们要将能重开本地潮门的钥记打碎，不留给下一任王一张随时招徕失踪者的票；此后只有凡海的风与航程。'
  ],ending:[
    '本地潮门合上，银枝的许诺不再从这段海岸带走新人。留在人间的归来者开始按人间的年月生活，尚在另一岸的名字成为一份不能兑现归期的记录。关门保护了后来人，也把一部分等待永远留在门外。',
    '席芙拉把引航绳编进普通船的缆索。她保有自己的技艺，失去能随潮返回旧宴厅的路；潮上使者没有再来索税，也没有在夜里悄悄开一扇方便的后门。海仍然辽阔，神异从此在这里缺席。'
  ]},
  {id:'time_lifeblood',domain:'B',title:'年轻人的主人',action:'按已窃取的寿年与借寿契建立王庭续龄池',price:'把借寿契的停付权交给续龄者；抽取按现有契约执行，受取者不能单方退出。',requires:need('stolen_years','lifespan_contract'),payment:{},facts:{lifespan_aristocracy:true,years_taken_by_force:true},tone:'黑暗',text:[
    '盆中的水让王庭受益者的指节重新平滑，供寿名单上的田工却一夜长出老年斑。偷来的年月已经有了去处，现在等的是你们是否准许它继续流。',
    '你们要把原本能停付的契钮搬到续龄池内，只有得到年轻的人才能触碰。席芙拉站在门外，看见一个曾答应借出短短一季的人被告知：契约活得比他的反悔更久。'
  ],ending:[
    '王庭出现了一群不肯衰老的主人。服役、欠租与借粮逐渐都可以折作寿年，田工在几年里走完一生，受益者把同样的几年当成能再添一季狩猎的零钱。续龄池确实延长了掌权者的青春，土地上却越来越少有力气替自己争辩的人。',
    '停付权被锁在池中，贫户不能靠还清钱债结束抽取。富家开始用成年继承人未来的岁月作担保，等继承发生，契已替他们决定应老去多少。席芙拉不接受王庭送来的第一杯续龄水；她认识的归乡，从此被制造成一台把别人赶出人生的机器。'
  ]},
  {id:'time_generation_price',domain:'B',title:'再无归乡的一代',action:'以一整代人的归乡权兑现现有渡船与借寿契',price:'将契约所列本代渡客的回岸权永久移交潮庭；后续本人改意也不能赎回。',requires:need('lifespan_contract','ferry_pledge'),payment:{},facts:{generation_return_rights_sold:true,one_generation_exiled:true},tone:'黑暗',text:[
    '潮庭的价写得很清楚：这一次，人间可领回要保住的岁月与船；已经编进契约的整代渡客则失去回岸资格。不是每个人都把名字写在这里，有些只是在同一轮出生与渡行的人。',
    '你们要把原先的一季借寿页覆在渡船誓约上，亲口授权它管到这一代的最后一个人。席芙拉要求把“归乡权”三个字念出来；潮庭没有许给受约者最后一次例外。'
  ],ending:[
    '一代人的归乡权换成了人间可以消耗的岁月。潮庭仍让他们望见海岸、听见亲人的名字，却不再承认任何回程；等待、悔意和新的爱都不能改写已经执行的价。受益的一岸保住了船和今日，付价的一岸被禁止拥有再次回来的明天。',
    '信能过潮，写信的人不能。墓碑上开始出现没有死亡日期的名字，家族把整排空席一并搬出长屋，好让没有归期的等待少占一点地方。席芙拉若在这一岸，便亲眼看着同代人被出售；若记名页牵住了她，任何王的恩令也不能让她踏上已经被卖掉的回程。'
  ]},
  {id:'time_eternal_feast',domain:'B',title:'盛宴里再没有你的名字',action:'延续已停止的季节，将受邀者的归念封进银宴酒',price:'交出这批宾客的归乡记忆作宴资；队伍不能再以唤旧名使其离席。',requires:need('silver_invitation','stopped_season'),payment:{},facts:{eternal_feast:true,home_memory_stripped:true},tone:'黑暗',sourceRefs:['CE02'],text:[
    '桌上的鱼每被切下一片便长回一片，席间笑声从未真正停过。潮上使者取来几只空杯，问你们愿不愿让想家的心也不再回来；它没有把这称作团聚。',
    '你们要把邀请册中这一批人的归念倒进宴酒，让留座不再需要每晚重新问。席芙拉把自己会的第一支故乡歌唱了一半，银杯正等着连后半支从她们的心里一起收走。'
  ],ending:[
    '银宴终于没有离席的争执。受邀者不会老，也不会再因为听见故乡的歌而哭；杯中夺走了他们认出归途的那一部分自己。席位上仍有笑声、有爱情和新故事，曾经许给岸边的人却再也得不到一个知道自己失约的人。',
    '使者准许你们来访，甚至准许你们讲起往事；宾客会礼貌地听完，像听一个不属于自己的陌生传说。盛宴留下了活着的面孔，抹掉了这些面孔曾对别人负有的心意。岸边的人继续衰老，宴厅里没有人觉得该为此起身。'
  ]},
  {id:'time_drift',domain:'B',title:'没有岸的下一程',action:'放弃接管潮路，拆去队伍尚能支配的引航标记',price:'零资源可行；本地回归计划失败，已盗寿年与已封季节保留其既成后果。',requires:{},payment:{},facts:{party_tide_claim_ended:true,return_plan_failed:true},failed:true,tone:'失落',text:[
    '水上没有突然出现一条足够载走所有人的船。席芙拉把量时绳一圈圈收好，不肯再答应一个现有锚、名册与人手都支撑不了的归期。',
    '你们能做的是撤去以队伍为主人的招徕，拆下尚归自己管的引航标记。有人仍会寻找别的岸，有人只能留在现在这一边；已被偷走的年岁不会因一次退出就自动流回原身。'
  ],ending:[
    '潮路没有按队伍的计划成为一条归乡路。招徕停下，引航标记被拆走，已经回到岸上的人保有归来，仍在等待的人也没有被写成圆满团聚。现有的盗年、封季与失去各按此前行动留在两岸。',
    '席芙拉不再替任何王保证下一次航期。她把量时绳交给愿意继续记录的人，自己开始学着在此地生活，或寻找一条真正属于自己的下一程。故事不替迷航的人凭空造岸，只停止把更多人引进同一个空诺。'
  ]},
  {id:'name_returned',domain:'C',title:'名字回到嘴里',action:'将有原稿证据的活人姓名归还本人，切断院印',price:'行粮−1供归名者首夜；销毁记名院对这批活名的控制副本。',requires:all(need('name_proof','living_names_free'),food(1)),payment:{resources:{supplies:-1}},facts:{names_returned_to_people:true,office_cannot_command_living:true},tone:'明亮',sourceRefs:['CE03'],text:[
    '梅尔不再替人念出确认句。他把每张原稿先递给名字的主人，让本人说出认不认、该怎样改，再用刀背刮掉院印。有人换掉旧姓，有人只把被污掉的一个笔画补回去。',
    '你们要把控制副本从炉边铁箱里全部取出，不留下方便王庭“暂借”的一份。费尔加念自己的名时停了一次，那句旧誓没有再把他的手拉向被指作敌人的朋友。'
  ],ending:[
    '这批活人的姓名不再能被记名院当作命令的握柄。原稿交回本人，控制副本已毁，一个名字如何念、是否延续、要不要改换，重新与说出它的人相连。旧案仍能按证据追问，却不能再靠一枚院印把被告的身体拖进庭。',
    '梅尔留下一套如何识别原稿的教法，放弃替所有人保管唯一真名。费尔加第一次在拒绝一条命令之后仍能清楚说出自己是谁。他们没得到永远不被欺骗的世界，得到了不必先放弃姓名才有资格拒绝的生活。'
  ]},
  {id:'name_new_oath',domain:'C',title:'一份能够退回的誓',action:'由已保留副本的见证者颁行可撤回的新誓制',price:'废掉院长独占的裁誓席；队伍的誓令也须由独立见证人复核。',requires:need('names_copied','oath_rewritten'),payment:{},facts:{revocable_oath_system:true,independent_oath_witnesses:true},tone:'重建',sourceRefs:['CE03'],text:[
    '三份副本被放到三张桌上，没有一份盖着“真本，其余作废”的新印。梅尔要求每一份新誓写明目的、期限与退出时怎样把已经得的好处还清，不再把生死都装进一个好听的忠字。',
    '你们先把自己的下一条誓令交给独立见证人。她删去了一句想征用所有路人的话，留下一段有限护路的承诺。只有接受这次删改，队伍才有资格让新制从自己头上开始生效。'
  ],ending:[
    '新誓不再靠院长的一张嘴判断谁配有名。期限、用途与退约代价被分存见证，队伍的命令也可被削去越界的部分。有人会在最需要帮手时离开，有人会索还先付的工钱；誓约因此少了绝对服从，留下可重新订立的信任。',
    '梅尔从裁誓席搬到抄写桌边，必须接受别人指出他的漏字。费尔加重写自己的护路誓，在最下方空出亲自退出的位置。他知道终有一天可能真的需要用到它，因而这一回敢把名字写得完整。'
  ]},
  {id:'name_house_ended',domain:'C',title:'院门拆成了屋梁',action:'拆散已焚账的誓院，取消其记名与颁禁职权',price:'交出队伍接任院长的资格；旧院的控制知识与部分追索线索一同失去。',requires:need('oath_shattered','ledger_burned'),payment:{},facts:{name_office_dissolved:true,oath_monopoly_ended:true},tone:'彻底的断裂',text:[
    '被烧空的铁书架还热着，旧院门上的禁文却仍试图在经过的人身上找一个能抓住的名字。费尔加把门轴抬下，要求不用它再建一扇新院门。',
    '你们要撤去队伍接任院长的那一行任命，把院梁交给实际要建屋的人。焚毁失去的旧档不能被重新宣称为一切皆清的证据；还能查的案件交给活着的证人，余下空白不再由院令硬填。'
  ],ending:[
    '记名院的门拆成屋梁，颁禁与强夺活名的职位被一同取消。没有新院长接过旧人的无限职权，靠院令生活的人必须另找生计，被誓禁控制的人也不再需要每年回来求一张准许活下去的纸。',
    '烈火吞过的旧档留下无法追回的空白，有些受害者再也找不到唯一能证明遭遇的一页。梅尔为此失去最后一份能洗清自己旧案的完整记录。他没有要求众人因此把院重新立起，只把还能说出的名字交给会继续听的人。'
  ]},
  {id:'name_term_binding',domain:'C',title:'锁上写着日期',action:'将已施行的缚名公开限期，设不受王令控制的解缚日',price:'共同金钱−4付解缚见证人；队伍交出延长原期限的单方权力。',requires:all(need('names_bound','public_ledger'),gold(4)),payment:{resources:{gold:-4}},facts:{term_binding_public:true,binding_expiry_independent:true},tone:'灰暗的秩序',text:[
    '公开账上列着受缚成年人的名字、被迫绑定的来由与已经受过的驱使。梅尔拒绝把那些痛写成新制从来无害的证明；能改的是从此谁有权解、何时必须解。',
    '见证人先领四枚工钱，封起能延期的院印。到期以前，受缚者仍被限制；到期以后，你们不能以危险未消为由继续留人。费尔加要求把这一点也念给锁下的人听。'
  ],ending:[
    '缚名没有在一声宽恕里全部消失，公开期限与独立解缚却开始真正约束掌权者。原有受缚者能看见自己的释放日，亲属能查账，队伍再无权单方把一季拖成终生。这样的秩序仍靠曾经伤人的术维持，受缚者也仍会记得被迫服从的日子。',
    '第一把到期的锁在没有王令的清晨自行断开。被释放的人没有向你们致谢，梅尔也没有替他要求。解缚见证人收起断片，转身去核下一把日期；法律第一次把让权当成一件无需等待统治者心情的事。'
  ]},
  {id:'name_dead_host',domain:'C',title:'死去以后，仍未下值',action:'以缚名术将已召的亡者列为永续服役的院属',price:'废掉亡者自行归土的解散条；生者的减役以死者无法拒绝的劳役支付。',requires:need('dead_host','names_bound'),payment:{},facts:{dead_labor_permanent:true,death_no_longer_releases:true},tone:'黑暗',text:[
    '亡者在石堤上排成队，呼吸已停，胸口的名字仍按鼓声发热。院长空下的位置就在你们身后：只要把解散条收进王印，死亡便不再是结束命令的事由。',
    '一名亡者认出了来认领尸身的成年女儿，手臂却仍按令把她挡在队外。你们要在她面前宣布名字归院、不归墓，令第一班亡者走向下一项人间的苦工。'
  ],ending:[
    '亡者被编为不领薪、不许退役的院属。修堤、采石、守夜和战争不断给他们新的班次；生者得到减役，必须忍受亲人的遗体穿着院号从自家门前经过。尸身磨损以后，院里仍会命名字依附新的骨架，连腐朽也不能换来下值。',
    '有人把葬礼改在失踪发生以前，抢在记名师到来前为自己办一次不被承认的告别。梅尔不再写任何召役名单，王庭于是培养更年轻、更服从的书记。队伍留下的秩序让死亡保留了痛苦，却剥去了休息。'
  ]},
  {id:'name_erasure',domain:'C',title:'从来没有反对者',action:'将已售活名收入密账，剥除异议者的公开身份',price:'把密账的核验权收为队伍私权；被删者不能凭亲属证词取回法律上的名字。',requires:need('names_sold','hidden_ledger'),payment:{},facts:{identity_purge:true,erased_people_excluded:true},tone:'黑暗',text:[
    '密账没有命令刀落下，只要你们把几行名字从公页上挖走。已经售出的活名会继续在院内发热，街上却再没有能拿它领粮、继承或告状的人。',
    '梅尔站在第一页曾被他错写死亡的名字前，拒绝再下笔。你们要亲手认可密页高于本人和亲属的证词，让第一个来申诉的人被门吏当作一个无法确认存在的陌生者赶出去。'
  ],ending:[
    '公开账上再没有那些反对者。身体仍走在街里，姓名却不能用于领粮、持产、结亲或申诉；连愿意收留他们的人也会因与一个不存在的人共用住址而被查问。统治者得到一座表面安静的城，受害者则被困在没有任何手续承认的活着之中。',
    '孩子开始背诵父母的名字，成年人把旧签名缝进衣领，怕第二天连自己的字也无法证明属于自己。梅尔带走原稿后成为密账追索的对象。王庭不再需要解释为什么有人失踪，它只须指着干净的一页说：这里没有这个人。'
  ]},
  {id:'name_one_voice',domain:'C',title:'所有喉咙里的王',action:'将武器化的誓禁接入缚名册，建立唯一发令声',price:'把队伍的王令也锁入同一术式；首令生效后不得靠更换院长解除众人的服从。',requires:need('oath_weapon','names_bound'),payment:{},facts:{one_voice_command:true,subjects_cannot_refuse:true},tone:'黑暗',sourceRefs:['CE03'],text:[
    '石堤上每个被缚名字都等着同一个起音。费尔加捂住喉咙，明白旧誓曾对他做过的事正在被扩大到整座城：眼睛可以愤怒，手仍会按别人说的话动作。',
    '你们要把王令接入誓禁的起句，让第一声“跪下”沿名册到达所有受缚者。术也会锁住发令者：后人只需得到这道声音，便能继承已经成形的服从。'
  ],ending:[
    '王令在受缚者喉咙里一同发声。守卫无需再抬刀逼迫，犯人会自己走上刑台，亲属会在违心的赞颂里交出想藏的人；城里保留了痛恨，失去了把痛恨化成拒绝的身体。队伍得到精准的服从，百姓却再不能以沉默保住最后一点不合作。',
    '发令者也成为可被争夺的器具。继任者争的不是民意或神授，只是能否控制那一口已经接入名册的声音。费尔加的盾留在石堤边，盾内曾刻过的拒令条款被新史官称作无法理解的旧误。'
  ]},
  {id:'name_refuge',domain:'C',title:'门上没有名牌',action:'放弃以队伍收尽真名，留下无需报出原名的避所',price:'零资源可行；队伍撤回接任总记名者的请求，避所只保护实际到达的人。',requires:{},payment:{},facts:{nameless_refuge:true,party_name_monopoly_ended:true},tone:'未竟的庇护',text:[
    '梅尔把门上的姓名槽翻到墙里。有人没有证据能取回名字，有人有了名字却不愿再写到任何账上；他们所求的第一件事只是今晚能不能在不自报来历的地方睡。',
    '你们撤回以队伍统一收名的任命，把避所留给实际在此的人。它不能隔空收回密账、解尽所有缚名，也不会让已经被役使的亡者自动归土；门内先留下一个不继续索取的地方。'
  ],ending:[
    '一座不问原名的避所留下来。实际到达的人得到歇息，愿意使用新名的人可以从新名开始生活；这份庇护没有让院外所有密账与誓禁消失，未完成的归名也仍是未完成。队伍放弃成为唯一真名保管者，避免把另一座大院重新建在此处。',
    '梅尔用空白木片记床数，不再先记来客的身世。有人住过一夜就走，有人逐渐敢在火边说出曾经的名字，听者不会替他说完。费尔加每天确认门闩能从里面打开，席芙拉只在自己愿意的时候留下。'
  ]}
];

const arcNames={A:'王权与土地',B:'活人与异界时间',C:'誓禁与记名'};
const questKeys={A:'land',B:'time',C:'name'};
const scene=(id,title,mapId,text,choices,extra={})=>({id,chapter:3,arc:arcNames[id[0]]||'归潮终章',title,location:title,mapId,text,choices,requires:all({chapterAtLeast:3},{sceneUnlocked:id},no(f(`${id}_done`))),...extra});
const opt=(id,label,description,effects={},extra={})=>({id,label,description,effects,next:'hub',once:true,...extra});

export function installEndings(c){
  c.epilogues||=[];c.worldStates||=[];
  for(const domain of ['A','B','C']){
    const branches=endingBranches.filter(b=>b.domain===domain),payId=`${domain}14`,actId=`${domain}15`;
    c.scenes[payId]=scene(payId,{A:'王土的最后一笔',B:'此岸与彼岸的真实价',C:'谁还握着那一行字'}[domain],{A:'dunharrow',B:'sidhe',C:'barrow'}[domain],[
      {A:'王田、粮仓与荆冠都已有来处。费尔加把可交付的印、绳与工钱放在桌上，穆伊琳等着一件真正要做的事。',B:'银潮前摆着量时绳、归来名册与现有契约。席芙拉要求把谁能回、谁会付价、谁失去拒绝说得清楚，再去动门。',C:'原稿、密页与残印摆在同一处。梅尔不替任何决定重新命名；它将使谁获得自己的身子，又将使谁连死亡都不能离开，必须现在决定。'}[domain],
      '这里只能承接此前已经做成的事。交出材料或权利后，方案即锁定；石堤上只留下执行这一件事的授权。'
    ],branches.map(b=>opt(b.id,b.action,b.price,{...b.payment,flags:{[`${payId}_done`]:true,[`undertaking_${b.id}`]:true,[`investment_${b.id}`]:true},unlockScenes:[actId]}, {requires:b.requires,text:`方案已锁定：${b.title}。${b.price}`})),{requires:all({chapterAtLeast:3},{sceneUnlocked:payId},f(`${domain}13_done`),no(f(`${payId}_done`)))});
    c.scenes[actId]=scene(actId,'石堤上的最后授权','causeway',['已交付的代价正在等待执行。只有先前锁定的方案可在这里授权。'],branches.map(b=>opt(b.id,b.action,'执行已经锁定的方案，留下本线不可撤回的结果。',{flags:{[`${actId}_done`]:true,[`${domain}_final`]:true,[`authorized_${b.id}`]:true,[`core_${b.id}`]:true,...b.facts},quests:{[questKeys[domain]]:b.failed?'failed':'done'},unlockScenes:['council']},{requires:f(`undertaking_${b.id}`),text:b.ending})),{requires:all({chapterAtLeast:3},{sceneUnlocked:actId},f(`${payId}_done`),no(f(`${actId}_done`))),textVariants:branches.map(b=>({requires:f(`undertaking_${b.id}`),text:b.text}))});
    const q=c.quests?.find(q=>q.id===questKeys[domain]);if(q){q.nodeIds=[...new Set([...(q.nodeIds||[]),payId,actId])];q.stages=[...(q.stages||[]),{stage:14,chapter:3,sceneIds:[payId]},{stage:15,chapter:3,sceneIds:[actId]}];}
  }
  c.endings=endingBranches.map((b,i)=>({id:b.id,title:b.title,text:b.ending,priority:100-i,requires:need(`priority_${b.domain}`,`core_${b.id}`,`authorized_${b.id}`,'A_final','B_final','C_final'),coreFacts:[`core_${b.id}`,...Object.keys(b.facts)],setupSceneIds:[`${b.domain}14`,`${b.domain}15`],causalRequirements:b.requires,domain:b.domain,tone:b.tone}));
  c.epilogues.push(...endingBranches.map(b=>({id:`aftermath_${b.id}`,title:`${arcNames[b.domain]} · ${b.title}`,requires:all(f(`core_${b.id}`),no(f(`priority_${b.domain}`))),text:b.ending.join('\n\n')})));
  // 新约不会抹去此前已经实施的取年、售名、役尸与具体失去。
  c.epilogues.push(
    {id:'lasting_sold_names',title:'十二枚银币换走过的名字',requires:f('names_sold'),text:'塔赫等四名成年人记得自己的原名曾被你们售出，也记得王册召回时腕上的灰痕。后来即使解开了活名，那一夜仍在他们的叙述中；他们有权决定是否再与售名者同桌。'},
    {id:'lasting_stolen_years',title:'年锚中没有归还的余生',requires:f('stolen_years'),text:'年锚中扣着从未答应者的余生，被抽年者已经衰老。后来新铸的银锚、有限渡航或关门都使用各自的办法，未把已经取走的岁月流回原来的身体；被害者仍带着那些白发生活。'},
    {id:'lasting_lifespan_contract',title:'沿岸来得太早的老年',requires:f('lifespan_contract'),text:'寿年契背面所列的沿岸成年人已经提前衰老。他们家中拐杖、少做的工与来不及完成的约定都按实际留下；那次抽取失去的余生，不会由后来一张新契自动补回。'},
    {id:'lasting_old_dead_commands',title:'还没有逐名解开的旧役册',requires:all(any(f('marrow_fields'),f('dead_host'),f('old_dead_commands_remain')),no(any(f('corpse_serfdom'),f('dead_labor_permanent')))),text:'王田或陵队中已经接通的旧命令仍留着各自的役名。终局的新约处理了它明确指向的权力，未逐名办理的旧尸役还在等待家属与持册者去解除；拆一扇院门并没有替每块墓石完成告别。'},
    {id:'lasting_geis_victim',title:'第一个被两道誓夹住的人',requires:f('first_geis_victim'),text:'相冲誓禁的第一名受试者已被迫在两个不能同时遵守的命令间犯错。后来的誓约无论多清楚，那次宣罪都留着发令者的名字；他的遭遇不能再记成一场自然发生的违誓。'},
    {id:'lasting_destroyed_routes',title:'被烧掉的旧桨',requires:f('route_destroyed'),text:'被烧毁的旧桨没有随终局重新长出刻痕。那批航路与能核对部分失踪年月的记录永久失去，仍在另一岸等这份线路的人也少了一条真实的归路。'},
    {id:'lasting_forest_drained',title:'泉边少掉的一年新芽',requires:f('forest_drained'),text:'第三界柱被黑刺贯穿时，泉边林木的一年新芽已经抽空。树仍站着，下一季的柴、果与可荫田地却都变少；后来的分地或退冠也必须在这片受伤的林中开始。'},
    {id:'lasting_courier_taken',title:'水道另一头没有回来的信使',requires:f('courier_taken'),text:'你们沿信使画出的水道退走，他被押送者带走。底稿后来到手、摄政后来退场，都没有另行实施营救；门边仍留一块由他亲手写过、尚不能说出的名字。'},
    {id:'lasting_stopped_season',title:'尚未解冻的季节',requires:all(f('stopped_season'),no(any(f('winter_demesne'),f('eternal_feast')))),text:'银盘曾经停住的季节仍没有被另一项结局自行推回。仓粮继续不腐，田种继续不生，留在原地的人须面对这个还待处理的冬夜；个人归名或一条新航路不会代替真正的换季。'},
    {id:'lasting_hoarded_grain',title:'原来封在队伍名下的粮',requires:all(f('grain_hoarded'),no(any(f('corpse_serfdom'),f('winter_demesne')))),text:'第一斗粮曾被封在队伍名下，以服从换配给的命令已经用过。后来田权即使转交，新持仓人仍须接手原来那批领粮者；谁曾被要求服从，也仍保有对那道旧命令的记忆。'}
  );
  c.epilogues.push(
    {id:'boat_pledged_cost',title:'留在桩上的旧舟',requires:f('boat_pledged'),text:'旧舟仍按第二章舟契押在掌土一岸，队伍的守土任期与已交出的价继续有效。退土也不会把已押出的船自动赎回。'},
    {id:'boat_anchor_cost',title:'用来抵住时间的舟',requires:f('boat_anchor'),text:'旧舟已成为时间回锚，不能同时取回作普通远航或拆作王田材料。潮路无论开闭，已交出的舟与那一段人生都留下原来的去处。'},
    {id:'boat_burned_cost',title:'烧尽的舟与留住的字',requires:f('boat_burned'),text:'旧舟已依记名之契焚去，船骨不再可用，回海也须另筹船。保留下来的字或被揭开的院权，不会把灰重新拼成出海的工具。'},
    {id:'hero_finn_thorns',title:'芬恩 · 盾后的手',requires:any(f('corpse_serfdom'),f('one_voice_command'),f('living_thorn_monarchy')),text:'芬恩能在命令落下时把盾举得很稳，后来也必须用同一双手看着谁被带走。他的武艺没有在结局中消失，守护的名义却再也不能替每一次服从免去责任。'},
    {id:'hero_finn_refusal',title:'芬恩 · 可以放低的盾',requires:all(any(f('bounded_crown'),f('revocable_oath_system'),f('common_land')),no(any(f('corpse_serfdom'),f('one_voice_command'),f('living_thorn_monarchy')))),text:'芬恩留下教人护路，也教人辨认何时应放低盾、不替一条越界的命令堵门。他没有得到一个再无争执的故乡，得到了可以把武艺交给活人而不先收走他们意志的地方。'},
    {id:'hero_niamh_return',title:'奈芙 · 自己选的路',requires:any(f('measured_ferry'),f('generational_settlement'),f('nameless_refuge')),text:'奈芙把走过的林道重画成几张小图，交给要走的人。她不要求他们最终都回来，也不把自己画在每一张路图的终点；有一条能由本人决定的路，对她已经足够重要。'},
    {id:'hero_niamh_border',title:'奈芙 · 封线之外',requires:any(f('winter_demesne'),f('generation_return_rights_sold'),f('identity_purge')),text:'奈芙仍认得边境的风向与漏水的石缝。每一条被你们封死的归路，都在她的地图上多留一道没有涂满的线；她若继续为王庭引路，便清楚那条线另一边是谁。'},
    {id:'hero_aeda_release',title:'艾妲 · 不再加一班',requires:any(f('names_returned_to_people'),f('name_office_dissolved'),f('mortal_time_accepted')),text:'艾妲继续照顾老去的人，替终于可以归土的名字留灯。她不再把每一次告别都算作自己没能挽回的失败，药碗与丧灯终于可以各自完成自己的工作。'},
    {id:'hero_aeda_chain',title:'艾妲 · 治疗之后',requires:any(f('dead_labor_permanent'),f('lifespan_aristocracy'),f('corpse_serfdom')),text:'艾妲的药依然能让身体站起来。她每救回一个人，都要面对那具身体随后会回到哪一本役册；治疗不再自动等于自由，她余生的祷言也必须带着自己亲手延长过的苦工。'},
    {id:'hero_brannoc_witness',title:'布兰诺克 · 留下不押韵的一句',requires:any(f('independent_oath_witnesses'),f('generational_settlement'),f('seasonal_land_treaty')),text:'布兰诺克没有把三条路唱成一首毫无裂缝的凯歌。他在谱边留下一句不押韵的原话，让后来的人知道受益者之外，还有谁付过价；听众若要改词，先得有人指出改掉了谁。'},
    {id:'hero_brannoc_silence',title:'布兰诺克 · 最安静的观众',requires:any(f('home_memory_stripped'),f('identity_purge'),f('one_voice_command')),text:'布兰诺克仍能令整厅安静听歌。后来他终于分得清，哪一次安静来自愿意听，哪一次来自不再记得、不能反驳或无法证明自己存在的人；他的最后一首歌将由他自己选择唱给谁。'}
  );
  c.worldStates.push(...endingBranches.map(b=>({id:`ending_world_${b.id}`,requires:f(`core_${b.id}`),mapId:b.domain==='A'?'oathwood':b.domain==='B'?'tidegate':'barrow',summary:`${b.title}：${b.ending[0]}`})));
  c.scenes.council=scene('council','已交出去的明天','dunharrow',[
    '王田、潮路与记名院都已经得到实际结果。桌上没有新的王冠、回程票或赦令；三条线付过的价，各自还在真实的人身上。',
    '第二章交出的旧舟决定了队伍最先承担哪一种明天。现在收起账，承认那一个主结局，并让另外两条路的余波一并留下。'
  ],[opt('close_book','收起账，迎接已造成的明天','按舟契重心与三条线的执行结果自动收束。',{}, {ending:true})],{arc:'归潮终章',requires:all({chapterAtLeast:3},{sceneUnlocked:'council'},f('A_final'),f('B_final'),f('C_final'))});
  c.expansionBranches=endingBranches.map(b=>({id:b.id,line:b.domain,title:b.title,requires:b.requires,setupSceneId:`${b.domain}14`,sceneId:`${b.domain}15`,executionFlag:`core_${b.id}`}));
}
