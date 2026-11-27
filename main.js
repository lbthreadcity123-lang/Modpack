import {
  world,
  system,
  Player,
  EntityDamageCause,
  CommandPermissionLevel,
  CustomCommandStatus,
} from "@minecraft/server";

import {
  DIM1_ID,
  DIM2_ID,
  DIM3_ID,
  DIM4_ID,
  OVERWORLD,
  LOAD_INTERVAL,
  TOWN_PRELOAD_RADIUS,
  FIELD_PRELOAD_RADIUS,
  HILLS_PRELOAD_RADIUS,
  SEA_PRELOAD_RADIUS,
  CELL_X,
  CELL_Z,
  CELL_H,
  BASE_Y,
  PLACE_PER_RUN,
  CHECK_PER_RUN,
  SPAWN,
  FIELD_CELL,
  GROUND_Y,
  FIELD_SPAWN,
  FIELD_PLACE_PER_RUN,
  HILLS_TILE,
  HILLS_GROUND_Y,
  HILLS_SPAWN,
  HILLS_PLACE_PER_RUN,
  HOUSE3_MAX_HEIGHT,
  FALL_WAKE_Y,
  SEA_TILE,
  SEA_STONE_Y,
  SEA_SPAWN,
  SEA_PLACE_PER_RUN,
  STONEHOUSE_ROW_STEP,
  RETURN_STAGGER,
  SLEEP_NEEDED,
  SLEEP_CHECK,
  NIGHT_FROM,
  NIGHT_TO,
  ALLOW_ENTER_COMMAND,
  ROLL_EVERY,
  ROLL_CHANCE,
  FOOTSTEP_VS_MUSIC,
  STALKER_TICKS,
  STEP,
  FOLLOW_DISTANCE,
  FOOTSTEP_CLIPS,
  MUSIC,
  RESCUE_DROP,
  VOID_TRIGGER_Y,
  DREAM_TIMES,
} from "./config.js";

import {
  valid,
  findPlayer,
  dimIs,
  inTown,
  inFields,
  inHills,
  inSea,
  inAnyDream,
  currentPhaseOfPlayer,
  getPlayerLoadRange,
  behindPlayer,
  withTimeout,
  preloadAreaAround,
  safe,
  newSalt,
} from "./utils.js";

import { resetDimen1State, placeTownCell, tickTownAudio } from "./dimen1.js";
import {
  resetDimen2State,
  trySpawnHouse5NearPlayer,
  isCoarseDirtBlock,
  isSteveHeadItemOrBlock,
  placeFieldCell,
} from "./dimen2.js";
import {
  resetDimen3State,
  placeHillsPlane,
  tickHillsHouses,
  isInsideCorruptedHouse,
} from "./dimen3.js";
import { resetDimen4State, placeSeaTile, ensureStoneHouseRowUpTo } from "./dimen4.js";
import {
  clearAllStoryTimers,
  isFallingToDim4,
  markHillsDropLanded,
  triggerCoarseDirtSkullPlaced,
  triggerCorruptedPinkHouseEntered,
  onPlayerEnteredPhase,
  canAdvanceFromTown,
  canAdvanceFromFields,
  canAdvanceFromHills,
  canAdvanceFromSea,
} from "./story.js";

let salt = newSalt();

