import {campaignData as pack} from './campaign-data.mjs';
import {matches} from './campaign-play.mjs';
export const handouts=pack.handouts||[];
export function availableHandouts(s){return handouts.map(h=>({...h,available:matches(s,h.requires)&&(!h.chapter||h.chapter<=s.chapter),published:s.journal.some(j=>j.sourceHandout===h.id)}));}
export function publishHandout(s,id){const h=handouts.find(h=>h.id===id);if(!h)throw Error('没有这份手札。');if(s.journal.some(j=>j.sourceHandout===id))return false;if(!matches(s,h.requires)||h.chapter&&h.chapter>s.chapter)throw Error('尚未实际取得这份材料。');s.journal.push({title:h.title,text:h.text||'',sourceHandout:id,publishedAt:new Date().toISOString()});s.log.push({id:++s.logSeq,kind:'story',text:`出示《${h.title}》，已收入手记。`,time:new Date().toISOString()});return true;}
