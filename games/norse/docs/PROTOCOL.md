> v3.2权限补充（优先于保留的旧主持示例）：默认18842与`data/local-v3-2`；可选`--mode=hosted`为18843与`data/hosted-v3-2`。普通有角色player可以travel/rest/retreat，按首个合法当前版本请求执行，无投票。个人actor动作仍校验归属，manager只可管理。`state.tableMode`由服务器初始化且restore强制保留当前模式，存档或正文不能提权。恢复不覆盖既有自动档。管理令牌不进入普通状态、SSE、存档或agent快照。GET/presence每15秒保持当前席位在线，90秒后方可接管离线角色；旧owner重连不会自动抢回。只对本机创建者提供管理能力；不声称隔离同一Windows账户中具有完全系统权限的其他程序。

# 盐峡湾 v3 · v3.2合作桌与无密钥智能体协议

本版是独立 Node 内置模块服务，默认 `http://127.0.0.1:18842`。启动命令为 `node server.mjs`；可用 `node server.mjs --port=18844` 更改端口。只绑定本机地址，未做外网部署，也不代表已完成跨设备联机。首次启动新建状态，不扫描或读取旧版运行文件、凭据、个人存档或 `.env`。

## 引擎接合

服务器通过四个导出函数接合本版引擎：

```js
createState(seed = 1) // JSON 状态，含 revision、actors、maps、mapId
dispatch(stateCopy, action, {seat: {id, role, actorIds}, requestId, now})
// -> {ok, state, error?, events?}，失败不提交
publicState(stateCopy, {id, role: 'host' | 'manager' | 'player', actorIds})
// -> 本席可见局面及逐项 legalActions
validateMap(map) // -> {ok, errors}
```

服务器维护权威状态。所有写操作进入同一串行队列，规则动作先在副本上执行，再原子写入自动档；磁盘成功后才提交内存状态，由服务器递增 `revision` 一次。失败不改变状态、随机数、资源、事件游标或智能体采用状态。存档恢复也递增当前版本，因此版本不会倒退。普通保存、管理分配席位和智能体准备只改变事件游标 `seq`；断线接管递增 `revision` 并写自动档；GET心跳不改变局面或游标。`revision` 是行动依据，`seq` 是同步游标。

## 席位与令牌

默认首次 `POST /api/start` 创建普通player（初始四角色）与独立manager（无角色），只在初始化响应返回 `seatToken`、`managementSeat`、`managementToken`。初始化requestId须32–96位随机标识（UUID可用），相同标识与正文可恢复原响应，不同正文冲突。只在本进程保存初始化恢复能力。`POST /api/host` 为显式旧主持初始化；任一桌已初始化后均不能再次取得管理或主持权限。管理席可用 `/api/seats` 或 `/api/claim` 分配玩家角色，自己不能持有角色或推进剧情。可选host仍可控制全队。令牌用随机 256 位值签发，服务端只在本进程内保存其 SHA-256 索引；不写进存档、地图、快照、收据或日志。令牌只在创建响应及相同随机初始化标识的恢复响应中交给调用者，服务重启后失效。

除 `/api/health` 与首次初始化 `/api/start`、`/api/host` 外，HTTP API 都要求 `x-seat-token` 请求头。正文中的 role、seat、actorIds 不提高权限。令牌查询参数不生效。只允许同源浏览器请求，不接受转发代理头。静态服务仅公开 `public/` 中允许的文件类型，数据目录和服务源码不公开。

房主负责保管本次响应中的令牌；同机 UI 可按本版约定存入浏览器会话。令牌不是联网邀请链接。本进程失去全部令牌时，重启后重新创建牌桌，再使用新管理席显式恢复本版存档。旧令牌与角色分配不写存档。

## HTTP 契约

POST 请求必须为 `Content-Type: application/json`，最多 2 MiB。除首次房主与智能体回复外，所有 POST 都带 8–96 位 `requestId`，允许字母、数字、下划线与连字符，推荐 UUID。需要当前局面的操作同时带 `revision`。

