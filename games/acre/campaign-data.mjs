import fs from 'node:fs';
export const campaignData=JSON.parse(fs.readFileSync(new URL('./data/campaign.json',import.meta.url),'utf8'));
export function validateCampaign(c=campaignData){
 if(!c||typeof c.id!=='string'||!c.id||!Array.isArray(c.chapters)||!c.chapters.length||!c.scenes)throw Error('战役包须包含id、chapters和scenes。');
 c.initialLevel??=c.fixedLevel||c.chapters[0]?.entryLevel||3;if(c.fixedLevel)c.levelMode='fixed';
 for(const [kind,rule]of Object.entries(c.restEffects||{})){if(!['short','long'].includes(kind)||!rule||typeof rule!=='object'||Object.keys(rule).some(k=>!['facts','text'].includes(k))||rule.facts&&(!rule.facts||typeof rule.facts!=='object'||Array.isArray(rule.facts))||rule.text!==undefined&&typeof rule.text!=='string')throw Error('restEffects仅支持short/long的facts和公开text，不改变休息时间或重复恢复资源。');}
 const ids=new Set();
 for(const [index,ch]of c.chapters.entries()){
  if(!ch.id||ids.has(ch.id)||!c.scenes[ch.scene])throw Error(`第${index+1}节点标识或地图无效。`);ids.add(ch.id);
  ch.number=index+1;ch.entryLevel??=c.initialLevel||3;ch.options||=[];ch.objectives||=[];ch.text??=[ch.title,ch.readAloud,ch.description,ch.dmNotes,...ch.options.map(o=>`${o.label}\n${o.text||''}\n${o.check?`${o.check.skill} DC${o.check.dc}`:''}\n成功：${JSON.stringify(o.success||{})}\n失败：${JSON.stringify(o.failure||{})}`)].filter(Boolean).join('\n\n');
  const opts=new Set();for(const o of ch.options){if(!o.id||opts.has(o.id)||!o.label)throw Error(`节点${ch.id}选项无效。`);opts.add(o.id);if(o.actorIds!==undefined&&(!Array.isArray(o.actorIds)||o.actorIds.some(id=>typeof id!=='string')))throw Error('actorIds须为角色ID数组。');if(o.visibility==='owner'&&!o.actorIds?.length)throw Error('本人私密选项须明确actorIds。');if(o.check&&(!Number.isInteger(o.check.dc)||o.check.dc<1||o.check.dc>40))throw Error(`节点${ch.id}的DC无效。`);}
 }
 for(const [id,sc]of Object.entries(c.scenes)){sc.map_id??=id;sc.name??=sc.title||id;sc.grid_ft??=5;sc.rooms||=[];sc.walls||=[];sc.openings||=[];sc.features||=[];if(![sc.width_ft,sc.height_ft].every(n=>Number.isFinite(n)&&n>=10&&n<=500)||sc.grid_ft!==5)throw Error(`地图${id}尺寸或网格无效。`);}
 c.initialScene??=c.chapters[0].scene;if(!c.scenes[c.initialScene])throw Error('起始地图不存在。');
 return c;
}
validateCampaign();
