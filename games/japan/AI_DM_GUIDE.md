# 镜与归路：AI 主持与玩家接入

API AI、工作区 AI 与真人共用房间席位和规则命令。房主先建立 API 或工作区席位，分配玩家角色或移交 DM，再将该席凭据交给实际使用者。玩家 AI 只能读取本席已知内容、控制本席角色；旁白不能直接修改 HP、物品、线索或结局。

本版默认本机地址为 `http://127.0.0.1:8799`，需要 Node.js 22+。新房间和服务重启后 AI 默认暂停。房主先在界面恢复 AI，或用房主自己的席位执行 `node tools/bridge.mjs resume`。API 请求在暂停时被拒绝；工作区可先准备回复，但 AI 席位采用或提交规则操作前仍须房主恢复。恢复后重新读取局面，再发起请求。

本次没有配置真实密钥、购买服务或调用真实模型。外部模型连接需要房主选择实际支持的协议、地址、模型 ID、凭据和额度。本机 HTTP 允许用于本地模型和本地游戏；远端游戏与模型服务必须使用 HTTPS。本轮没有启动公网隧道或公开部署。

## 连接自己的席位

在本版目录执行。URL 和房间 ID 可以公开在本桌，席位凭据只放环境变量，不贴到聊天、命令参数、日志或源码。PowerShell 可使用隐藏输入：

```powershell
$env:MYTH_URL='http://127.0.0.1:8799'
$env:MYTH_ROOM='从房间面板复制的房间ID'
$env:MYTH_SEAT_TOKEN=[System.Net.NetworkCredential]::new('',(Read-Host '输入自己的游戏席位凭据' -AsSecureString)).Password
node tools/bridge.mjs state
node tools/bridge.mjs events --cursor 0
```

`MYTH_ROOM` 用于检查是否连对房间。凭据决定实际席位权限，不能靠 `request dm` 的文字参数变成主持。未指定 `--url` 或 `MYTH_URL` 时，桥只从本版 `data/runtime-v2.json` 发现地址；`RUNTIME_FILE` 可指定其他运行记录。桥不会从运行文件读取席位凭据，也不回退到旧版运行资料。

远端连接使用相同协议：

```powershell
node tools/bridge.mjs --url https://你的游戏地址 --room 房间ID --token-env MYTH_SEAT_TOKEN state
node tools/bridge.mjs --url https://你的游戏地址 --room 房间ID events --cursor 42
```

控制台和 `--out` JSON 会递归移除席位、事件、邀请、进程及 API 凭据字段，并移除当前席位 token 的字面值。输出仍可能含有本席获准阅读的主持正文或私人桌记，不要把整份输出当作公开玩家材料。

## 读取请求、预览与采用

真人已为 AI 席位建立待办时，先领取它，避免覆盖现有请求：

```powershell
node tools/bridge.mjs inbox --out data/bridge/current-request.json
```

没有待办时，按自己的真实职责选择一条请求：

```powershell
node tools/bridge.mjs request dm p1 请回应当前玩家提议并按真实局面主持 --out data/bridge/current-request.json
node tools/bridge.mjs request player p2 请为本席角色选择下一步 --out data/bridge/current-request.json
```

`p1`／`p2` 应换成当前角色 ID。房主或 DM 可以用 `--seat 席位ID` 为相应 AI 席位准备请求。请求含 `requestId`、`revision`、受限 `situation`、合法 `actions`、命令说明和 `responseSchema`；DM 另有本景正文与持续事实。

将回复保存为 `data/bridge/response.json`。只叙事时 `command` 明确为 null；需要行动时从当前 `actions` 复制完整命令字段，删除显示用的 `index` 和 `label`：

```json
{
  "requestId": "复制当前请求的requestId",
  "revision": 12,
  "narration": "面向本桌的对话、可见事实或行动提议。",
  "reason": "选择依据，不声称尚未执行的结果。",
  "command": null
}
```

```powershell
node tools/bridge.mjs submit data/bridge/response.json --request data/bridge/current-request.json
node tools/bridge.mjs apply --request data/bridge/current-request.json
node tools/bridge.mjs state
```