成功状态响应的公共外层为：

```js
{
  ok: true, protocolVersion: 1,
  seat: {id, name, role, actorIds},
  state, revision, seq, pending,
  // 仅管理或主持：seats: [{id, name, role, actorIds}]
  // 写接口另有 duplicate、applied、saved 等结果
}
```

| 方法与路径 | 正文／参数 | 结果与权限 |
| --- | --- | --- |
| GET `/api/health` | 无 | 本机服务状态、是否已有房主，不含局面 |
| POST `/api/start` | `{requestId,name?}` | 默认合作初始化，普通player与分离manager；响应含两种独立令牌 |
| GET `/api/presence` | 无 | 认证席位心跳；席位列表、在线状态、距最后请求时间和90秒阈值 |
| POST `/api/takeover` | `{requestId,revision,actorId}` | 合作模式有角色player显式接管离线90秒的其他player角色，幂等且CAS |
| POST `/api/host` | `{name?}` | 仅本进程首次成功，201，额外 `seatToken` |
| GET `/api/state` | 无 | 当前席位投影 |
| POST `/api/seats` | `{requestId,name?,actorIds:[]}` | 管理或主持新建玩家，额外 `createdSeat,seatToken` |
| POST `/api/claim` | `{requestId,seatId,actorIds:[]}` | 管理或主持完整替换目标席位归属，收回指定角色在其他席的归属 |
| POST `/api/action` | `{requestId,revision,action}` | 权限与引擎双重验证后提交 |
| GET `/api/updates` | `?since=N` | 当前投影、`events,reset` |
| GET `/api/events` | `?since=N`，或 `Last-Event-ID` | SSE 受限投影，见下文 |
| GET `/api/saves` | 无 | 管理或主持读取 `slots`、`availableSlots` 与校验后的 `metadata` |
| POST `/api/save` | `{requestId,revision,slot}` | 管理或主持手动保存，不增加规则版本；`autosave` 名称保留 |
| POST `/api/restore` | `{requestId,revision,slot}` | 管理或主持重验存盘并恢复，规则版本增加一次 |
| POST `/api/map` | `{requestId,revision,mapId,map}` | 管理或主持验证、存盘并执行 `map.replace` |
| POST `/api/map/load` | `{requestId,revision,mapId}` | 管理或主持从固定地图目录读盘，重验后执行 `map.replace` |
| POST `/api/agent/request` | `{requestId,revision}` | 为认证本席准备一次快照，返回 `snapshot` |
| GET `/api/agent/request` | 无 | 本席快照与状态；房主可见本桌请求 |
| POST `/api/agent/submit` | 下节的严格回复对象 | 仅提交预览，不执行动作 |
| POST `/api/agent/apply` | `{requestId,revision,agentRequestId}` | 请求席或房主采用；永远以请求所属席重新授权 |
| POST `/api/agent/cancel` | `{requestId,agentRequestId}` | 请求席或房主取消，已采用动作不能撤销 |

标准失败为 `{ok:false,error:{code,message},revision}`。无认证 401、越权 403、版本过期／复交冲突 409、规则或存盘验证失败 422、超时 408、动作存盘失败 503。客户端应按错误重新取状态，不在失败时本地扣资源。

同席位相同 `requestId` 与相同操作、相同正文会返回 `duplicate:true`，不会再结算；键顺序不影响比较。更换操作或正文返回 `REQUEST_ID_CONFLICT`。自动档暂时写入失败的 `503 AUTOSAVE_FAILED` 没有提交动作；修好磁盘后可使用原 requestId 和原正文重试，仍保留正文指纹保护。近期收据在内存中最多保留 1000 笔，重启后清空；不承诺无限历史幂等。复交返回当前投影与原操作结果，避免 UI 回退到旧状态。

## 行动白名单

