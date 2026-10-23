# 千问中国·三册异途：房间 AI 协议

API 模型与工作区连接器都是房间席位。身份来自服务端认证的 `x-seat-token`；`x-room-id` 检查房间一致性。正文中的 role、actor、roomId 不能提高权限。默认本机服务为 `http://127.0.0.1:8829`；远端游戏和模型需要 HTTPS，本机允许 HTTP。

本版没有配置真实模型密钥或发起真实模型调用。新房间与服务重启后 `aiPaused=true`，房主恢复前，API 请求被拒绝，AI 席位不能采用或提交规则操作。普通工作区请求只准备上下文，不自行调用模型。

## 请求与回复

`makeRoomRequest(state,campaign,seat,options)` 接受已认证的席位；玩家必须提供服务端过滤后的 `options.view`。

| 字段 | 含义 |
| --- | --- |
| protocolVersion / version | 均为2 |
| requestId / id | 请求唯一标识 |
| roomId / seat | 房间、真实席位、职责及其控制的角色ID |
| revision | 推理所依据的游戏版本 |
| seq | 请求创建时的房间事件游标 |
| situation | 本席可见局面 |
| actions | 当前合法命令；index / label仅供显示 |
| commandCatalog | 叙事、检定、转场和主持裁定说明 |
| events | 可见近期事件 |
| source / continuity | 仅DM获得本景原文及持续事实 |
| handouts | 仅DM获得当前实际提供的材料ID、title、cue、text |
| responseSchema | API严格格式；工作区沿用同一语义 |

回复结构为 `{requestId,revision,narration,reason,command}`。一次最多一条规则命令，只叙事时 `command:null`。手工回复可省略未用的命令字段；Responses严格schema要求未用可空字段填null，解析后会清除。兼容Chat使用相同JSON语义并由解析器检查。

命令通用字段为 `type,actor,target,targets,option,mode,dc,x,y,cover,knock,slot,text,patch`，并非每种动作都接受所有字段。优先复制当前 actions 中真实的合法命令；`mode`用于仪式／专长等实际模式，`dc`用于检定，不凭空创造命令或免费资源。

`parseRoomResult` 检查请求关联、版本、结构和基本席位边界；兼容旧 `{narration,reason,actionIndex}` 时，只转换本请求记录的动作。采用时服务器使用请求所属席位重新授权，再经过 `authorizeCommand` 和引擎 `apply`。点击采用的人拥有DM权限，也不会把该权限借给玩家AI。

玩家上下文使用正向字段表，不含主持原文、原始flags／locations、地图主持标记、配置及凭据。自己角色可读取真实规则卡，其他可见角色使用公开摘要。玩家AI不能控制其他角色或使用gm／chapter／travel／handout。服务器投影与权限校验构成边界，提示词只是行为约束。

## HTTP 通道

所有下列接口均要求席位认证；桥为POST生成唯一commandId，涉及局面时提交revision。

| 方法与路径 | 用途 |
| --- | --- |
| GET /api/state | 受限状态、席位、待采用回复及真实忙碌状态 |
| GET /api/updates?since=N | 游标后的可见事件与最新投影；窗口过期时reset=true |
| GET /api/events | SSE，同样支持游标及受限投影 |
| GET /api/bridge/request | 本席现有待回复请求；DM／房主可查看本桌请求 |
| GET /api/handouts | DM／房主读取材料目录；玩家无权限 |
| POST /api/ai/request | `{revision,actor?,text?,mode:'bridge'|'api',seatId?}` |
| POST /api/bridge/submit | `{id,revision,response}`，仅预览，不执行规则动作 |
| POST /api/ai/apply | `{id,revision}`，重验过期／归属后原子采用 |
| POST /api/command | `{commandId,revision,command}`，真人／API／工作区共用 |
| POST /api/bridge/presence | `{status:'connected'|'disconnected',cursor}`，连接器心跳 |
| POST /api/ai/control | 房主pause／resume／cancel／takeover；有限API批次还带seatId／steps／autoApply |

