# 适用完整规则卡与来源

本页只说明雅法当前实际使用的五类NPC。官方英文原卡、本场中文参考卡、实时角色状态分开保存和展示。参考卡不会覆盖当前HP、资源、死亡豁免、位置或条件；读卡不会改写房间或手动槽。

## 人物、原卡与程序值

| 雅法实际人物 | 程序type | 官方来源与正文页码 | 本场卡的差异与边界 |
| --- | --- | --- | --- |
| 玛尔塔、尤素夫、布特鲁斯、阿黛拉、汉娜；萨米和临时工也使用居民基础卡 | `commoner` | SRD 5.2.1 **Commoner，p275** | 基础AC10/HP4/速度30/Club保留；Training保留一技熟练及该技检定优势。五名救援NPC的各自Training、生活语言、人物身份以及0HP角色式死亡豁免是明确的本场选择/救援适配，不扩展给所有路人。临时工的实际技能与生命状态以角色数据为准。 |
| 达乌德／守夜人 | `guard` | SRD 5.2.1 **Guard，p296** | AC16/HP11、Perception+2、一次Spear（近战5尺或投掷20/60尺）保留；达乌德的中立身份、停止清场和保护行为为原创剧情。不是Guard Captain。 |
| 奥东忠从甲、乙／受雇打手 | `bandit` | SRD 5.2.1 **Bandit，p261** | AC12/HP11、每动作一次Scimitar或Light Crossbow保留；程序旧攻击显示名“短刀”与弯刀同数值。没有Pack Tactics、偷袭或额外攻击。动机、姓名与停手条件是本场原创。 |
| 奥东 | `odon` | SRD 5.2.1 **Bandit Captain，pp261–262** | 人物为雅法原创，数值基于Bandit Captain。**本场不携带/不使用Pistol，没有替代枪械**；一个动作仅作两次原有Scimitar，其余AC15/HP52/先攻+3/豁免/技能/Parry+2保留。停手条件为本场行为指引。官方完整原文仍原样保留Pistol，不能把去枪后的中文卡冒称官方原卡。 |
| 烬客 | `ember` | **本作原创E04，无对应官方原卡** | AC12/HP22、速度20/飞行20悬浮、火免疫/寒冷易伤、火触1d6及充能5–6喷焰均沿用本作。估CR1/2、100XP为主持估值，未宣称桌测平衡。不是Fire Elemental，不继承其火焰灵光、穿墙、遇水伤害或其他能力。 |

Guard页码已核对为**印刷正文p296**，对应PDF零基索引295／阅读器第296页。旧雅法速查中的“p295”是引用页码误记，不是另一张数值卡。其余页码同样使用SRD正文印刷页码。

## 完整原文与许可

唯一官方规则原文来源为[Wizards发布的SRD 5.2.1 PDF](https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf)，许可为[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/legalcode)。本包只保存上述四张适用原卡的完整英文条目，没有复制整本SRD，也没有复制非开放的DMG、Monster Manual或其他D&D书籍全文。

依SRD p1所要求，保留以下署名：

> This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

上述CC BY 4.0明确适用于官方SRD原文部分。本场人物、剧情、原创烬客及其他原创文字的权利边界见[LICENSES.md](../LICENSES.md)；不能仅因与SRD放在一个JSON内就把原创段误标为官方内容或自动另行授权。

## 提取与完整性记录

静态数据在[`data/static/rule-statblocks.json`](../data/static/rule-statblocks.json)。`originalText`只含完整英文官方原卡；`text`是独立的本场中文参考卡；`adaptations`列明变更。烬客的`originalName`、`originalText`和`originalTextSha256`为`null`，官方`pages`为空。

提取使用项目已有的`SRD521.pdf`，并与上述官方PDF核对卡头、页码与完整条目边界。没有读取相邻非开放书籍。参考PDF的SHA-256为：

```text
8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87
```

提取方式为PyMuPDF `page.get_text()`，保留英文正文、数值和排版换行，仅移除跨页处的页眉与页码。可按以下边界复核：

| 条目 | PDF零基索引 | 开始与结束边界 | 全部专有能力 |
| --- | --- | --- | --- |
| Commoner | 274 | `Commoner`卡头至Club的`Bludgeoning damage.`；止于Copper Dragons之前 | Traits/Training；Actions/Club |
| Guard | 295 | `Guard`卡头至Spear的`Piercing damage.`；止于Guard Captain之前 | Skills；Actions/Spear |
| Bandit | 260 | `Bandit`卡头至Light Crossbow的`Piercing damage.`；止于Bandit Captain之前 | Actions/Scimitar、Light Crossbow |
| Bandit Captain | 260–261 | p261卡头/AC/先攻/HP/速度，接p262页首属性表，至Parry的`possibly causing it to miss.`；止于Barbed Devil之前 | Skills；Actions/Multiattack、Scimitar、Pistol；Reactions/Parry |

四卡均保留体型/类型/阵营、AC、先攻、HP、速度、六项属性及各自MOD/SAVE、装备、感官、语言、CR/XP/PB和所有列出的能力。四卡均无Bonus Actions；未把相邻怪物的特性拼入。每条`originalText`另有UTF-8 SHA-256，可用Node核验：

```javascript
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const data=JSON.parse(fs.readFileSync('data/static/rule-statblocks.json','utf8'));
for(const card of Object.values(data.blocks)) {
  if(card.originalText===null) continue;
  const actual=createHash('sha256').update(card.originalText,'utf8').digest('hex');
  if(actual!==card.originalTextSha256) throw Error(card.id+' reference text changed');
}
```

## 实际查阅与秘密隔离

- 主持接口：`GET /api/statblock?type=commoner|guard|bandit|odon|ember`。返回完整本场`text`、完整官方`originalText`（适用时）、`kind`、`originalName`、`pages`、`adaptations`、来源URL、许可与署名。未知type返回404。
- DM角色视图：`state.actors[].fullStatBlock`为本场完整卡，`originalStatBlock`为适用的完整英文原卡，另有`statBlockRef`、`statBlockKind`、`sourceName/sourceUrl/sourcePages/sourceLicense/sourceAttribution`和改编说明。DM永久NPC快照视图也按同样方式补全。
- 旧房间或手动槽即使没有完整卡字段，也可按已存`type`在**读取时**派生当前参考卡。派生只发生在克隆的DM视图，不写原存档，不覆盖实时数值。完整原卡接口也始终可按type读取。
- 普通玩家调用原卡接口返回403。玩家state/updates/SSE与玩家AI视角按正向字段表删除完整原文及其元数据；隐藏敌人不会因为新增参考卡而提前公开。静态原卡JSON不在`public/`，不能匿名通过静态网址读取。

前端主持入口使用上述真实数据展示，标明“本场参考卡”和“官方完整英文原卡”两个区域；原始Pistol仍只属于官方参考，不能据此生成本场奥东的枪械动作。
