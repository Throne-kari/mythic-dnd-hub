# 七门之债 3.2 · 队伍共游：界面与权限

## 3.2 当前增量

唯一实施根为 `mesopotamia-v3-2-party`。仅修改 public 与本文件；剧情、吉尔伽美什档案、画像及地图继承 3.1，不重做视觉或生成新图。运行版信息读取 `/api/content` 的 edition，故事仍读取原 campaign。页面标题采用 edition.title，默认创建模式采用 edition.defaultRoomMode。

### 创建与共同决定

欢迎页默认「队伍共游」，创建者选择四人之一作为席位身份，提交 `{name,mode:'party',characterId}`。创建后身份仍是 player，另有管理能力。可改选「主持模式」，提交 `{name,mode:'hosted'}`，不认领角色。加入邀请只提交 `{name,characterId}`，不发送或推断 role、canManage、roomMode；加入后依据权威返回状态展示模式和能力。

共游玩家均可操作固定四人、推进预设剧情、旅行、休整、撤退与终局。认领仅标识席位，不是共游中的独占操作锁。控制判断同时要求目标属于 state.party，因此吉尔伽美什仍不可操控。主持模式保留旧规则：主持全权，玩家只控制自己的角色。

创建页、主桌模式条、房间面板与抉择上方明确说明：最新修订上的第一条合法请求即时生效，并发冲突刷新，不等待投票、队长或在线人数。UI 不把它描述为全员同意。409 时仅刷新状态，要求重新确认，不自动重放原选择；刷新失败时明确说明未同步完成。

### 能力字段与管理隔离

原统一 host() 判断已拆除。UI 优先读取 `state.capabilities`；兼容 `state.viewer` 上直接展开的 allowedActions/canManage/controlAll/canProgress；缺这些字段时调用同源 engine.capabilitiesForActor。缺 roomMode 的旧房间按 hosted 解释，不因 edition 默认 party 而提升旧席位权限。

- allowedActions：逐动作控制剧情、旅行、休整、撤退、终局、战术与地图入局按钮；提交函数也检查该动作。
- controlAll：共享控制四人；否则只允许 viewer.characterId。战斗仍要求当前角色回合、生命与行动点等规则条件。
- canProgress：用于说明当前席位能否推进预设故事，与管理能力独立。
- canManage：管理地图、命名存档保存/恢复/导出、创建智能体。普通队员可以看见这些入口，但按钮禁用并说明权限；地图可只读查看。

界面权限只是操作提示。实际角色、房间模式和管理能力仍由服务器依据认证席位构造，客户端不向 action 或 join 发送权限声明。

3.2 席位命名空间为 `mesopotamia-v3-2-seat:<edition.version>:<campaign.id>`，独立于 3.1。标签页保存当前席位，持久层按 room/seat 保存，并用 last-manager 保留最近可管理席位；player 管理员同样可恢复，普通队员加入不改写管理入口。邀请仍不包含 token。

### 新控件与程序验证

沿用原深靛青、铜金与泥板语言，只新增 `public/party.css` 小控件样式。主要定位：`#room-mode`、`#room-create-fields`、`#join-character`、`#mode-description`、`#decision-strip`、`#room-mode-badge`、`#decision-policy`、`#seat-capability`，以及 editor/save/agent 的 access-note。原人物档案与地图结构保持。

以下是程序/静态适配器验证，不是浏览器实测：

- JS 语法检查通过；无重复 DOM ID、缺失引用或 inline handler，原 host() 调用与 3.1 存储 namespace 已移除。
- 使用真实 engine.publicState/capabilitiesForActor 和最小 DOM 对象执行界面函数。普通 party player 可控制四人且剧情/旅行/休整启用，存档/地图保存/智能体禁用且可见；party 管理员仍为 player 且管理启用；hosted player 即使带 canManage:true 也只控制本人、不能推进剧情或管理；hosted host 全权。所有情况均不能控制 gilgamesh。
- 创建协议适配检查：party 默认并发送所选角色，返回 player+管理能力；hosted 不发送 characterId；join 只发送姓名与角色，不夹带模式或权限字段。界面读取 edition 标题，存储读取仅进入 3.2 namespace。
- 兼容性检查：仅 viewer 展开能力字段仍正确；缺模式的旧 player 保持 hosted 限制，不自动升级。
- 冲突 fixture：一次 action 得到 409 后一次 GET state 刷新，修订更新到 1，action 总数仍为 1，没有自动重放；主桌与抉择前规则提示存在。
- 管理员通过真实引擎创建演练战斗后，以一名非管理员 party player 逐一结束 karat、nisaya、belu、suen 回合；界面自动选中当前角色，防御/结束回合均可用。此验证不是叙事全流程或浏览器联机体验。

