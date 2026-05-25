import { GAME_H, ENV_CONFIG } from './config.js';
export * from './config.js';

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

const imageCache = {};
const imageFlipCache = {};

export function getCachedImage(src) {
  if (!src) return null;
  if (imageCache[src]) {
    return imageCache[src].loaded ? imageCache[src].img : null;
  }
  const img = new Image();
  imageCache[src] = { img, loaded: false };
  img.onload = () => {
    imageCache[src].loaded = true;
  };
  img.onerror = () => {
    console.error("Failed to load custom image:", src);
  };
  img.src = src;
  return null;
}

export function getCachedFlippedImage(src) {
  if (!src || !(src.startsWith('data:image/') || src.startsWith('http') || src.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i))) return null;
  if (imageFlipCache[src]) {
    return imageFlipCache[src].loaded ? imageFlipCache[src].img : null;
  }
  const originalImg = getCachedImage(src);
  if (!originalImg) return null;
  const flipCanvas = document.createElement('canvas');
  flipCanvas.width = originalImg.width;
  flipCanvas.height = originalImg.height;
  const flipCtx = flipCanvas.getContext('2d');
  flipCtx.translate(flipCanvas.width, 0);
  flipCtx.scale(-1, 1);
  flipCtx.drawImage(originalImg, 0, 0);
  imageFlipCache[src] = { img: flipCanvas, loaded: true };
  return flipCanvas;
}

export function preloadFlippedImagesForAsset(icon) {
  if (icon && typeof icon === 'string' && (icon.startsWith('data:image/') || icon.startsWith('http') || icon.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i))) {
    getCachedFlippedImage(icon);
  }
}

