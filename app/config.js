// Night Vibe Online Arena Combat Sandbox - Centralized & Dynamic Game Configurations

// ==========================================
// A. DEFAULT CONFIGURATIONS OBJECT
// ==========================================
const FALLBACK_DEFAULTS = {
  // 1. Player Movement (Simple)
  MOVE_SPEED: 3.0,

  // 2. Player Combat & Ranges
  RANGED_MAX_RANGE: 450,
  WARRIOR_MELEE_RANGE: 90,
  MAGICGLADIATOR_MELEE_RANGE: 80,
  MELEE_RANGE_LVL_SCALE_MULT: 0.6,
  E1_RANGE_ATK_EXPONENT: 1.0,

  // 3. Player Progression & Rebirth
  PLAYER_INITIAL_LEVEL: 1,
  PLAYER_INITIAL_KILLS: 0,
  PLAYER_INITIAL_STAT_POINTS: 0,
  PLAYER_INITIAL_RESETS: 0,
  LEVEL_UP_STAT_POINTS: 3,
  REQ_KILLS_BASE_MULT: 2,
  REQ_KILLS_EXPONENT: 1.3,
  REQ_KILLS_SIN_AMP: 0,
  REBIRTH_BASE_LEVEL: 4,
  REBIRTH_LEVEL_STEP: 5,
  REBIRTH_POINTS_PER_LEVEL: 3,
  LIMIT_LEVEL_TO_REBIRTH_REQ: true,

  // 4. Potions & Elixirs (Advanced Buffs)
  POTION_BUFF_DURATION: 10000,
  POTION_LIFESTEAL_PERCENT: 0.50,
  POTION_BLUE_BUFF_DURATION: 12000,
  POTION_BLUE_CD_MULTIPLIER: 4.0,

  // 5. Viewport & Display (Environmental)
  GAME_W: 2560,
  GAME_H: 1024,
  DEPTH_GROUND_TOP: 0.2,
  DEPTH_GROUND_BOTTOM: 1.0,
  GROUND_TOLERANCE: 30,
  DEAD_BODY_LIFETIME: 3500,
  DAY_CYCLE_DURATION: 115,

  // 6. Waves Setup
  GAME_INITIAL_WAVE: 1,
  GAME_INITIAL_KILLS: 0,
  GAME_INITIAL_WAVE_ENEMIES: 10,

  // 7. Enemy Dynamics & Timing
  ENEMY_SPAWN_INTERVAL: 300,
  ENEMY_SCALE_WAVE_MULT: 0.22,
  ENEMY_SCALE_LVL_MULT: 0.15,
  ENEMY_SKY_SPEED_MULTIPLIER: 2.5,
  ENEMY_ATTACK_COOLDOWN_BASE: 35,
  ENEMY_ATTACK_COOLDOWN_RAND: 20,

  // 8. Boss Balance
  BOSS_BASE_HP: 350,
  BOSS_BASE_ATK: 22,
  BOSS_BASE_SPEED: 0.25,
  BOSS_BASE_SIZE: 52,
  BOSS_BASE_COLOR: '#8e44ad',
  BOSS_ATTACK_COOLDOWN: 60,
  BOSS_WAVE_INTERVAL: 5,
  BOSS_SPAWN_INCREMENT: 1,
  BOSS_LASER_CHANNEL_TIME: 80,
  BOSS_LASER_DAMAGE_INTERVAL: 300,
  BOSS_LASER_DAMAGE_PER_SEC: 25,
  BOSS_LASER_DAMAGE_LEVEL_SCALE: 6,
  BOSS_PROJECTILE_SPEED: 10.0,
  BOSS_PROJECTILE_HOMING: false,
  BOSS_PROJECTILE_LIFETIME: 0,

  // 9. Projectile Collision Size
  PROJ_HIT_RADIUS_ARROW: 12,
  PROJ_HIT_RADIUS_BOLT: 10,
  PROJ_HIT_RADIUS_DEFAULT: 15,

  // 10. Social, Chat & Network
  CHAT_MESSAGE_DURATION: 5000,
  CHAT_FADE_OUT_DURATION: 500,
  NETWORK_ROOM_NAME: 'Night-Vibe-Online-Arena',

  // 11. Inventory & Gear
  EQUIPMENT_SLOTS: 'Weapon,Armor,Ring 1,Ring 2,Amulet',

  // 12. Gear Drops & Stats
  GEAR_DROP_RATE: 0.10,
  GEAR_RARITY_NORMAL: 0.50,
  GEAR_RARITY_MAGIC: 0.35,
  GEAR_RARITY_RARE: 0.15,
  GEAR_STAT_MULTIPLIER: 1.2,
  GEAR_STAT_VARIANCE: 0.15,
  GEAR_DROP_ONLY_BOSS: true,
  CLEAR_ITEMS_ON_START: true,
  POTION_RED_DROP_CHANCE: 0.15,
  POTION_BLUE_DROP_CHANCE: 0.08
};

export let DEFAULTS = { ...FALLBACK_DEFAULTS };
try {
  const xhr = new XMLHttpRequest();
  xhr.open('GET', 'configs/default.json', false); // false makes the request synchronous
  xhr.send(null);
  if (xhr.status === 200) {
    const loadedDefaults = JSON.parse(xhr.responseText);
    DEFAULTS = { ...FALLBACK_DEFAULTS, ...loadedDefaults };
    // Prevent nulls (from generated JSON files) from breaking the equipment slots UI
    if (!DEFAULTS.EQUIPMENT_SLOTS) {
        DEFAULTS.EQUIPMENT_SLOTS = FALLBACK_DEFAULTS.EQUIPMENT_SLOTS;
    }
  }
} catch (error) {
  console.warn("Could not load configs/default.json synchronously, using hardcoded fallback", error);
}