// ================= ĐĂNG KÝ DIMENSION + LỆNH =================
system.beforeEvents.startup.subscribe((ev) => {
  for (const id of [DIM1_ID, DIM2_ID, DIM3_ID, DIM4_ID]) {
    safe("đăng ký dimension " + id, () => ev.dimensionRegistry.registerCustomDimension(id));
  }

  const asPlayer = (origin) => (origin.sourceEntity instanceof Player ? origin.sourceEntity : undefined);
  const fail = (message) => ({ status: CustomCommandStatus.Failure, message });
  const ok = { status: CustomCommandStatus.Success };

  safe("lệnh dream:enter", () =>
    ev.customCommandRegistry.registerCommand(
      {
        name: "dream:enter",
        description: "Vào giấc mơ (bắt đầu từ Dimen 1, dùng để test)",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const p = asPlayer(origin);
        if (!p) return fail("Chỉ người chơi mới dùng được.");
        if (!ALLOW_ENTER_COMMAND) return fail("Hãy ngủ vào ban đêm để vào giấc mơ.");
        if (inAnyDream(p)) return fail("Bạn đang ở trong giấc mơ rồi.");
        system.run(() => startSession([p], new Map()));
        return ok;
      }
    )
  );

  safe("lệnh dream:exit", () =>
    ev.customCommandRegistry.registerCommand(
      {
        name: "dream:exit",
        description: "Rời giấc mơ ngay",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const p = asPlayer(origin);
        if (!p) return fail("Chỉ người chơi mới dùng được.");
        if (!inAnyDream(p)) return fail("Bạn không ở trong giấc mơ.");
        system.run(() => {
          evacuateAll();
          resetWorld();
        });
        return ok;
      }
    )
  );

  safe("lệnh dream:test", () =>
    ev.customCommandRegistry.registerCommand(
      {
        name: "dream:test",
        description: "Test: chuyển ngay cả nhóm sang dimension kế tiếp (hoặc về Overworld nếu là chặng cuối)",
        permissionLevel: CommandPermissionLevel.Any,
        cheatsRequired: false,
      },
      (origin) => {
        const p = asPlayer(origin);
        if (!p) return fail("Chỉ người chơi mới dùng được.");
        const curPhase = currentPhaseOfPlayer(p);
        if (!curPhase) return fail("Bạn không ở trong giấc mơ.");
        const group = world.getAllPlayers().filter((pl) => currentPhaseOfPlayer(pl) === curPhase);
        system.run(() => advance(group, curPhase));
        return ok;
      }
    )
  );
});

// ================= DỰNG Ô THEO CHUNK =================
function makeLayer(cfg) {
  return {
    ...cfg,
    forcePerRun: cfg.forcePerRun ?? 6,
    built: new Set(),
    pending: new Map(),
    chain: Promise.resolve(),
  };
}

const town = makeLayer({
  name: "town",
  id: DIM1_ID,
  w: CELL_X,
  d: CELL_Z,
  y0: BASE_Y,
  h: CELL_H,
  forcePerRun: 10,
  perRun: PLACE_PER_RUN,
  place: (dim, cx, cz) => placeTownCell(dim, cx, cz, salt),
});

const fields = makeLayer({
  name: "fields",
  id: DIM2_ID,
  w: FIELD_CELL,
  d: FIELD_CELL,
  y0: GROUND_Y,
  h: 10,
  forcePerRun: 10,
  perRun: FIELD_PLACE_PER_RUN,
  place: (dim, cx, cz) => placeFieldCell(dim, cx, cz, salt),
});

const hills = makeLayer({
  name: "hills",
  id: DIM3_ID,
  w: HILLS_TILE,
  d: HILLS_TILE,
  y0: HILLS_GROUND_Y,
  h: HOUSE3_MAX_HEIGHT + 16,
  forcePerRun: 10,
  perRun: HILLS_PLACE_PER_RUN,
  place: (dim, tx, tz) => placeHillsPlane(dim, tx, tz),
});

const sea = makeLayer({
  name: "sea",
  id: DIM4_ID,
  w: SEA_TILE,
  d: SEA_TILE,
  y0: SEA_STONE_Y,
  h: 18,
  forcePerRun: 10,
  perRun: SEA_PLACE_PER_RUN,
  place: (dim, tx, tz) => placeSeaTile(dim, tx, tz, salt),
});

function layerOf(phase) {
  if (phase === "town") return town;
  if (phase === "fields") return fields;
  if (phase === "hills") return hills;
  return sea;
}

function spawnOf(phase) {
  if (phase === "town") return SPAWN;
  if (phase === "fields") return FIELD_SPAWN;
  if (phase === "hills") return HILLS_SPAWN;
  return SEA_SPAWN;
}

