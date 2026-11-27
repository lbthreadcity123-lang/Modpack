import {
  SEA_TILE,
  SEA_STONE_Y,
  SEA_WATER_Y,
  SEA_LAMP_CHANCE,
  LAMP_STRUCTURE_ID,
  STONEHOUSE_ROW_STEP,
  STONEHOUSE_ROW_Z,
  STONEHOUSE_TYPES,
} from "./config.js";
import { mix } from "./utils.js";

const stoneRowPlaced = new Set();
let maxReachedStoneIndex = 0;

export function resetDimen4State() {
  stoneRowPlaced.clear();
  maxReachedStoneIndex = 0;
}

export function placeSeaTile(dim, tx, tz, salt) {
  const x0 = tx * SEA_TILE;
  const z0 = tz * SEA_TILE;
  const x1 = x0 + SEA_TILE - 1;
  const z1 = z0 + SEA_TILE - 1;
  dim.runCommand(`fill ${x0} ${SEA_STONE_Y} ${z0} ${x1} ${SEA_STONE_Y} ${z1} stone`);
  dim.runCommand(`fill ${x0} ${SEA_WATER_Y} ${z0} ${x1} ${SEA_WATER_Y} ${z1} water`);
  if (mix(tx, tz, salt + 97) % 100 < SEA_LAMP_CHANCE * 100) {
    const lx = x0 + 12 + (mix(tx, tz, salt + 101) % (SEA_TILE - 24));
    const lz = z0 + 12 + (mix(tx, tz, salt + 103) % (SEA_TILE - 24));
    dim.runCommand(`structure load ${LAMP_STRUCTURE_ID} ${lx} ${SEA_WATER_Y + 1} ${lz}`);
  }
}

export function ensureStoneHouseRowUpTo(dim, targetIndex, seaBuiltSet, salt) {
  const endIdx = Math.max(targetIndex, maxReachedStoneIndex);
  maxReachedStoneIndex = endIdx;
  for (let i = -2; i <= endIdx + 4; i++) {
    if (stoneRowPlaced.has(i)) continue;
    const sx = i * STONEHOUSE_ROW_STEP;
    const sz = STONEHOUSE_ROW_Z;
    const tx = Math.floor(sx / SEA_TILE);
    const tz = Math.floor(sz / SEA_TILE);
    if (!seaBuiltSet.has(`${tx},${tz}`)) continue;
    const houseType = (Math.abs(mix(i, 0, salt + 131)) % STONEHOUSE_TYPES) + 1;
    const houseId = `dream:stonehouse_${houseType}`;
    try {
      dim.runCommand(`fill ${sx - 1} ${SEA_STONE_Y} ${sz - 1} ${sx + 8} ${SEA_WATER_Y} ${sz + 8} stone`);
      dim.runCommand(`structure load ${houseId} ${sx} ${SEA_WATER_Y + 1} ${sz} 0`);
      stoneRowPlaced.add(i);
    } catch {}
  }
}