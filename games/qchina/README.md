# 三册异途 · 中国神话三弧

三条可分别开团的故事，从文书、约定与受托之物出发，各自抵达不同的归路。

4 人＋主持；主持＋玩家；三弧 · 13 节点。版本 2.0。
## 启动

推荐从合集网站进入，作者可在本机管理台启动、停止游戏和管理存档。单独运行需要 Node.js 24 或更新版本，无第三方 npm 依赖。

```sh
node server.mjs
```

默认地址 http://127.0.0.1:8829 。终端按 Ctrl+C 停止。可通过 PORT 指定端口。合集内部使用 HOST=127.0.0.1，通过网关提供网站入口。

HUB_DATA_DIR 指定本游戏的独立运行目录，包含房间、存档、席位和智能体文件。在合集目录内直接运行游戏或命令行工具，也默认使用合集 runtime/qchina/；HUB_RUNTIME_DIR 可调整合集运行目录。独立移出合集后使用本游戏原有默认数据位置。运行目录不应提交到 Git。游戏内容、规则和素材随源码提供，原作者机器的存档、配置和凭据均不在此发行版中。

## 资料

- [玩家本](manuscript/rules/PLAYER_PACKET.md)
- [主持本](manuscript/rules/READING_DRAFT.md)
- [分批手札](manuscript/rules/HANDOUTS.md)
- [来源与许可](LICENSES.md)