function preloadRadiusOf(phase) {
  if (phase === "town") return TOWN_PRELOAD_RADIUS;
  if (phase === "fields") return FIELD_PRELOAD_RADIUS;
  if (phase === "hills") return HILLS_PRELOAD_RADIUS;
  return SEA_PRELOAD_RADIUS;
}

function cellLoaded(L, dim, x0, z0) {
  const y = L.y0 + 1;
  const pts = [
    [x0 + 2, z0 + 2],
    [x0 + L.w - 3, z0 + 2],
    [x0 + 2, z0 + L.d - 3],
    [x0 + L.w - 3, z0 + L.d - 3],
    [x0 + (L.w >> 1), z0 + (L.d >> 1)],
  ];
  try {
    return pts.every(([x, z]) => dim.getBlock({ x, y, z }) !== undefined);
  } catch {
    return false;
  }
}

async function buildCell(L, cx, cz, key) {
  const dim = world.getDimension(L.id);
  const x0 = cx * L.w;
  const z0 = cz * L.d;
  const areaId = `dream_${L.name}_${cx}_${cz}`;
  try {
    try {
      world.tickingAreaManager.removeTickingArea(areaId);
    } catch {}
    await world.tickingAreaManager.createTickingArea(areaId, {
      dimension: dim,
      from: { x: x0, y: L.y0, z: z0 },
      to: { x: x0 + L.w - 1, y: L.y0 + L.h - 1, z: z0 + L.d - 1 },
    });
    L.place(dim, cx, cz);
    L.built.add(key);
  } finally {
    try {
      world.tickingAreaManager.removeTickingArea(areaId);
    } catch {}
  }
}

function ensureCell(L, cx, cz) {
  const key = `${cx},${cz}`;
  if (L.built.has(key)) return Promise.resolve();
  if (L.pending.has(key)) return L.pending.get(key);
  const job = L.chain.then(() => withTimeout(buildCell(L, cx, cz, key), 600));
  L.chain = job.catch(() => {});
  L.pending.set(key, job);
  job.then(
    () => L.pending.delete(key),
    () => {
      L.pending.delete(key);
      system.runTimeout(() => {
        if (!L.built.has(key) && !L.pending.has(key)) {
          ensureCell(L, cx, cz).catch(() => {});
        }
      }, 40);
    }
  );
  return job;
}

function ensureRing(L, cx, cz) {
  const jobs = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++)
      jobs.push(ensureCell(L, cx + dx, cz + dz).catch(() => {}));
  return withTimeout(Promise.all(jobs), 400);
}

function loadAround(L) {
  const players = world.getAllPlayers().filter((p) => dimIs(p, L.id));
  if (players.length === 0) return;
  const dim = world.getDimension(L.id);
  const wanted = new Map();

  for (const p of players) {
    const range = getPlayerLoadRange(p);
    const px = p.location.x;
    const pz = p.location.z;
    const pcx = Math.floor(px / L.w);
    const pcz = Math.floor(pz / L.d);
    const r = Math.ceil(range / Math.min(L.w, L.d)) + 1;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        const key = `${cx},${cz}`;
        if (L.built.has(key) || L.pending.has(key)) continue;
        const d = Math.hypot((cx + 0.5) * L.w - px, (cz + 0.5) * L.d - pz);
        if (d > range) continue;
        const old = wanted.get(key);
        if (!old || d < old.d) wanted.set(key, { cx, cz, d, key });
      }
    }
  }

  const list = [...wanted.values()].sort((a, b) => a.d - b.d);

  let forced = 0;
  for (const c of list) {
    if (forced >= L.forcePerRun) break;
    if (c.d > Math.min(L.w, L.d) * 1.8) break;
    if (L.built.has(c.key) || L.pending.has(c.key)) continue;
    forced++;
    ensureCell(L, c.cx, c.cz).catch(() => {});
  }

  let placed = 0;
  let checked = 0;
  for (const c of list) {
    if (placed >= L.perRun || checked >= CHECK_PER_RUN) break;
    if (L.built.has(c.key) || L.pending.has(c.key)) continue;
    checked++;
    if (!cellLoaded(L, dim, c.cx * L.w, c.cz * L.d)) continue;
    try {
      L.place(dim, c.cx, c.cz);
      L.built.add(c.key);
      placed++;
    } catch {}
  }
}

