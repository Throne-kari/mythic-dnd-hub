# 最小内容与地图格式

入口`data/campaign.json`：`{id,title,subtitle,port,initialScene,initialLevel,levelMode:'fixed',initialPotions,initialFacts:{},publicFacts:[],chapters:[],scenes:{},npcs:{},handouts:[],endings:[],ruleCards:[]}`。`fixedLevel`兼容为initialLevel与固定等级。正式两包均十二节点；模板允许其他数量。

每章：`{id:'J01',number:1,title,scene:'J01',entryLevel:5,next:'J02',description,readAloud,dmNotes,safeRest:false,objectives:[{id,label,fact}],options:[],encounters:{}}`。readAloud/dmNotes和选项后果只由主持正文接口读取。

选项示例：

```json
{"id":"ask","label":"提出具体条件","text":"可见说明","requires":{"done":false},"once":true,"check":{"skill":"persuasion","dc":12,"once":true},"success":{"facts":{"done":true},"say":"实际成功后果"},"failure":{"facts":{"done":true},"say":"较慢仍可完成","minutes":10,"complete":true},"complete":true}
```

`option.complete`只在检定成功时完成；失败也完成需`failure.complete:true`。选项默认一次；`once:false`允许重复。章完成后默认拒绝剩余选项，必要后续选项显写`allowAfterComplete:true`。`at:[x,y,距离]`要求实际靠近，`combat:true`允许先攻中执行并花`action`字段（默认动作）。常规`campaign:next`仅在当前章completed且不在先攻时可用。

前提为扁平facts精确比对，支持`all:[conditions]`、`any:[conditions]`、`not:condition`、`completed:节点号`、`notCombat:true`、`goldAtLeast:数值`、`encounterCleared:'guard'`、`npcAlive:'npcid'`；事实也可`{eq/ne/gte/lte:值}`或允许值数组。

效果字段：facts、increment、say（文本/数组）、gold（负数支付）、minutes、items、handouts、promises、npc、neutralize、encounter、transferItems、removeItems、complete、enter、ending。items为`[{id,name,kind,count,holder}]`；普通物品只归属。kind/type=potion支持附赠动作触及饮用或喂药、实际掷2d4+2、扣count；weapon的magic/weaponType支持装备现有熟练武器。transferItems为`[{id,holder,location}]`，转出队伍会真实移出inventory名称。ending可id字符串或{id,title,text}。章safeRest:true开放正常休息，不自动回血。

遭遇`encounters:{guard:[{id,type,name,x:32.5,y:22.5,side:'enemy',truceHp:8,truceOnPartyDown:1}]}`。成功效果encounter:'guard'只建立一次；重访保留真实伤势。所有成员死亡、失能、离场或中立停手后写encounter_guard_cleared:true。cleared只表示离开敌对；encounter_guard_defeated仅全成员实际hp0/死亡，encounter_guard_outcome为defeated/truce。强行战胜取货须检查_defeated；败局停战不能自动授予胜利收益。停手不回血、不复活。倒地人数用整数；不建议以true代替1。

身份`party:[{id:'p1',name,role,bio,portrait,color,languages,tools,inventory,background}]`仅覆盖身份；兼容characterNames的warrior/rogue/cleric/wizard映射。四卡固定Fighter Champion、Rogue Thief、Cleric Life、Wizard Evoker。初始药水是全队数量。肖像暂为1–2字徽，路径字符串会降级为name首字。

地图：`{map_id,name,width_ft:80,height_ft:60,grid_ft:5,rooms:[],walls:[],openings:[],features:[],starting:[[2.5,2.5],...]}`。矩形`{x,y,w,h,label,height_ft?}`，门窗`{id,a:[x,y],b:[x,y],state:'open'/'closed'/'locked',kind:'door'/'window'}`。可视地面surfaces为`[{x,y,w,h,z,water?}]`，屋顶roofs为`[{id,x,y,w,h,height_ft}]`。坐标单位尺，格宽固定5；token起点归入2.5模5格心，原墙体几何不变。sourceScene/sourceMap/sourceOrigin仅留来源，不从示意总览推射程。视图高度不自动变成服务器碰撞高度。

NPC：根npcs以id索引`{name,type,location:'J01',x,y,side:'neutral',status,attitude}`。手札`{id,title,text,chapter,requires}`。结局数组`[{id,title,text,requires}]`（也兼容id→标题/对象映射）。规则卡`{id,title,category,tags:[],summary,sourceUrl,page}`支持公开全文搜索。

技能：acrobatics, animalhandling, arcana, athletics, deception, history, insight, intimidation, investigation, medicine, nature, perception, performance, persuasion, religion, sleight, stealth, survival。

常用原卡type：commoner, guard, bandit, bandit_captain, scout, berserker, armor, sword, giantSpider, skeleton, minotaurSkeleton, waterElemental, steam_mephit；其余公共卡captain, knight, priest, mage, druid, air, gargoyle, gladiator, golem, stalker, efreeti, fire, rakshasa, lamia。
