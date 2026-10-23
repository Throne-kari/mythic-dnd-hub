export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const canControl = (state, hero) => !!hero && (state.seat?.role === 'dm' || state.seat?.heroIds?.includes(hero.id));
export function reachable(state, map, hero) {
  const result = new Map();
  if (!hero || hero.hp <= 0 || !canControl(state, hero) || state.ending || (state.combat && state.activeHeroId !== hero.id)) return result;
  const max = state.combat ? hero.speed - (state.turnUsage?.move || 0) : map.width * map.height * 2;
  const occupied = new Set([...state.heroes, ...state.enemies].filter(h => h.hp > 0 && h.id !== hero.id).map(h => `${h.x},${h.y}`));
  const queue = [{ x: hero.x, y: hero.y, cost: 0 }]; result.set(`${hero.x},${hero.y}`, 0);
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    for (const next of [{ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }]) {
      if (next.x < 0 || next.y < 0 || next.x >= map.width || next.y >= map.height) continue;
      const tile = map.tiles[next.y][next.x], key = `${next.x},${next.y}`, cost = p.cost + ('2^'.includes(tile) ? 2 : 1);
      if ('#~c'.includes(tile) || occupied.has(key) || cost > max || cost >= (result.get(key) ?? Infinity)) continue;
      result.set(key, cost); queue.push({ ...next, cost });
    }
  }
  return result;
}
export function currentStage(campaign, state, arcId) {
  const arc = campaign.arcs.find(a => a.id === arcId), progress = state.arcs[arcId];
  return { arc, progress, stage: arc?.stages.find(s => s.id === progress?.stage) };
}
export function actionAllowed(state, action) {
  return state.legalActions?.some(candidate => Object.entries(action).every(([key, value]) => candidate[key] === value));
}
export function nextInteractCell(state, map, point, hero) {
  const cells = [...reachable(state, map, hero)].map(([key, cost]) => { const [x, y] = key.split(',').map(Number); return { x, y, cost }; });
  return cells.filter(p => distance(p, point) <= 2 && distance(p, hero) > 0).sort((a, b) => a.cost - b.cost)[0];
}
