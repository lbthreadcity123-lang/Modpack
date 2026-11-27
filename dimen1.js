import { world } from "@minecraft/server";
import {
  CELL_X,
  CELL_Z,
  BASE_Y,
  RARE_ODDS,
  CORRUPTED_TOWN_PERCENT,
  CORRUPTED_TOWN_ID,
  MUSIC,
  MUSIC_VOLUME,
} from "./config.js";
import { inTown, mix } from "./utils.js";

const town2Heard = new Map();

export function resetDimen1State() {
  town2Heard.clear();
}

export function pickTownStructure(cx, cz, salt) {
  if (cx === 0 && cz === 0) return "dream:town_1";
  const roll = mix(cx, cz, salt) % 1000;
  if (roll < CORRUPTED_TOWN_PERCENT * 10) return CORRUPTED_TOWN_ID;
  return mix(cx, cz, salt + 3) % RARE_ODDS === 0 ? "dream:town_2" : "dream:town_1";
}

export function placeTownCell(dim, cx, cz, salt) {
  const x0 = cx * CELL_X;
  const z0 = cz * CELL_Z;
  dim.runCommand(`structure load ${pickTownStructure(cx, cz, salt)} ${x0} ${BASE_Y} ${z0}`);
}

export function tickTownAudio(townBuiltSet, salt) {
  for (const p of world.getAllPlayers()) {
    if (!inTown(p)) continue;
    const cx = Math.floor(p.location.x / CELL_X);
    const cz = Math.floor(p.location.z / CELL_Z);
    const key = `${cx},${cz}`;
    if (!townBuiltSet.has(key) || pickTownStructure(cx, cz, salt) !== "dream:town_2") continue;
    let heard = town2Heard.get(p.name);
    if (!heard) {
      heard = new Set();
      town2Heard.set(p.name, heard);
    }
    if (heard.has(key)) continue;
    heard.add(key);
    try {
      p.playMusic(MUSIC[Math.floor(Math.random() * MUSIC.length)], {
        volume: MUSIC_VOLUME,
        fade: 0,
        loop: false,
      });
    } catch (err) {
      console.warn("dream town2 music: " + err);
    }
  }
}