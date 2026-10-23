# 共用技术架构与边界

白名单复用十字军v2的HTTP房间、独立席位/角色归属、SSE、幂等命令、revision冲突、服务端NPC调度、暂停、逐房间存档、三个手动槽、工作区桥和API预览/采用。法术与战斗复用公共引擎；不是新数值体系。

|模块|职责|
|---|---|
|server / rooms|本机HTTP、房间权限、token hash、SSE、事务、恢复、公共投影；gameId须与本包匹配|
|engine / abilities|d20、平面移动/阻挡、先攻、动作、攻击、反应、施法、豁免、治疗、死亡豁免、2024击昏、消耗品与休息|
|campaign-data / campaign-play|读取校验主题包；声明式节点、前提、真实检定、效果、战斗停手、物品归属、承诺、结局|
|preset-base / progression|完整人类Champion/Thief/Life/Evoker三级预建，含背景、Origin、18技能、工具、语言、资源及法术；日本沿完整原卡升5级，两包均固定等级|
|bestiary / monster-rules|SRD原文、中文本场说明与实时状态分别显示；补巨蛛实体束网、骷髅、牛头人骷髅、水元素吞卷/窒息、蒸汽魔蝠喷吐/模糊/死亡爆发|
|public/scene|canvas实体网格，可旋转/俯仰/平移/缩放、低墙剖视、真实点击移动和OBJ导出；高度不额外创造规则|
|public/app|保持原实交互；动态主题/章节，公开规则卡搜索，成功命令发myth:action音频事件|
|tools/bridge|state/events/inbox/request/submit/apply/command/watch/stop/pause/resume/takeover/cancel|

Node.js22+；`PORT/HOST/ROOMS_DIR/RUNTIME_FILE`覆盖配置。AI模型/地址/协议可配，密钥不落房间快照；重启与新房间保持AI暂停。工作区桥用`MYTH_URL/MYTH_ROOM/MYTH_SEAT_TOKEN`或`--url/--room/--token-env`。token只从环境读取，不作为明文命令行参数。watch只保持连接和收取待办，不思考、不付费调用。AI回复核对requestId/revision后再通过同一权限与规则体系采用。

玩家只收到正向字段清单：章节元数据不含后续选项/后果/DM备注；公开事实仅publicFacts，隐藏NPC/物品/几何/私密日志继续过滤。原始manifest与当前章正文只供主持接口。

自动化边界：一般三维视线/攀爬/拖拽、水下路线、未列全的SRD能力/物品和开放提案仍由主持按原卡裁定并写结构化patch。没有宣称完整实现全部2024规则。全队倒地不会被强写为成功。场景minutes不是休息；短休可不花生命骰或花1枚，其他角色可在同一小时完成各自短休。固定四卡不代表任意自定义构筑。

未执行真实付费API、公开部署、HTTPS隧道或真人4–5小时试玩。实际HTTP/SSE/权限/多结局等验收证据见各正式包qa与docs/TECHNICAL_QA.md。当前前端的真实浏览器能力受执行环境限制，不能用离线检查冒充页面截图验收。