// ==========================================
// B. METADATA FOR DYNAMIC SETTINGS UI GENERATION
// ==========================================
export const CONFIG_METADATA = {
  // 1. Player Movement (Simple)
  MOVE_SPEED: { label: "Global Move Speed", type: "number", min: 0.5, max: 10, step: 0.1, category: "Player Movement" },

  // 2. Player Combat & Ranges
  RANGED_MAX_RANGE: { label: "Ranged Max Attack Range", type: "number", min: 100, max: 1000, step: 50, category: "Combat & Ranges" },
  WARRIOR_MELEE_RANGE: { label: "Warrior Melee Attack Range", type: "number", min: 30, max: 300, step: 10, category: "Combat & Ranges" },
  MAGICGLADIATOR_MELEE_RANGE: { label: "Magic Gladiator Melee Range", type: "number", min: 30, max: 300, step: 10, category: "Combat & Ranges" },
  MELEE_RANGE_LVL_SCALE_MULT: { label: "Melee Level-Scale Factor", type: "number", min: 0.1, max: 2.0, step: 0.05, category: "Combat & Ranges" },
  E1_RANGE_ATK_EXPONENT: { label: "E1 Projectile Range ATK Exponent", type: "number", min: 0.0, max: 3.0, step: 0.1, category: "Combat & Ranges" },

  // 3. Player Progression & Rebirth
  LEVEL_UP_STAT_POINTS: { label: "Stat Points per Level Up", type: "number", min: 1, max: 20, step: 1, category: "Player Progression" },
  REQ_KILLS_BASE_MULT: { label: "Req Kills Base Multiplier", type: "number", min: 1, max: 20, step: 1, category: "Player Progression" },
  REQ_KILLS_EXPONENT: { label: "Req Kills Exponential Curve", type: "number", min: 1.0, max: 3.0, step: 0.1, category: "Player Progression" },
  REQ_KILLS_SIN_AMP: { label: "Req Kills Sinusoidal Amp", type: "number", min: 0, max: 10, step: 0.5, category: "Player Progression" },
  REBIRTH_BASE_LEVEL: { label: "Rebirth Starting Min Level", type: "number", min: 2, max: 50, step: 1, category: "Player Progression" },
  REBIRTH_LEVEL_STEP: { label: "Rebirth Level Step per Reset", type: "number", min: 1, max: 20, step: 1, category: "Player Progression" },
  REBIRTH_POINTS_PER_LEVEL: { label: "Rebirth Points per Level", type: "number", min: 1, max: 20, step: 1, category: "Player Progression" },
  LIMIT_LEVEL_TO_REBIRTH_REQ: { label: "Cap Level to Rebirth Reqs", type: "boolean", category: "Player Progression" },

  // 4. Potions & Elixirs (Advanced Buffs)
  POTION_BUFF_DURATION: { label: "Vampirism Buff Duration (ms)", type: "number", min: 1000, max: 60000, step: 1000, category: "Potions & Elixirs" },
  POTION_LIFESTEAL_PERCENT: { label: "Vampirism Heal Percentage", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Potions & Elixirs" },
POTION_BLUE_BUFF_DURATION: { label: "Mana Buff Duration (ms)", type: "number", min: 1000, max: 60000, step: 1000, category: "Potions & Elixirs" },
   POTION_BLUE_CD_MULTIPLIER: { label: "Mana Potion CD Recovery Mult", type: "number", min: 1.0, max: 20.0, step: 0.5, category: "Potions & Elixirs" },
   POTION_RED_DROP_CHANCE: { label: "Red Buff Potion Drop Chance", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Potions & Elixirs" },
   POTION_BLUE_DROP_CHANCE: { label: "Blue Buff Potion Drop Chance", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Potions & Elixirs" },

  // 5. Viewport & Display (Environmental / Display settings)
  GAME_W: { label: "Game Width", type: "number", min: 800, max: 2560, step: 80, category: "Viewport & Display" },
  GAME_H: { label: "Game Height", type: "number", min: 600, max: 1600, step: 64, category: "Viewport & Display" },
  DEPTH_GROUND_TOP: { label: "Ground Top Depth Ratio", type: "number", min: 0.1, max: 0.9, step: 0.05, category: "Viewport & Display" },
  DEPTH_GROUND_BOTTOM: { label: "Ground Bottom Depth Ratio", type: "number", min: 0.5, max: 1.0, step: 0.05, category: "Viewport & Display" },
  GROUND_TOLERANCE: { label: "Ground Y-Tolerance (px)", type: "number", min: 5, max: 100, step: 5, category: "Viewport & Display" },
  DEAD_BODY_LIFETIME: { label: "Dead Body Lifetime (ms)", type: "number", min: 500, max: 10000, step: 500, category: "Viewport & Display" },
  DAY_CYCLE_DURATION: { label: "Day/Night Cycle Duration", type: "number", min: 30, max: 3000, step: 30, category: "Viewport & Display" },

  // 6. Enemy Dynamics & Timing
  ENEMY_SPAWN_INTERVAL: { label: "Enemy Spawn Delay (ms)", type: "number", min: 100, max: 5000, step: 100, category: "Enemy Dynamics" },
  ENEMY_SCALE_WAVE_MULT: { label: "Enemy HP/ATK Wave Multiplier", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Enemy Dynamics" },
  ENEMY_SCALE_LVL_MULT: { label: "Enemy HP/ATK Level Multiplier", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Enemy Dynamics" },
  ENEMY_SKY_SPEED_MULTIPLIER: { label: "Sky Spawn Falling Speed Mult", type: "number", min: 1.0, max: 5.0, step: 0.5, category: "Enemy Dynamics" },
  ENEMY_ATTACK_COOLDOWN_BASE: { label: "Enemy Attack Delay Base (frames)", type: "number", min: 20, max: 200, step: 5, category: "Enemy Dynamics" },
  ENEMY_ATTACK_COOLDOWN_RAND: { label: "Enemy Attack Delay Variance", type: "number", min: 0, max: 100, step: 5, category: "Enemy Dynamics" },

  // 7. Boss Battles
  BOSS_BASE_HP: { label: "Boss Base HP", type: "number", min: 50, max: 2000, step: 50, category: "Boss Battles" },
  BOSS_BASE_ATK: { label: "Boss Base ATK", type: "number", min: 5, max: 100, step: 5, category: "Boss Battles" },
  BOSS_BASE_SPEED: { label: "Boss Base Speed Factor", type: "number", min: 0.05, max: 2.0, step: 0.05, category: "Boss Battles" },
  BOSS_BASE_SIZE: { label: "Boss Base Physical Size (px)", type: "number", min: 20, max: 100, step: 4, category: "Boss Battles" },
  BOSS_BASE_COLOR: { label: "Boss Accent Color", type: "color", category: "Boss Battles" },
  BOSS_ATTACK_COOLDOWN: { label: "Boss Attack Delay (frames)", type: "number", min: 20, max: 300, step: 10, category: "Boss Battles" },
  BOSS_WAVE_INTERVAL: { label: "Boss Spawn Wave Interval", type: "number", min: 1, max: 20, step: 1, category: "Boss Battles" },
  BOSS_SPAWN_INCREMENT: { label: "Additional Bosses per Boss Wave", type: "number", min: 0, max: 10, step: 1, category: "Boss Battles" },
  BOSS_LASER_CHANNEL_TIME: { label: "Boss Laser Channel Time (frames)", type: "number", min: 30, max: 300, step: 10, category: "Boss Battles" },
  BOSS_LASER_DAMAGE_INTERVAL: { label: "Boss Laser Damage Interval (ms)", type: "number", min: 50, max: 2000, step: 50, category: "Boss Battles" },
  BOSS_LASER_DAMAGE_PER_SEC: { label: "Boss Laser Damage Per Sec", type: "number", min: 1, max: 200, step: 5, category: "Boss Battles" },
  BOSS_LASER_DAMAGE_LEVEL_SCALE: { label: "Boss Laser Lvl Scale Factor", type: "number", min: 0, max: 50, step: 1, category: "Boss Battles" },
  BOSS_PROJECTILE_SPEED: { label: "Boss Projectile Speed", type: "number", min: 1.0, max: 15.0, step: 0.5, category: "Boss Battles" },
  BOSS_PROJECTILE_HOMING: { label: "Boss Projectiles Homing", type: "boolean", category: "Boss Battles" },
  BOSS_PROJECTILE_LIFETIME: { label: "Boss Projectile Lifetime (ms, 0=infinite)", type: "number", min: 0, max: 30000, step: 500, category: "Boss Battles" },

  // 8. Projectiles & Hitboxes
  PROJ_HIT_RADIUS_ARROW: { label: "Arrow Hitbox Radius (px)", type: "number", min: 2, max: 50, step: 2, category: "Projectiles & Hitboxes" },
  PROJ_HIT_RADIUS_BOLT: { label: "Bolt Hitbox Radius (px)", type: "number", min: 2, max: 50, step: 2, category: "Projectiles & Hitboxes" },
  PROJ_HIT_RADIUS_DEFAULT: { label: "Default Projectile Radius (px)", type: "number", min: 2, max: 50, step: 2, category: "Projectiles & Hitboxes" },

  // 9. Social & Chat
  CHAT_MESSAGE_DURATION: { label: "Chat Bubble Duration (ms)", type: "number", min: 500, max: 20000, step: 500, category: "Social & Chat" },
  CHAT_FADE_OUT_DURATION: { label: "Chat Bubble Fade-out time (ms)", type: "number", min: 100, max: 5000, step: 100, category: "Social & Chat" },
  NETWORK_ROOM_NAME: { label: "Multiplayer Room Name", type: "string", category: "Social & Chat" },

  // 10. Inventory & Gear
  EQUIPMENT_SLOTS: { label: "Equipment Slots (comma separated)", type: "string", category: "Inventory & Gear" },

  // 11. Gear Drops & Stats
  GEAR_DROP_RATE: { label: "Gear Drop Chance", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Gear Drops & Stats" },
  GEAR_RARITY_NORMAL: { label: "Normal Rarity Weight", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Gear Drops & Stats" },
  GEAR_RARITY_MAGIC: { label: "Magic Rarity Weight", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Gear Drops & Stats" },
  GEAR_RARITY_RARE: { label: "Rare Rarity Weight", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Gear Drops & Stats" },
  GEAR_STAT_MULTIPLIER: { label: "Gear Base Stat Multiplier", type: "number", min: 0.5, max: 5.0, step: 0.1, category: "Gear Drops & Stats" },
  GEAR_STAT_VARIANCE: { label: "Gear Stat Variance (+/- %)", type: "number", min: 0.0, max: 1.0, step: 0.05, category: "Gear Drops & Stats" },
   GEAR_DROP_ONLY_BOSS: { label: "Gear Drops Only From Bosses", type: "boolean", category: "Gear Drops & Stats" },
   CLEAR_ITEMS_ON_START: { label: "Clear Items on Game Start", type: "boolean", category: "Gear Drops & Stats" }
};

// ==========================================
// C. CONFIG LOAD & DYNAMIC INITIALIZATION
// ==========================================
export function getCustomPresets() {
  try {
    return JSON.parse(localStorage.getItem('nightvibe-config-presets') || '{}');
  } catch (e) {
    console.error("Failed parsing custom presets", e);
    return {};
  }
}

export function saveCustomPresets(presets) {
  localStorage.setItem('nightvibe-config-presets', JSON.stringify(presets));
}

export let activePresetId = localStorage.getItem('nightvibe-active-preset-id') || 'built-in:default';
export let activePresetName = 'Default';

export function setActivePresetId(id) {
  activePresetId = id;
  localStorage.setItem('nightvibe-active-preset-id', id);
}

export function setActivePresetName(name) {
  activePresetName = name;
  localStorage.setItem('nightvibe-active-preset-name', name);
}

// Load startup active configuration (uses scratch space or default values)
let startupConfig = {};
if (activePresetId && activePresetId.startsWith('custom:')) {
  const customId = activePresetId.split('custom:')[1];
  const presets = getCustomPresets();
  if (presets[customId]) {
    startupConfig = presets[customId].values || {};
    activePresetName = presets[customId].name || 'Custom Preset';
  }
} else if (activePresetId && activePresetId.startsWith('built-in:')) {
  const key = activePresetId.split('built-in:')[1];
  activePresetName = key.charAt(0).toUpperCase() + key.slice(1);
} else {
  try {
    startupConfig = JSON.parse(localStorage.getItem('nightvibe-scratch-config') || '{}');
  } catch (e) {
    console.error("Failed parsing scratch config", e);
  }
}

export let activeConfig = Object.assign({}, DEFAULTS, startupConfig);

// ==========================================
// D. LIVE LET BINDINGS EXPORTS
// ==========================================
export let GAME_W = activeConfig.GAME_W;
export let GAME_H = activeConfig.GAME_H;
export let DEPTH_GROUND_TOP = activeConfig.DEPTH_GROUND_TOP;
export let DEPTH_GROUND_BOTTOM = activeConfig.DEPTH_GROUND_BOTTOM;
export let GROUND_TOLERANCE = activeConfig.GROUND_TOLERANCE;
export let DEAD_BODY_LIFETIME = activeConfig.DEAD_BODY_LIFETIME;
export let DAY_CYCLE_DURATION = activeConfig.DAY_CYCLE_DURATION;

export let MOVE_SPEED = activeConfig.MOVE_SPEED;

export let RANGED_MAX_RANGE = activeConfig.RANGED_MAX_RANGE;
export let WARRIOR_MELEE_RANGE = activeConfig.WARRIOR_MELEE_RANGE;
export let MAGICGLADIATOR_MELEE_RANGE = activeConfig.MAGICGLADIATOR_MELEE_RANGE;
export let MELEE_RANGE_LVL_SCALE_MULT = activeConfig.MELEE_RANGE_LVL_SCALE_MULT;
export let E1_RANGE_ATK_EXPONENT = activeConfig.E1_RANGE_ATK_EXPONENT;

export let LEVEL_UP_STAT_POINTS = activeConfig.LEVEL_UP_STAT_POINTS;
export let REQ_KILLS_BASE_MULT = activeConfig.REQ_KILLS_BASE_MULT;
export let REQ_KILLS_EXPONENT = activeConfig.REQ_KILLS_EXPONENT;
export let REQ_KILLS_SIN_AMP = activeConfig.REQ_KILLS_SIN_AMP;
export let REBIRTH_BASE_LEVEL = activeConfig.REBIRTH_BASE_LEVEL;
export let REBIRTH_LEVEL_STEP = activeConfig.REBIRTH_LEVEL_STEP;
export let REBIRTH_POINTS_PER_LEVEL = activeConfig.REBIRTH_POINTS_PER_LEVEL;
export let LIMIT_LEVEL_TO_REBIRTH_REQ = activeConfig.LIMIT_LEVEL_TO_REBIRTH_REQ;

export let PLAYER_INITIAL_LEVEL = activeConfig.PLAYER_INITIAL_LEVEL;
export let PLAYER_INITIAL_KILLS = activeConfig.PLAYER_INITIAL_KILLS;
export let PLAYER_INITIAL_STAT_POINTS = activeConfig.PLAYER_INITIAL_STAT_POINTS;
export let PLAYER_INITIAL_RESETS = activeConfig.PLAYER_INITIAL_RESETS;

export let GAME_INITIAL_WAVE = activeConfig.GAME_INITIAL_WAVE;
export let GAME_INITIAL_KILLS = activeConfig.GAME_INITIAL_KILLS;
export let GAME_INITIAL_WAVE_ENEMIES = activeConfig.GAME_INITIAL_WAVE_ENEMIES;

export let ENEMY_SPAWN_INTERVAL = activeConfig.ENEMY_SPAWN_INTERVAL;
export let ENEMY_SCALE_WAVE_MULT = activeConfig.ENEMY_SCALE_WAVE_MULT;
export let ENEMY_SCALE_LVL_MULT = activeConfig.ENEMY_SCALE_LVL_MULT;
export let ENEMY_SKY_SPEED_MULTIPLIER = activeConfig.ENEMY_SKY_SPEED_MULTIPLIER;

export let BOSS_BASE_HP = activeConfig.BOSS_BASE_HP;
export let BOSS_BASE_ATK = activeConfig.BOSS_BASE_ATK;
export let BOSS_BASE_SPEED = activeConfig.BOSS_BASE_SPEED;
export let BOSS_BASE_SIZE = activeConfig.BOSS_BASE_SIZE;
export let BOSS_BASE_COLOR = activeConfig.BOSS_BASE_COLOR;
export let BOSS_ATTACK_COOLDOWN = activeConfig.BOSS_ATTACK_COOLDOWN;
export let BOSS_WAVE_INTERVAL = activeConfig.BOSS_WAVE_INTERVAL;
export let BOSS_SPAWN_INCREMENT = activeConfig.BOSS_SPAWN_INCREMENT;
export let BOSS_LASER_CHANNEL_TIME = activeConfig.BOSS_LASER_CHANNEL_TIME;
export let BOSS_LASER_DAMAGE_INTERVAL = activeConfig.BOSS_LASER_DAMAGE_INTERVAL;
export let BOSS_LASER_DAMAGE_PER_SEC = activeConfig.BOSS_LASER_DAMAGE_PER_SEC;
export let BOSS_LASER_DAMAGE_LEVEL_SCALE = activeConfig.BOSS_LASER_DAMAGE_LEVEL_SCALE;
export let BOSS_PROJECTILE_SPEED = activeConfig.BOSS_PROJECTILE_SPEED;
export let BOSS_PROJECTILE_HOMING = activeConfig.BOSS_PROJECTILE_HOMING;
export let BOSS_PROJECTILE_LIFETIME = activeConfig.BOSS_PROJECTILE_LIFETIME;
export let ENEMY_ATTACK_COOLDOWN_BASE = activeConfig.ENEMY_ATTACK_COOLDOWN_BASE;
export let ENEMY_ATTACK_COOLDOWN_RAND = activeConfig.ENEMY_ATTACK_COOLDOWN_RAND;

export let POTION_BUFF_DURATION = activeConfig.POTION_BUFF_DURATION;
export let POTION_LIFESTEAL_PERCENT = activeConfig.POTION_LIFESTEAL_PERCENT;
export let POTION_BLUE_BUFF_DURATION = activeConfig.POTION_BLUE_BUFF_DURATION;
export let POTION_BLUE_CD_MULTIPLIER = activeConfig.POTION_BLUE_CD_MULTIPLIER;

export let PROJ_HIT_RADIUS_ARROW = activeConfig.PROJ_HIT_RADIUS_ARROW;
export let PROJ_HIT_RADIUS_BOLT = activeConfig.PROJ_HIT_RADIUS_BOLT;
export let PROJ_HIT_RADIUS_DEFAULT = activeConfig.PROJ_HIT_RADIUS_DEFAULT;

export let CHAT_MESSAGE_DURATION = activeConfig.CHAT_MESSAGE_DURATION;
export let CHAT_FADE_OUT_DURATION = activeConfig.CHAT_FADE_OUT_DURATION;
export let NETWORK_ROOM_NAME = activeConfig.NETWORK_ROOM_NAME;
export let EQUIPMENT_SLOTS = activeConfig.EQUIPMENT_SLOTS;

export let GEAR_DROP_RATE = activeConfig.GEAR_DROP_RATE;
 export let GEAR_RARITY_NORMAL = activeConfig.GEAR_RARITY_NORMAL;
 export let GEAR_RARITY_MAGIC = activeConfig.GEAR_RARITY_MAGIC;
 export let GEAR_RARITY_RARE = activeConfig.GEAR_RARITY_RARE;
 export let GEAR_STAT_MULTIPLIER = activeConfig.GEAR_STAT_MULTIPLIER;
 export let GEAR_STAT_VARIANCE = activeConfig.GEAR_STAT_VARIANCE;
 export let GEAR_DROP_ONLY_BOSS = activeConfig.GEAR_DROP_ONLY_BOSS;
 export let CLEAR_ITEMS_ON_START = activeConfig.CLEAR_ITEMS_ON_START;
 export let POTION_RED_DROP_CHANCE = activeConfig.POTION_RED_DROP_CHANCE;
 export let POTION_BLUE_DROP_CHANCE = activeConfig.POTION_BLUE_DROP_CHANCE;

// Static-structure configurations
export const MOVE_STOP_DIST = 3;
export const PLAYER_MOVE_SPEEDS = {
  warrior: 2.5,
  magicgladiator: 2.3,
  archer: 2.0,
  mage: 1.7,
  default: 2.5
};

export const CLASS_DATA = {
  warrior: { name: 'Warrior', icon: '⚔️', hp: 120, mp: 40, atk: 22, spd: 8, color: '#c0392b', accent: '#e74c3c', s1Name: 'Bash', s1Color: '#d4af37', s2Name: 'Sword Slash', s2Color: '#ffd700', bodyType: 'warrior' },
  mage: { name: 'Mage', icon: '🔮', hp: 80, mp: 120, atk: 18, spd: 14, color: '#2980b9', accent: '#3498db', s1Name: 'Magic Bolt', s1Color: '#3498db', s2Name: 'Fireball', s2Color: '#e67e22', bodyType: 'mage' },
  archer: { name: 'Archer', icon: '🏹', hp: 70, mp: 60, atk: 24, spd: 18, color: '#27ae60', accent: '#2ecc71', s1Name: 'Quick Shot', s1Color: '#f1c40f', s2Name: 'Arrow Barrage', s2Color: '#e74c3c', bodyType: 'archer' },
  magicgladiator: { name: 'Magic Gladiator', icon: '✨', hp: 140, mp: 80, atk: 26, spd: 6, color: '#8e44ad', accent: '#9b59b6', s1Name: 'Psionic Slash', s1Color: '#e74c3c', s2Name: 'Cross Slash', s2Color: '#ffd700', bodyType: 'magicgladiator' }
};

try {
  const customClasses = JSON.parse(localStorage.getItem('nightvibe-custom-classes'));
  if (customClasses) {
    for (const key in CLASS_DATA) {
      delete CLASS_DATA[key];
    }
    Object.assign(CLASS_DATA, customClasses);
  }
} catch (e) {
  console.error("Failed loading custom classes", e);
}

export const ENEMY_TYPES = [
  { name: 'Slime', icon: '🟢', hp: 30, atk: 5, color: '#2ecc71', speed: 0.4, size: 20 },
  { name: 'Goblin', icon: '👺', hp: 45, atk: 8, color: '#27ae60', speed: 0.7, size: 22 },
  { name: 'Skeleton', icon: '💀', hp: 55, atk: 10, color: '#dfe6e9', speed: 0.5, size: 24 },
  { name: 'Orc', icon: '👹', hp: 80, atk: 14, color: '#6b8e23', speed: 0.35, size: 28 },
  { name: 'Ghost', icon: '👻', hp: 40, atk: 12, color: '#dfe6e9', speed: 0.9, size: 22 },
  { name: 'Demon', icon: '🔥', hp: 100, atk: 18, color: '#e74c3c', speed: 0.55, size: 26 },
  { name: 'Dragon', icon: '🐉', hp: 150, atk: 22, color: '#e67e22', speed: 0.3, size: 32 },
  { name: 'Lich', icon: '🧙', hp: 120, atk: 20, color: '#8e44ad', speed: 0.45, size: 26 },
];

try {
  const customMonsters = JSON.parse(localStorage.getItem('nightvibe-custom-monsters'));
  if (customMonsters && Array.isArray(customMonsters) && customMonsters.length > 0) {
    ENEMY_TYPES.length = 0;
    ENEMY_TYPES.push(...customMonsters);
  }
} catch (e) {
  console.error("Failed loading custom monsters", e);
}

export const ITEMS_DB = [
  { name: 'Broadsword', icon: '🗡️', gearType: 'Weapon', rarity: 'normal', color: '#ecf0f1', stats: { atk: 10, maxHp: 0, spd: 0 } },
  { name: 'Plate Armor', icon: '🛡️', gearType: 'Armor', rarity: 'magic', color: '#3498db', stats: { atk: 0, maxHp: 80, spd: 0 } },
  { name: 'Wind Ring', icon: '💍', gearType: 'Ring', rarity: 'rare', color: '#f1c40f', stats: { atk: 2, maxHp: 10, spd: 2 } }
];

try {
  const customItems = JSON.parse(localStorage.getItem('nightvibe-custom-items'));
  if (customItems && Array.isArray(customItems) && customItems.length > 0) {
    ITEMS_DB.length = 0;
    ITEMS_DB.push(...customItems);
  }
} catch (e) {
  console.error("Failed loading custom items", e);
}

export const ENV_LIST = ['forest', 'castle', 'volcano', 'beach', 'tundra', 'swamp'];
export const ENV_DISPLAY = { forest: 'Forest', castle: 'Castle', volcano: 'Volcano', beach: 'Beach', tundra: 'Tundra', swamp: 'Swamp' };
export const ENV_CONFIG = {
  forest: { skyTop: '#0a1628', skyMid: '#1a3a2a', skyBot: '#0d2015', ground: '#0d2015', groundY: 0.52, horizonType: 'trees', horizonColor: '#0b1911', groundType: 'grass', groundColor: '#1e4024' },
  castle: { skyTop: '#2a2a3a', skyMid: '#3a3a4a', skyBot: '#2a2a3a', ground: '#1a1a2a', groundY: 0.50, horizonType: 'walls', horizonColor: '#111116', groundType: 'stones', groundColor: '#2f3542' },
  volcano: { skyTop: '#2a0a0a', skyMid: '#4a1a0a', skyBot: '#1a0a0a', ground: '#1a0a0a', groundY: 0.55, horizonType: 'mountains', horizonColor: '#1f0a0a', groundType: 'cracks', groundColor: '#e74c3c' },
  beach: { skyTop: '#1a3a6a', skyMid: '#3a7aaa', skyBot: '#5a9aca', ground: '#d4a574', groundY: 0.51, horizonType: 'palms', horizonColor: '#1d441d', groundType: 'shells', groundColor: '#f5b041' },
  tundra: { skyTop: '#0a1a3a', skyMid: '#1a3a6a', skyBot: '#e8f0f8', ground: '#c0d8e8', groundY: 0.56, horizonType: 'pines', horizonColor: '#748a9c', groundType: 'ice', groundColor: '#ffffff' },
  swamp: { skyTop: '#0a1a0a', skyMid: '#1a2a1a', skyBot: '#0a150a', ground: '#1a2a1a', groundY: 0.48, horizonType: 'deadtrees', horizonColor: '#081108', groundType: 'mud', groundColor: '#3e4a34' }
};

export const SKILL_DESC = {
  warrior: {
    s1: { name: 'Bash', desc: 'Wide arc strike. 100% ATK + knockback.', ctrl: 'Left-click enemy' },
    s2: { name: 'Sword Slash', desc: 'Shockwave projectile. 250% ATK + knockback.', ctrl: 'Right-click / long-press' }
  },
  mage: {
    s1: { name: 'Magic Bolt', desc: 'Fast bolt. 90% ATK single-target.', ctrl: 'Left-click enemy' },
    s2: { name: 'Fireball', desc: 'Exploding AoE fireball. 220% ATK.', ctrl: 'Right-click / long-press' }
  },
  archer: {
    s1: { name: 'Quick Shot', desc: 'Fast arrow. 95% ATK, 15% crit.', ctrl: 'Left-click enemy' },
    s2: { name: 'Arrow Barrage', desc: '3 arrows spread. 130% ATK each.', ctrl: 'Right-click / long-press' }
  },
  magicgladiator: {
    s1: { name: 'Psionic Slash', desc: 'Double wide arc. 110% ATK, 12% crit.', ctrl: 'Left-click enemy' },
    s2: { name: 'Cross Slash', desc: 'Massive AoE explosion. 300% ATK.', ctrl: 'Right-click / long-press' }
  }
};

// ==========================================
// E. DYNAMIC SETTINGS CONTROLS FUNCTIONS
// ==========================================

export function applyPreset(presetValues) {
  activeConfig = Object.assign({}, DEFAULTS, presetValues);

  // Dynamically update the live bindings so that all other game source modules receive the fresh settings immediately!
  GAME_W = activeConfig.GAME_W;
  GAME_H = activeConfig.GAME_H;
  DEPTH_GROUND_TOP = activeConfig.DEPTH_GROUND_TOP;
  DEPTH_GROUND_BOTTOM = activeConfig.DEPTH_GROUND_BOTTOM;
  GROUND_TOLERANCE = activeConfig.GROUND_TOLERANCE;
  DEAD_BODY_LIFETIME = activeConfig.DEAD_BODY_LIFETIME;
  DAY_CYCLE_DURATION = activeConfig.DAY_CYCLE_DURATION;

  MOVE_SPEED = activeConfig.MOVE_SPEED;

  RANGED_MAX_RANGE = activeConfig.RANGED_MAX_RANGE;
  WARRIOR_MELEE_RANGE = activeConfig.WARRIOR_MELEE_RANGE;
  MAGICGLADIATOR_MELEE_RANGE = activeConfig.MAGICGLADIATOR_MELEE_RANGE;
  MELEE_RANGE_LVL_SCALE_MULT = activeConfig.MELEE_RANGE_LVL_SCALE_MULT;
  E1_RANGE_ATK_EXPONENT = activeConfig.E1_RANGE_ATK_EXPONENT;

  LEVEL_UP_STAT_POINTS = activeConfig.LEVEL_UP_STAT_POINTS;
  REQ_KILLS_BASE_MULT = activeConfig.REQ_KILLS_BASE_MULT;
  REQ_KILLS_EXPONENT = activeConfig.REQ_KILLS_EXPONENT;
  REQ_KILLS_SIN_AMP = activeConfig.REQ_KILLS_SIN_AMP;
  REBIRTH_BASE_LEVEL = activeConfig.REBIRTH_BASE_LEVEL;
  REBIRTH_LEVEL_STEP = activeConfig.REBIRTH_LEVEL_STEP;
  REBIRTH_POINTS_PER_LEVEL = activeConfig.REBIRTH_POINTS_PER_LEVEL;
  LIMIT_LEVEL_TO_REBIRTH_REQ = activeConfig.LIMIT_LEVEL_TO_REBIRTH_REQ;

  PLAYER_INITIAL_LEVEL = activeConfig.PLAYER_INITIAL_LEVEL;
  PLAYER_INITIAL_KILLS = activeConfig.PLAYER_INITIAL_KILLS;
  PLAYER_INITIAL_STAT_POINTS = activeConfig.PLAYER_INITIAL_STAT_POINTS;
  PLAYER_INITIAL_RESETS = activeConfig.PLAYER_INITIAL_RESETS;

  GAME_INITIAL_WAVE = activeConfig.GAME_INITIAL_WAVE;
  GAME_INITIAL_KILLS = activeConfig.GAME_INITIAL_KILLS;
  GAME_INITIAL_WAVE_ENEMIES = activeConfig.GAME_INITIAL_WAVE_ENEMIES;

  ENEMY_SPAWN_INTERVAL = activeConfig.ENEMY_SPAWN_INTERVAL;
  ENEMY_SCALE_WAVE_MULT = activeConfig.ENEMY_SCALE_WAVE_MULT;
  ENEMY_SCALE_LVL_MULT = activeConfig.ENEMY_SCALE_LVL_MULT;
  ENEMY_SKY_SPEED_MULTIPLIER = activeConfig.ENEMY_SKY_SPEED_MULTIPLIER;
  ENEMY_ATTACK_COOLDOWN_BASE = activeConfig.ENEMY_ATTACK_COOLDOWN_BASE;
  ENEMY_ATTACK_COOLDOWN_RAND = activeConfig.ENEMY_ATTACK_COOLDOWN_RAND;

  BOSS_BASE_HP = activeConfig.BOSS_BASE_HP;
  BOSS_BASE_ATK = activeConfig.BOSS_BASE_ATK;
  BOSS_BASE_SPEED = activeConfig.BOSS_BASE_SPEED;
  BOSS_BASE_SIZE = activeConfig.BOSS_BASE_SIZE;
  BOSS_BASE_COLOR = activeConfig.BOSS_BASE_COLOR;
  BOSS_ATTACK_COOLDOWN = activeConfig.BOSS_ATTACK_COOLDOWN;
  BOSS_WAVE_INTERVAL = activeConfig.BOSS_WAVE_INTERVAL;
  BOSS_SPAWN_INCREMENT = activeConfig.BOSS_SPAWN_INCREMENT;
  BOSS_LASER_CHANNEL_TIME = activeConfig.BOSS_LASER_CHANNEL_TIME;
  BOSS_LASER_DAMAGE_INTERVAL = activeConfig.BOSS_LASER_DAMAGE_INTERVAL;
  BOSS_LASER_DAMAGE_PER_SEC = activeConfig.BOSS_LASER_DAMAGE_PER_SEC;
  BOSS_LASER_DAMAGE_LEVEL_SCALE = activeConfig.BOSS_LASER_DAMAGE_LEVEL_SCALE;
  BOSS_PROJECTILE_SPEED = activeConfig.BOSS_PROJECTILE_SPEED;
  BOSS_PROJECTILE_HOMING = activeConfig.BOSS_PROJECTILE_HOMING;
  BOSS_PROJECTILE_LIFETIME = activeConfig.BOSS_PROJECTILE_LIFETIME;

  POTION_BUFF_DURATION = activeConfig.POTION_BUFF_DURATION;
  POTION_LIFESTEAL_PERCENT = activeConfig.POTION_LIFESTEAL_PERCENT;
  POTION_BLUE_BUFF_DURATION = activeConfig.POTION_BLUE_BUFF_DURATION;
  POTION_BLUE_CD_MULTIPLIER = activeConfig.POTION_BLUE_CD_MULTIPLIER;

  PROJ_HIT_RADIUS_ARROW = activeConfig.PROJ_HIT_RADIUS_ARROW;
  PROJ_HIT_RADIUS_BOLT = activeConfig.PROJ_HIT_RADIUS_BOLT;
  PROJ_HIT_RADIUS_DEFAULT = activeConfig.PROJ_HIT_RADIUS_DEFAULT;

  CHAT_MESSAGE_DURATION = activeConfig.CHAT_MESSAGE_DURATION;
  CHAT_FADE_OUT_DURATION = activeConfig.CHAT_FADE_OUT_DURATION;
  NETWORK_ROOM_NAME = activeConfig.NETWORK_ROOM_NAME;
  EQUIPMENT_SLOTS = activeConfig.EQUIPMENT_SLOTS;

  GEAR_DROP_RATE = activeConfig.GEAR_DROP_RATE;
  GEAR_RARITY_NORMAL = activeConfig.GEAR_RARITY_NORMAL;
  GEAR_RARITY_MAGIC = activeConfig.GEAR_RARITY_MAGIC;
  GEAR_RARITY_RARE = activeConfig.GEAR_RARITY_RARE;
  GEAR_STAT_MULTIPLIER = activeConfig.GEAR_STAT_MULTIPLIER;
  GEAR_STAT_VARIANCE = activeConfig.GEAR_STAT_VARIANCE;
  GEAR_DROP_ONLY_BOSS = activeConfig.GEAR_DROP_ONLY_BOSS;
  CLEAR_ITEMS_ON_START = activeConfig.CLEAR_ITEMS_ON_START;
  POTION_RED_DROP_CHANCE = activeConfig.POTION_RED_DROP_CHANCE;
  POTION_BLUE_DROP_CHANCE = activeConfig.POTION_BLUE_DROP_CHANCE;
}

export function updateConfig(newValues) {
  for (const key in newValues) {
    if (DEFAULTS[key] !== undefined) {
      activeConfig[key] = newValues[key];
    }
  }

  applyPreset(activeConfig);

  // Save updated values to persistent preset if custom, or scratch space if built-in
  if (activePresetId && activePresetId.startsWith('custom:')) {
    const customId = activePresetId.split('custom:')[1];
    const presets = getCustomPresets();
    if (presets[customId]) {
      presets[customId].values = { ...activeConfig };
      saveCustomPresets(presets);
    }
  } else {
    localStorage.setItem('nightvibe-scratch-config', JSON.stringify(activeConfig));
  }
}

export function updateClassData(newClasses) {
  for (const key in CLASS_DATA) delete CLASS_DATA[key];
  Object.assign(CLASS_DATA, newClasses);
  localStorage.setItem('nightvibe-custom-classes', JSON.stringify(CLASS_DATA));
}

export function updateEnemyTypes(newEnemies) {
  if (Array.isArray(newEnemies) && newEnemies.length > 0) {
    ENEMY_TYPES.length = 0;
    ENEMY_TYPES.push(...newEnemies);
    localStorage.setItem('nightvibe-custom-monsters', JSON.stringify(ENEMY_TYPES));
  }
}

export function updateItemsDb(newItems) {
  if (Array.isArray(newItems) && newItems.length > 0) {
    ITEMS_DB.length = 0;
    ITEMS_DB.push(...newItems);
    localStorage.setItem('nightvibe-custom-items', JSON.stringify(ITEMS_DB));
  }
}

export function resetConfig() {
  if (activePresetId && activePresetId.startsWith('custom:')) {
    const customId = activePresetId.split('custom:')[1];
    const presets = getCustomPresets();
    if (presets[customId]) {
      presets[customId].values = { ...DEFAULTS };
      saveCustomPresets(presets);
    }
  } else {
    localStorage.removeItem('nightvibe-scratch-config');
  }
  updateConfig(DEFAULTS);
}

export function setDynamicGameW(w) {
  GAME_W = w;
}
