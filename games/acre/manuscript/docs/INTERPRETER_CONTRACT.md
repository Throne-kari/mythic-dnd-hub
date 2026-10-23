# 与既有日印v2解释器的合同

核对对象为既有日本v2 `campaign-data.mjs`、`campaign-play.mjs`、`campaign-v2.mjs`、`content.mjs`、`engine.mjs`。本包只写战役JSON和文档，共用核心由主线程接入，未另造引擎或前端。

条件使用现有合同：事实键精确值/数组值、`all`、`any`、`not`、`goldAtLeast`、`npcAlive`、`npcCanRespond`、`npcCanConsent`、`encounterCleared`、`notCombat`，数值比较`gte/ne`。没有假设解释器支持`itemHeld`或数量条件。实际物品不足交`cost.items`原子检查，不能仅凭叙事flag扣不存在的粮。

成本只使用`cost.items:[{id,count}]`。所有消费物实际归队伍，玩家不能扣NPC私物或别席法术位。选择在尝试前支付，检定失败不会退款。本切片未设“捐两袋才开口”的强制证词成本。

效果使用`facts`、`increment`、`minutes`、`items`、`transferItems`、`promises`、`npc`、`neutralize`、`encounter`、`conditional`、`complete`、`ending`、`handouts`、`say`。`items`是首次授予，不能用重复授予更新同一物；因此粮分为开局food和实际援粮relief-food，原件保管用transferItems更改同一id。所有NPC返还须其本来有权同意，不能由玩家借transfer从NPC处擅取；烙印留置明确跨切片未完，未复制返还物。

节点按A01—A12顺序，前景complete才出现下一景；没有依赖新增goToChapter。场景以AC01—AC12独立id对应。固定3级设置`initialLevel=3/fixedLevel=3`，不依赖低于现预建最低3级的降级功能。原Lv2战斗预算未冒称照搬；唯一可选四Bandit小规模遭遇用实际共用原卡。

地图墙为`x/y/w/h`矩形；门为`a/b`线段、`kind:door`、`state:open`；墙体本身留10尺门洞。场景均5尺网格，起点、NPC和地物不在封墙内。水域有明确区域矩形，按共用核心的水域移动处理；船席由合同事实决定，不能凭模型外观无限载客。

`npcAlive`不等价能表达同意，也不保证实际同场。`npcCanRespond`核当前NPC记录所在场景、实际演员、正HP、非死亡/离场/失能；`npcCanConsent`再排除魅惑和支配。新签、私人器具新分配、个人公开与出行许可都用后者。既有许可只按其原范围保存，实际收件/出行仍核当前答复能力，不能让剧情事实覆盖HP。具体迁移与三种许可键见[同意与在场修订](AGENCY_AND_PRESENCE_FIX.md)。

原件暂管、有益放行与必要照护不被冒称新的本人同意：A09可在纳西尔0HP时支付放行，收据由萨利姆出具、队伍暂存，原HP不变；A08/A11各有无新公开/无新出行的诚实交接旁路。新放行约仍须真实有权签署的萨利姆能自主答复。修改剧情、额外能力和真实新增运输由主持按原规则记清具体事实，不是假称已程序化所有自由提案。

内容作者验证限静态条件/效果形状、地图几何、物品去向、隔离合同与明确合成的同意状态夹具；独立验收路线另存总项目独立验收目录。不启动服务和浏览器，不冒称真人平衡/趣味或所有自由动作完整验证。
