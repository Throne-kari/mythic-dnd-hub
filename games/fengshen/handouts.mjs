import fs from 'node:fs';
export const handouts = JSON.parse(fs.readFileSync(new URL('./data/handouts.json', import.meta.url), 'utf8'));
export function publishHandout(state, id) {
  const entry = handouts.find(h => h.id === id);
  if (!entry) throw Error('没有这份手札。');
  if (state.journal.some(j => j.sourceHandout === entry.id)) throw Error('这份手札已经发给本桌。');
  state.journal.push({title: entry.title, text: entry.text, sourceHandout: entry.id, publishedAt: new Date().toISOString()});
  state.log.push({id: `handout-${entry.id}-${state.revision}`, kind: 'story', text: `主持人出示了《${entry.title}》，已收入行旅手记。`, time: state.time});
  if (state.log.length > 500) state.log.splice(0, state.log.length - 500);
}
