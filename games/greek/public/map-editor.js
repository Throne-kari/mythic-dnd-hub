export const TERRAIN = [
  { key: '.', name: '地面', cost: 1 }, { key: 'r', name: '石路', cost: 1 },
  { key: '#', name: '石墙', cost: 0 }, { key: '~', name: '深水', cost: 0 },
  { key: '2', name: '高台', cost: 2 }, { key: '^', name: '碎石', cost: 2 },
  { key: 'c', name: '石柱', cost: 0 }
];
export const MONSTERS = [
  { name: '铜面卫兵', hp: 16, maxHp: 16, ac: 14, attack: 4, damage: 5, range: 1 },
  { name: '墓丘游魂', hp: 12, maxHp: 12, ac: 12, attack: 3, damage: 4, range: 1 },
  { name: '神庙弓卫', hp: 13, maxHp: 13, ac: 13, attack: 4, damage: 4, range: 5 },
  { name: '饥饿野犬', hp: 9, maxHp: 9, ac: 12, attack: 3, damage: 3, range: 1 }
];
export const DECORATION_TYPES = new Set(['roof','tree','statue','tomb','brazier','beam','ledger','tripod','stairs','valve','gate','benches','desk','dock']);
const damageSafe = value => (Number.isFinite(value)&&value>=0&&value<=50)||(typeof value==='string'&&/^([1-4])d(4|6|8|10|12)([+-][0-9]{1,2})?$/.test(value));
export function decorationSafe(d,map) {
  return !!d && typeof d === 'object' && !Array.isArray(d) && Object.keys(d).every(k=>['type','x','y','w','h'].includes(k)) && DECORATION_TYPES.has(d.type) && Number.isInteger(d.x) && Number.isInteger(d.y) && d.x>=0 && d.y>=0 && Number.isInteger(d.w??1) && Number.isInteger(d.h??1) && (d.w??1)>=1 && (d.h??1)>=1 && (d.w??1)<=40 && (d.h??1)<=40 && d.x+(d.w??1)<=map.width && d.y+(d.h??1)<=map.height;
}
export class MapDraft {
  constructor(map) { this.map = structuredClone(map); for(const key of ['enemies','points','exits','tokens','decorations'])this.map[key]||=[]; this.dirty = false; this.history = []; }
  snapshot() { this.history.push(structuredClone(this.map)); if (this.history.length > 50) this.history.shift(); this.dirty = true; }
  paint(x, y, terrain) {
    if (x < 0 || y < 0 || x >= this.map.width || y >= this.map.height || !TERRAIN.some(t => t.key === terrain)) return;
    if (this.map.tiles[y][x] === terrain) return;
    this.snapshot(); const row = this.map.tiles[y].split(''); row[x] = terrain; this.map.tiles[y] = row.join('');
  }
  placeEnemy(x, y, index = 0) {
    if ('#~c'.includes(this.map.tiles[y]?.[x] || '#')) throw new Error('怪物只能放在可以通行的格子。');
    if (this.map.enemies.some(e => e.x === x && e.y === y)) throw new Error('此处已有怪物棋子。');
    this.snapshot(); const enemy = { ...MONSTERS[index], id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, x, y };
    this.map.enemies.push(enemy); return enemy;
  }
  moveEnemy(id, x, y) {
    if ('#~c'.includes(this.map.tiles[y]?.[x] || '#')) throw new Error('棋子不能放进石墙、石柱或深水。');
    if (this.map.enemies.some(e => e.id !== id && e.x === x && e.y === y)) throw new Error('此格已被占用。');
    const enemy = this.map.enemies.find(e => e.id === id); if (!enemy) return;
    this.snapshot(); enemy.x = x; enemy.y = y;
  }
  erase(x, y) { this.snapshot(); this.map.enemies = this.map.enemies.filter(e => e.x !== x || e.y !== y); }
  undo() { if (this.history.length) { this.map = this.history.pop(); this.dirty = true; } }
  export() { return JSON.stringify(this.map, null, 2); }
  static import(text) {
    let map;try{map=JSON.parse(text);}catch{throw new Error('地图文件不是有效的JSON。');}
    if(!map||typeof map!=='object'||Array.isArray(map)||Object.keys(map).some(k=>!['id','name','width','height','tiles','spawn','exits','points','enemies','description','tokens','subtitle','decorations'].includes(k)))throw new Error('地图包含未知字段。');
    if (!map.id || !map.name || !Number.isInteger(map.width) || !Number.isInteger(map.height) || map.width < 6 || map.width > 40 || map.height < 6 || map.height > 40 || !Array.isArray(map.tiles) || map.tiles.length !== map.height || map.tiles.some(r => typeof r !== 'string' || r.length !== map.width || /[^.#~r2^c]/.test(r))) throw new Error('需要有效的6至40格地图JSON。');
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(map.id)||typeof map.name!=='string'||map.name.length>100)throw new Error('地图名称或标识无效。');
    for(const key of ['enemies','points','exits','tokens','decorations']){if(map[key]===undefined)map[key]=[];if(!Array.isArray(map[key])||map[key].length>100)throw new Error('地图中的棋子、地标或装饰列表无效。');}
    if(map.decorations.some(d=>!decorationSafe(d,map)))throw new Error('装饰类型、字段、尺寸或坐标无效；装饰必须完整位于地图内。');
    const inside=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.y>=0&&p.x<map.width&&p.y<map.height;
    const floor=p=>inside(p)&&!'#~c'.includes(map.tiles[p.y][p.x]);
    if(!floor(map.spawn))throw new Error('地图出生点需要位于可通行地面。');
    if(map.points.some(p=>!floor(p)||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.id))||map.exits.some(p=>!floor(p)||!/^[a-zA-Z0-9_-]{1,64}$/.test(p.to||p.mapId)))throw new Error('地图地标或出口无效。');
    if(map.enemies.some(e=>!floor(e)||!/^[a-zA-Z0-9_-]{1,64}$/.test(e.id)||!Number.isFinite(e.hp)||e.hp<=0||!Number.isFinite(e.ac)||!Number.isFinite(e.attack)||!damageSafe(e.damage)||!Number.isFinite(e.range??1)))throw new Error('怪物棋子的坐标或战斗数值无效。');
    if(map.tokens.some(t=>!floor(t)||!/^[a-zA-Z0-9_-]{1,64}$/.test(t.id)||typeof t.label!=='string'||t.label.length>80||(t.color!==undefined&&!/^#[0-9a-fA-F]{6}$/.test(t.color))))throw new Error('叙事标记的坐标、文字或颜色无效。');
    return new MapDraft(map);
  }
}