system.runInterval(() => {
  loadAround(town);
  loadAround(fields);
  loadAround(hills);
  loadAround(sea);
}, LOAD_INTERVAL);

system.runInterval(() => {
  tickHillsHouses(hills.built, salt);
}, 2);

system.runInterval(() => {
  const now = system.currentTick;
  const fieldDim = world.getDimension(DIM2_ID);
  const seaDim = world.getDimension(DIM4_ID);

  for (const p of world.getAllPlayers()) {
    if (inFields(p)) {
      trySpawnHouse5NearPlayer(fieldDim, p, now);
    } else if (inHills(p)) {
      if (isFallingToDim4(p.name) && p.location.y <= FALL_WAKE_Y) {
        markHillsDropLanded(p.name);
        const hillsGroup = world.getAllPlayers().filter((pl) => valid(pl) && inHills(pl));
        advance(hillsGroup.length > 0 ? hillsGroup : [p], "hills");
      } else if (isInsideCorruptedHouse(p.location)) {
        triggerCorruptedPinkHouseEntered(p);
      }
    } else if (inSea(p)) {
      const idx = Math.floor(p.location.x / STONEHOUSE_ROW_STEP);
      ensureStoneHouseRowUpTo(seaDim, idx, sea.built, salt);
    }
  }
}, 2);

system.runInterval(() => {
  tickTownAudio(town.built, salt);
}, 10);

function resetWorld() {
  town.built.clear();
  fields.built.clear();
  hills.built.clear();
  sea.built.clear();
  resetDimen1State();
  resetDimen2State();
  resetDimen3State();
  resetDimen4State();
  salt = newSalt();
}

// ================= GIẤC MƠ: VÀO / CHUYỂN CẢNH THEO ĐIỀU KIỆN / TRẢ VỀ =================
const ALL_PHASES = ["town", "fields", "hills", "sea"];
const PHASE_CFG = {
  town: { dim: DIM1_ID, in: inTown },
  fields: { dim: DIM2_ID, in: inFields },
  hills: { dim: DIM3_ID, in: inHills },
  sea: { dim: DIM4_ID, in: inSea },
};
const CAN_ADVANCE = {
  town: canAdvanceFromTown,
  fields: canAdvanceFromFields,
  hills: canAdvanceFromHills,
  sea: canAdvanceFromSea,
};

const returnInfo = new Map();
const schedule = new Map();
let starting = false;
let savedMobSpawning;
let savedDayTime;
let savedDayLightCycle;

function nextPhaseOf(currentPhase) {
  const idx = ALL_PHASES.indexOf(currentPhase);
  if (idx === -1 || idx + 1 >= ALL_PHASES.length) return null;
  return ALL_PHASES[idx + 1];
}

function currentSpot(p) {
  const l = p.location;
  return { x: l.x, y: l.y, z: l.z, dim: p.dimension.id };
}

function setDayLightCycle(on) {
  try {
    world.gameRules.doDayLightCycle = on;
    return;
  } catch {}
  try {
    world.getDimension(OVERWORLD).runCommand(`gamerule dodaylightcycle ${on}`);
  } catch {}
}

function lockWorldTime() {
  if (savedDayTime !== undefined) return;
  try {
    savedDayTime = world.getTimeOfDay();
  } catch {}
  try {
    savedDayLightCycle = world.gameRules.doDayLightCycle;
  } catch {
    savedDayLightCycle = true;
  }
  setDayLightCycle(false);
}

function setDreamWorldTime(phase) {
  try {
    world.setTimeOfDay(DREAM_TIMES[phase] ?? 1000);
  } catch {}
}

function unlockWorldTime() {
  if (savedDayTime === undefined) return;
  const time = savedDayTime;
  const cycle = savedDayLightCycle ?? true;
  savedDayTime = undefined;
  savedDayLightCycle = undefined;
  try {
    world.setTimeOfDay(time);
  } catch {}
  setDayLightCycle(cycle);
}

