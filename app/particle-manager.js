import { getGroundY } from './utils.js';

export default class ParticleManager {
  constructor(game) {
    this.game = game;
  }

  spawnDamageParticles(x, y) {
    for (let i = 0; i < 2; i++) {
      this.game.particles.push({
        x, y: y - 5,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 3,
        life: 20, maxLife: 20,
        color: '#8b0000', size: 8
      });
    }
  }

  spawnParticles(x, y, color, count = 20, speed = 5, sizeScale = 1.0) {
    const finalCount = Math.floor(count * (this.game.settings ? this.game.settings.particles : 1.0));
    for (let i = 0; i < finalCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.5 + Math.random()) * speed;
      this.game.particles.push({
        x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1,
        life: 20 + Math.floor(Math.random() * 20), maxLife: 40, color,
        size: (1.5 + Math.random() * 3) * sizeScale
      });
    }
  }

  spawnEnemyDeathExplosion(e) {
    const size = e.size || 30;
    const pCount = Math.floor(45 * (this.game.settings ? this.game.settings.particles : 1.0));
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * 4.5;
      const r = Math.random() * (size * 0.45);
      const startAngle = Math.random() * Math.PI * 2;
      const px = e.x + Math.cos(startAngle) * r;
      const py = (e.y - size * 0.4) + Math.sin(startAngle) * r;
      this.game.particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 0.5,
        life: 25 + Math.floor(Math.random() * 25), maxLife: 50,
        color: e.color || '#e74c3c',
        size: (2.0 + Math.random() * 4.5) * (size / 30)
      });
    }
    const sparksCount = Math.floor(20 * (this.game.settings ? this.game.settings.particles : 1.0));
    for (let i = 0; i < sparksCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.2 + Math.random() * 0.5) * 2.5;
      this.game.particles.push({
        x: e.x + (Math.random() - 0.5) * size * 0.6,
        y: e.y - size * 0.4 + (Math.random() - 0.5) * size * 0.6,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.2,
        life: 30 + Math.floor(Math.random() * 30), maxLife: 60,
        color: '#ff7979',
        size: (3.0 + Math.random() * 5) * (size / 30)
      });
    }
  }

  triggerLevelUpAnimation(p) {
    const size = p.level ? Math.max(24, 24 * (0.5 + 0.5 * (p.level / 10))) : 28;
    this.game.particles.push({
      x: p.x, y: p.y + 10, vx: 0, vy: -0.6,
      life: 30, maxLife: 30,
      color: 'rgba(255, 215, 0, 0.7)',
      size: size * 1.3, isHalo: true
    });
    const rayCount = 12;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
      const spd = 1.2 + Math.random() * 2.0;
      const length = size * 1.5 + Math.random() * size * 0.5;
      this.game.particles.push({
        x: p.x, y: p.y - size * 0.4,
        vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd,
        life: 25 + Math.floor(Math.random() * 15), maxLife: 40,
        color: i % 2 === 0 ? '#ffd700' : '#fffae0',
        size: 1.2 + Math.random() * 1.2, length, isRay: true
      });
    }
    const sparkleCount = 18;
    for (let i = 0; i < sparkleCount; i++) {
      this.game.particles.push({
        x: p.x + (Math.random() - 0.5) * 24,
        y: p.y + (Math.random() - 0.5) * 35 - 15,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -1.8 - Math.random() * 2.5,
        life: 20 + Math.floor(Math.random() * 15), maxLife: 35,
        color: '#fffbe0', size: 1.0 + Math.random() * 1.5, isSparkle: true
      });
    }
  }

  initBgParticles() {
    this.game.bgParticles = [];
    const groundY = getGroundY(this.game.selectedEnv);
    for (let i = 0; i < 40; i++) {
      this.game.bgParticles.push({
        x: Math.random() * this.game.gameW,
        y: 10 + Math.random() * (groundY - 30),
        vx: (Math.random() - 0.5) * 0.5,
        vy: -Math.random() * 0.8 - 0.2,
        size: Math.random() * 2 + 1,
        alpha: Math.random() * 0.5 + 0.2
      });
    }
  }
}
