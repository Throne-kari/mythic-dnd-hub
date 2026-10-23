> 本文保留v3.1阶段材料。v3.2默认合作权限、端口、测试结果和限制以 `COOP_RELEASE_REPORT.md`、`COOP_UPGRADE_CHECKLIST.md`、`PLAY_GUIDE.md` 为准。

# 盐峡湾 v3 · 界面与地图交付

本目录界面为独立实现，不读取旧游戏存档或凭据。仅两个主视图：冒险桌、地图工坊。HTTP 为同源 localhost；前端不使用 CDN、远程字体、外部图片或模型接口。

## 已实现

- 冒险桌：队伍生命与护甲、六项属性、法术位/能力次数、共同 GP/口粮/药水；可点地图移动、攻击、选择能力目标、防御、结束回合；主持摆放现有角色；探索点调查；场景真实选项、禁用原因、章节三线目标、任务、日志、旅途与当前同伴立场；只显示已达结局及已发生事实回收。
- 地图工坊：七类地形连续绘制、撤销、四个独立队伍出生点、五种敌人类型的摆放/移除、地图命名和标识、6–40列/6–30行、探索点命名/内容/坐标、六张预设、JSON 导入/导出、保存、从本版磁盘重载、带入探索、试演遭遇。棋子摆放保存在 spawns.party，敌人保存在 enemies[{kind,x,y}]。试演经引擎实际生成敌人，非装饰标记。
- 顶部：本地房间、在线/重连状态、同机席位切换、创建四个玩家席位、手动存档/恢复、工作区协作请求/采用/取消。令牌仅放当前标签页 sessionStorage，不写入源码、URL、图片或此文档。
- 响应式：大屏三栏；1030px以下两栏加下方叙事；690px以下纵向排列。地图地形采用可编辑 CSS 格子与符文棋子，**不是参考图写实 2.5D 地图的像素复刻**。无外部图像依赖。

## 先图后实现证据

先读 `ui-image-first` 与 `imagegen`，列出真实控件和内容，再通过 built-in `image_gen.imagegen` 分别调用两次。两张结果均实际显示于工具输出中，之后才写界面。选择依据：A 图的左队伍/中地图/右羊皮纸叙事、铜金细线与青色选中态，B 图同构工坊和常驻地形/棋子工具。最终实现保留此布局、配色、层级与控件用途，将地图转换成真实数据驱动的 CSS 格网。

工具原始对象都只有 `image_url`，没有源文件路径：

| 结果 | 返回前缀 | base64 字符数 | 最终文件 SHA-256 |
|---|---|---:|---|
| A 冒险桌 | `data:image/png;base64,iVBORw0K` | 4011444 | `34A35D55EC60A452BFF0D1D8F06CD8E7A0A54C0F1E3B902226FF57659A675DEF` |
| B 工坊 | `data:image/png;base64,iVBORw0K` | 3651788 | `EF4303F1C0EA9C9F2E2E522C36DD2C0D2A0028BD5A455D1AFF6BC0CBC1F9BFA2` |

项目文件：[冒险桌参考](../assets/reference-adventure.png)、[工坊参考](../assets/reference-workshop.png)。2026-10-20 16:41 UTC 直接从本轮工具结果内存 data URL 写入项目，随后分别 `view_image` 实际查看本地正确图片。负责人也独立查看确认。

保存过程曾误用 `$CODEX_HOME/generated_images` 的最近文件，拷入两张旧的中国场景/肖像；负责人检查后立即发现。两张错误文件已被本轮 data URL 的正确北欧控件图替换，未作为设计证据。没有伪造 imagegen 文件路径或把旧文件时间当本次生成时间。

### A 完整提示词

