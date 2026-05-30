import * as ConfigModule from './config.js';
import { PRNG } from './utils.js';
import Enemy from './enemy.js';

export default class WaveManager {
  constructor(game) {
    this.game = game;
  }

  initWaves() {
    this.game.wave = ConfigModule.GAME_INITIAL_WAVE;
    if (this.game.wave % ConfigModule.BOSS_WAVE_INTERVAL === 0) {
      this.game.bossActive = true;
      let numBosses = 1;
      if (ConfigModule.BOSS_WAVE_INTERVAL > 0) {
        const bossWaveNum = Math.floor(this.game.wave / ConfigModule.BOSS_WAVE_INTERVAL);
        if (bossWaveNum > 1) {
          numBosses = 1 + (bossWaveNum - 1) * ConfigModule.BOSS_SPAWN_INCREMENT;
        }
      }
      this.game.waveTotalEnemies = numBosses;
      this.game.waveEnemiesToSpawn = numBosses;
    } else {
      this.game.bossActive = false;
      this.game.waveTotalEnemies = ConfigModule.GAME_INITIAL_WAVE_ENEMIES;
      this.game.waveEnemiesToSpawn = ConfigModule.GAME_INITIAL_WAVE_ENEMIES;
    }
    this.game.waveEnemiesKilled = 0;
    this.game.waveTransitionTimer = 0;
    this.game.emptyWaveTimer = 0;
  }

  updateWaveTransitions(dt, activePlayers) {
    if (!this.game.isHost) return;

    this.game.enemies = this.game.enemies.filter(e => e.alive || (Date.now() - e.deathTime < 2000));

    const aliveCount = this.game.enemies.filter(e => e.alive).length;
    if (aliveCount === 0 && this.game.waveTransitionTimer <= 0 && this.game.waveEnemiesToSpawn === 0) {
      this.game.emptyWaveTimer = (this.game.emptyWaveTimer || 0) + dt * 16.67;
      if (this.game.emptyWaveTimer > 60000) {
        this.game.waveTransitionTimer = 120;
        this.game.emptyWaveTimer = 0;
      }
    } else {
      this.game.emptyWaveTimer = 0;
    }

    if (this.game.waveTransitionTimer > 0) {
      this.game.waveTransitionTimer -= dt;
      if (this.game.waveTransitionTimer <= 0) {
        this.transitionToNextWave(activePlayers);
      }
    }

    this.spawnEnemies(dt);
  }

  transitionToNextWave(activePlayers) {
    if (this.game.player && !this.game.player.alive) this.game.respawnPlayer();
    this.game.wave++;
    this.game.prng = new PRNG(this.game.sessionSeed + this.game.wave * 12345);
    this.game.dropPrng = new PRNG(this.game.sessionSeed + this.game.wave * 54321);
    this.game.waveEnemiesKilled = 0;
    this.game.generateScenery();
    if (this.game.state === 'MENU') {
      document.getElementById('main-area').style.display = 'none';
    }
    this.game.initBgParticles();
    if (this.game.wave % ConfigModule.BOSS_WAVE_INTERVAL === 0) {
      this.game.bossActive = true;
      let numBosses = 1;
      if (ConfigModule.BOSS_WAVE_INTERVAL > 0) {
        const bossWaveNum = Math.floor(this.game.wave / ConfigModule.BOSS_WAVE_INTERVAL);
        if (bossWaveNum > 1) {
          numBosses = 1 + (bossWaveNum - 1) * ConfigModule.BOSS_SPAWN_INCREMENT;
        }
      }
      this.game.waveTotalEnemies = numBosses;
      this.game.waveEnemiesToSpawn = numBosses;
      this.game.ui.showBossWarning();
    } else {
      this.game.bossActive = false;
      let baseEnemies = 10 + Math.floor(this.game.wave * 2.5 + Math.pow(this.game.wave, 1.2));
      let pCount = activePlayers ? activePlayers.length : 1;
      this.game.waveTotalEnemies = Math.floor(baseEnemies * (0.5 + pCount * 0.5));
      this.game.waveEnemiesToSpawn = this.game.waveTotalEnemies;
    }
    this.game.waveEnemiesKilled = 0;
    this.game.ui.updateScore(this.game.player, this.game.wave, this.game.waveEnemiesKilled, this.game.waveTotalEnemies);
  }

  spawnEnemies(dt) {
    if (this.game.waveTransitionTimer > 0 || this.game.waveEnemiesToSpawn <= 0) return;
    this.game.enemySpawnTimer += 16.67 * dt;
    if (this.game.enemySpawnTimer >= this.game.enemySpawnInterval) {
      this.game.enemySpawnTimer = 0;
      const spawnIndex = this.game.waveTotalEnemies - this.game.waveEnemiesToSpawn;
      const newEnemy = new Enemy(this.game, this.game.bossActive, false, spawnIndex);
      if (!this.game.enemies.find(e => e.id === newEnemy.id)) {
        this.game.enemies.push(newEnemy);
      }
      this.game.waveEnemiesToSpawn--;
    }
  }
}
