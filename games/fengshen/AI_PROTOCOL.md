> v0.3 世路人情：本副本仅本机8811；本轮未实际调用API。运行信息、房间、桥接环境变量均与原版独立。以本版README为准，不使用原版隧道或自动迁存档。
> 粮药、韩家附约、证言及买断专报、独家运力、魏简附报都走当前actions与真实服务端命令。80／180／200 GP诱惑、对应的合作缺席、退款交接与封卷职书以服务端结果为准。先读选项成本，不以旁白声称扣款、更正、退款或本人同意；1HP击昏、失能、魅惑／支配的定光不得核稿。私人关系与私密材料只由真人GM离线手工分发，不加入bootstrap／facts／journal／AI玩家请求。成年人自愿、非露骨，可友情或淡出无机械惩罚。原救援、合法聪明解决与基础报酬不得临时反悔。

# 房间 AI 协议 v2

API 模型与工作区连接器都是房间席位。身份来自服务端验证的 `x-seat-token`；`x-room-id` 可检查房间一致性。JSON 正文中的 role、actor 或 roomId 不能提高权限。

## 请求与回复

`makeRoomRequest(state, campaign, seat, options)` 接受已认证的 seat 和服务器生成的 options.view。玩家请求缺少过滤后 view 时直接拒绝。请求包含：

| 字段 | 含义 |
| --- | --- |
| protocolVersion / version | 均为 2 |
| requestId / id | 此次请求的唯一标识 |
| roomId / seat | 房间、真实角色与本席可控制的演员 ID |
| revision | 推理所依据的游戏版本 |
| seq | 创建请求时的房间事件游标 |
| situation | 席位视角中的当前局面 |
| actions | 当前演员的合法规则命令；index / label 仅显示 |
| commandCatalog | 叙事、检定、章节操作与有依据的主持裁定说明 |
| events | 可见的近期事件 |
| source / continuity | 仅 DM 获取本回原文与长期事实 |
| responseSchema | API 严格回复格式；工作区也沿用其语义 |

回复为 `{requestId, revision, narration, reason, command}`。command 为一个规则命令对象或 null；叙事不直接改变资源和任务。手工回复无需填写未用字段，API 严格格式将未用字段设为 null，解析后清除。

`parseRoomResult(raw, request, {revision?})` 检查请求关联、版本、命令结构和基本席位边界，保留旧 `{narration, reason, actionIndex}` 格式的转换。采用时仍由服务器使用请求所属席位再次授权，不借用点击采用者的主持权限。最终规则效果通过同一 `authorizeCommand` 与引擎 `apply` 结算。

玩家视角不含原始 flags、locations、gm_markers、主持正文、配置或 API 凭据。对自己角色提供规则卡，对其他可见角色使用公开摘要。事件只送入白名单摘要字段。服务器投影是权限边界，AI 提示词不是权限边界。

## HTTP 通道

以下为已认证席位的接口；所有 POST 由桥自动附带唯一 commandId，涉及局面提交时附 revision。

| 方法 / 路径 | 用途 |
| --- | --- |
| GET /api/state | 当前受限状态、席位、待采用回复与真实 AI 忙碌状态 |
| GET /api/updates?since=N | 游标后的可见事件与当前状态；事件窗口过期时 reset=true |
| GET /api/bridge/request | 领取本席现有待回复请求；DM / 房主可查本桌请求 |
| GET /api/handouts | DM 读取本幕资料的真实 ID、cue 与正文；玩家只取得已发布资料 |
| GET /api/events | 浏览器 SSE；连接凭据由服务器短期签发 |
| POST /api/ai/request | `{revision, actor?, text?, mode:'bridge'|'api', seatId?}`；席位权限由服务器决定 |
| POST /api/bridge/submit | `{id, revision, response}`；预览结构化回复，不执行 |
| POST /api/ai/apply | `{id, revision}`；再校验过期与席位后原子采用 |
| POST /api/command | `{commandId, revision, command}`；真人 / API / 工作区共用规则命令 |
| POST /api/bridge/presence | `{status:'connected'|'disconnected', cursor}`；真实连接器心跳 |
| POST /api/ai/control | 房主暂停、恢复、取消或接管；取消中止实际请求 |

重交同一 commandId 必须保持相同正文。服务器记录命令回执，重复请求只返回原结果，不能重复扣资源或发奖。revision 与事件 seq 分开：心跳、请求准备等房间事件不应让有效游戏命令失效。

## 章节与规则命令

剧情选项使用 `{type:'choice', actor, option}`，从当前 actions / campaignView.options 复制 option。后续章节使用带章节前缀的选项 ID；完成后当前可用的 `campaign:next` 负责收束与衔接。DM 可用 chapter / travel 处理已同意的特殊转场，常规推进不跳过章节目标。

move、attack、spell、feature、item、door、rest 等直接使用引擎命令；法术多目标使用 targets。请求检定时以 roll 提交骰式与检定名称，收到真实结果再继续。自由裁定使用 `{type:'gm', text, patch}`，text 留下具体依据；玩家席位无此权限。

DM 的 options.handouts 可提供本幕真实手札元数据 `{id,title,cue,text}`，仅送给 DM。发布使用 `{type:'handout',option:实际ID}`，按 cue 分件发布。解析器拒绝不在本请求 handouts 中的 ID；缺少目录时不会为模型生成任何 ID。玩家 AI 没有此命令权限。

GM patch 可写已出场人物的 npc/status/attitude、现存物件 itemOwner/holder、真实 promise 与 chapter。API 的严格 schema 将事实表达为 `fact:[{key,value}]`，解析后规范成引擎的 `fact:{短名称:值}`；工作区直接提交原事实对象仍保持兼容。原因 text 必填，玩家无 GM 权限。

## 连接器与调用生命周期

`tools/bridge.mjs` 保留本地 state / request / submit / apply / command，并支持远端 --url、--room、--token-env、events、watch / stop 与房主控制命令。默认新本地服务只从 runtime-v2.json 读取地址；席位 token 从环境变量读取。旧 runtime.json 只在旧本地协议下兼容。

inbox 读取已有请求，watch 在 reply 待办中提供当前请求上下文，避免覆盖真人已经为 AI 席位建立的请求。房主可通过 resume 的 seatId、steps 与 autoApply 主动启动有限次数的 API 参与；工作区连接器不代为发起模型调用。

watch 的网络在线与工作区 AI 的思考是不同状态。watch 运行时发送心跳并输出增量事件 / 待办，不自行调用付费模型；实际决策由正在处理任务的工作区 AI 提交。Ctrl+C 或 stop 能停止连接器，异常断线由心跳时效反映。控制台及输出文件清除 token、临时事件凭据、邀请与 API key 字段。

watch 对短断线、超时、408 / 425 / 429 与服务端错误按 1–30 秒退避重连，认证及权限失败直接退出。--out 保存的游标仅在连接地址 / 房间一致时恢复，显式 --cursor 优先；停止与断线保留最后待办及游标，不把未完整读取的事件视为已经消费。新房间与重启后 AI 暂停，由房主 resume 后才可执行 AI 规则命令。

`callAI(config, request, {signal})` 使用请求自带 responseSchema，外部取消与 90 秒超时组合。Responses 禁用存储；兼容 Chat Completions 使用同一 JSON 协议并解析。没有静默重试、模型自动切换或启动后的自动收费调用。API key 只在服务器 / 本地连接器进程内持有，停止连接不能撤销服务商已经发生的计费。