campaign SHA-256 保持 `0b80df53d11493f093a3b9b1f0e6fe54aaf070f38678f566efa1c0a8c3db48cb`，maps 与 3.1 字节相同。完整引擎/HTTP/24终局与独立权限审查由对应负责人记录。CUA 仍无可用浏览器，真实点击、布局截图、跨设备均未在本次验证；没有绕过或把程序 fixture 叫作浏览器测试。

## 3.1 继承设计与历史验证

以下为 3.1 及更早版本的设计、画像和程序检查记录。它们解释继承资产，不代表 3.2 新权限与房间机制已通过同样验收；本版结论见上节及最新 QA。

## 3.1 · 吉尔伽美什关键人物增量

本节仅作用于独立工作根 `mesopotamia-v3-1-gilgamesh`。旧 v3 与其归档保持不变。沿用既有深靛青、泥板、铜金设计；没有重做主桌布局。

以下 3.1 增量与本版 campaign.json 为当前依据；后面的「继承设计与历史验证」保留 v3 视觉演进和旧初稿程序检查，123 选项等旧规模不是 3.1 规格，也不代替本版回归结果。3.1 仍保留三章、九条章内路线与二十四个主终局，选项及王权后果由本版战役数据和最新证据记录确定。

「同行之人」页新增「关键人物」区域，独立于四人队伍。通过纯引擎 `majorNpcForState(state,npc)` 显示公开身份与动机、往来数值、全部匹配的 activeStances 和 activeMilestones；既有许可、反对与共同记忆可以同时成立。未满足条件的条目不显示。若将来声明 knownFromFlag，未满足时隐藏该档案；当前吉尔伽美什按作者设定在开场公开。

吉尔伽美什档案不提供认领、战术动作、自动决策或智能体席位操作，不进入 party 与 join 下拉。剧情正文实际提及公开人物时，提供只读档案跳转。SSE 更新后档案按权威状态重绘。

原创画像由内建 ImageGen 生成、实际查看后保存为 `public/assets/gilgamesh-portrait.png`，完整提示词见 `public/assets/GILGAMESH-PORTRAIT-PROMPT.md`。画像采用成年王者、深靛青织袍、铜金与青金石、泥板和圆筒印章；不采用影视或游戏角色造型，不使用神光或冥界判官身份。画像是本作虚构演绎，不作为历史复原证据。

新增样式位于 `public/npc.css`。档案卡沿用细铜框、暗色人物卡与原正文层级；宽屏为左画像、右档案，窄屏上下排列，已发生接触采用时间线。画像保持自身比例，避免历史记录增长时拉伸裁切面部。

3.1 席位存储使用 `mesopotamia-v3-1-seat:<campaign.id>` 命名空间，不读取 v3 的席位凭据。相对 HTTP/SSE 地址沿用当前服务地址，支持本版默认 8844 端口。

静态页面标题与欢迎页标明 3.1 吉尔伽美什核心篇，运行后页面标题采用实际 campaign.title。欢迎正文优先使用 campaign.welcomeText；未提供时只取 intro 第一自然段，完整 intro 仍保留在战役数据与叙事文档，不把长篇开场挤进启动对话框。

控件与阅读定位：`#major-npcs-section`、`#major-npcs`、`#npc-profile-gilgamesh`、`[data-npc-stance]`、`[data-npc-milestone]`、`[data-npc-profile]`。

无浏览器适配器检查已确认：公开身份显示；未满足接触/许可/里程碑条件时，相应测试段落不进入 HTML；条件具备后多个 stance 同时显示、往来数值更新、里程碑出现；四人 party 与认领名单没有增加吉尔伽美什。新增 DOM 引用、样式链接与画像路径已检查。真实战役数据仍需在作者落盘后复核；真实浏览器交互与截图仍受既有浏览器不可用限制，未宣称通过。