```text
Use case: ui-mockup. Create a polished high fidelity desktop web tabletop RPG interface reference, 1920x1080 landscape. Chinese Norse fantasy campaign exact title 盐峡湾：断誓之冬. Visually implementable real UI, restrained charcoal navy and icy teal, brushed copper gold, parchment narrative cards, highly legible generous text. Top bar title left, 房间 FJORD-07, four seat dots, 保存, tabs 冒险桌 and 地图工坊. Three column board: left 250px party with four distinct portrait initials and health bars for 艾瑞克 42/42 战士, 莉芙 33/33 游荡者, 索菈 38/38 牧师, 伊瓦尔 27/27 法师; resource cards 18 GP, 粮食 6, 药水 4. Center 16 by 12 top down square tactical tile map icy Nordic harbor with dark water, pier bridge, snow, walls and 4 player tokens plus two red monster tokens, map heading 盐风议事港, small turn strip 第1轮 · 艾瑞克, bottom buttons 移动, 攻击, 防御, 结束回合. Right 370px parchment toned narrative reading panel heading 议会的断誓, narrative 海风卷着盐霜穿过议事厅。粮仓只够十二日，三份互不相容的誓约等候裁决。, three prominent choice cards 调查失踪的誓约石, 听取粮仓守人的证词, 前往亡者渡口, lower tabs 日志 and 任务, 3 quest rows 议会誓约 / 亡者船债 / 寒冬粮种. Crisp functional buttons, grids, borders, understated rune emblems. Atmospheric top edge fjord silhouette. No marketing slogans, no fake charts, no watermark.
```

### B 完整提示词

```text
Use case: ui-mockup. Second high fidelity browser desktop web tabletop RPG screen reference 1920x1080: Norse Chinese campaign 盐峡湾：断誓之冬, active tab 地图工坊, another tab 冒险桌, same dark charcoal navy / icy teal / copper gold and parchment design, crisp highly legible real controls. Top title and small room 房间 FJORD-07 and 保存. Three column workshop: left 240px palette titled 地形 with 7 square swatches labels 石墙, 深水, 薄冰, 石地, 泥地, 木桥, 危险, selection 薄冰; lower 棋子 with four circular party chips and two monster chips, selected token 艾瑞克. Center large 16x12 editable topdown strategic grid of icebound grave mound with snow stone ring, frozen water stream, stone walls, bridge across river, floor paths, hazard pink rune, player and enemy colored round initials. Central map heading 旧丘墓环 · 16 × 12. Beneath center inline coordinates and 保存到工坊, 从存盘重载, 将地图带入冒险. Right parchment control sidebar 地图设置; text input 地图名称 with 旧丘墓环, dropdown 地点预设, width and height fields 16 and 12; subsection 兴趣点 with named locations 誓约石, 封冰渡口, lower saved map list 盐风港, 议事长屋, 旧丘墓环, 亡者渡口, 冻林粮道, 余烬锻炉. Design precise developer implementable UI, understated decorative Nordic knot borders, map graphic native CSS compatible tiles, high contrast teal grid selection, no explanatory marketing copy, no huge illustration taking over functionality, no watermark.
```

参考图中人名/数值是设计示例；实现全部从真实 `publicState` 渲染阿斯格尔、莉芙、鲁娜、埃里克与实际资源。单房间版本不伪造 FJORD-07 为真实房间标识。

## 接口与后续章节扩展

`public/api.js` 为独立适配层：`POST /api/host`，`GET /api/state`，`POST /api/action {requestId,revision,action}`；认证使用 `x-seat-token`。SSE 用 fetch 读取 `/api/events?since=seq`，支持中断与重连、较旧 revision 不覆盖当前状态。所有交互等服务端结算后渲染，不在前端修改钱包或骰点。

存档：顶部“存档”使用 `POST /api/save` 手动槽 `manual-1`；“读档”先经 `GET /api/saves` 读取 `metadata` / `availableSlots`，显示自动档、手动档、保存时间、局面版本及不可恢复原因，再经常规确认调用 `POST /api/restore {slot}`。`autosave` 由服务端成功动作自动维护，前端不写此槽、不伪造恢复状态。重启服务并创建新主持后可从同一列表恢复既存自动档；没有存档时友好提示并禁用恢复。工坊：`POST /api/map`、`POST /api/map/load`；入局 action `map.load`、试演 `map.encounter`。协作：`/api/agent/request`、`/api/agent/apply`、`/api/agent/cancel`。

