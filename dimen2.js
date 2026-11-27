import {
  FIELD_CELL,
  GROUND_Y,
  TREE_SIZE,
  TREE_Z_SPACING,
  FIELD_HOUSE_PERCENT,
  FIELD_EXTRA_STRUCT_PERCENT,
  FIELD_EXTRA_STRUCT_ID,
  GRAVE_STRUCTURE_ID,
  GRAVE_SPAWN_PERCENT,
  HOUSE5_STRUCTURE_ID,
  HOUSE5_SPAWN_RADIUS,
  HOUSE5_SPAWN_CHANCE,
} from "./config.js";
import { mix, randomHouseRotation } from "./utils.js";

let house5SpawnedInSession = false;
let house5LastRollTick = -9999;

export function resetDimen2State() {
  house5SpawnedInSession = false;
  house5LastRollTick = -9999;
}

export function trySpawnHouse5NearPlayer(dim, player, currentTick) {
  if (house5SpawnedInSession || !dim || !player) return false;
  if (currentTick - house5LastRollTick < 20) return false;
  house5LastRollTick = currentTick;
  if (Math.random() > HOUSE5_SPAWN_CHANCE) return false;
  const px = Math.floor(player.location.x);
  const pz = Math.floor(player.location.z);
  const angle = Math.random() * Math.PI * 2;
  const dist = 16 + Math.random() * Math.max(12, HOUSE5_SPAWN_RADIUS - 16);
  const ox = px + Math.round(Math.cos(angle) * dist);
  const oz = pz + Math.round(Math.sin(angle) * dist);
  const rot = randomHouseRotation();
  try {
    dim.runCommand(`fill ${ox - 1} ${GROUND_Y} ${oz - 1} ${ox + 10} ${GROUND_Y + 12} ${oz + 10} air`);
    dim.runCommand(`fill ${ox - 1} ${GROUND_Y} ${oz - 1} ${ox + 10} ${GROUND_Y} ${oz + 10} grass_block`);
    dim.runCommand(`structure load ${HOUSE5_STRUCTURE_ID} ${ox} ${GROUND_Y + 1} ${oz} ${rot}`);
    house5SpawnedInSession = true;
    return true;
  } catch {
    return false;
  }
}

export function isCoarseDirtBlock(dim, loc) {
  if (!dim || !loc) return false;
  const isCoarseDirt = (id) =>
    typeof id === "string" && (id === "minecraft:coarse_dirt" || id === "coarse_dirt");
  try {
    const b = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y), z: Math.floor(loc.z) });
    if (b && isCoarseDirt(b.typeId)) return true;
    const below = dim.getBlock({ x: Math.floor(loc.x), y: Math.floor(loc.y) - 1, z: Math.floor(loc.z) });
    return !!(below && isCoarseDirt(below.typeId));
  } catch {
    return false;
  }
}

export function isSteveHeadItemOrBlock(typeId) {
  if (typeof typeId !== "string") return false;
  const lower = typeId.toLowerCase();
  return (
    lower.includes("player_head") ||
    lower.includes("steve_head") ||
    lower.includes("skull") ||
    lower.includes("head")
  );
}

// Chỉ tạo 1 lớp grass_block duy nhất tại GROUND_Y
export function placeFieldCell(dim, cx, cz, salt) {
  const x0 = cx * FIELD_CELL;
  const z0 = cz * FIELD_CELL;
  const x1 = x0 + FIELD_CELL - 1;
  const z1 = z0 + FIELD_CELL - 1;
  dim.runCommand(`fill ${x0} ${GROUND_Y} ${z0} ${x1} ${GROUND_Y} ${z1} grass_block`);
  const tx = x0 + (FIELD_CELL >> 1) - (TREE_SIZE >> 1);
  const firstZ =
    Math.ceil((z0 + (TREE_SIZE >> 1) - (TREE_Z_SPACING >> 1)) / TREE_Z_SPACING) * TREE_Z_SPACING +
    (TREE_Z_SPACING >> 1) -
    (TREE_SIZE >> 1);
  for (let tz = firstZ; tz + TREE_SIZE - 1 <= z1; tz += TREE_Z_SPACING) {
    const treeRot = (mix(tx, tz, salt + 7) % 4) * 90;
    dim.runCommand(`structure load dream:tree ${tx} ${GROUND_Y + 1} ${tz} ${treeRot}`);
  }
  if (cx === 0 && cz === 0) {
    const rot = randomHouseRotation();
    dim.runCommand(`structure load ${GRAVE_STRUCTURE_ID} ${x0 + 18} ${GROUND_Y + 1} ${z0 + 18} ${rot}`);
  } else if (mix(cx, cz, salt + 43) % 100 < GRAVE_SPAWN_PERCENT) {
    const rot = randomHouseRotation();
    dim.runCommand(`structure load ${GRAVE_STRUCTURE_ID} ${x0 + 18} ${GROUND_Y + 1} ${z0 + 18} ${rot}`);
  }
  if (!(cx === 0 && cz === 0) && mix(cx, cz, salt + 11) % 100 < FIELD_HOUSE_PERCENT) {
    const type = (mix(cx, cz, salt + 23) % 4) + 1;
    const houseRot = randomHouseRotation();
    dim.runCommand(`structure load dream:dream_house_${type} ${x0 + 10} ${GROUND_Y + 1} ${z0 + 10} ${houseRot}`);
  }
  if (!(cx === 0 && cz === 0) && mix(cx, cz, salt + 71) % 100 < FIELD_EXTRA_STRUCT_PERCENT) {
    const structRot = randomHouseRotation();
    dim.runCommand(`structure load ${FIELD_EXTRA_STRUCT_ID} ${x0 + 28} ${GROUND_Y + 1} ${z0 + 12} ${structRot}`);
  }
}