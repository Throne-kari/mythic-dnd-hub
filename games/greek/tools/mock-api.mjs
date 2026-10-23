// Optional provider-neutral integration. Only a caller-supplied callback is run.
// This file contains no HTTP client, SDK, configuration reader, or credential path.
export function createCallbackAdapter(decide) {
  if(typeof decide!=='function') throw new Error('需要注入决策回调');
  return async snapshot=>{
    const action=await decide(structuredClone(snapshot));
    if(!action || typeof action!=='object' || Array.isArray(action)) throw new Error('回调必须返回行动对象');
    return structuredClone(action);
  };
}
export function mockDecision(snapshot) {
  const actions=snapshot.state.legalActions || [];
  if(!actions.length) return null;
  const choose=actions.find(a=>a.type==='choose');if(choose) return choose;
  const attack=actions.find(a=>a.type==='attack');if(attack) return attack;
  if(snapshot.state.combat) {
    const heal=actions.find(a=>a.type==='heal' && snapshot.state.heroes.find(h=>h.id===a.targetId)?.hp<=6);if(heal) return heal;
    const target=snapshot.state.enemies.filter(e=>e.hp>0)[0];
    const move=closestMove(snapshot,actions,target);if(move) return move;
    return actions.find(a=>a.type==='defend') || actions.find(a=>a.type==='endTurn') || null;
  }
  const objective=snapshot.context?.objectives?.[0];
  if(objective) {
    if(objective.mapId!==snapshot.state.mapId) return actions.find(a=>a.type==='travel' && a.mapId===objective.mapId) || null;
    const target=snapshot.context.map.points.find(p=>p.id===objective.pointId);
    const move=closestMove(snapshot,actions,target);if(move) return move;
  }
  return actions.find(a=>a.type==='finish') || null;
}
function closestMove(snapshot,actions,target) {
  if(!target) return null;
  const map=snapshot.context.map,distances=new Map([[`${target.x},${target.y}`,0]]),queue=[target];
  for(let i=0;i<queue.length;i++) {
    const p=queue[i],d=distances.get(`${p.x},${p.y}`);
    for(const n of [{x:p.x+1,y:p.y},{x:p.x-1,y:p.y},{x:p.x,y:p.y+1},{x:p.x,y:p.y-1}]) {
      const key=`${n.x},${n.y}`;if(n.x<0 || n.y<0 || n.x>=map.width || n.y>=map.height || '#~c'.includes(map.tiles[n.y][n.x]) || distances.has(key)) continue;
      distances.set(key,d+1);queue.push(n);
    }
  }
  return actions.filter(a=>a.type==='move' && (distances.get(`${a.x},${a.y}`) ?? Infinity)<(distances.get(`${snapshot.state.heroes.find(h=>h.id===a.heroId).x},${snapshot.state.heroes.find(h=>h.id===a.heroId).y}`) ?? Infinity)).sort((a,b)=>(distances.get(`${a.x},${a.y}`) ?? Infinity)-(distances.get(`${b.x},${b.y}`) ?? Infinity))[0];
}
