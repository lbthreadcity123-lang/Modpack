export const DIM1_ID = "dream:town";
export const DIM2_ID = "dream:world2";
export const DIM3_ID = "dream:world3";
export const DIM4_ID = "dream:world4";
export const OVERWORLD = "minecraft:overworld";

// Load liên tục theo phạm vi chunk của người chơi (1 chunk = 16 block)
export const LOAD_CHUNKS = 8;
export const MIN_LOAD_RANGE = 112;
export const LOAD_INTERVAL = 1;

// Bán kính ô tải trước khi vào / chuyển sang từng dimension (2 => lưới 5x5 ô)
export const TOWN_PRELOAD_RADIUS = 2;
export const FIELD_PRELOAD_RADIUS = 2;
export const HILLS_PRELOAD_RADIUS = 2;
export const SEA_PRELOAD_RADIUS = 2;

// Dimen 1: Thị trấn + Corrupted Town
export const CELL_X = 45;
export const CELL_Z = 50;
export const CELL_H = 30;
export const BASE_Y = 60;
export const PLACE_PER_RUN = 4;
export const CHECK_PER_RUN = 32;
export const RARE_ODDS = 200;
export const CORRUPTED_TOWN_PERCENT = 12;
export const CORRUPTED_TOWN_ID = "dream:corrupted_town";
export const SPAWN = { x: 22, y: BASE_Y + 12, z: 25 };

// Dimen 2: Cánh đồng 1 lớp grass_block + Mộ + dream:house_5 spawn 1 lần + dream:structure_1
export const FIELD_CELL = 50;
export const GROUND_Y = 64;
export const TREE_SIZE = 5;
export const FIELD_SPAWN = { x: 31, y: GROUND_Y + 1, z: 25 };
export const FIELD_PLACE_PER_RUN = 12;
export const FIELD_HOUSE_PERCENT = 35;
export const FIELD_EXTRA_STRUCT_PERCENT = 15;
export const FIELD_EXTRA_STRUCT_ID = "dream:structure_1";
export const TREE_Z_SPACING = 30;
export const GRAVE_STRUCTURE_ID = "dream:gravel";
export const GRAVE_SPAWN_PERCENT = 20;
export const HOUSE5_STRUCTURE_ID = "dream:house_5";
export const HOUSE5_SPAWN_RADIUS = 55;
export const HOUSE5_SPAWN_CHANCE = 0.08;

// Dimen 3: Mặt phẳng 1 block grass_block + Pink House (1..30, cách 30 block) + Corrupted Pink House
export const HILLS_TILE = 60;
export const HILLS_GROUND_Y = 64;
export const HILLS_SPAWN = { x: 15, y: HILLS_GROUND_Y + 2, z: 15 };
export const HILLS_PLACE_PER_RUN = 5;
export const HOUSE3_GRID = 30;
export const HOUSE3_SIZE = 10;
export const HOUSE3_TYPES = 3;
export const HOUSE3_MIN_HEIGHT = 1;
export const HOUSE3_MAX_HEIGHT = 30;
export const PINKHOUSE_CHANCE = 0.65;
export const CORRUPTED_HOUSE_ID = "dream:corruptedpinkhouse";
export const CORRUPTED_HOUSE_CHANCE = 0.2;
export const FALL_WAKE_Y = HILLS_GROUND_Y + 2;

// Dimen 4: Biển đêm vô tận (y=-1 stone, y=0 water), hàng stonehouse 1..3 dài vô tận, dream:lamp
export const SEA_TILE = 64;
export const SEA_STONE_Y = -1;
export const SEA_WATER_Y = 0;
export const SEA_SPAWN = { x: 8, y: SEA_WATER_Y + 2, z: 8 };
export const SEA_PLACE_PER_RUN = 5;
export const SEA_LAMP_CHANCE = 0.22;
export const LAMP_STRUCTURE_ID = "dream:lamp";
export const STONEHOUSE_ROW_STEP = 18;
export const STONEHOUSE_ROW_Z = 28;
export const STONEHOUSE_TYPES = 3;
export const DIM4_DURATION_TICKS = 2400; // 2 phút = 2400 ticks

// Thời gian & ngủ vào giấc mơ
export const RETURN_STAGGER = 60;
export const SLEEP_NEEDED = 60;
export const SLEEP_CHECK = 10;
export const NIGHT_FROM = 12542;
export const NIGHT_TO = 23459;
export const ALLOW_ENTER_COMMAND = true;

// Âm thanh & Stalker
export const ROLL_EVERY = 200;
export const ROLL_CHANCE = 0.30;
export const FOOTSTEP_VS_MUSIC = 0.5;
export const STALKER_TICKS = 300;
export const STEP = 5;
export const FOLLOW_DISTANCE = 6;
export const FOOTSTEP_CLIPS = 15;
export const MUSIC = [
  "dream.music.wrong_place",
  "dream.music.spooky",
  "dream.music.drone",
  "dream.music.lurking",
  "dream.music.flesh",
  "dream.music.cave_mc",
  "dream.music.scary_cave",
  "dream.music.silly_loop",
  "dream.music.ghostly",
];

// Âm lượng (tăng lên cho to hơn)
export const MUSIC_VOLUME = 2.5;
export const FOOTSTEP_VOLUME = 4;

// Cứu rơi & Void
export const RESCUE_DROP = 2;
export const VOID_TRIGGER_Y = -60;
export const DREAM_TIMES = Object.freeze({
  town: 14000,
  fields: 1000,
  hills: 13000,
  sea: 15000,
});