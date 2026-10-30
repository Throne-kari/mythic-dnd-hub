# 权威合作房间 API

Node 24+，无 npm 依赖。运行 `npm start`，打开 `http://127.0.0.1:8841`。可用 `PORT=…` 环境变量改变端口；PowerShell 写法 `$env:PORT='8842'; npm start`。普通路径配置 `RUNTIME_DIR` 可隔离运行数据。CLI 始终监听 127.0.0.1。合集通过网关提供公开部署入口；直接启动本文件仍只监听本机。

这是受 d20 规则启发的小型原创游戏，不是完整 D&D 2024 实现。四英雄按固定顺序行动；每回合可移动 speed 点并执行一次攻击、防御、治疗或交涉。最后一名英雄结束回合后敌方自动移动/攻击。掷骰、伤害与代价写入游戏日志。伤害支持固定0–50或严格骰串 `1d8+4`（1–4颗，d4/6/8/10/12，至多两位修正）。自然20自动命中并额外d6，自然1失手。

地形 `# ~ c`（墙/深水/石柱）不可通行，`.`/`r`（地面/石路）耗1移动点，`2`高台/`^`碎石仅耗2移动点；`# c`遮挡射线，邻接石柱c提供护甲+2。治疗消耗1药物，距离≤2，恢复6，可拉起倒地队友。梅莉娅信任≥2额外治疗2，≤-3拒绝协助但保留英雄基础治疗；伊昂信任≥2技能检定+1，≤-3检定-1。日志记录协助与拒助。

剧情交互需要非战斗状态、可控英雄在本阶段地图点位曼哈顿距离2内；开战后须先击败或交涉撤走敌人，再交叉推进任意剧情线。交涉需所有活敌标记 `parley:true`，当前英雄距离最近敌人≤6，消耗一次行动及2粮食或3银币；敌人变为 `hp:0,status:'withdrawn'`，持久保留为撤离而非击杀。检查成功使用 `effects`，失败使用 `check.failEffects`（完整失败结果），失败后默认同样推进 `next`，也支持 `check.failNext`。每次选择/休整耗一天，探索旅行免费。休整消耗2粮食、恢复全队。全队倒下会回集市、恢复半血，耗2天/2粮食并增加动荡；达到 `campaign.deadline`（本战役49，旧无配置fixture默认18）尚active剧情线失败，已完成章节成果保留并触发封城终局。最后一章三线全部有结论且无战斗时可 `finish`；章节战役要求恰好一个结局匹配，否则拒绝含混或缺失结局。

## 四章推进

最终战役4章×3线×3阶段，共36节点。`campaign.chapters`为连续编号的 `{id,number,title,summary,goals:{burial,harvest,oracle},arrivalEffects?}`；各stage有chapter。没有chapters的兼容fixture按单章工作。

`state.chapter`为当前数字章，`chapterHistory`为按序数组：`[{number,enteredDay,arrivalApplied:true,outcomes:{burial:'complete'|'failed',...},completedDay?}]`。本章三线可按任意顺序交错；先完成的线保持 `status:'active'`，stage指向下一章，但处于waiting，不能提前选择。三线均离开本章、且当前没有战斗时自动进入下一章，公开应用 `arrivalEffects` 一次并记日志，保存/重启不会重复领取。第一章开局同样只应用一次入章效果。

前期失败通常由内容选项设置 `*_cN_failed` 并next下章首stage；引擎在history记failed。前期的 `next:'failed'` 也自动转到本弧下一章入口并置该旗标；最后一章才成为全弧failed。损失与旗标不会因入章清除。下章选择仍可修复后果；存档验证章节顺序、阶段范围与历史，拒绝越章/损坏状态。

## HTTP

所有 JSON UTF-8。除创建、加入、目录和健康检查，均需 `Authorization: Bearer <本地房间令牌>`。令牌是随机房间凭证，不是模型 API 密钥；服务端只存SHA-256摘要，不记录访问URL或凭证。SSE因浏览器EventSource限制可用query token，其他接口不接受query token。无跨来源授权；请求Origin必须与Host一致。

