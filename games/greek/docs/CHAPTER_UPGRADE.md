# 四章深化契约（覆盖原首轮数量与期限）

用户最新：每套至少20–30实质结局，每章2–3可交织主线。首轮3弧12节点/7结局、88测试为技术断点，已归档 checkpoints/greek-12nodes-88tests-baseline.zip，不视作最终完成。

## 最终结构

- 4章，每章3条主线，各主线每章3阶段，总36阶段。保留 burial / harvest / oracle 三个持续弧；每弧12阶段。前3阶段为第一章；原第4阶段进入第二章，后续继续承受其后果。
- 每个stage添加 `chapter:1..4`；每章3线自由交错，先做完的线进入待下一章状态，不能越章。三线均走出本章（或已全弧失败）自动进入下一章，写章节日志；第四章全部有结果后可finish。
- 早期失败是本章目标失败，写明确的 `*_cN_failed` 和后续后果，next指下一章首阶段；后续章节有真实承接，不直接永久删除这条线。最后一章才next failed/complete，前期失败可修复但不抹掉损失。
- 初始day1，最终deadline49，36次标准决定到37日，留休整余地。截止规则从campaign.deadline读取，UI不硬编码18。章节可含 `arrivalEffects`（完整effects格式）作为公开补给/世界状态变化，由引擎只应用一次，日志记明。不能用隐藏补给掩盖不可达选择。
- campaign.chapters 为 `{id,number,title,summary,goals:{burial,harvest,oracle},arrivalEffects?}`；状态含chapter,chapterHistory。旧无chapters fixtures继续单章工作，deadline默认18，减少无关破坏。
- 需24个精细结局（另有期限失败）。每个必须有独立权力安排、关键人物命运、世界状况、付出代价、跨章伏笔，不能简单笛卡尔积套话。campaign.endings各有 `id,title,text,requires`，并可加 `power,characters,world,cost,foreshadowing`用于说明。
- 为表达24个互斥覆盖分支，requires 在原分组之外可支持 `all:[requires...]`, `any:[requires...]`, `not:requires`，与既有组条件AND组合。禁止任意JS表达式/代码执行。逻辑由系统严验，结局条件应互斥，所有可达最终组合有一个结局；独立QA验证可达及唯一性。
- 作者提供 data/ending-witnesses.json：24个结局各一条真实36节点以内的optionId序列，可含路线说明（移动旅行由QA按实际点位执行），不能直接写endingId当游戏行动或篡改状态。独立QA必须真实回放，结局检测只允许finish自然命中。
- state.arcs保留3个，UI支持章节标题、3线本章目标/等待下一章、36节点进度，期限从catalog读取。六图复用须表现跨章后果；不要把地图数或测试数充当内容深度。

## 所有权与验收

narrative扩展data/campaign.json data/ending-witnesses.json、STORY_GUIDE/SOURCES，并新增docs/STORY_STATE_GRAPH.md、docs/ENDING_DESIGN.md。system升级engine/server/API/agent上下文及必要兼容。ui_maps升级界面章节、动态deadline、待章提示及状态反馈。independent_qa更新真实路线测试，原12阶段断点可用归档核对但不能宣称新版沿用88全部通过。新增narrative_review只读评审、写docs/NARRATIVE_REVIEW.md，具体指出弱处并由作者返修，负责人最终把关。

最终验证：4章每章3线目标/冲突/NPC/失败点，跨章交织图；24完整结局见证回放；互斥与覆盖；各章任意线先行不死锁、失败可接下一章、黑暗动机和损失；之前地图/席位/战斗/文件协议功能不倒退。真实浏览器工具依然不可用，此项明确未测，不绕过。
