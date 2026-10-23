# 合作房间与文件夹玩家接口

服务使用 Node 内置模块，默认地址 `http://127.0.0.1:18846`。引擎导出 `createState(seed)`、`dispatch(state,action,{seat})`、`publicState(state,seat)` 和 `validateMap(map)`。服务器维护权威状态、角色归属、串行事务、自动档、单调修订号和 SSE 事件。

普通玩家只操作自己的英雄，合作模式也可发起旅行、短休和撤退。管理席只管理角色、地图与存档；可选主持可以控制全队。权限来自服务签发的令牌和服务器归属表，正文不能声明自身权限。

除健康检查和首次初始化外，HTTP 请求需要 `x-seat-token` 请求头。POST 使用 JSON，写请求含 `requestId`，依赖局面的写请求还需当前 `revision`。同席位相同请求 ID 和正文复交不会重复执行；过期修订返回 409，失败行动不扣资源。

| 接口 | 用途 |
| --- | --- |
| GET `/api/health` | 服务状态与模式 |
| POST `/api/start` | 首次合作初始化；返回普通玩家及独立管理令牌 |
| POST `/api/host` | 仅可选主持模式的首次初始化 |
| GET `/api/state` | 本席位可见局面及真实 `legalActions` |
| GET `/api/events?since=N` | 使用 fetch 和认证头读取 SSE；每 15 秒心跳 |
| GET `/api/presence` | 席位在线状态、角色与接管阈值 |
| POST `/api/seats` | 管理席创建普通玩家并分配 `actorIds` |
| POST `/api/claim` | 管理席重分配目标 `seatId` 的 `actorIds` |
| POST `/api/takeover` | 玩家接管离线队友的 `actorId` |
| POST `/api/action` | 经权限、资源、回合与规则检查后执行 `action` |
| GET `/api/saves` | 管理席读取本版存档列表与元数据 |
| POST `/api/save`、`/api/restore` | 管理席保存、恢复 `slot` |
| POST `/api/folder-player` | 管理席将一个英雄交给自主文件夹玩家 |
| POST `/api/folder-player/stop` | 管理席停止文件夹玩家并收回角色 |

文件夹玩家创建正文为 `{requestId,revision,actorId,name?}`。响应含 `createdSeat`、`folderPath` 和 `automatic:true`。管理席的普通状态响应还含 `folderPlayers:[{seatId,name,actorIds,folderPath}]`。停用正文为 `{requestId,revision,seatId}`；角色归还给创建前的玩家，原玩家已不存在时归还给现有普通真人玩家。默认只在显式选择角色后创建文件夹玩家。

文件夹玩家是一张普通玩家席，只能选择自己的合法行动；它不会取得管理或主持权限。服务器在角色归属变化、局面推进或快照超时后更新其快照。agent 写回的合法行动自动执行，自动保存并同步给真人，无需点“采用”。旧快照、越权动作和重复回复均由同一规则链处理。

独立的人工协作提案接口仍保留：`/api/agent/request` 创建本席快照，`/api/agent/submit` 提交候选回复，`/api/agent/apply` 采用，`/api/agent/cancel` 取消。这条提案流程与自主文件夹玩家使用相同的回复格式，但提案需要显式采用。

服务的所有读写仅在当前游戏目录内进行。启动不读取其他游戏、旧运行目录、环境密钥或用户文件。存档和快照不包含席位明文令牌。
