# DM / 玩家文件协议与可选API适配

## 不需要密钥的运行示例

先启动本机8845服务器，再运行 `node tools/agent-demo.mjs`。示例新建默认共游房，创建无管理权的player文件席位，读取快照并提交一次合法旅行，等待回执；不需要DM，不调用模型、执行模型代码或读取任何密钥。

正式游戏由房间管理者或可选主持创建DM/玩家桥。HTTP：`POST /api/rooms/:roomId/agents`，管理席位认证，正文 `{ "role":"dm" }` 或 `{ "role":"player", "characterId":"belu" }`。身份角色不能重复认领；共游桌中的实际操作权为全队共享。返回的 `folder` 只指向本游戏生成的桥目录。

目录为 `data/bridge/<room UUID>/<agent UUID>/`：

- `snapshot.json`：协议版本、角色、角色ID、roomMode、decisionPolicy、修订号、公开状态、可信capabilities及allowedActions；还含当前展开地图、合法剧情、目的地和已知NPC档案。NPC没有可控身份。客户端可仅凭桥目录决定游戏行动，无需读取电脑其他位置，无HTTP席位令牌。
- `inbox.json`：外部客户端唯一可提交的请求文件。先写临时文件、写完后原子改名，避免半写JSON。
- `receipt.json`：最新请求的成功/拒绝、原因与实际修订号。
- `events.jsonl`：回执历史；超过1MiB轮换到前一份日志。

请求示例（实际使用最新快照的修订号与30秒以内的未来时间）：

```json
{
  "protocol":1,
  "id":"one-unique-request-id",
  "expectedRevision":12,
  "expiresAt":"2026-10-20T18:30:30.000Z",
  "action":{"type":"move","characterId":"belu","x":4,"y":8}
}
```

`expiresAt` 必须晚于服务端当前时间且不超过5分钟。一次请求最多32KiB；只接受普通文件、明确的协议字段和白名单动作。服务端轮询默认500ms。文件回执不携带凭据。

## 权限与权威验证

在默认party桌，player文件席位和普通真人玩家一样，可操作固定四人队伍，提交剧情/旅行/休整/撤退/终局，不必有DM。先到的合法revision行动立即生效，模型不得称已取得投票一致。hosted桌的player仍只操作自己角色。DM可选，保留主持能力；普通player不能发布地图、开启自制遭遇或越权读档/导出/创建agent。服务端从房间和认证席位计算权限，不信任action中自称的role/canManage/roomMode，仍校验通行、回合、资源及所有剧情前置。

协议不接受命令行、文件路径、工具调用、脚本、密钥或任意状态修改。API适配器也只接受一个纯JSON游戏行动。游戏不启动外部智能体进程，也不给模型提供系统命令或任意文件读取接口。

此协议是游戏行为边界，并非操作系统沙箱。如果另行启动一个可访问电脑的第三方智能体，它自身的Windows权限必须另行隔离；本包不为该进程授予或保证系统级隔离。推荐只把单个桥目录交给受约束客户端。

## 超时、冲突与恢复

1. 收到 `ok:true` 后确认相同请求ID，再读取新快照。
2. 409表示世界已经变化；重新读取快照，重新决定行动并使用新ID，不自动套用旧意图。
3. 过期、非法或越权请求收到 `ok:false`，不改变状态；改正后提交新请求。
4. 如果回执丢失或客户端中断，用**相同ID**重交同一请求。服务端持久化已执行ID，重启后也不会重复扣费或移动；已执行ID即使原有效期已过也返回 `duplicate:true`，未执行的过期请求仍被拒绝。请勿以新ID盲重试未知结果。
5. 服务端每次变更原子写入房间，并保留前一份备份。重启恢复房间；当前房间文件无法解析时尝试前一份备份。浏览器恢复原席位凭据后即可接续。

## 可选API层

`tools/api-adapter.mjs` 导出 `parseModelAction(text,snapshot,{id})` 与 `requestAction(invokeModel,snapshot,{id,timeoutMs})`。调用者注入独立授权传输，纯适配层不访问网络/环境/凭据。请求含模式与可信快照能力；解析器采用更窄的简单行动格式白名单，不支持模型生成任意地图结构或存档管理请求。模型只可通过合法剧情回应吉尔伽美什，不能把他当队员或改关系。最终行动仍由服务端验证。

传输默认30秒超时，上限60秒，支持AbortSignal；超时不提交行动，下次可重新尝试。提供者未响应不能阻止核心游戏或文件示例运行。

本次没有配置任何API提供者、读取/生成/展示/保存密钥或进行付费调用。真正接入需要另行授权并配置传输，不以用户的持续游戏授权扩大凭据访问。

## 多人接口

`POST /api/rooms {name,mode?:'party'|'hosted',characterId?}`默认party，创建者player兼管理者。hosted创建host；`/join {name,characterId}`加入普通player。认证`/action`带expectedRevision/requestId；`/events`为SSE，重连重新GET状态。缺mode旧房按hosted恢复。读档只换游戏state，不改变room mode、席位权限或请求账本。房间隔离不变。

默认127.0.0.1仅供本机。开发接口可通过 `startServer({host,port,dataDir})`选择绑定地址，但本次没有启用LAN、公网或端口转发，也没有测试真实跨设备。任何后续网络暴露需单独审查部署与认证。
