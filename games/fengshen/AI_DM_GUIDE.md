> v0.3 世路人情：本副本仅本机8811；本轮未实际调用API。运行信息、房间、桥接环境变量均与原版独立。以本版README为准，不使用原版隧道或自动迁存档。
> 粮药、韩家附约、证言及买断专报、独家运力、魏简附报都走当前actions与真实服务端命令。80／180／200 GP诱惑有实际收益；未退出时的急递、撤营队、80 GP独立委托和职书冲突也是真实条件。先读成本再执行，不用旁白假称付款、退款或同意。定光1HP击昏、失能、魅惑／支配时不能代本人核稿。私人关系与私密材料只由真人GM离线手工分发，不加入bootstrap／facts／journal／AI玩家请求。成年人自愿、非露骨，可友情或淡出无机械惩罚。原救援、合法聪明解决与基础报酬不得临时反悔。

# AI 主持与玩家接入

API AI、工作区 AI 和真人使用同一房间席位与规则命令。先让房主在房间中创建或分配 AI 席位，指定 DM 或玩家角色；工作区 AI 使用该席位凭据，不能代用朋友的身份。玩家上下文由服务器过滤，只有 DM / 房主可读取主持原文与隐藏事实。

新房间与服务重启后的 AI 默认暂停。房主先在席位面板点击“恢复 AI”，或用房主自己的凭据执行 `node tools/bridge.mjs resume`，再让工作区 / API 席位提交规则操作。AI 席位不能自行恢复房主暂停的桌面。

## 读取局面

本地服务启动后，在游戏目录执行：

```powershell
node tools/bridge.mjs state
node tools/bridge.mjs events --cursor 0
```

联机版本地 CLI 同样需要席位凭据。将凭据只放在本机环境变量中，默认变量名为 FENGSHEN_V03_SEAT_TOKEN；不要贴进聊天、命令参数、日志或源码。服务的 runtime-v2.json 只记录本机地址和进程信息，不含房主凭据。旧版 runtime.json 的本地文件桥保持兼容。

远端房间使用：

```powershell
node tools/bridge.mjs --url https://你的游戏地址 --room 房间ID --token-env FENGSHEN_V03_SEAT_TOKEN state
node tools/bridge.mjs --url https://你的游戏地址 --room 房间ID events --cursor 42
```

可改用 FENGSHEN_V03_URL、FENGSHEN_V03_ROOM 环境变量保存非敏感连接参数。token 决定房间与席位；--room 额外检查是否连对房间。CLI 的控制台与输出文件会移除席位、临时实时连接、邀请及 API 凭据字段。

不直接读取、覆盖运行中的个人自动存档。读取远端视角也不要另读本地 DM 资料来补足玩家 AI 不知道的剧情。

## 生成、提交和采用

```powershell
node tools/bridge.mjs request dm p1 请回应玩家的提问并按当前目标主持 --out data/bridge-v03/current-request.json
node tools/bridge.mjs request player p1 请为本角色选择下一步 --out data/bridge-v03/current-request.json
```

role 参数保留本地用法，房间服务器以真实席位权限决定身份，不因传入 dm 而提升权限。请只运行符合当前身份的一条请求。请求包含 requestId、revision、受限 situation、合法 actions、命令说明和 responseSchema。DM 另有本回原文与持续事实；玩家没有主持秘密。

房间回复格式：

```json
{
  "requestId": "复制当前请求的 requestId",
  "revision": 12,
  "narration": "面向玩家的对话、当前事实或行动提议。",
  "reason": "本次选择的简短依据。",
  "command": {
    "type": "choice",
    "actor": "p1",
    "option": "从当前 actions 或 campaignView.options 复制真实选项"
  }
}
```

无需规则动作时 command 为 null。手工回复只填写实际使用的命令字段即可；API 的严格 JSON Schema 要求未使用的可空字段为 null，服务器会清除这些 null。旧版 actionIndex 回复仍能转换为请求中记录的那条命令，不能把旧索引套用到新请求。

将回复写到 data/bridge-v03/response.json 后：

```powershell
node tools/bridge.mjs submit data/bridge-v03/response.json --request data/bridge-v03/current-request.json
node tools/bridge.mjs apply --request data/bridge-v03/current-request.json
node tools/bridge.mjs state
```

submit 只预览；apply 才采用。用户已授权你主持本桌或控制该席位时，可以直接采用，不反复索取相同授权。每次采用后读取真实结果再决定下一步。局面在思考时发生变化，旧请求会报过期；重新 request，不能删掉 revision 检查。

## 同一规则命令与主持裁定

优先复制 actions 中合法命令，忽略仅用于显示的 index、label。后续各回的剧情命令沿用 choice；完成章节收束后，按实际可用的 campaign:next 选项推进，不直接跳过任务。角色 feature、item、spell 命令及 targets 由当前行动表提供。

