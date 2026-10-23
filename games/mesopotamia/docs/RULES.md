# 规则与存档

本作规则全部由纯 Node ESM 引擎 `engine.mjs` 结算。`createState(campaign,maps)` 创建 schema 3 状态；`legalChoices(state,campaign)` 提供当前地图、前置条件及资源允许的选择；`applyAction(state,action,campaign,maps,actor)` 返回新状态；`publicState` 返回脱离原对象的公开副本。任何非法行动抛出错误且不修改输入。成功行动令 revision 与 clock 各加一。状态无需类实例、闭包或外部随机源，可完整 JSON 序列化并恢复。

## 剧情与资源

节点只能在指定地图触发一次，完成后记录 `node:<id>`。节点和选择的所有 requires 同时成立：flags 必须存在、notFlags 必须不存在、资源至少达到指定值、completedRoutes 达到指定条数。cost 先扣除，effects 修改粮食、白银、净水、恐惧、旗标、派系及人物关系；资源不得为负。路线可完成或失败，结算后不再显示该路线节点。后续节点用前置旗标组织，不通过传入任意节点ID绕过。

3.1 的主要 NPC 由 `campaign.majorNpcs` 独立声明，吉尔伽美什不占玩家角色、不能被认领或移动、不会自动攻击、取胜、复活或补充资源。createState 将已声明 NPC 的关系初始化为 `npcRelationships {id:0}`，与队友 relationships 分开。`effects.npcRelationships {id:delta}` 仅允许已声明 NPC，增量及加总结果都必须是有限数值；未声明ID、非数值、NaN、无穷或溢出均令整个行动失败，扣费、旗标和其他效果不会提交。NPC 与队友ID不能重复。

节点、选择、条件场景、结局和后续段落的 requires 均可使用 `npcRelationships {id:min}` 与 `npcRelationshipsMax {id:max}`，分别表示关系至少或至多，并与其他条件共同成立。旧存档缺少 npcRelationships 或缺少新 NPC 时默认关系为0，下一次合法行动会补齐已声明NPC的关系字典；此过程不改变输入存档。关系门槛本身不赠粮、不改变战斗，不等同于获得授权。任何支援次数都由剧情 flags 与 notFlags 约束，并使用普通效果实际记账，不能靠反复打开人物页重复领取。

`majorNpcForState(state,npc)` 为独立、只读的人物志展开函数。NPC 可定义 `stances` 与 `milestones`，每项为 `{id,requires?,title,text}`；所有满足条件的公开立场和事实里程碑可以同时呈现，不是互斥心理槽。函数返回源 NPC 的独立副本，删除原条件池，附 `relationship`、`controllable:false`、`activeStances` 和 `activeMilestones`；两种活动片段均保留 id/title，并把 text 统一为段落数组。默认0关系、旗标与关系门槛可共同决定显示；读取人物志不修改 party、关系、资源或存档，JSON 恢复后显示一致。

场景正文可以通过 `node.sceneVariants [{id,requires,text}]` 按真实状态展示条件段落。`sceneForState(state,node)` 返回独立展开副本，基础 text 和各段 text 均可为文字或文字数组，输出 text 统一为段落数组；所有满足 requires 的附段按源顺序追加，未发生分支不会凭空出现。返回值移除 sceneVariants 并附 activeSceneVariants（每项 id），重复渲染展开结果不会重复追加。legalChoices 自动使用此展开函数，因此界面与桥接快照获得相同正文；条件场景只影响文本，不修改旗标、不授权选项、不产生资源效果，原节点、状态和 JSON 存档均不受影响。

遭遇战在选择后开始。选择效果在入战前立即结算，遭遇奖励仅在胜利时结算；败退和全员倒下不发胜利奖励，记录 `encounter:<id>:lost`，保留节点已处理标记与选择代价，让后续剧情选择承担损失。末节点通过 completeRoute 或 failRoutes 最终结算路线。finale 逐项验证结局自身 requires；存在章节的战役必须所有章节已收束，无章节的旧战役保留至少两条已完成或失败路线的门槛。结局记录完成、失败、未处理路线与剩余资源，之后拒绝所有行动。

章节定义为有序的 `campaign.chapters [{id,title,summary,requires?,settledFlags:[]}]`，每个节点通过 chapter 指向所属章。节点可用时不仅验证节点与选择 requires，还强制所属章 requires 成立、所有前章均已收束，且本章未收束；即使未来章节点未写自己的前置条件，也不能越章执行。所属章不存在的节点在章节战役中不可执行。章节收束要求 settledFlags 非空且全部已具备；每条主线的成功与失败末节点均可给出相同收束旗标，因此失败不会阻止推进下一章。

`getChapterProgress(state,campaign)` 为纯导出，不保存或改变章游标，旧 JSON 存档只要保留 flags 即可推导进度。返回 `{currentChapter,current,chapters,allSettled}`：currentChapter 是首个已解锁且未收束的章节ID，current 是其进度对象；全部收束或没有可开始的章时两者均为 null。chapters 每项为 `{id,title,summary,unlocked,settled,progress,total,completedFlags,remainingFlags}`，progress/total 是已具备/所需收束旗标数，数组均为独立副本。无章节时 chapters 为空且 allSettled 为 false。结局前必须 allSettled 为 true，且仍需满足所选结局的 requires。

