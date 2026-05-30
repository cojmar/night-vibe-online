import { ENV_CONFIG, getGroundY, darkenColor, PRNG } from './utils.js';
import * as ConfigModule from './config.js';

export default class SceneryManager {
  constructor(game) {
    this.game = game;
  }

  generateScenery() {
    this.game.scenery = [];
    this.game.horizonFoliage = [];
    this.game.groundFoliage = [];
    const env = ENV_CONFIG[this.game.selectedEnv] || ENV_CONFIG.forest;
    const currentDay = Math.floor(this.game.globalTime / ConfigModule.DAY_CYCLE_DURATION);
    let localPrng = new PRNG((currentDay + 1) * 9999);

    const sceneryCount = Math.floor(15 * (this.game.settings ? this.game.settings.bgElements : 1.0));
    for (let i = 0; i < sceneryCount; i++) {
      const w = 40 + localPrng.nextFloat() * 60;
      const h = 50 + localPrng.nextFloat() * 120;
      this.game.scenery.push({
        x: localPrng.nextFloat() * this.game.gameW, w, h,
        color: darkenColor(env.ground, 0.2 + localPrng.nextFloat() * 0.3)
      });
    }

    const horizonCount = Math.floor(25 * (this.game.settings ? this.game.settings.bgElements : 1.0));
    for (let i = 0; i < horizonCount; i++) {
      this.game.horizonFoliage.push({
        x: localPrng.nextFloat() * this.game.gameW,
        h: 20 + localPrng.nextFloat() * 50,
        w: 15 + localPrng.nextFloat() * 30,
        phase: localPrng.nextFloat() * Math.PI * 2,
        speed: 0.5 + localPrng.nextFloat() * 1.5,
        color: env.horizonColor || darkenColor(env.ground, 0.4),
        type: env.horizonType || 'trees'
      });
    }

    const groundY = this.game.gameH * env.groundY;
    const groundCount = Math.floor(60 * (this.game.settings ? this.game.settings.groundElements : 1.0));
    for (let i = 0; i < groundCount; i++) {
      this.game.groundFoliage.push({
        x: localPrng.nextFloat() * this.game.gameW,
        y: groundY + 5 + localPrng.nextFloat() * (this.game.gameH - groundY - 10),
        size: 4 + localPrng.nextFloat() * 12,
        phase: localPrng.nextFloat() * Math.PI * 2,
        color: env.groundColor || darkenColor(env.ground, 0.1),
        type: env.groundType || 'grass'
      });
    }
  }
}