`submit` 只预览，`apply` 才采用。`--request` 同时接受请求本身和 `inbox` 返回的 `{request:...}` 外层。局面已变时，旧请求不能采用；重新读局面和请求，不能删除版本检查。用户已经授权本席操作时，按授权继续，不重复索取同一授权。每步采用后读取真实返回，再决定下一步。

## 规则命令与当前战役主持边界

剧情从当前 `actions`／`campaignView.options` 选择真实 `choice`；完成当前收束后，使用实际可用的 `campaign:next` 推进下一景。十二节点的前提、检定、物品归属与结局以本包manifest和真实房间状态为准；不能把跳章、旁白或一次自由检定当作已经完成任务。

移动、攻击、施法、物品、能力、准备法术、技能及豁免等使用服务器提供的命令。法术命令可能带 `mode:'ritual'` 或 `mode:'initiate'`，分别表示真实可用的仪式／专长免费施法；保留当前动作给出的字段，不把普通施法改成免费。自由检定使用 `skill`／`save` 的 `dc`、或 `roll` 的真实骰式；检定本身不会自动改剧情事实。`chat` 可公开交流，不要求先领取角色，不赋予规则权限。

可将 `{revision,command}` 写入文件，用同一接口直接提交：

```powershell
node tools/bridge.mjs command data/bridge/action.json
```

也可通过 `--request 请求.json` 或 `--revision N` 提供读取时的版本。桥自动生成 `commandId`；需要可重试提交时，事先在行动文件填写自己的唯一 `commandId`，或用 `--command-id 唯一ID` 固定它。网络超时后重交同一步，保留原 ID 和完全相同正文。一次成功后不能拿同一 ID 做下一步。

DM 的 `handouts` 给出当前实际可发布的材料及 cue，发布使用 `{type:'handout',option:'实际手札ID'}`，一次一件。缺少目录先读主持 `/api/handouts` 并核对当前事实，不编造 ID、不提前发全文。H06 为开场材料，其他 H01–H05 以实际发现／商谈时机为准；服务端还会检查就绪事实。玩家只能看到已发布材料。

开放裁定使用 `{type:'gm',text:'具体规则依据',patch:{...}}`，仅 DM／房主可用。骰点、HP、法术位、材料、物品归属、人物去向与承诺必须按真实规则记录。保留谈判、绕行、救援、合法法术、暂退和明确退出；已经完成的任务不因预设剧情重置，不替玩家选择牺牲或最终安排。

## 工作区 watch 与房主控制

```powershell
node tools/bridge.mjs watch --cursor 42 --out data/bridge/remote-events.json
```

watch 在实际运行期间发送心跳、读取增量事件和待办，并保存游标。`reply` 待办带当前请求，`review` 表示回复已到等待采用，`refresh` 表示已过期；实际决策仍由正在处理任务的工作区 AI 完成。它不购买或调用模型，聊天关闭不会产生后台思考。

默认每3秒轮询，`--interval` 范围1000–30000毫秒。短断线、超时、408／425／429及服务端错误按1–30秒退避重连；认证／权限失败退出。相同连接地址和房间可从 `--out` 恢复最后游标，显式 `--cursor` 优先。事件窗口过期时返回 `reset` 与最新状态。停止／断线保留最后待办和游标。

Ctrl+C，或另开终端使用相同停止文件：

```powershell
node tools/bridge.mjs stop
node tools/bridge.mjs pause
node tools/bridge.mjs resume
node tools/bridge.mjs cancel
node tools/bridge.mjs takeover --seat 要接管的AI席位ID
```

多个连接器应各用不同 `--stop-file`。`bridge stop` 只停连接器；`tools/stop.mjs` 是本机当前包的游戏服务的保存停止工具，使用本版进程凭据，不是席位控制命令。

pause／cancel／takeover 要求房主身份，会暂停 AI、取消待采用回复并中止当前 API 请求。takeover 将目标席位的角色或 DM 职责交回房主。停止请求不能撤销服务商已经发生的计费。只有房主明确授权实际模型调用时，才为 API 席位执行有限批次：

```powershell
node tools/bridge.mjs resume --seat API席位ID --steps 3 --auto-apply
```

省略 `--auto-apply` 时保留回复预览；不指定 API 席位／次数的普通 resume 只恢复权限。模型协议在房间设置中选择 Responses 或兼容 Chat Completions；密钥仅在服务内存，重启重填，不进入房间文件和普通玩家视角。
