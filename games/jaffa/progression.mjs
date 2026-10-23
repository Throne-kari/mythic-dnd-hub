// 雅法余烬是固定三级的一夜冒险；资源恢复由引擎的休息规则处理。
export const spellSlots = {3: [4, 2]};
export const proficiency = level => 2 + Math.floor((level - 1) / 4);
export function buildAt(a, level = 3) {
  if (Number(level) !== 3) throw new Error('本冒险使用固定三级角色；其他等级请由主持人完整导入角色卡。');
  return structuredClone(a);
}
export function advanceActor(a, level = 3) {
  if (Number(level) !== 3) throw new Error('本冒险不在一夜之间自动升级。');
  return false;
}
export function advanceParty(s, level = 3) {
  if (Number(level) !== 3) throw new Error('雅法余烬保持三级，不能使用其他战役的升级表。');
  return s;
}