章节战役在全章收束后，必须恰好满足一个主结局的 requires；未覆盖任何结局或同时满足多个时，finale 报结局条件数据错误并保持输入不变。无章节的旧战役仍采用首个满足条件的结局以兼容旧内容。`campaign.epilogues [{id,requires?,text}]` 为补充后果段落：finale 按源顺序收集全部满足条件的附段，保存为 `ending.followups [{id,text}]`，并将文字附入 `ending.consequences` 与日志。附段不替换主结局、不计作额外主结局；因此黑暗伤亡、船产边界、同伴后续等事实可以与政治或水务主结局共同保留。所有段落均在结局时写入 JSON 状态，存档恢复与公开状态不会重新筛选或丢失它们。

## 地图、探索与移动

`.` 为地面，`#` 为墙，`~` 为不可通行水域，`=` 为桥，`^` 为困难地形，`*` 为危险地形。墙与水不可进入，桥通行；普通格消耗1移动力，困难格消耗2。使用带地形权重的最短路径搜索，不可穿越其他棋子；移动经过危险格时每格损失1生命。探索每次最多移动5点，角色周围曼哈顿距离3格会被记录到 explored。每次旅行重新安排出生点周围互不重叠、合法且连通的队伍站位。

旅行只接受固定地图ID；loadMap 还可以载入已保存的自定义地图。自定义地图仅接受 id、name、description、width、height、tiles、spawn、pois；出生点仅 x/y；兴趣点仅 id/name/x/y/description。拒绝未知属性、HTML式文字、错误尺寸或地形、非法出生点与不足的连通站位。尺寸限制8–40列、6–30行；不能覆盖固定地图，不能直接改写正在探索的地图。存图后载入即可按相同规则探索。

固定地图可以有数据型变体 `variants [{id,requires:{flags?,notFlags?},changes:[{x,y,tile}],description?}]`。`mapForState(state,maps,id=state.mapId)` 返回展开后的独立地图副本，按源顺序应用全部满足条件的变体；补丁坐标须在地图内，tile 仅允许可通行的 `. = ^ *`，禁止任意属性和脚本。这允许旗标增加泥障成本、制造危险或将原水域改成桥，而不会把正在站立的棋子封进新墙或水中。规则的移动、视线、危险、探索和部署均读取展开图，原地图不会修改。展开图删除 variants，附 activeVariants 数组（每项 id/description），描述追加当前变体后果；界面编辑副本时须删除 activeVariants 后再保存。自定义地图直接返回原内容的副本，不套用固定地图变体。保存 flags 后恢复会得到相同展开图。

固定源地图的兴趣点（pois）可额外带 `requires {flags?,notFlags?}`。mapForState 仅返回满足条件的兴趣点并删除 requires，未附条件的公开兴趣点始终存在；只有旗标数组可作兴趣点条件。当前许可可以通过 notFlags 在撤销后隐藏，历史遗留物则使用独立的 ever 旗标，在撤销权限后仍保留“曾发生”的事实。展开地图再次以同状态展开时不会重复描述或丢失变体元数据。自建地图的兴趣点仍只接受 id/name/x/y/description，saveMap 拒绝 requires，不能从工坊编造或绕过剧情条件。

自建地图载入后，主持人可以执行 `startEncounter {templateId}`。固定白名单只有 `reeds`「工坊演练：芦苇巡守」与 `shades`「主持遭遇：死契执吏」，每个模板包含两名固定属性敌人；不能上传任意怪物属性、奖励或脚本。仅探索状态和当前自建地图允许开战，敌人总是在出生区域连通、合法且不与棋子重叠的空位生成；空间不足则整项行动失败且不改变状态。战斗使用完整移动、AI、AP、技能和存档规则，combat.training 为 true。胜利没有资源奖励、不写剧情旗标、不结算主线，重复演练无法刷资源；撤退及全倒仍消耗生命、恐惧或白银，且不写剧情失败旗标。

## 战斗

队伍按角色顺序行动，再轮到敌人；战斗状态的 turn 是当前单位ID，order 是ID数组。每次单位回合有2行动点、5移动力。移动消耗移动力；攻击、防守、治疗各消耗1行动点。行动点耗尽自动推进，也可 endTurn 提前结束。敌人回合自动执行：向最近存活角色寻找合法攻击位置、移动最多5点，并在射程与视线允许时攻击。全轮结束后 round 增加，下一单位开始时恢复行动资源。

攻击距离使用曼哈顿距离；墙阻挡视线。伤害为 `max(1, attack + d6 - armor - 防守加值)`。防守提供2护甲，不能叠加，持续至自己的下一回合。d6 使用状态内32位 seed 的确定性生成器，存档恢复后的骰序完全一致。治疗需要相邻、消耗1粮食、恢复最多5生命，并可以救起倒下的角色。生命为0的单位不能行动。敌人可以移动，敌人和角色使用同一地形通行、危险伤害与占位规则。

