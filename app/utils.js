export const GAME_W = 1440, GAME_H = 1024;
export const DEPTH_GROUND_TOP = 0.45;
export const DEPTH_GROUND_BOTTOM = 1.0;
export const DEAD_BODY_LIFETIME = 2000;
export const MOVE_SPEED = 2.5;
export const MOVE_STOP_DIST = 3;
export const GROUND_TOLERANCE = 30;

export const CLASS_DATA = {
  warrior: { name: 'Warrior', icon: '⚔️', hp: 120, mp: 40, atk: 22, spd: 8, color: '#c0392b', accent: '#e74c3c', s1Name: 'Bash', s1Color: '#d4af37', s2Name: 'Sword Slash', s2Color: '#ffd700' },
  mage: { name: 'Mage', icon: '🔮', hp: 80, mp: 120, atk: 18, spd: 14, color: '#2980b9', accent: '#3498db', s1Name: 'Magic Bolt', s1Color: '#3498db', s2Name: 'Fireball', s2Color: '#e67e22' },
  archer: { name: 'Archer', icon: '🏹', hp: 70, mp: 60, atk: 24, spd: 18, color: '#27ae60', accent: '#2ecc71', s1Name: 'Quick Shot', s1Color: '#f1c40f', s2Name: 'Arrow Barrage', s2Color: '#e74c3c' },
  magicgladiator: { name: 'Magic Gladiator', icon: '✨', hp: 140, mp: 80, atk: 26, spd: 6, color: '#8e44ad', accent: '#9b59b6', s1Name: 'Psionic Slash', s1Color: '#e74c3c', s2Name: 'Cross Slash', s2Color: '#ffd700' }
};

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

export function getGroundY(selectedEnv) {
  const envConfig = ENV_CONFIG[selectedEnv] || ENV_CONFIG.forest;
  return GAME_H * envConfig.groundY;
}

export function getArmAnim(animTimer) {
  if (animTimer <= 0) return 0;
  const t = 1 - animTimer / 15;
  return Math.sin(t * Math.PI) * -0.40;
}

export function normalizeAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function pointInSweepArc(originX, originY, dirAngle, halfAngle, innerR, outerR, px, py) {
  const dx = px - originX, dy = py - originY;
  const dist = Math.hypot(dx, dy);
  if (dist < innerR || dist > outerR) return false;
  const angleToP = normalizeAngle(Math.atan2(dy, dx));
  const angleDiff = normalizeAngle(angleToP - dirAngle);
  return Math.abs(angleDiff) <= halfAngle;
}

export function circleOverlapsCrescentArc(ox, oy, dirAngle, travelDist, enemyX, enemyY, enemySize) {
  const arcCX = ox + Math.cos(dirAngle) * travelDist;
  const arcCY = oy + Math.sin(dirAngle) * travelDist;
  const edx = enemyX - arcCX, edy = enemyY - arcCY;
  const dist = Math.hypot(edx, edy);
  const cosDir = Math.cos(dirAngle), sinDir = Math.sin(dirAngle);
  const tanX = -sinDir, tanY = cosDir;
  const tangentDist = Math.abs(edx * tanX + edy * tanY);
  const axialDist = Math.abs(edx * cosDir + edy * sinDir);
  const arcRadius = 60;
  const crescentWidth = 160;
  const crescentDepth = 18;
  const halfWidth = crescentWidth / 2;
  if (dist > arcRadius + enemySize + 10) return false;
  if (tangentDist > halfWidth + enemySize) return false;
  if (axialDist > crescentDepth + enemySize + 8) return false;
  return true;
}

export function darkenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgb(${Math.round(r * (1 - factor))},${Math.round(g * (1 - factor))},${Math.round(b * (1 - factor))})`;
}

export class PRNG {
  constructor(seed) {
    this.seed = seed % 2147483647;
    if (this.seed <= 0) this.seed += 2147483646;
  }
  next() {
    return this.seed = this.seed * 16807 % 2147483647;
  }
  nextFloat() {
    return (this.next() - 1) / 2147483646;
  }
}