function restoreWorldTimeIfNoDream() {
  if (!world.getAllPlayers().some(inAnyDream)) unlockWorldTime();
}

function defaultSpot() {
  const d = world.getDefaultSpawnLocation();
  return { x: d.x, y: d.y, z: d.z, dim: OVERWORLD };
}

function persistSpot(p, spot) {
  try {
    p.setDynamicProperty("dream:return", JSON.stringify(spot));
  } catch {}
}

function loadSpot(p) {
  try {
    const s = p.getDynamicProperty("dream:return");
    return typeof s === "string" ? JSON.parse(s) : undefined;
  } catch {
    return undefined;
  }
}

function clearSpot(p) {
  try {
    p.setDynamicProperty("dream:return", undefined);
  } catch {}
}

function sendBack(player) {
  const name = player.name;
  const spot = returnInfo.get(name) ?? loadSpot(player) ?? defaultSpot();
  returnInfo.delete(name);
  schedule.delete(name);
  endStalker(name);
  clearAllStoryTimers(name);
  try {
    player.teleport(
      { x: spot.x, y: spot.y, z: spot.z },
      { dimension: world.getDimension(spot.dim ?? OVERWORLD) }
    );
    clearSpot(player);
    player.sendMessage("§7Bạn giật mình tỉnh dậy...");
    restoreWorldTimeIfNoDream();
  } catch (err) {
    player.sendMessage("§cKhông trả về được: " + err);
  }
}

function evacuateAll() {
  for (const p of world.getAllPlayers()) {
    if (inAnyDream(p)) sendBack(p);
  }
  schedule.clear();
}

async function startSession(players, spots) {
  if (starting) return;
  starting = true;
  try {
    const list = players.filter(valid);
    lockMobSpawning();
    lockWorldTime();
    if (!world.getAllPlayers().some(inAnyDream)) resetWorld();

    const startPhase = "town";
    for (const p of list) {
      const spot = spots.get(p.name) ?? currentSpot(p);
      returnInfo.set(p.name, spot);
      persistSpot(p, spot);
      p.sendMessage("§5Bạn chìm vào giấc mơ...");
    }

    const L = layerOf(startPhase);
    await ensureRing(L, 0, 0);
    await preloadAreaAround(L, 0, 0, preloadRadiusOf(startPhase), (cx, cz) => ensureCell(L, cx, cz));

    const dim = world.getDimension(PHASE_CFG[startPhase].dim);
    const spawn = spawnOf(startPhase);
    setDreamWorldTime(startPhase);

    list.forEach((p, i) => {
      if (!valid(p)) return;
      p.teleport(
        { x: spawn.x + (i % 3) * 2, y: spawn.y, z: spawn.z + Math.floor(i / 3) * 2 },
        { dimension: dim }
      );
      p.addEffect("slow_falling", 200, { showParticles: false });
      schedule.set(p.name, { phase: startPhase });
      onPlayerEnteredPhase(p, startPhase, sendBack);
    });
  } catch (err) {
    for (const p of players) {
      if (valid(p)) p.sendMessage("§cKhông vào được giấc mơ: " + err);
    }
  } finally {
    starting = false;
  }
}