服务器拒绝未知动作与额外动作字段。玩家只可使用本席拥有角色的以下行动，具体距离、回合、资源、前提仍由引擎裁定：

```js
{type:'move', actorId, x, y}
{type:'attack', actorId, targetId}
{type:'ability', actorId, abilityId, targetId?}
{type:'defend', actorId}
{type:'endTurn', actorId}
{type:'choose', actorId, choiceId}
{type:'explore', actorId, poiId}
```

以下仅房主：`travel {sceneId}`、`rest {}`、`retreat {}`、`map.replace {mapId,map}`、`map.load {mapId}`、`map.encounter {mapId}`、`actor.place {actorId,x,y}`。其中 `map.load` 把已在权威状态的地图放上桌面；`/api/map/load` 则重读该地图的本版磁盘存盘。`map.encounter` 使用地图中的敌人配置启动无叙事奖励的沙盘战斗。摆放和编辑是否允许，还受引擎的战斗状态校验。

## SSE 同步

使用 `fetch('/api/events?since=0', {headers:{'x-seat-token': token}})` 读取流；浏览器原生 EventSource 不能添加该头，因此本版 UI 使用 fetch。每个消息为 `event: state`，`id` 是 `seq`，data 是当前受限状态外层。每 15 秒发送注释心跳。

服务保留最近 256 个事件。初连或重连都会发送最新投影与可见事件；游标过旧或大于当前值时 `reset:true`，客户端应替换投影并保存新游标。后台智能体事件只向请求席和房主发送；事件本身仅含类型、版本和时间，不夹带完整引擎内部事件。`/api/updates` 可作同语义轮询兜底。

## 保存与地图存盘

默认仅写本版 `data/local-v3-2/saves/<slot>.json` 与 `data/local-v3-2/maps/<mapId>.json`。槽位及地图 ID 只能用 1–64 位字母、数字、下划线和连字符，拒绝路径、分隔符、符号链接与任意文件目标。

存盘外层含 `format:'norse-local-v3'`、版本、种类、JSON 内容与 SHA-256 校验和，用于检测内容损坏；它不是针对拥有本机文件权限者的签名。写盘先写入并同步唯一临时文件，再重命名。读盘检查类型、大小、结构和校验和，地图再经引擎校验；恢复保存的地图也重验。任何校验失败都不替换权威状态。存盘只包含规则状态，不包含席位令牌和智能体待办。已有存档不自动载入。

每次成功规则动作都会在提交前写 `saves/autosave.json`，包含普通行动、地图载入／编辑与智能体采用的真实行动。写自动档失败时返回 `503 AUTOSAVE_FAILED`，内存状态、规则版本、事件与待采用回复均保持原样；地图编辑已更新的独立地图文件也会回滚。只叙述的智能体回复不改变规则状态，不写自动档。

启动、首次新建房主、手动保存及手动恢复均不改写自动档。`POST /api/save` 使用 `autosave`（不区分大小写）会被 `SLOT_RESERVED` 拒绝，防止新启动的空初始局面覆盖恢复点。手动恢复之后，下一次成功规则动作才更新自动档。

关闭或断电后重新运行本版，创建新房主，再显式恢复 `slot:'autosave'`：

```js
POST /api/restore
{requestId: 'new-request-id', revision: currentRevision, slot: 'autosave'}
```

原令牌仍然失效。服务不会在启动时读取旧状态；恢复只使用房主明确选择的本版固定槽位。`GET /api/saves` 保留 `slots:string[]`，另返回可用槽位 `availableSlots:string[]` 与如下元数据，供 UI 显示时间、版本或损坏原因：

```js
{
  slot: 'autosave', kind: 'autosave', available: true,
  revision: 12, savedAt: 'ISO timestamp', bytes: 123456
}
// 手动槽位 kind:'manual'；不可恢复时 available:false，另有 error:{code,message}
```

## 文件夹智能体

默认工作区为本版 `data/local-v3-2/agent/`：

