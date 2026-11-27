import { system } from "@minecraft/server";
import { DIM4_DURATION_TICKS } from "./config.js";
import { valid, findPlayer, inTown, inFields, inHills, inSea } from "./utils.js";
import { isInsideCorruptedHouse } from "./dimen3.js";

const storyProgress = new Map();
const townIntroTimers = new Map();
const fieldIntroTimers = new Map();
const fieldAdvanceTimers = new Map();
const fieldReadyToAdvance = new Set();
const hillsIntroTimers = new Map();
const corruptedHouseTimers = new Map();
const corruptedTriggeredPlayers = new Set();
const fallingToDim4Players = new Set();
export const hillsDoneReadyToAdvance = new Set();
const seaEndTimers = new Map();

export function getStoryState(playerName) {
  if (!storyProgress.has(playerName)) {
    storyProgress.set(playerName, {
      cluesFound: 0,
      solvedPuzzles: new Set(),
      chapter: 1,
    });
  }
  return storyProgress.get(playerName);
}

function clearHandleList(map, key) {
  const handles = map.get(key);
  if (!handles) return;
  for (const h of handles) {
    try {
      system.clearRun(h);
    } catch {}
  }
  map.delete(key);
}

export function clearTownIntro(playerName) {
  clearHandleList(townIntroTimers, playerName);
}

export function clearFieldSequence(playerName) {
  clearHandleList(fieldIntroTimers, playerName);
  clearHandleList(fieldAdvanceTimers, playerName);
  fieldReadyToAdvance.delete(playerName);
}

export function clearHillsSequence(playerName) {
  clearHandleList(hillsIntroTimers, playerName);
  clearHandleList(corruptedHouseTimers, playerName);
  corruptedTriggeredPlayers.delete(playerName);
  fallingToDim4Players.delete(playerName);
  hillsDoneReadyToAdvance.delete(playerName);
}

export function clearSeaSequence(playerName) {
  clearHandleList(seaEndTimers, playerName);
}

export function clearAllStoryTimers(playerName) {
  clearTownIntro(playerName);
  clearFieldSequence(playerName);
  clearHillsSequence(playerName);
  clearSeaSequence(playerName);
}

export function isFallingToDim4(playerName) {
  return fallingToDim4Players.has(playerName);
}

export function markHillsDropLanded(playerName) {
  fallingToDim4Players.delete(playerName);
  hillsDoneReadyToAdvance.add(playerName);
}

export function triggerTownIntro(player) {
  clearTownIntro(player.name);
  const name = player.name;
  const say = (msg) => {
    try {
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inTown(pl)) {
        clearTownIntro(name);
        return;
      }
      pl.sendMessage(msg);
    } catch {}
  };
  say("ụa đầu tôi nhức quá");
  const h1 = system.runTimeout(() => {
    say("mà đây là đâu?");
  }, 100); // +5s
  const h2 = system.runTimeout(() => {
    say(" có thứ gì đó khác thường ở đây");
    clearTownIntro(name);
  }, 500); // +20s sau câu 2
  townIntroTimers.set(name, [h1, h2]);
}

export function triggerFieldIntro(player) {
  clearFieldSequence(player.name);
  const name = player.name;
  const h = system.runTimeout(() => {
    fieldIntroTimers.delete(name);
    try {
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inFields(pl)) return;
      pl.sendMessage("lại đâu nữa đây?");
    } catch {}
  }, 60); // +3s
  fieldIntroTimers.set(name, [h]);
}

export function triggerCoarseDirtSkullPlaced(player, onTeleportToDim3) {
  const name = player.name;
  const plNow = findPlayer(name);
  if (!plNow || !valid(plNow) || !inFields(plNow)) return;
  if (fieldAdvanceTimers.has(name) || fieldReadyToAdvance.has(name)) return;
  getStoryState(name).solvedPuzzles.add("dimen2_coarse_dirt_steve_head");
  const sayIfStillHere = (msg) => {
    try {
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inFields(pl)) {
        clearFieldSequence(name);
        return false;
      }
      pl.sendMessage(msg);
      return true;
    } catch {
      return false;
    }
  };
  if (!sayIfStillHere("...")) return;
  const hLine2 = system.runTimeout(() => {
    if (!sayIfStillHere("là do cậu ấy sai trước mà")) return;
    const hTele = system.runTimeout(() => {
      fieldAdvanceTimers.delete(name);
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inFields(pl)) return;
      fieldReadyToAdvance.add(name);
      try {
        onTeleportToDim3?.(pl);
      } catch {}
    }, 200); // +10s
    fieldAdvanceTimers.set(name, [hLine2, hTele]);
  }, 40);
  fieldAdvanceTimers.set(name, [hLine2]);
}