async function advance(players, from) {
  const to = nextPhaseOf(from);
  if (!to) {
    for (const p of players) {
      if (valid(p)) sendBack(p);
    }
    return;
  }
  for (const p of players) schedule.set(p.name, { phase: "moving" });
  try {
    const L = layerOf(to);
    const spawn = spawnOf(to);
    await ensureRing(L, 0, 0);
    await preloadAreaAround(L, 0, 0, preloadRadiusOf(to), (cx, cz) => ensureCell(L, cx, cz));

    setDreamWorldTime(to);
    const dim = world.getDimension(PHASE_CFG[to].dim);
    const isLast = nextPhaseOf(to) === null;

    players.forEach((p, i) => {
      if (!valid(p) || !PHASE_CFG[from].in(p)) {
        schedule.delete(p.name);
        return;
      }
      p.teleport(
        { x: spawn.x + (i % 3), y: spawn.y, z: spawn.z + Math.floor(i / 3) },
        { dimension: dim }
      );
      if (to !== "hills") {
        p.addEffect("slow_falling", 100, { showParticles: false });
      }
      if (to === "sea") {
        ensureStoneHouseRowUpTo(dim, 0, sea.built, salt);
      }
      endStalker(p.name);
      p.sendMessage("§5Giấc mơ đổi cảnh...");
      const stagger = isLast ? i * RETURN_STAGGER : 0;
      system.runTimeout(() => {
        if (valid(p) && PHASE_CFG[to].in(p)) {
          schedule.set(p.name, { phase: to });
          onPlayerEnteredPhase(p, to, sendBack);
        }
      }, stagger);
    });
  } catch (err) {
    for (const p of players) {
      if (!valid(p)) continue;
      p.sendMessage("§cKhông chuyển được sang chặng kế tiếp: " + err);
      sendBack(p);
    }
  }
}

system.runInterval(() => {
  const toMove = { town: [], fields: [], hills: [], sea: [] };
  for (const [name, s] of [...schedule]) {
    if (s.phase === "moving") continue;
    const p = findPlayer(name);
    if (!p || !valid(p) || !PHASE_CFG[s.phase].in(p)) {
      schedule.delete(name);
      returnInfo.delete(name);
      clearAllStoryTimers(name);
      if (p && valid(p)) clearSpot(p);
      continue;
    }
    if (CAN_ADVANCE[s.phase]?.(p)) {
      toMove[s.phase].push(p);
    }
  }

  for (const phase of ALL_PHASES) {
    if (toMove[phase].length > 0) advance(toMove[phase], phase);
  }

  if (!starting && !world.getAllPlayers().some(inAnyDream)) {
    if (town.built.size > 0 || fields.built.size > 0 || hills.built.size > 0 || sea.built.size > 0) {
      resetWorld();
    }
    unlockMobSpawning();
    unlockWorldTime();
  }
}, 10);

safe("playerSpawn", () =>
  world.afterEvents.playerSpawn.subscribe((ev) => {
    if (!ev.initialSpawn) return;
    const p = ev.player;
    system.runTimeout(() => {
      if (valid(p) && inAnyDream(p) && !schedule.has(p.name)) sendBack(p);
    }, 40);
  })
);

// ================= NGỦ ĐỂ VÀO GIẤC MƠ =================
const sleepTicks = new Map();
const sleepSpots = new Map();

function isNight() {
  const t = world.getTimeOfDay();
  return t >= NIGHT_FROM && t <= NIGHT_TO;
}

system.runInterval(() => {
  const players = world.getAllPlayers();
  const busy = starting || schedule.size > 0 || players.some(inAnyDream);
  if (players.length === 0 || busy || !isNight()) {
    sleepTicks.clear();
    sleepSpots.clear();
    return;
  }
  let everyoneSleeping = true;
  for (const p of players) {
    let sleeping = false;
    try {
      sleeping = p.isSleeping && p.dimension.id === OVERWORLD;
    } catch {}
    if (sleeping) {
      sleepTicks.set(p.name, (sleepTicks.get(p.name) ?? 0) + SLEEP_CHECK);
      sleepSpots.set(p.name, currentSpot(p));
    } else {
      sleepTicks.delete(p.name);
      sleepSpots.delete(p.name);
      everyoneSleeping = false;
    }
  }
  if (everyoneSleeping && players.every((p) => (sleepTicks.get(p.name) ?? 0) >= SLEEP_NEEDED)) {
    const spots = new Map(sleepSpots);
    sleepTicks.clear();
    sleepSpots.clear();
    startSession(players, spots);
  }
}, SLEEP_CHECK);

// ================= KHÔNG CHO MOB NÀO SPAWN =================
function setMobSpawning(on) {
  try {
    world.gameRules.doMobSpawning = on;
    return;
  } catch {}
  try {
    world.getDimension(OVERWORLD).runCommand(`gamerule domobspawning ${on}`);
  } catch {}
}