| 方法和路径 | 请求 | 响应 |
|---|---|---|
| GET `/api/health` | 无 | `{ok,service:'the-unburied-city',title,protocol,rooms}` |
| GET `/api/catalog` | 无 | `{campaign,maps}` |
| POST `/api/rooms` | `{name,mode?:'cooperative'\|'hosted'}` | `{roomId,token,seat,state}`，默认合作玩家；hosted仅兼容可选旧模式 |
| POST `/api/rooms/:id/join` | `{name,heroId}` | 同上，玩家席位；在线重复认领409，确认离线可接管 |
| GET `/api/rooms/:id/state` | 身份头 | `{roomId,seat,state}` |
| POST `/api/rooms/:id/action` | `{revision,action}` | `{state}` |
| POST `/api/rooms/:id/save` | `{slot}` | `{slot,state}`，合作队员或旧模式DM |
| POST `/api/rooms/:id/load` | `{slot}` | 同上，仅合作房间发起者或旧模式DM；新revision永远递增 |
| GET `/api/rooms/:id/events?token=…` | 身份 | SSE `event: state`，data为view状态；15秒心跳 |
| POST `/api/rooms/:id/agents` | `{name,heroId,role?:'player'}` 或 `{name,role:'dm'}` | `{roomId,seat,folder}`，仅合作房间发起者或旧DM授权创建；合作模式禁止dm角色，无密钥文件席位 |
| GET `/api/rooms/:id/agents` | 身份头 | `{agents:[{seat,folder}]}`，仅合作房间发起者或旧DM |

错误为 `{error}`；无凭证401，DM权限不足403，修订/认领冲突409，缺失404，非法动作400，超大请求413。请求体最多128KiB，未知字段拒绝。slot仅1–64字母、数字、下划线、连字符。合作玩家可操作自己的、未认领的或断线45秒确认离线的英雄，不可操作其他在线队员认领的英雄。活跃SSE连接始终保护归属；加入时接管离线英雄会转移原归属。合作`seat.heroIds`是当前有效控制范围，`ownedHeroIds`是明确认领，`canManage`仅控制读档/文件席位管理，不授予DM动作。控权变化会通过SSE在相同revision更新。无mode的旧房间按hosted解释，旧DM仍可操控全队、保存/加载、编辑地图；所有模式均遵守真实剧情、资源、地图和战斗规则。

## 状态和动作

`state` 为 `view`：权威状态的副本，含 `seat`、`legalActions` 和 `availableChoices`。后者每条含 `chapter,waiting`，等待线的options均不可选且reason解释等待。`heroes`/`enemies`为数组，`customMaps`为 `{id:map}`，`arcs[id]={stage:阶段字符串id,status:'active'|'complete'|'failed'}`。`combat`为布尔值，`turnUsage={move,action}`。没有DM隐藏笔记或跨席位凭证。`legalActions`列出一步移动及当前可执行动作，复杂移动/地图编辑/任意主持叙事仍可提交合法参数，不枚举无限文本。

`action.type` 白名单：

```text
move {heroId,x,y}       attack {heroId,targetId}
defend {heroId}         heal {heroId,targetId}
parley {heroId,resource:'grain'|'coin'}
endTurn {}             travel {mapId}
choose {arcId,optionId,heroId}
rest {}                finish {}
mapSave {map}          mapLoad {mapId}
mapToken {token:{id,x,y,label,color?}}
narrate {text}
```

在上述参数外加 `type`，不接受额外字段。`mapSave`保存完整自定义图（包括怪物）；不可覆盖原剧情图，最多12图。地图6–40格边长，合法地形/出生点/敌人/出口/点位严格检查，点位与出口必须可达。更新地图清除旧缓存；当前自定义图同时重置敌人/队伍入口。`mapLoad`将图载入权威房间，首次用模板敌人，后续恢复该图战斗状态。编辑器移动怪物后保存/重载即可实际入局。`mapToken`是DM叙事标记（最多30），不改变怪物。旅行仅沿出口且不能在战斗中进行。

