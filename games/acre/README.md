# 阿卡账房 · 围城中的交接

阿卡围城中的十二个节点。豆粮、船位与人的去留，都写在一张不能替别人签名的交接单上。

4 人＋主持；主持＋玩家；三时段 · 12 节点。版本 2.0。
## 启动

推荐从合集网站进入，作者可在本机管理台启动、停止游戏和管理存档。单独运行需要 Node.js 24 或更新版本，无第三方 npm 依赖。

```sh
node server.mjs
```

默认地址 http://127.0.0.1:8831 。终端按 Ctrl+C 停止。可通过 PORT 指定端口。合集内部使用 HOST=127.0.0.1，通过网关提供网站入口。

HUB_DATA_DIR 指定本游戏的独立运行目录，包含房间、存档、席位和智能体文件。在合集目录内直接运行游戏或命令行工具，也默认使用合集 runtime/acre/；HUB_RUNTIME_DIR 可调整合集运行目录。独立移出合集后使用本游戏原有默认数据位置。运行目录不应提交到 Git。游戏内容、规则和素材随源码提供，原作者机器的存档、配置和凭据均不在此发行版中。

## 资料

- [玩家本](manuscript/docs/PLAYER_PACKET.md)
- [主持本](manuscript/docs/GM_ACRE_LEDGER.md)
- [后果矩阵](manuscript/docs/CONSEQUENCE_MATRIX.md)
- [来源与许可](LICENSES.md)
