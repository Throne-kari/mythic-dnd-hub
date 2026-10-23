# 来源与许可

朋友私用项目《封神·岐路》的游戏代码与界面为本次任务编写。章节来源是本项目 `中国神话/rules`；既有图像来自本项目先前生成的 `dnd-maps/09_exports/oblique_v2`；精确平面几何来自 `dnd-maps/07_battlemaps`。导入工具保留 map_id、尺数、出处与美术补足说明。v0.2 的界面参考、渡口画卷及四人角色像由内置 ImageGen 生成，设计依据见 `design/UI.md`。

没有导入或复制《博德之门》的代码、人物、音乐、贴图或界面素材。参考仅为四人队伍、自由探索、对话选择与先攻回合的游戏交互思路。

This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

规则术语、基础结算与首回敌卡数据依据 [官方 SRD 5.2.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)。本项目对界面文案作中文转述并实现其中部分规则，不代表官方完整数字规则系统。飞剑、铜甲 p.259，Bandit p.261，Berserker p.263，Scout p.322。构装体完整感官、免疫及未自动化特质由 DM 按原卡处理。

v0.2 的 `data/srd-statblocks.json` 收录本战役使用的十九张 SRD 原型完整英文卡片段，包含必要的跨页延续；每张记录原名与页码。`bestiary.mjs` 对规则数据作程序字段转换，并使用本战役中文人物名；`progression.mjs` 依据相应职业表与子职选定固定成长。英文原卡依同一 CC BY 4.0 许可保留，自动结算范围以游戏实际实现为准。

API 格式参考 [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)。无第三方前端依赖、外部 CDN 或字体下载。

## v0.3 世路人情增补与复制边界

本副本从项目实际v0.2白名单复制78个公开源码／静态素材及主持来源文件，复制记录与原始SHA-256见`docs/SOURCE_COPY_MANIFEST.json`。原`中国神话/game`、原规则、运行存档与隧道均未修改。本版新增`worldly.mjs`因果逻辑、文案、主持／玩家／矩阵与隔离验证、打包工具为本次任务编写，未下载第三方代码、插图、音乐、商业模组或私密文件。

原画、地图、角色与战役底稿保持项目既有来源；未重新生图或改视觉。既有SRD英文原卡、页码及CC BY 4.0署名继续保留，新增中文叙事不代表Wizards官方内容。本交付不假设项目既有原创素材另有可公开商业再许可的授权，适用朋友私用范围；SRD部分依上列CC BY 4.0。数据中v0.3增补与`docs/source`原底稿明确区分。
