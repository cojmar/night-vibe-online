import { getGroundY } from './utils.js';
import * as ConfigModule from './config.js';

export default class AtmosphereManager {
  constructor(game) {
    this.game = game;
  }

  processAtmosEffects(dt) {
    if (this.game.settings.atmos <= 0) return;

    const isNight = this.game.nightAlpha > 0.3;
    const rainColorsNight = ['rgba(255,255,255,0.4)', 'rgba(255,50,50,0.4)', 'rgba(50,255,50,0.4)'];
    const rainColorsDay = ['rgba(0,0,0,0.4)', 'rgba(100,0,0,0.4)'];
    const rColors = isNight ? rainColorsNight : rainColorsDay;

    const rainDensity = Math.floor(3 * this.game.settings.atmos * dt);
    for (let i = 0; i < rainDensity; i++) {
      if (Math.random() < 0.2) {
        this.game.atmosEffects.push({
          type: 'rain',
          x: Math.random() * this.game.gameW,
          y: -10,
          vx: -1 + Math.random() * 2,
          vy: 10 + Math.random() * 5,
          color: rColors[Math.floor(Math.random() * rColors.length)],
          size: 1 + Math.random() * 1.5,
          life: 1.0
        });
      }
    }

    if (Math.random() < 0.005 * this.game.settings.atmos * dt) {
      const clouds = this.game.atmosEffects.filter(ef => ef.type === 'cloud');
      const maxClouds = Math.max(1, Math.floor(4 * this.game.settings.atmos));

      if (clouds.length < maxClouds) {
        const groundY = getGroundY(this.game.selectedEnv);
        const size = 60 + Math.random() * 80;
        const maxCloudY = groundY - size * 0.6 - 20;

        const laneHeight = maxCloudY / 3;
        const laneCounts = [0, 0, 0];
        for (let c of clouds) {
          const laneIndex = Math.min(2, Math.floor(c.y / laneHeight));
          laneCounts[laneIndex]++;
        }

        let minLane = 0;
        let minVal = Infinity;
        for (let i = 0; i < 3; i++) {
          if (laneCounts[i] < minVal) {
            minVal = laneCounts[i];
            minLane = i;
          }
        }

        const spawnedY = minLane * laneHeight + Math.random() * (laneHeight - 10) + 5;
        const spawnLeft = Math.random() < 0.5;
        const x = spawnLeft ? -150 : this.game.gameW + 150;
        const vx = (spawnLeft ? 1 : -1) * (0.1 + Math.random() * 0.3);

        this.game.atmosEffects.push({
          type: 'cloud',
          x, y: spawnedY, vx, vy: 0,
          color: isNight
            ? `rgba(255,255,255,${0.03 + Math.random() * 0.05})`
            : `rgba(0,0,0,${0.03 + Math.random() * 0.05})`,
          size, life: 1.0
        });
      }
    }

    if (Math.random() < 0.02 * this.game.settings.atmos * dt) {
      const groundY = getGroundY(this.game.selectedEnv);
      this.game.atmosEffects.push({
        type: 'smoke',
        x: Math.random() * this.game.gameW,
        y: groundY + (Math.random() * (this.game.gameH - groundY)),
        vx: -0.5 + Math.random(),
        vy: -0.5 - Math.random() * 0.5,
        color: isNight
          ? `rgba(150,255,150,${0.05 + Math.random() * 0.1})`
          : `rgba(50,50,50,${0.05 + Math.random() * 0.1})`,
        size: 10 + Math.random() * 15,
        life: 1.0
      });
    }
  }

  updateAtmosEffects(dt) {
    for (let i = this.game.atmosEffects.length - 1; i >= 0; i--) {
      const ef = this.game.atmosEffects[i];
      ef.x += ef.vx * dt;
      ef.y += ef.vy * dt;
      let dead = false;
      if (ef.type === 'rain' && ef.y > this.game.gameH) dead = true;
      if (ef.type === 'cloud' && (ef.x < -200 || ef.x > this.game.gameW + 200)) dead = true;
      if (ef.type === 'smoke') {
        ef.life -= 0.005 * dt;
        ef.size += 0.2 * dt;
        if (ef.life <= 0) dead = true;
      }
      if (dead) this.game.atmosEffects.splice(i, 1);
    }
  }
}