DM 请求的 handouts 给出本幕可发布资料的真实 id、title、cue 和正文。按当前进度满足 cue 后提交 `{type:"handout", option:"当前真实手札ID"}`，每次发布一件；没有提供目录时先读取 DM 的 `/api/handouts`，不编造 ID，也不把未到时机的资料一次全部交给玩家。玩家 AI 只能看到已经发布的资料，无发布权限。

需要自由行动时，用规则命令处理可自动化部分，再由 DM 按真实角色卡裁定。掷骰、HP、法术位、法宝归属和物品消耗不能只写在旁白里。例：

```json
{
  "revision": 12,
  "command": {
    "type": "gm",
    "text": "依据真实角色能力结算已同意的特殊移动，记录所耗移动。",
    "patch": {"actor": "p1", "position": {"x": 32.5, "y": 42.5}, "move": 10}
  }
}
```

```powershell
node tools/bridge.mjs command data/bridge-v03/action.json
```

房间命令文件应保存读取局面时的 revision，也可用 --request 请求.json 或 --revision N。桥自动生成 commandId；发生网络超时而需要重交同一命令时，使用原 commandId 与完全相同的正文，服务器只结算一次。成功后不能拿同一 ID 做下一步。

gm 只供 DM / 房主使用，必须填写 text 说明原因。玩家只能操作本席角色；旁白、自由掷骰或 AI 回复均不授予额外权限。若调用尚未自动化的 SRD 能力，先按真实原卡说明与记录所需资源，不给自己的角色免伤、免耗或擅改失败。

## 工作区连接器

```powershell
node tools/bridge.mjs --url https://你的游戏地址 --room 房间ID watch --cursor 42 --out data/bridge-v03/remote-events.json
```

watch 在真实运行期间发送心跳、获取增量事件与当前待办，将最近一批数据和游标写到指定文件。它不自行购买或调用模型，也不自动替工作区聊天作决定。正在工作的 AI 读取待办后，再用 request / submit / apply 或 command 作合法操作。

真人已经为此席位发起请求时，watch 的 reply 待办会包含对应 request；也可用 `node tools/bridge.mjs inbox --out data/bridge-v03/current-request.json` 领取现有上下文。inbox 返回 `{request, ...}` 外层，`--request` 文件可使用 request 本身或该外层。不要无故新建请求覆盖等待中的那一条。

按 Ctrl+C 停止，或另开终端执行：

```powershell
node tools/bridge.mjs stop
```

多个连接器同时运行时，为各自指定不同 --stop-file；stop 使用相同路径。--interval 可调整轮询毫秒数，默认 3000，范围 1000–30000。短时断线、超时与服务临时错误会按 1–30 秒退避自动重连，期间 Ctrl+C / stop 仍生效；凭据无效或权限错误直接退出，避免不停重试。

使用 --out 时，连接器保存最后成功处理的游标；再次运行相同连接命令会从该文件恢复，显式 --cursor 优先。事件窗口已过期时服务器返回 reset，输出同时附带最新局面。断线与停止会保留最后待办，并将 connection 改为 reconnecting / disconnected；恢复连接、重新读取当前局面后再决策。

工作区聊天关闭后不会继续思考；只有实际仍运行的连接器保持网络参与。异常退出后房间依据最后心跳识别断线。

房主可用界面，或自己的凭据执行 pause / resume / cancel / takeover；takeover 可附 --seat 席位ID。pause 与 cancel 会停止正在处理的 API 请求并撤销待采用回复，不能承诺撤销服务商已经计入的调用。takeover 将控制权交回真人，进度与资源保留。

若房主主动要让 API 席位连续参与，可在 resume 指定 `--seat 席位ID --steps 次数 --auto-apply`。这是实际模型调用授权，使用有限次数；省略 --auto-apply 时保留回复预览。工作区 watch 不会因此获得独立思考能力。

## API 模式

房主在服务器设置中选择 Responses 或兼容 Chat Completions、服务商地址与真实支持的模型 ID。远程服务需要 HTTPS，本地模型允许 loopback HTTP。凭据只进入服务器内存，不进入普通玩家视角、战役存档、打包内容或 CLI 输出。

API 模式与工作区模式使用相同 requestId / revision / command 协议；回复先预览再采用，取消由真实 AbortController 中止请求。错误不会自动无限重试。DM 可演绎 NPC、提交 choice 推进章节、处理规则动作与有依据的 gm 裁定；玩家只获取本席已知内容与控制权。

本次实现没有创建密钥、选择付费账户或发起实际模型调用。游戏内有真实配置并执行请求后，界面才显示调用中的连接状态。

## 主持口径

遵循 D&D 2024 / SRD 5.2.1 与原六幕稿。关键线索提供继续道路；交易成立就承认成果。交涉、绕行、撤退和合法法术都可以成功，不用反魔法、强行新增人质或重置已开关门来保住预设战斗。既有伤势、承诺、消耗、人物生死与法宝持有人跨回保存。终章保留每个角色自己的选择，不强迫死亡、受封或归还法宝。