地图新增四处作者确认地点：港口 (10,4) 测水营与大渠 (11,8) 勘测界桩公开可见；封泥库 (10,6) 王印副本需要历史旗标 gilg_royal_warrant_ever，神庙 (6,8) 恩奇都的空碗需要 gilg_enkidu_named。固定 POI 的 requires 由 mapForState 统一筛选并去除，UI 与工坊只使用展开图，不另做旗标分支。撤销当前许可不会抹去历史副本。

本版固定地图共五项地形变体：继承的低街积水、逆流闸新桥、城库木障，以及新增的施工围堰、封墓后保留堰体。新增关键人物 POI 共四处，不计入原有十处地点。

大渠 (5,8)、(6,8)、(7,8) 的 royal-cofferdam-active 变体由 gilg_tomb_works_active 且尚未封墓触发；royal-cofferdam-sealed 由 gilg_tomb_sealed 独立维持实体。三个地格变为 ^，表示料堆和跨堰每格耗 2 点移动力，不是绝对禁入。审计或撤权不移除堰体；实际拆除清除 active 后才回到原通道，其他已经成立的地图变体照常保留。所有地格始终可通行，不堵无资源退路。

地形说明与高亮依据 mapForState 返回的 activeVariants id；UI 只按这些已生效 id 取纹理与说明，不自行再次判断变体条件。新围堰使用木料交叉纹理与「搬料与跨堰 · 2 步」地格名称。

工坊条件地点专项适配检查：分别从 archive 与 temple 的 mapById 展开图执行 initDraft/readDraft，已取得的王印副本或空碗保留，所有 POI 不带 requires，地图不带 variants/activeVariants；输出交给真实引擎 saveMap/loadMap 均通过，四人队伍可合法落点。此为 Node 程序与引擎检查，不冒充真实浏览器操作。公开界桩的说明只陈述待受理图样，不把未获许的测绘或开工写成已发生。

正式 NPC 数据集成的程序检查已运行：从本版真实 createState 开始，在正式开场节点选择 royal-wages，真实引擎结算后档案显示往来 +2、王库已付出真物与测绘租约；party 仍是 karat/nisaya/belu/suen，认领列表没有 gilgamesh。该记录只证明此实际开场选择到档案的适配，不宣称全部王权分支或主终局已由 UI 走通。完整分支验收另见主负责人最新 QA。

### 3.1 最终适配复核与冻结记录

正式主文落盘后，本次复核读取的是 campaign.id `wet-seal-iii-gilgamesh-3-1`：27 节点、145 选择、50 后日谈、24 主终局。该规模与下面 v3 历史初稿分开记录。

- `node --check public/app.js` 通过；静态 DOM 检查的重复 ID、缺失引用、inline handler 均为零。新增 NPC 样式与正式画像路径存在。
- 使用最小 DOM 对象与真实正式数据运行界面函数：标题采用正式 3.1 标题，欢迎正文与 welcomeText 一致（本次 122 字），初始档案只有公开 living-king 状态、没有已发生接触；席位读取均在本战役 3.1 命名空间内。
- 使用真实引擎从初始状态执行 royal-wages，再把返回状态交给界面函数，得到往来 +2、royal-aid 与 survey；队伍仍四人，认领名单没有 NPC。
- 使用 UI 的 mapById/initDraft/readDraft 克隆有条件 POI 的 archive/temple，再执行真实引擎 saveMap/loadMap，通过且没有条件或变体定义流入自建图。
- 使用显式旗标矩阵对地图纯函数做程序验证：施工、审计后、撤权后和封墓后仍保留 ^ 堰体；真正拆除且 active 已清除时回到原 `..=`。五张展开图仍连通，所有已显示 POI 可达；固定源数据不被修改。这是数据/纯函数检查，不是从故事初始状态实走全部上述分支。

上述均为程序验证。CUA 仍无可用浏览器，未执行真实浏览器点击、响应式布局或 UI 截图验收，不用画像或参考图冒充 UI 实拍。界面、地图与本设计文档在此冻结；后续文学小修由作者维护，完整引擎/HTTP/分支回归以主负责人记录为准。