章节预留：`chapter:{id,title,index,goals:[string|{title/name,summary/text/description/goal,state,complete}]}`；建议 index 为1开始。任务栏与地图上方读取同一目标字段。旅途按钮读取仅开放地点 `sceneNames`。同伴只读取已投影的 `currentStance`，结局读取 `ending.epilogues`（支持字符串或 `{title,text}`），不请求或渲染全部未来结局卡。

地图 `worldState:string[]` 存在时，副标题显示末两条已发生变化，完整内容放在原生标题提示中；没有变化时沿用地图原副标题。长内容截断，不撑宽布局。日志识别 `world` / `chapter` 为“世界变化”/“章节”。

## 队伍肖像追加

负责人通过 built-in imagegen 生成并实际查看 `public/portraits.png` 四人2×2 atlas，本界面代理也用 `view_image` 实际查看文件并核对 SHA-256：`FC844AF9FCE69CA3531BA2DD15C6CAB089BB25A592E25B36EE75FD4E4FCA0925`。完整原始提示词和生成来源见 [ART.md](ART.md)。左上阿斯格尔、右上莉芙、左下鲁娜、右下埃里克；队伍卡以 `background-size:200% 200%` 按象限裁切，保留符文角标。地图棋子继续显示符文，保证小尺寸目标辨认。肖像是实际游戏素材，页面参考图仍只作设计依据，二者均不是成品页面截图。

地图导出：`content/maps.mjs` 提供 `MAPS` 数组、`maps` 按 id 对象、`getMap(id)` 深拷贝、`TERRAIN`。六图均16×12：harbor / thing / mound / hel / forest / forge。wall/water阻挡，ice/mud双移动，hazard由服务端掷敏捷豁免结算。

## 验证与剩余阻碍

- `node --check public/app.js`、`node --check public/api.js` 通过。
- 六张地图经真实 `engine.validateMap` 均 `{ok:true,errors:[]}`，包括出生点/探索点可达性。
- 真实 `createState/publicState` 输入下的 Node DOM facade 窄测：初次渲染、192格地图、4张角色卡、场景选项、切工坊192格、7地形画笔、5敌种、6预设、同伴/日志渲染通过。此测试只验证模板与控件注册，不是浏览器测试，不证明布局、触屏或动效。
- 独立代理检查全部字面 DOM id 均存在、HTTP字段与认证/版本契约匹配。HTTP玩法与存读档的系统验收由负责人及独立QA另行记录。
- 肖像/自动档追加后重新通过JS语法与 Node DOM facade 窄测：四个肖像角标、打开读档列表、自动档时间/版本、手动档行、确认后向 `/api/restore` 传 `slot:'autosave'`、成功关闭列表、空档提示、两空槽禁用、损坏原因显示。系统代理另外报告13项真实协议测试全部通过，包括关闭重启后新主持恢复及写盘失败事务不提交；该报告不是本界面代理的浏览器验证。
- **实机视觉与交互验收仍阻塞。** 负责人调用 CUA inventory 返回 `apps:[]`、`browsers:[]`。本任务未另开隐藏浏览器、未用 Playwright 绕过、未生成实际页面截图。因此尚未做成品截图对照、真实鼠标/触屏/响应式视觉验收；参考图仅为设计参考，不是完成游戏的截图。工具恢复后需实际打开 localhost:18841，核对两主视图与存读档/绘图/遭遇目标选择。


补充工具能力核实：负责人又尝试文档明确支持的 `cua.createBrowserTab("iab", "http://127.0.0.1:18841", {visible:true})`，工具明确返回 `Browser is not available: iab`；没有创建页面，也未使用另一套浏览器技术绕过。此前空库存不是页面检查通过。