```text
snapshots/<requestId>.json  服务生成的本席受限快照
inbox/<requestId>.json      智能体原子写入的回复
receipts/<requestId>.json   最新接受、拒绝、采用、过期或取消状态
logs/<requestId>-<id>.json  每次已处理回复的收据记录
```

此目录属于同机、同用户的受信任工作区，可能包含房主主动创建的主持快照；它不是为不受信任远程用户建立的文件隔离区。HTTP 玩家投影与规则权限仍分别验证。服务器不把令牌交给文件智能体，也不提供 shell、工具调用、任意文件读写、模块加载或 `eval` 动作。

快照含 `protocolVersion,requestId,revision,seat,state,actions,createdAt,expiresAt,responseSchema`。`actions` 是 `{label,action}` 数组，只来源于该席当前真实 `legalActions` 并再次过滤权限。智能体只能选择本快照中的行动索引，最多一项；旁白不会产生规则、物品、奖励或剧情效果。

严格回复示例（用实际快照值替换示意 ID）：

```json
{
  "protocolVersion": 1,
  "requestId": "snapshot-request-id",
  "revision": 0,
  "actionIndex": 0,
  "narration": "谨慎前进，等待真实行动结果。"
}
```

只叙述时 `actionIndex:null`。拒绝 `action`、`command`、`role`、`path`、`tools` 等额外字段，拒绝越界索引与超过 4000 字的旁白。回复文件最多 64 KiB，文件名必须与 requestId 相同。目录扫描只读自己的 inbox 中普通 JSON 文件；写入 `.tmp` 后重命名可避免半份 JSON 被读取。

生命周期为 `pending → ready → applied`，也可进入 `cancelled / stale / expired`。收到回复仅到 `ready`；采用时再次验证原席归属、当前版本、过期时间与引擎规则。房主点击采用也不会把自己的权限借给玩家智能体。局面、地图、存档恢复或角色归属变化使旧快照失效。

默认 120 秒超时；之后可新建快照。相同回复再次提交会返回当前收据，不再执行；同请求更换回复被拒绝。断线时 inbox 与收据保留，可复交确认结果。服务重启不会恢复令牌或未完成授权，旧 inbox 会得到“请求不存在”收据，须在新席位下重新请求。处理失败后应读 receipt，修正格式或按最新状态创建请求；不要把“文件已写入”当成规则已采用。

## 无密钥可运行示例与测试

`node tools/protocol-demo.mjs` 在临时目录、随机本机端口启动真实引擎，验证快照、文件回复、预览、原席授权采用、幂等、保存和恢复；结束时关闭服务并清理临时数据。它只模拟协议选择，不调用真实模型，不代表真人体验或平衡验证。

服务运行且 UI 已为本席创建请求后，可运行 `node tools/folder-agent.mjs`，它只回复模拟旁白。加 `--simulate-action` 会选择每份未处理快照的第一项允许行动，仍需采用；`--dir=<本版智能体目录>` 可指定独立夹具目录。该工具不读取令牌或旧运行文件。

工作区智能体可显式注入 `answerSnapshots({root,decide})`，`decide(snapshot)` 返回上述严格对象。`tools/api-adapter-example.mjs` 的 `proposeWithAdapter(snapshot, adapter)` 是可注入纯接口，只传受限输入并验证输出；附带 `mockAdapter`。这两处均未配置服务商、未读环境或密钥、未发网络请求，真实 API 接入仍待后续另行配置与验证。

协议检查：`node --test tests/protocol.test.mjs`。若执行环境禁止测试运行器创建子进程，Node 24 可用 `node --experimental-test-isolation=none --test tests/protocol.test.mjs` 在当前进程运行。测试使用独立临时夹具，不读取原版数据。协议检查含真实引擎关闭重启恢复，以及实际阻断自动档路径后，普通动作、地图文件与智能体采用均不提交、修复后原请求只执行一次的事务验证。
