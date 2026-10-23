# 无密钥文件夹智能体协议 v1

智能体可以占据受限游戏主持或玩家席位，通过写JSON请求参与同一个权威房间。服务器绝不执行文件中的脚本、命令、路径或自由文本指令，不会联网调用模型，不读取/配置/打印API密钥。目录写权限就是该席位的本机操作能力；本机文件夹方案不隔离拥有整个runtime写权限的程序。不要将整个runtime交给不受信任软件。

1. `npm start`，浏览器创建主持房间。
2. 主持凭证调用 `POST /api/rooms/:roomId/agents`，body `{name:"纸鸢",heroId:"doros"}`创建玩家智能体（须选择未被认领英雄），或 `{name:"城邦主持",role:"dm"}`创建游戏主持智能体。响应含 `folder`；没有令牌或API密钥。只有真人DM的HTTP凭证能创建此席位；文件DM只有游戏动作白名单，可控制全队或自定义游戏地图，不能发系统命令或指定电脑文件路径。
3. 对该路径运行 `node tools/agent-client.mjs "<folder>"`。内置mock只选择快照合法动作，运行一次写一个请求；服务器下一秒扫描并产生回执。可重复运行推进。单英雄轮到其他玩家时idle是正常等待，不会越权操控他们。
4. 查看 `receipts/<requestId>.json`；accepted表示已原子落盘，rejected含原因。每次决策都先读最新snapshot，勿在旧revision上连续提交动作。

无需手工操作浏览器的离线完整演示：

```sh
node tools/agent-demo.mjs
```

演示创建临时runtime、真实HTTP房间与文件玩家/主持席位，执行callback注入mock移动与纯文本narrate，验证重复请求不重放、`.processing`请求重启恢复、过期拒绝、存档读取revision递增。报告只输出结果和临时目录，不输出任何凭证；只访问本机临时HTTP服务，没有外部联网或付费调用。该目录保留便于检查。DM席位运行同一个client或callback，可从快照中选择任一英雄的合法动作或发布纯叙事。

## 文件格式

目录结构：

```text
runtime/agents/<roomId>/<seatId>/
  snapshot.json          主机更新，含有时限的权限内状态
  requests/<id>.json     智能体原子写入，最大32KiB
  requests/<id>.json.processing  主机处理中，重启自动恢复
  receipts/<id>.json     accepted/rejected回执
  archive/<id>.json      已处理原请求（不可执行）
  audit.jsonl           仅时间/id/状态/revision，无原始参数或令牌
```

快照含 `protocol:1,roomId,seatId,revision,generatedAt,expiresAt,seat,state,context`。`state.legalActions`是受席位约束动作；context含当前地图、chapter/chapterInfo/deadline、canNarrate及当前章active剧情点。等待下一章的线不会进入objectives，快照availableChoices也排除waiting；权威服务器仍会拒绝手工构造的越章行动。快照60秒到期，主机每秒刷新。快照未包含其他人的凭证或电脑系统控制指令。

请求严格只接受下列字段；文件名必须等于requestId，标识1–64字母/数字/下划线/连字符：

```json
{
  "protocol": 1,
  "requestId": "scout-0001",
  "roomId": "从快照复制",
  "seatId": "从快照复制",
  "revision": 12,
  "expiresAt": "从当前时间计算，至多5分钟后",
  "action": {"type":"move","heroId":"doros","x":4,"y":6}
}
```

实际expiresAt必须为有效ISO时间。过期、未来超过5分钟、旧修订、身份不符、额外字段、非法动作、路径注入或越权均拒绝，且不改游戏状态。目录/目标文件链接拒绝；扫描器只看已登记agent席位的合法请求文件名，不遍历请求提供路径。

回执：`{protocol:1,requestId,status:'accepted'|'rejected',revision,at,error?}`。处理先把文件重命名为`.processing`，原子保存完整游戏状态和回执去重键后发布回执/快照，再归档。若在提交之后、回执之前退出，重启扫描同ID会从房间存档取旧回执，不会重放。若提交前退出，重启重新验证deadline/revision；超时则拒绝，不会擅自执行旧动作。accepted和rejected的ID均不可重用；新决策用新ID。不同客户端同revision竞态只有首个有效动作成功，其余刷新重试。

## 可选回调适配

`tools/mock-api.mjs` 的 `createCallbackAdapter(decide)`只运行调用方注入的函数；没有HTTP客户端、SDK或配置读取。未来接供应商时由调用方负责实现回调，仍要经过文件协议与权威服务器验证。当前演示只注入mock，不实际调用任何API：

```js
import { runOnce } from './tools/agent-client.mjs';
import { createCallbackAdapter } from './tools/mock-api.mjs';
await runOnce({
  folder,
  decide:createCallbackAdapter(snapshot=>snapshot.state.legalActions[0])
});
// 文件DM也可注入纯叙事mock；不解释脚本/命令，不访问任何路径：
await runOnce({folder:dmFolder,decide:createCallbackAdapter(snapshot=>({
  type:'narrate', text:`第${snapshot.context.chapter}章，见证人围拢在铜秤旁。`
}))});
```

集成测试可用 `tick({runtimeDir,rooms,campaign,maps,commit,now})`。commit必须原子持久化state及`{key,receipt}`并更新room内存；仅返回成功而不持久化不满足协议。生产服务已实现此约束。单进程运行，队列每席位每次最多40件。不要启动两个服务器处理同一runtime。