function lockMobSpawning() {
  if (savedMobSpawning === undefined) {
    let cur = true;
    try {
      cur = world.gameRules.doMobSpawning;
    } catch {}
    savedMobSpawning = cur;
    try {
      world.setDynamicProperty("dream:mobspawn", cur);
    } catch {}
  }
  setMobSpawning(false);
}

function unlockMobSpawning() {
  if (savedMobSpawning === undefined) return;
  setMobSpawning(savedMobSpawning);
  savedMobSpawning = undefined;
  try {
    world.setDynamicProperty("dream:mobspawn", undefined);
  } catch {}
}

safe("worldLoad", () =>
  world.afterEvents.worldLoad.subscribe(() => {
    try {
      const v = world.getDynamicProperty("dream:mobspawn");
      if (typeof v === "boolean") {
        setMobSpawning(v);
        world.setDynamicProperty("dream:mobspawn", undefined);
      }
    } catch {}
  })
);

system.runInterval(() => {
  if (!world.getAllPlayers().some(inAnyDream)) return;
  for (const id of [DIM1_ID, DIM2_ID, DIM3_ID, DIM4_ID]) {
    try {
      for (const e of world.getDimension(id).getEntities({ families: ["mob"] })) {
        try {
          e.remove();
        } catch {}
      }
    } catch {}
  }
}, 20);

// ================= CHẶN PHÁ/ĐẶT BLOCK + ĐẶT ĐẦU STEVE LÊN COARSE_DIRT =================
const warnedAt = new Map();

function warnOnce(player, text) {
  const now = system.currentTick;
  if (now - (warnedAt.get(player.name) ?? -999) < 40) return;
  warnedAt.set(player.name, now);
  system.run(() => {
    try {
      player.sendMessage(text);
    } catch {}
  });
}

safe("playerBreakBlock", () =>
  world.beforeEvents.playerBreakBlock.subscribe((ev) => {
    if (!inAnyDream(ev.player)) return;
    ev.cancel = true;
    warnOnce(ev.player, "§cKhông thể phá block ở đây.");
  })
);

safe("playerPlaceBlock", () =>
  world.beforeEvents.playerPlaceBlock.subscribe((ev) => {
    if (!inAnyDream(ev.player)) return;

    if (
      inFields(ev.player) &&
      isSteveHeadItemOrBlock(ev.itemStack?.typeId || ev.block?.typeId) &&
      isCoarseDirtBlock(ev.block.dimension, ev.block.location)
    ) {
      ev.cancel = false;
      system.run(() => {
        if (valid(ev.player) && inFields(ev.player)) {
          triggerCoarseDirtSkullPlaced(ev.player, (pl) => {
            if (valid(pl) && inFields(pl)) advance([pl], "fields");
          });
        }
      });
      return;
    }

    ev.cancel = true;
    warnOnce(ev.player, "§cKhông thể đặt block ở đây.");
  })
);

safe("afterPlayerPlaceBlock", () =>
  world.afterEvents.playerPlaceBlock.subscribe((ev) => {
    if (!inAnyDream(ev.player)) return;
    const id = ev.block.typeId;
    if (typeof id === "string" && id.includes("bed")) {
      system.run(() => {
        try {
          ev.block.dimension.setBlock(ev.block.location, { typeId: "air" });
          ev.player.sendMessage("§cGiường không hoạt động ở đây.");
        } catch {}
      });
    }
  })
);

safe("playerInteractWithBlock", () =>
  world.beforeEvents.playerInteractWithBlock.subscribe((ev) => {
    if (!inAnyDream(ev.player)) return;
    const id = ev.block.typeId;
    if (typeof id === "string" && id.includes("bed")) {
      ev.cancel = true;
      warnOnce(ev.player, "§cKhông thể sử dụng giường ở đây.");
    }
  })
);

// ================= LƯỚI CỨU RƠI & XỬ LÝ VOID =================
const voidCooldown = new Map();