## 继承设计与历史验证（v3）

以下记录包含 v3 的视觉参考与旧初稿检查。作为本版继承设计的背景保留，其中旧的内容数量、合成 fixture 和验收结果不得当作 3.1 新叙事已通过的证据。

### 真实内容与视觉依据

主桌包含 16×12 方格地图、A—P/1—12 坐标、地形图例与移动范围、队伍与敌棋、移动/攻击/救治/防御/结束回合、角色特技、三条主线、当前地图故事与跨地图旅行线索、资源、阵营与信任、记录、席位、邀请、存档与恢复。工坊包含源地图、命名与描述、七种画笔（含出生点）、撤销、重置、服务端保存、重载、JSON 导出、入局与自绘地图主持遭遇。

章节扩展采用 campaign.chapters 有序数组与 node.chapter。主桌泥板顶部显示当前章名称、概要、章内已结算 flag 数与章序列；三线进度只统计当前章节点。优先复用引擎 getChapterProgress，旧数据无章节时保持兼容。章节开启与剧情选项仍由引擎校验。只有所有章节与全部主线都有归宿时才出现终局按钮。

正式战役采用 ch1/ch2/ch3 与九个唯一的章内路线 id。UI 通过 node.chapter/route 关联筛选当前章三条路线，跨章自动选择当前章可用路线；不把九条路线挤进同一泥板。终局展示引擎 consequences 和未被其包含的 followups，避免后日谈重复出现。

资源 dread 的界面名称统一为「恐惧」，用于压力、缺粮与撤退后果；不与叙事中的银债、替身与债制旗标混为积分。冥界地图的旅行入口标示「托身见证」，与七门正文里庙中留身的机制一致。

故事正文使用纯引擎 sceneForState(state,node) 展开 sceneVariants，再按段落显示；选择列表只从 legalChoices 取可用 id，因此不会重复追加同一条件场景。条件未成立的幸存者、证据或此前行为不由 UI 自行补写。

「旅程回顾」可从左侧导航和当前章标题旁打开。每章展示开启/结算状态、概要与三线节点进度；已完成节点读取实际 journal 的选择记录及对应 effects.text，保留前章后果。未开启章节只展示概要，不提供越章操作。

在最终视觉实现前，通过内建 ImageGen 生成并实际查看两张参考：

- `public/assets/reference-table.png`：大棋盘、右侧泥板叙事、底部队伍与记录。
- `public/assets/reference-workshop.png`：同一棋盘、左侧地形画笔、右侧地图铭文与保存操作。
- 完整提示词保存在 `public/assets/REFERENCE-PROMPTS.md`。

参考图中的「两河纪事 / 洪水将至」仅是生成时界面草案用字。成品使用实际战役名「泥印未干 III · 七门之债」，所有故事、人物和选项读取 campaign.json，不沿用参考图虚构叙事或数值。

深靛青与黑曜石承载工具界面；暖泥板叙事栏使用深墨正文，铜金用于边界和主操作，青金石蓝标识当前选择和可达格。使用楔形几何、细线边框、泥砖、水波、木桥与高台纹理。地图由确定性 SVG 绘制，方格比例与服务端碰撞完全一致。画像使用原创代码绘制的四种识别形态；不依赖外部字体、CDN、npm 或网络素材。CSS 提供 850/560px 移动布局与减少动效偏好。

### 地图

五张原创局部地图：芦苇港 harbor、乌鲁大渠 canal、封泥库 archive、月神阶庭 temple、无归之庭 underworld。每张为 16×12，出生点 (2,9)，边界封闭，至少 99 个连通可行走地格。河道、桥梁与障碍形成路线而不封死出生区。所有 POI 位于出生点连通区域。敌人坐标由剧情提供，最终位置由引擎合法性与可达性检查兜底。

地形字符：`.` 沙地、`#` 墙、`~` 河水、`=` 桥、`^` 高台、`*` 诅咒地。高台耗 2 步；诅咒造成伤害。工坊绘制墙或水覆盖 POI 时移除该 POI，出生点被覆盖时要求重新指定。服务端再次验证结构与出生点连通性。自绘地图以 custom- ID 保存，固定地图不能直接覆盖；正在使用的地图需先离开再保存修改。

