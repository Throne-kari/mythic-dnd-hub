# 千问日本三弧：AI主持与玩家接入

本包ID为`qwen-japan-three-arcs-v2`，默认本机地址为`http://127.0.0.1:8827`，需要Node.js 22或更新版本。系统已装Node；由用户在本目录运行 `node server.mjs`运行。未配置模型也可创建房间、分配真人席位、使用地图和人工主持。启动、存档、局域网和证据入口见[运行说明](docs/RUNTIME_GUIDE.md)。

本包故事范围：《五名之主》《携云的匣》《可畏者的登录》三弧各四节点，另有选弧入口，共13节点、13张局部图。 主持依[主持本](../GM_HANDOUTS.md)、[后果矩阵](../CONSEQUENCE_MATRIX.md)、[CONTENT_MAPPING：三弧节点与原稿对应](docs/CONTENT_MAPPING.md)处理；手札只使用当前请求提供的真实ID和发放条件。角色合法法术、现存物件和本人同意不会因按钮未列出而消失；剧情旁白不能代替实际花费、伤害、移交或施法。共用[AI协议](AI_PROTOCOL.md)说明请求格式，章节数量、材料ID与内容范围以本包数据和来源材料为准。

## API席位

房主在房间建立API席位，指定主持职责或实际控制的角色；在“设置与存档 → API接入”填写兼容服务基础地址、模型ID、Responses或Chat Completions协议及自己授权使用的密钥。密钥仅保存在该服务进程内存，不写房间存档，重启后需由房主重新配置；玩家投影不返回密钥。这里未读取、填写任何实际凭据，未调用或验证付费API。

新房间与服务重启后AI默认暂停。房主核对席位、模型和费用后主动恢复，才从“AI同行”选择API模型创建请求；回复先预览，再采用。有限批次须明确指定API席位与步数，自动采用另行选择；恢复普通权限并不等于无限自主运行。未授权的实际付费调用不属于文档操作。

## 工作区桥

工作区席位不要求API密钥。房主建立工作区席位并分配职责，将该席位自己的凭据安全交给相应连接端；凭据通过环境变量`MYTH_SEAT_TOKEN`或`--token-env`指定的变量提供，不放进命令行、聊天或公开附件。所有命令在本包`game`目录执行；先用`node tools/bridge.mjs --help`查看本地帮助。

```powershell
$env:MYTH_URL = 'http://127.0.0.1:8827'
$env:MYTH_ROOM = '<本桌房间ID>'
# 先在连接端安全设置该席位的 MYTH_SEAT_TOKEN；此处不包含真实值。
node tools/bridge.mjs state
node tools/bridge.mjs events --cursor 0
node tools/bridge.mjs inbox --out data/bridge/current-request.json
```

先用`inbox`领取真人已经创建的待办；需要新请求时再创建，避免覆盖当前提议。下例`p1`须替换为该席位真实控制的角色ID，主持席可请求主持建议：

```powershell
node tools/bridge.mjs request dm p1 '回应当前局面，保留真实资源和授权' --out data/bridge/request.json
# 玩家席改用 request player，并只填写自己角色的ID。
node tools/bridge.mjs submit data/bridge/response.json --request data/bridge/request.json
node tools/bridge.mjs apply --request data/bridge/request.json
node tools/bridge.mjs state
```

`response.json`由工作区AI依据请求生成，包含从请求复制的`requestId`、`revision`，以及`narration`、`reason`、`command`；纯叙事用`command:null`。有行动时从当前`actions`复制真实命令并去掉仅供显示的`index/label`，一次最多一条。`submit`只提交预览，`apply`才重新授权并采用；玩家席不能控制别席、花他人私物或取得主持权限。

若局面更新，旧`revision`会拒绝采用；重新读取状态、领取或创建当前请求并重写回复，不把版本号改新来硬套旧建议。HTTP意外断线后重交同一命令时保持同一`commandId`与正文；收据窗口内可防重复结算，不承诺无限历史幂等。未指定URL时桥只从本版`data/runtime-v2.json`发现服务地址，席位凭据仍只从指定环境变量取得；runtime含进程凭据，不分享。

## 暂停、停止与接管

```powershell
node tools/bridge.mjs watch --out data/bridge/watch.json
# 在另一终端停止同一默认停止文件的watch：
node tools/bridge.mjs stop
# 以下房间控制只允许房主：
node tools/bridge.mjs pause
node tools/bridge.mjs cancel
node tools/bridge.mjs takeover --seat '<目标席位ID>'
node tools/bridge.mjs resume
```

`watch`仅同步可见事件、待办与心跳，不会思考、调用模型或让聊天结束后继续决策；Ctrl+C也可停止连接器。停止watch不等于暂停全桌AI，`pause/cancel/takeover`才会暂停、清空待采用回复并取消当前批次；接管还按服务端权限转交目标职责。取消不能撤销服务商已发生的计费。远端桥要求HTTPS，本机HTTP允许；本包没有据此开通公网或验证跨设备连接。桥输出文件可能含本席可见剧情，仍留在本地，不随公共包发布。