function handleVoidFall(player) {
  const now = system.currentTick;
  if (now - (voidCooldown.get(player.name) ?? -999) < 40) return;
  voidCooldown.set(player.name, now);

  try {
    player.addEffect("instant_health", 2, { amplifier: 10, showParticles: false });
    player.addEffect("slow_falling", 200, { showParticles: false });
  } catch {}

  const curPhase = currentPhaseOfPlayer(player);
  const nxt = curPhase ? nextPhaseOf(curPhase) : null;

  if (curPhase && nxt) {
    player.sendMessage("§5Bạn rơi xuyên qua tầng mơ và trôi sang giấc mơ kế tiếp...");
    advance([player], curPhase);
  } else {
    player.sendMessage("§5...bạn kịp tỉnh lại trước khi rơi vào hư vô.");
    sendBack(player);
  }
}

safe("voidDamageGuard", () =>
  world.beforeEvents.entityHurt.subscribe((ev) => {
    if (!(ev.hurtEntity instanceof Player)) return;
    if (!inAnyDream(ev.hurtEntity)) return;
    if (isFallingToDim4(ev.hurtEntity.name)) return;
    if (ev.damageSource?.cause === EntityDamageCause.void) {
      ev.cancel = true;
      const p = ev.hurtEntity;
      system.run(() => {
        if (valid(p) && inAnyDream(p)) handleVoidFall(p);
      });
    }
  })
);

system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    if (isFallingToDim4(p.name)) continue;

    let L;
    if (inTown(p))        L = town;
    else if (inFields(p)) L = fields;
    else if (inHills(p))  L = hills;
    else if (inSea(p))    L = sea;
    else continue;

    if (p.location.y <= VOID_TRIGGER_Y || p.location.y <= L.y0 - RESCUE_DROP) {
      handleVoidFall(p);
    }
  }
}, 2);

// ================= ÂM THANH + ENTITY ĐI THEO =================
const stalkers = new Map();

function startStalker(player) {
  const e = player.dimension.spawnEntity("dream:stalker", behindPlayer(player, FOLLOW_DISTANCE));
  try {
    e.addEffect("invisibility", STALKER_TICKS + 60, { showParticles: false });
  } catch {}
  stalkers.set(player.name, { entity: e, left: STALKER_TICKS, sinceClip: 20, clip: 0 });
}

function endStalker(name) {
  const s = stalkers.get(name);
  if (!s) return;
  stalkers.delete(name);
  try {
    s.entity.remove();
  } catch {
    try {
      s.entity.kill();
    } catch {}
  }
}

system.runInterval(() => {
  for (const p of world.getAllPlayers()) {
    if (!inAnyDream(p)) continue;
    if (stalkers.has(p.name)) continue;
    if (Math.random() >= ROLL_CHANCE) continue;
    try {
      if (Math.random() < FOOTSTEP_VS_MUSIC) startStalker(p);
      else p.playMusic(MUSIC[Math.floor(Math.random() * MUSIC.length)], { volume: 1, fade: 0, loop: false });
    } catch (err) {
      console.warn("dream audio: " + err);
    }
  }
}, ROLL_EVERY);

system.runInterval(() => {
  for (const [name, s] of [...stalkers]) {
    const player = findPlayer(name);
    s.left -= STEP;
    if (!valid(player) || !inAnyDream(player) || !valid(s.entity) || s.left <= 0) {
      endStalker(name);
      continue;
    }
    try {
      const e = s.entity;
      const target = behindPlayer(player, FOLLOW_DISTANCE);
      const cur = e.location;
      e.teleport(
        {
          x: cur.x + (target.x - cur.x) * 0.4,
          y: player.location.y,
          z: cur.z + (target.z - cur.z) * 0.4,
        },
        { facingLocation: player.location }
      );
      s.sinceClip += STEP;
      if (s.sinceClip >= 20 && s.clip < FOOTSTEP_CLIPS) {
        player.playSound(`dream.footstep.${s.clip}`, { location: e.location, volume: 1 });
        s.clip++;
        s.sinceClip = 0;
      }
    } catch {
      endStalker(name);
    }
  }
}, STEP);