地图decorations必须为≤150项数组，每项仅 `type,x,y,w?,h?`，type限 roof/tomb/benches/beam/tree/statue/tripod/brazier/desk/ledger/dock/stairs/valve/gate。坐标为图内整数；w/h为正整数（默认1），整个矩形需在图内，防止巨大绘制/渲染崩溃。地图名称≤100，subtitle≤300，description≤2000；点位label≤100、description≤1500，均验证字符串类型。模板tokens会实际带入战局，离开/返回保存更新后的标记。

`narrate`仅真人DM或其授权文件DM可用，text需非空且≤1500字，作为纯文本写入同步日志；不解释HTML、脚本、文件路径或命令，不耗日/行动，但正常递增revision并落盘。玩家提交、额外字段或过长文本拒绝。

`state.log`保存完整有限卷轴，包含末800条剧情、章节、检定、战斗和行动记录；超限仅移除最旧条目。界面最近事件是摘要，可展开完整卷轴。存档/重启保留该卷轴，章节长期结果另由chapterHistory与flags保留。

`requires`分组为flags/resources/world/relations/companions/arcs；数字表示下限，`{min,max}`表示区间，flags严格等值，arcs值匹配status。额外允许递归 `all:[requires...]`、`any:[requires...]`、`not:requires`，与同对象其余条件AND组合；列表1–32项，嵌套至多12层，总至多256条件节点。未知键、任意表达式/代码、空逻辑数组、非有限数、倒置范围均拒绝；不会运行eval或JS条件。createGame预先严验所有选项与结局条件。成本必须为非负整数且资源足够；效果必须使用已知资源/世界/关系/同伴键，flags允许安全标识。拒绝动作不会消耗骰、时间、资源或revision。

## 持久化和嵌入

运行数据仅 `runtime/`：`rooms/:id.json`含campaignId/contentVersion、席位摘要、当前完整状态、智能体回执记录；`saves/:room/:slot.json`含相同战役/内容版本标识和手动存档。startup/load严格匹配当前campaign.id及contentVersion（未配置默认1），不同版本拒绝并保留原文件；新版使用独立目录，不自动迁移原型存档。每次接受动作、认领与读档均在响应前写同目录临时文件、fsync、rename原子替换。重启恢复同房间、席位身份与状态；`load`也保留席位和智能体去重记录。请备份整个runtime并避免手动编辑运行中JSON。

每个runtime只有一个权威主机：启动以进程内realpath登记及 `.host.lock` 的独占wx创建双重防重入，元数据为 `{version:1,pid,nonce,createdAt}`。正常close/shutdown等连接结束后释放锁；换PORT仍不能重复占用同一runtime，独立房间服务需另设RUNTIME_DIR。异常退出后仅对锁中PID执行 `process.kill(pid,0)`无信号探测，仅明确ESRCH时可回收；EPERM、探测不确定或坏元数据均保留锁并拒绝，需人工确认旧主机停止后处理。不会枚举系统进程、读取命令行或终止其他进程。死锁回收由 `.host.recover.lock` 串行化，恢复中断残留同样保守拒绝；不会以重置存档绕过锁。嵌入测试可注入 `lockProbe(pid)=>'alive'|'dead'|'unknown'`，生产无需此选项。独立服务不应绕过合集网关直接暴露运行文件或智能体目录。

```js
import { createServer } from './server.mjs';
const server = createServer({campaign, maps, runtimeDir:'/isolated/runtime', agentInterval:1000});
server.listen(0, '127.0.0.1'); // 测试用随机端口
// server.agentTick() 同步处理文件队列；server.rooms 为权威Map。
// server.shutdown() 结束SSE并关闭服务器。
```

引擎导出 `createGame(campaign,maps)`、`act(state,action,seat,campaign,maps)`、`view`、`legalActions`、`validateMap`、`validateState`、`validateRequires`、`meets`、`normalizeMaps`。`act`返回新状态；抛Error时传入状态不变。startup/load在改变当前房间前用validateState检查地图、四英雄模板、有限数值、剧情阶段、章节历史、回合、日志及自定义图；坏存档拒绝并保留原文件。旧12节点断点的运行存档不自动迁移为新版四章，保留归档用于核对。rngState是持久化LCG种子，初始20261021，便于重放；不是安全随机或公平竞争服务。