`revision`与事件`seq`分开：心跳和请求准备等事件不应让有效游戏命令失效。旧revision被409拒绝，返回最新投影供重新选择。相同席位重交同一commandId必须保持同一操作类型与正文；收据窗口内重复不二次结算，换正文被拒绝。服务器当前保留500笔收据、400个事件，不承诺无限历史幂等。

## 剧情、规则与手札

两个正式包均为十二可执行节点的单场冒险，等级与端口由各自内容包定义。剧情命令使用 `{type:'choice',actor,option}`，option从当前actions或campaignView.options复制；当前收束完成后再用实际可见的campaign:next。转场／跳章只能由DM按实际进展操作，不能绕过人物、物品、已发生的任务事实与结局条件。

move／attack／spell或cast／feature／item／door／rest／prepare等走同一引擎。skill使用技能option与dc；save使用属性编号option与dc，死亡豁免另按引擎约束；roll使用text骰式及option检定名称。收到真实骰点后才继续；自由检定不自动改剧情事实。chat为公开交谈，可不带actor、不先领角色，不修改规则资源。

DM发布手札使用 `{type:'handout',option:'实际ID'}`。AI解析器只接受本请求handouts中的ID；缺少目录不能自行编造。服务器还按发现／商谈事实检查H01–H05的就绪条件；H06为开场材料。一次发布一件，玩家只能见已发布件。

自由裁定使用 `{type:'gm',text:'明确依据',patch:{...}}`，玩家无权调用。patch可记录真实角色数值、已出场NPC状态、已有物件持有人、承诺、事实及1–6景转场；每一项仍受引擎校验。严格API把事实写成 `fact:[{key,value}]`，解析后变为`fact:{短名称:值}`。旁白不会代替结构化资源／剧情效果。

## CLI 与生命周期

`tools/bridge.mjs` 支持state、events、inbox、request、submit、apply、command、watch／stop及房主控制。非敏感连接参数用MYTH_URL／MYTH_ROOM，凭据只用MYTH_SEAT_TOKEN或`--token-env`指定的环境变量；不接受明文token参数，不从runtime文件回退读取席位凭据。

未指定URL时，只读取本版data/runtime-v2.json发现地址；RUNTIME_FILE可指定隔离运行记录。该文件含进程停止凭据，不应分享；桥不输出它。`tools/stop.mjs`只接受本机HTTP地址与该进程凭据，不使用玩家token、不停止连接到的远端服务。

inbox领取已有请求，避免覆盖真人为AI创建的待办。watch在reply待办中提供请求上下文，review表示待采用，refresh表示过期；它只取事件与心跳，不思考、不调用付费模型。运行连接器并不意味着聊天关闭后仍能继续决策。

watch默认3秒轮询，可在1–30秒调整。短断线、超时、408／425／429和服务端错误按1–30秒退避重连；认证／权限失败退出。相同URL／room的--out游标可恢复，显式--cursor优先；事件窗口失效时reset带最新状态。停止／断线保留最后待办及游标，不把未完整处理的事件当作已消费。

Ctrl+C或同一--stop-file的bridge stop停止连接器，并尽力发送disconnected心跳；异常退出后服务按最后心跳判断断线。多个watch使用不同停止文件。所有控制台与输出文件递归去除席位／事件／邀请／进程／API凭据字段及当前席位token字面值；内容本身仍遵循本席知情权限。

pause／cancel／takeover要求房主，会清空待采用回复、暂停AI、停止有限批次并Abort当前请求；takeover把目标角色／DM职责交给房主。resume普通模式只恢复权限；带API席位与steps才准备有限批次，autoApply明确选择自动采用。服务重启不会自动恢复批次或收费调用。

`callAI`将外部取消与90秒超时组合，Responses请求store=false；无静默重试或自动换模型。API密钥仅在服务内存，持久化与玩家视角均不含密钥。取消不能撤销服务商已经发生的计费。真实模型连接和公网部署须有独立实际证据，技术模拟或本机协议检查不能替代。