export function triggerHillsIntro(player) {
  clearHillsSequence(player.name);
  const name = player.name;
  const h = system.runTimeout(() => {
    hillsIntroTimers.delete(name);
    try {
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inHills(pl)) return;
      pl.sendMessage("thật là 1 nơi kì lạ");
    } catch {}
  }, 60); // +3s
  hillsIntroTimers.set(name, [h]);
}

export function triggerCorruptedPinkHouseEntered(player) {
  const name = player.name;
  const plNow = findPlayer(name);
  if (!plNow || !valid(plNow) || !inHills(plNow)) return;
  if (corruptedTriggeredPlayers.has(name) || corruptedHouseTimers.has(name) || fallingToDim4Players.has(name)) {
    return;
  }
  corruptedTriggeredPlayers.add(name);
  try {
    plNow.sendMessage("§dĐầu bạn bỗng đau nhức dữ dội, mọi thứ trước mắt quay cuồng chóng mặt...");
    plNow.addEffect("nausea", 240, { amplifier: 1, showParticles: false });
    plNow.addEffect("blindness", 120, { amplifier: 0, showParticles: false });
  } catch {}
  const hDrop = system.runTimeout(() => {
    corruptedHouseTimers.delete(name);
    try {
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inHills(pl) || !isInsideCorruptedHouse(pl.location)) {
        corruptedTriggeredPlayers.delete(name);
        return;
      }
      const loc = pl.location;
      fallingToDim4Players.add(name);
      pl.teleport({ x: loc.x, y: 200, z: loc.z }, { dimension: pl.dimension });
    } catch {
      fallingToDim4Players.delete(name);
    }
  }, 200); // +10s
  corruptedHouseTimers.set(name, [hDrop]);
}

export function triggerSeaSequence(player, onSendBack) {
  clearSeaSequence(player.name);
  const name = player.name;
  const hNausea = system.runTimeout(() => {
    try {
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inSea(pl)) return;
      pl.addEffect("nausea", 160, { amplifier: 1, showParticles: false });
      pl.sendMessage("§7Cơn buồn nôn ập đến...");
    } catch {}
  }, DIM4_DURATION_TICKS);
  const hWake = system.runTimeout(() => {
    seaEndTimers.delete(name);
    try {
      const pl = findPlayer(name);
      if (!pl || !valid(pl) || !inSea(pl)) return;
      onSendBack?.(pl);
    } catch {}
  }, DIM4_DURATION_TICKS + 40);
  seaEndTimers.set(name, [hNausea, hWake]);
}

export function onPlayerEnteredPhase(player, phase, onSendBack) {
  if (phase === "town") {
    clearFieldSequence(player.name);
    clearHillsSequence(player.name);
    clearSeaSequence(player.name);
    triggerTownIntro(player);
  } else if (phase === "fields") {
    clearTownIntro(player.name);
    clearHillsSequence(player.name);
    clearSeaSequence(player.name);
    triggerFieldIntro(player);
  } else if (phase === "hills") {
    clearTownIntro(player.name);
    clearFieldSequence(player.name);
    clearSeaSequence(player.name);
    triggerHillsIntro(player);
  } else if (phase === "sea") {
    clearTownIntro(player.name);
    clearFieldSequence(player.name);
    clearHillsSequence(player.name);
    triggerSeaSequence(player, onSendBack);
  } else {
    clearAllStoryTimers(player.name);
  }
}

export function canAdvanceFromTown(_player) {
  return false;
}

export function canAdvanceFromFields(player) {
  return fieldReadyToAdvance.has(player.name);
}

export function canAdvanceFromHills(player) {
  return hillsDoneReadyToAdvance.has(player.name);
}

export function canAdvanceFromSea(_player) {
  return false;
}