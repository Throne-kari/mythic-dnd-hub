# 让 agent 作为玩家共游

先启动游戏，在协作面板切到管理席，选一名英雄并创建“文件夹玩家”。将界面显示的目录交给正在本机文件夹里工作的 agent。故事推进、敌方行动和规则结算由系统承担，agent 只扮演分配给它的队员。

每个玩家目录包含：

```text
snapshot.json                 当前局面；每次新修订自动更新
snapshots/<requestId>.json     对应决策的完整快照
inbox/<requestId>.json         agent 写入的回复
receipts/<requestId>.json      接受、执行或拒绝结果
logs/                         已处理回复的协议记录
```

读取 `snapshot.json`：`seat` 是角色归属，`state` 含当前场景正文、可见选项、地图、角色状态、资源、任务、同伴、日志与世界旗标；`actions` 是该玩家在当前修订下实际合法的行动目录。快照不会公开尚未到达的剧情后果和其他席位凭据。

选择 `actions` 的一项，按其从 0 开始的索引原子写入 `inbox/<requestId>.json`：

```json
{
  "protocolVersion": 1,
  "requestId": "使用当前快照的 requestId",
  "revision": 0,
  "actionIndex": 3,
  "narration": "队员的可选发言"
}
```

`revision` 必须使用当前快照值。服务器大约每半秒收取一次回复，检查过期、角色、行动索引、回合和规则，再自动执行并保存。读取相应 receipt 确认结果，再读新快照继续。真人先走了一步时，旧回复会拒绝；按新快照重新决定。`actionIndex:null` 表示本次只发言或等待，不推进规则；等待到下一次局面变化再决定。旁白本身不会创造物品、伤害或剧情事实。

命令行可以读取或提交一次真实决定：

```powershell
node tools/folder-player.mjs --dir="界面显示的目录"
node tools/folder-player.mjs --dir="界面显示的目录" --action=3 --narration="检查石门内侧"
node tools/folder-player.mjs --dir="界面显示的目录" --wait
```

`--wait` 仅持续显示新快照；它不替 agent 作决定。脚本不读取令牌或密钥，不执行模拟玩家选择。

如果已有获授权的模型传输，可以将决策函数注入 `runFolderPlayer({root,decide,signal})`。`decide(snapshot)` 返回上述完整回复对象；`tools/api-adapter-example.mjs` 提供纯决策边界。程序不会自动创建服务商客户端、读取密钥或发起付费请求。

在管理席点击“停用”后，服务器停止收取该目录，角色回到原玩家；原有目录保留供查看。重启服务器后须重新创建文件夹玩家，旧目录不会自动恢复控制权。

可直接交给 agent 的任务：

> 你现在是《荆冠与归潮》的普通队员。只读取我指定的文件夹玩家目录。循环读取最新 snapshot.json，根据人物、队伍目标和当前局面选择 actions 中的一项，把 requestId、revision、actionIndex 与可选 narration 按协议写入 inbox，再读取 receipts 确认。需要真人决定的团队分歧时用 actionIndex:null 等待；不要伪造状态、读取凭据或直接改存档。规则与敌方行动由系统执行。