四位同伴各有独特战斗技能，通过 `skill {characterId,targetId?}` 执行：卡拉特（karat）「钩索破阵」选择3格内可见敌人，护甲降低2并尝试向自己牵引一格，墙、水、其他棋子阻挡牵引；妮萨雅（nisaya）「泥版铭印」选择4格内可见敌人，护甲降低3；贝鲁（belu）「芦舟渡步」本回合增加5移动力，无需目标；苏恩（suen）「净水救护」消耗1粮食，选择3格内可见队友或自己恢复最多8生命并可救起。每种技能消耗1行动点，每名角色每场战斗限一次，party.skillUsed 记录次数；护甲削弱持续本场战斗且不低于0。新遭遇重置次数，非法或缺资源的技能不会消耗行动点和次数。

关系会直接改变技能。角色关系达到3时，卡拉特和妮萨雅额外降低1护甲，贝鲁额外增加2移动力，苏恩额外恢复2生命；关系在-3或更低时，该角色因迟疑而需要2AP才能施放技能。普通攻击与移动不受关系限制，避免关系不佳造成软锁。公开 party 对象附 skillCost 与 skillEmpowered，供界面显示当前消耗与增益，日志明确记录触发原因。居民派系（commons）声望达到3时，互助令休整标准耗粮由2降为1；粮食不足仍可恢复，每缺1份增加1恐惧。亡影派系（shades）在-4或更低时，冥界（underworld）的危险地形每格伤害由1增为2；其他地图与地形不变，日志注明亡影敌意。

撤退使恐惧加1，倒下队友以1生命离场并回到出生区域。全员倒下使恐惧加2、损失最多3白银，进入 defeat；此时休整可恢复。休整消耗最多2粮食、全队恢复满生命；粮食不足时每缺1粮食恐惧加1，避免零粮导致永久卡局。失败后的剧情仍可继续处理后果。

## 多人权限

3.2 默认新建队伍共游（party），无需专人主持。创建者也是 player，另有 canManage 管理标记；其他队员是普通 player。认领角色只表示席位身份，任何认证共游队员都可操作四位固定同伴，某个角色玩家断线不会令该角色失去操作者。所有角色行动仍验证真实队员ID、存活、当前回合、行动点、移动与射程；吉尔伽美什等主要NPC依然不能操控。

引擎从服务端提供的可信 actor 读取 role、characterId、roomMode、canManage，不从 action、游戏存档或 viewer 读取权限。`capabilitiesForActor(actor)` 返回 `{allowedActions,canManage,controlAll,canProgress}`；缺 roomMode 严格按旧 hosted 行为，不把旧房间升级为共游。未知角色或模式拒绝处理，字符串形式的 canManage 不作为真值。

| 可信席位 | 全队角色行动 | 剧情/旅行/休整/撤退/结局 | 地图保存/载入/工坊遭遇 |
| --- | --- | --- | --- |
| party 普通 player | 可以 | 可以 | 不可以 |
| party 且 canManage===true 的 player | 可以 | 可以 | 可以 |
| hosted player 或旧缺模式 player | 仅自己的角色 | 不可以 | 不可以 |
| host | 可以 | 可以 | 可以 |

六类角色动作是 move、attack、guard、heal、skill、endTurn；五类共享进程动作是 choose、travel、rest、retreat、finale；三类引擎管理动作是 saveMap、loadMap、startEncounter。hosted player 即使错误携带 canManage=true 也维持旧玩家限制，不能成为隐式管理员。host 保留旧全部权限。命名存档、导出、智能体创建等 HTTP 管理权限由服务端独立验证，不是新增任意改数值能力。

action 顶层携带 role、canManage、roomMode、actor、capabilities 或 viewer 时统一拒绝；未授权行动与其他非法行动一样，不扣费、不改旗标、不推进 clock/revision。publicState 每次从可信 actor 重新生成 viewer 的 role/characterId/roomMode 与四个能力字段，并生成同值的顶层 capabilities；即使输入存档含伪造 viewer/capabilities 也不会沿用。两份 allowedActions 数组彼此及原状态独立。公开状态仍不携带座位令牌、密码或待发战斗奖励。

共游采用即时执行而非投票：服务端以 first-valid-revision 接受最新修订上第一条合法请求，其他并发旧修订请求返回409后刷新，不依赖在线人数或队长等待。房间模式、管理身份和并发账本由房间/席位持久化管理，不写入可读档覆盖的游戏状态；加载槽位不会改变玩家权限。引擎测试验证纯能力矩阵与规则事务，HTTP 并发、幂等和重启行为另由服务端验收测试覆盖。

## 验证

运行 `node --test --test-isolation=none tests/engine.test.mjs`。测试覆盖输入不可变性、异常原子性、资源与前置、节点重复、地图约束、权限、加权寻路、危险地形、战斗轮次与AI、AP、防守、治疗、独特技能、撤退、全倒恢复、编辑器白名单、结局门槛，以及 JSON 存档的确定性恢复。`--test-isolation=none` 允许在禁止创建子进程的受限环境中运行 node:test。
