# v2 成年叙事技术契约

仅用于本轮两个v2目录，不改变v1。剧情使用普通事实、NPC文字关系和D&D标准资源，不新增好感、业力、神力等平行数值。

## 成本与角色权限

```json
{"actorIds":["p3"],"cost":{"gold":20,"potions":{"count":1,"from":"actor"},"items":[{"id":"medicine","count":1}],"actorResources":[{"actorId":"actor","resource":"slots","slot":1,"amount":1}]}}
```

成本发生在尝试前，真实失败也支付；选项和actions/AI均有公开可读costSummary。所有成本先累计到同一账本，再整批预检和扣除；任何前提、资源、物品、目标或后续效果非法均回滚整个剧情命令。不能通过重复hd条目或potions快捷字段与actorResources混用透支。

actorIds在服务器强制，主持也不能用错误角色代替同伴作个人选择。共享gold可依剧情花费；个人hp/hd/slots/potions/inspiration只可由该角色持有席位操作。多角色成本须由同时控制这些角色的席位或主持执行。`_authority`由服务器认证身份重建，客户端伪造会丢弃。`potions.from:'party'`是跨角色合池，仍检查每名实际付款人的控制权，不自动视作已获其他玩家同意。

actorResources字段resource为hp、hd、slots、potions、inspiration；slot取1–9，amount为整数。cost中正amount表示消耗；`actorId:'actor'`为行动者，具体ID为角色/NPC，party为各名队友分别承担。HP成本须保留至少1HP；它是事先明示的消耗，不凭旁白制造伤害。真正伤害请用效果hp负数。

## 规则后果

success/failure的actorResources同结构，amount正数恢复、负数消耗；HP通过现有ctx.heal/hurt，处理上限、临时HP、专注、倒地与死亡规则；法术位/生命骰封顶，英雄激励最多1。具体NPC或已出场的npc.actor快照可作为效果目标。NPC首次initialHp可设受伤开局，后续重访不重置；不支持治疗死者。

标准状态用`conditions:[{actorId:'actor',condition:'poisoned',requires:{exposed:true},minutes:60,remove:false}]`。支持标准D&D条件枚举，尊重免疫，移除用remove:true；未写minutes不自行过期，须剧情明确解除。Poisoned实际影响属性检定，与Champion/训练/Help等优势相抵消。Help可用现有效果helpSkill指定下一次技能；不另增资源。

`conditional:[{requires:{priorChoice:true},...effects}]`按事实门槛实际执行。NPC公开态度/状态仍用npc数组；关系用`relationships:[{npcId,actorId,status:'承诺尚未原谅',visibility:'owner'}]`，只记文字。encounter.actors成员可各带requires；或对象`{variants:[{requires,actors:[...]}],actors:[默认]}`先取首个匹配变体再筛成员，且保留原卡/伤势/停战结果。不同剧情选择可改变实际增援组成。

物品成本/consumeItems按真实持有权和数量结算。transferItems可`{id,count,holder,splitId,location}`：省count转整堆，部分转交会减源堆并创建/合并splitId，数量守恒。空堆、毁坏、未持有物不能转交；物品动作give同样拒绝空堆。

## 私密信息与略述

party.privateBrief是字符串或对象，只给GM/房主及该角色真实持有人。`privateFacts:{p2:{sealed:true}}`独立存储；门槛为`privateFact:{actorId:'p2',key:'sealed',value:true}`。`privateSay:[{actorId:'p2',text,summary?}]`为本人日志。owner关系和`option.visibility:'owner',actorIds:['p2']`只给本人/GM；该选项新增日志、手记和未显式指定可见性的物件默认继承owner。公开可见后果另外放publicFacts白名单。

过滤同时覆盖state/campaignView、actions、SSE投影及玩家AI请求；不依靠UI禁用或模型自觉。私人选项不能被其他席位用命令ID直接提交。owner私人信息不会因旁观另一人物卡而泄漏；玩家AI只收到该席允许的内容。

`introSafety:{title,summary,topics:[],fadeText}`在进桌时用既有modal展示，设置按钮可重开。默认略述；完整叙述须用户选择。偏好只保存在当前浏览器，不回传房间，不改变掷骰、成本、事实、条件、物品或结局。

敏感章写sensitive:true与descriptionSummary，选项textSummary，效果saySummary。普通玩家的历史/手记默认使用摘要；完整文本放detailText，仅本机用户选择完整显示后渲染。玩家AI不接收这些敏感详情副本，GM保留完整裁定材料。未标敏感/未写摘要的普通对话不会擅自改写。

技术验证见V2_ENGINE_CONTRACT_QA.json及独立内容QA报告；这是程序契约验证，不是真人时长或平衡试玩。正常浏览器不可用，未宣称真实页面截图验收。

## 真实休息的剧情后果

`restEffects:{short:{facts:{restTaken:true},text:'短休会使斥候追上。'},long:{facts:{restTaken:true,raidAlert:true},text:'长休会让警报传开。'}}`仅支持事实与公开说明。选择休息前，actions/玩家AI及既有动作按钮均显示text；真实休息命令成功后设置事实。失败命令不触发；同一场景、同一时间的共享短休只触发一次。该hook不另加时间、不额外回血/补资源。奥术回想和共鸣本来即完成实际短休，也触发short后果。事实可供后续遭遇requires读取；对玩家公开的事实仍须加入publicFacts白名单。

休息后果并不把普通等待视为休息收益；主持人可按实际经过时间处理未休息的追击。针对性程序证据见V2_REST_QA.json（实际engine.apply，隔离内存manifest）。

## 遭遇投降与队伍受挫

自动停战保存实际原因。敌方自身HP降至truceHp时标记surrendered；因truceOnPartyDown停追时标记party_setback，同时满足时优先后者。遭遇收束后，`encounter_<id>_surrendered`只有全体敌人均0HP/死亡或依自身伤势投降，且没有party_setback时为true；至少须有一名实际投降者。`encounter_<id>_party_setback`一旦出现会保留，不因后来治疗同伴而清除。`_defeated`仍只指全体0HP/死亡。

`_cleared`仅表示交锋已结束，含普通交涉、敌方投降或队伍败退；授予战胜/交付收益请用any:[{encounter_<id>_defeated:true},{encounter_<id>_surrendered:true}]，不能只用_cleared。`_outcome`现在为defeated、surrendered或truce；partyDown仍为truce并另设_party_setback。普通neutralize不伪造投降。此修改仅两v2，不从旧存档推断历史原因。针对性实际运行证据在V2_SURRENDER_QA.json。

## 指定NPC的真实治疗钩子

`spellHooks:[{spell:'cure',targetNpcId:'porter',healed:true,requires:{porterRecovered:false},effects:{facts:{porterRecovered:true}}}]`在法术合法结算后执行，治愈真言key为word。healed:true要求明确targetNpcId、该NPC确为法术目标、施法前活着且HP实际增加；只施法、治别人、过量治疗、普通增HP上限或对死者的失败施法不会触发。真实法术距离、准备、动作及法术位消耗由原规则处理。首次受伤NPC放根npcs，type:'commoner',location:'J04',initialHp:1,vital:true；重访保留伤势。证据见V2_HEAL_HOOK_QA.json。