固定地图支持三项真正影响通行规则的后果，均使用叙事确认的旗标：`drowned_quarter` 使港口低街五格变成 `^`（泥水困难地形）；`sluice_stable` 将大渠 (7,5)、(8,5) 两格水面变为桥梁 `=`，开辟新捷径；`constitution_house` 使封泥库三格通道成为 `^` 木障。原路径与出生区始终保持连通，变化不把正在站立的棋子变成不可通行地形。

schema 为 `variants:[{id,requires:{flags?,notFlags?},changes:[{x,y,tile}],description}]`。UI 与规则共用纯引擎 `mapForState`，并在棋盘上方显示实际街区变化、在地格绘制泥水或木障。工坊使用已展开地图，去掉 variants 与 activeVariants 后保存；自绘地图不会自动套用固定地图的变化。

### 权威状态与席位

浏览器通过 HTTP 发送 {expectedRevision,requestId,action}，通过 SSE 接收权威状态。409 时重新读取状态并明确提醒重新确认，不重放旧选择。任务展示复用纯引擎 legalChoices 与 meetsRequirements；服务端仍重新校验。玩家只有自己角色的战术权限，主持人拥有旅行、剧情、工坊与存档权限。

当前标签页凭据存 sessionStorage；localStorage 按 roomId+seatId 保留席位，并单独记录最近主持席位。join=1 邀请始终进入认领流程，不自动使用主持身份；邀请链接没有 token。刷新可恢复本标签页，重开主入口可尝试最近主持席位。邀请按本地服务端同机使用设计，跨设备连接尚未验证。JSON 导出不包含席位凭据。

### 验证与限制

- `node --check public/app.js` 已通过。
- 静态 DOM 检查：无重复 ID、无遗漏引用、无 inline handler；动态控件采用委托或显式监听。
- 使用 Node VM 与最小 DOM 对象运行启动和工坊渲染：主地图 SVG、四位队友、七画笔与欢迎窗口均成功生成。这只是无浏览器的程序检查，不验证 CSS 布局与真实事件行为。
- 使用合成三章 fixture 运行界面函数，确认第一章结算后切换第二章、全部结算后仍可读完整旅程回顾；使用真实 maps 三个 flags 展开检查，三个变体补丁均命中、variants 定义未进入展开图。该检查不等于实际战役全流程验收。
- 对正式 3 章、27 节点、123 选项、24 结局初稿运行上述无浏览器渲染检查：三章分别仅显示对应三个 route id，初始目标为「湿盘里的十二份工钱」，全部章节结算才出现终局入口。文学内容仍由独立叙事审查负责。
- 条件场景适配器检查：无条件 flag 时段落不出现，加入 flag 后恰好追加一次；使用内存测试段落，不向战役写入测试文本。
- 五张地图尺寸、出生点连通与 POI 可达性已通过脚本检查。
- 本环境 CUA 返回 apps:[]、browsers:[]；创建 iab 提示 Browser is not available: iab。主负责人已实际确认。未绕过该限制，未生成或伪造浏览器截图。
- 已实际查看两张 ImageGen 参考；最终浏览器视觉对照、指针绘制、SSE 多窗口与响应式行为仍需可用浏览器验收。静态检查不等于上述交互已实测。

### 控件定位

主桌：#game-board、#party、[data-mode]、#skill-button、#guard、#end-turn、#travel-map/#travel-go、#routes/#story、#journal。

房间：#room-open、#invite-copy、#room-copy、#agent-character/#agent-player/#agent-dm。创建智能体后 #agent-result 显示本地协议目录。

存档：#save-open、#save-slot/#save-now、[data-restore]、#export-game。

工坊：[data-view="editor"]、#editor-source、[data-brush]、#editor-board、#editor-name/#editor-description、#editor-undo/#editor-reset、#editor-save/#editor-reload/#editor-play/#editor-export、[data-edit-map]/[data-load-map]。载入自绘图后 #encounter-template/#encounter-start 可选 reeds 或 shades 遭遇。
