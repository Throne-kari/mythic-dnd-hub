# 新同意、真实在场与保管旁路

2026-10-20独立验收确认了三类缺陷：失能哈利姆仍可新签劳动替代；失能纳西尔被写成新本人同意；A08未到场或已死的当事人与尤哈娜仍可生成获准段和核验书。本次只修本切片生成源、数据和必要文档，保留旧债、原物链、8831配置和旧验收证据。共用核心由主线程维护。

新同意使用现有`npcCanConsent`，要求记录与实际演员都在当前场景，正HP，非死亡、离场、昏迷或失能，并排除魅惑/支配。旧授权与保管记录保持原范围，不把它们扩大成新签约；救助不以新签字为条件，所有迁移保留原HP与伤亡。

| 范围 | 字段和值 | 谁真正答复、后续允许什么 |
|---|---|---|
| A08公开摘录 | `mariamDisclosure/rafiqDisclosure/leaDisclosure`：unasked→allowed或withheld | 本人当前能自主答复才allowed；只许读过的本次段落，不许他人姓名、会面、劳动或出行 |
| A08下次会面 | `mariamMeeting/rafiqMeeting/leaMeeting`：unasked→attend或care | 独立询问；只许AC08到AC11安全会面处的单段安排，care保留原安全照护 |
| A11下一程 | `mariamOnward/rafiqOnward/leaOnward/nasirOnward`：unasked→yes或pending | 实际同场者重新自主答复；仅yes且执行时能答复者迁往AC12，纳西尔另须已放行 |

`keep-private/meeting-care/defer-onward`只处理尚未答复的字段，保留已经取得的有限许可。它们不冒称失能者拒绝；无人公开人名或无人愿意迁居仍可完整交接本切片。

| 节点 | 新增ID | 已有ID的必要边界 |
|---|---|---|
| A02 | `copy-alone` | barter须萨利姆、尤哈娜自主在场；copy-labor须尤哈娜。独自公开材料对照90分钟、不假抄手署名 |
| A03 | `witness-unavailable` | witness须萨利姆自主在场；未能取得证词不封锁后续合法路径 |
| A06 | 无 | repay/extend/extra须哈利姆自主在场。refuse现为保留旧债与原物的暂缓新约旁路，不伪造劳动替代或船席 |
| A08 | `consent-mariam/consent-rafiq/consent-lea`、`keep-private`、`meeting-mariam/meeting-rafiq/meeting-lea`、`meeting-care`、`hold` | sealed/carry须逐人公开状态已结且至少一位allowed；sealed另须尤哈娜自主接收，joint须尤哈娜和哈利姆。hold不造公开副本与核验书 |
| A09 | `care-defer` | grain/pledge须萨利姆自主在场。活着但0HP/受魅惑的纳西尔仍可受益，`nasirConsentRecorded=false`，不造劳动或同行承诺；grain收据暂存队伍，能自主答复时才转本人。independent须纳西尔自主答复 |
| A10 | `water-defer` | verify须尤哈娜，三种水罐分配须哈利姆自主在场；无法新签则不动私物，普通水源和救助继续 |
| A11 | `confirm-mariam/confirm-rafiq/confirm-lea/confirm-nasir`、`defer-onward`、`care-handover` | two-seats须拉菲格、莱娅本次同意，一席须拉菲格；岸路须至少一位实际能答复的已同意者。care-handover零席、不迁移人，只完成照护与未定事项交接 |
| A12 | 无 | handover须实有获准副本与尤哈娜自主接收；joint-ending新经营约再查尤哈娜、哈利姆；sponsor-ending新约再查萨利姆。mobile/open保留无需新约的收束 |

A08的carry只制作已授权者摘录。当前能收件者真实持有自己的摘录；已不能答复者对应`*-extract-pending`由队伍暂存，不能把待交写成本人已经收件。hold的`roster-hold-note`明确不是新公开授权。A09粮付收据由萨利姆出具，不是纳西尔的新签字。A12后账据`rosterCopied/nasirPlan/transportMode`区分实际副本、照护待议与已自主出行，不用结局名补造事实。

真实迁移由以下已发生的内容动作触发；不是新增自由瞬移命令。核心保留NPC伤亡，死人不因地点patch重生；后续新答复仍重新核验实际在场。

| 触发 | 地点与坐标（尺） | 范围 |
|---|---|---|
| A01:site-shore/site-market | 萨利姆AC02(52.5,22.5)，尤哈娜AC02(47.5,27.5) | 账房后续材料会面 |
| A02:leave | 萨利姆AC03(52.5,17.5)，尤哈娜AC03(47.5,27.5) | 法庭材料与证词会面 |
| A05:secure/rush | 既有三位获救者→AC08 | 必要救助与照护，保HP，不是公开或出行签字 |
| A07:withdraw | 尤哈娜AC08(52.5,22.5)，哈利姆AC08(57.5,27.5) | A08真实核验者 |
| A08:close | 萨利姆AC09(52.5,22.5) | 个人放行约签署者 |
| A09:close | 尤哈娜AC10(52.5,22.5)，哈利姆AC10(57.5,27.5)；确已放行且仍活的纳西尔AC11(62.5,27.5) | 原抄手、水罐物主；纳西尔为安全照护，不预签下一程 |
| A10:close | Meeting=attend且仍活者：玛丽亚姆AC11(42.5,22.5)、拉菲格(47.5,27.5)、莱娅(52.5,32.5) | 仅本人的单段会面许可；care者不自动出现 |
| A11实际运输 | Onward=yes且当前能答复者：玛丽亚姆AC12(42.5,22.5)、拉菲格(47.5,27.5)、莱娅(52.5,32.5)、纳西尔(57.5,32.5) | 本次自愿出行，其他人保持实际照护地点 |
| A11:close | 尤哈娜AC12(52.5,22.5)，哈利姆AC12(57.5,27.5)，萨利姆AC12(62.5,27.5) | 结账会面；新经营约仍须当场自主同意 |

作者只作静态检查、六项隔离物品合同与10组合成同意边界夹具。独立验收者的正常路线和合成状态复核另存总项目独立验收目录；不把以上检查称作真人、全剧情、全规则或服务验证。
