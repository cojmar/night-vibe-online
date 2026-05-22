// Night Vibe Online Arena Combat Sandbox - Centralized Game Configurations

// ==========================================
// 1. VIEWPORT & RENDERING CONFIGURATIONS
// ==========================================
export const GAME_W = 1440;
export const GAME_H = 1024;

// Perspective and Y-Sorting Boundaries
export const DEPTH_GROUND_TOP = 0.45;
export const DEPTH_GROUND_BOTTOM = 1.0;
export const GROUND_TOLERANCE = 30;

// Entity Lifetimes (in milliseconds)
export const DEAD_BODY_LIFETIME = 2000;

// ==========================================
// 2. PLAYER MOVEMENT SPEED CONFIGURATIONS
// ==========================================
export const MOVE_SPEED = 2.5; // Global fallback speed
export const MOVE_STOP_DIST = 3;

export const PLAYER_MOVE_SPEEDS = {
  warrior: 2.5,
  magicgladiator: 2.3,
  archer: 2.0,
  mage: 1.7,
  default: 2.5
};

// ==========================================
// 3. PLAYER ATTACK & RANGE CONFIGURATIONS
// ==========================================
export const RANGED_MAX_RANGE = 450;
export const WARRIOR_MELEE_RANGE = 90;
export const MAGICGLADIATOR_MELEE_RANGE = 80;
export const MELEE_RANGE_LVL_SCALE_MULT = 0.8;

// ==========================================
// 4. PLAYER PROGRESSION & REBIRTH SETTINGS
// ==========================================
export const LEVEL_UP_STAT_POINTS = 5;
export const REQ_KILLS_BASE_MULT = 5;
export const REQ_KILLS_EXPONENT = 1.4;
export const REQ_KILLS_SIN_AMP = 2;

export const REBIRTH_BASE_LEVEL = 4;
export const REBIRTH_LEVEL_STEP = 5;
export const REBIRTH_POINTS_PER_LEVEL = 5;

// ==========================================
// 5. PLAYER INITIAL STATE CONFIGURATION
// ==========================================
export const PLAYER_INITIAL_LEVEL = 1;
export const PLAYER_INITIAL_KILLS = 0;
export const PLAYER_INITIAL_STAT_POINTS = 0;
export const PLAYER_INITIAL_RESETS = 0;

// ==========================================
// 6. INITIAL GAME STATE CONFIGURATION
// ==========================================
export const GAME_INITIAL_WAVE = 1;
export const GAME_INITIAL_KILLS = 0;
export const GAME_INITIAL_WAVE_ENEMIES = 10;

// ==========================================
// 7. ENEMY & BOSS SPAWNING & DIFFICULTY SCALING
// ==========================================
export const ENEMY_SPAWN_INTERVAL = 800;

// Scaling factors per wave and average player level
export const ENEMY_SCALE_WAVE_MULT = 0.15;
export const ENEMY_SCALE_LVL_MULT = 0.12;

// Sky Spawn descent speed multiplier
export const ENEMY_SKY_SPEED_MULTIPLIER = 2.0;

// Boss Default Specifications
export const BOSS_BASE_HP = 250;
export const BOSS_BASE_ATK = 18;
export const BOSS_BASE_SPEED = 0.2;
export const BOSS_BASE_SIZE = 48;
export const BOSS_BASE_COLOR = '#8e44ad';

// Attack Cooldowns (in frames/ticks, where 60 ticks ~= 1 second)
export const BOSS_ATTACK_COOLDOWN = 120;
export const ENEMY_ATTACK_COOLDOWN_BASE = 60;
export const ENEMY_ATTACK_COOLDOWN_RAND = 40;

// ==========================================
// 8. POTION & BUFF CONFIGURATIONS
// ==========================================
export const POTION_BUFF_DURATION = 10000; // in milliseconds (10 seconds)
export const POTION_LIFESTEAL_PERCENT = 0.75; // Vampirism heals 75% of dealt damage

// ==========================================
// 9. PROJECTILE COLLISION CONFIGURATIONS
// ==========================================
export const PROJ_HIT_RADIUS_ARROW = 12;
export const PROJ_HIT_RADIUS_BOLT = 10;
export const PROJ_HIT_RADIUS_DEFAULT = 15;

// ==========================================
// 10. CHAT & STATUS CONFIGURATIONS
// ==========================================
export const CHAT_MESSAGE_DURATION = 5000; // Duration in ms for status/chat messages
export const CHAT_FADE_OUT_DURATION = 500;  // Fade out time in ms at the end

// ==========================================
// 11. CLASS DATA & SKILLS DEFINITIONS
// ==========================================
export const CLASS_DATA = {
  warrior: { name: 'Warrior', icon: '⚔️', hp: 120, mp: 40, atk: 22, spd: 8, color: '#c0392b', accent: '#e74c3c', s1Name: 'Bash', s1Color: '#d4af37', s2Name: 'Sword Slash', s2Color: '#ffd700' },
  mage: { name: 'Mage', icon: '🔮', hp: 80, mp: 120, atk: 18, spd: 14, color: '#2980b9', accent: '#3498db', s1Name: 'Magic Bolt', s1Color: '#3498db', s2Name: 'Fireball', s2Color: '#e67e22' },
  archer: { name: 'Archer', icon: '🏹', hp: 70, mp: 60, atk: 24, spd: 18, color: '#27ae60', accent: '#2ecc71', s1Name: 'Quick Shot', s1Color: '#f1c40f', s2Name: 'Arrow Barrage', s2Color: '#e74c3c' },
  magicgladiator: { name: 'Magic Gladiator', icon: '✨', hp: 140, mp: 80, atk: 26, spd: 6, color: '#8e44ad', accent: '#9b59b6', s1Name: 'Psionic Slash', s1Color: '#e74c3c', s2Name: 'Cross Slash', s2Color: '#ffd700' }
};

// Enemy Species Specifications
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

// Arena Environments
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

// Skill Description Overlays
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
