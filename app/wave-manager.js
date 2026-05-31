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
    this.game.enemies = this.game.enemies.filter(e => e.alive || (Date.now() - e.deathTime < 2000));

    if (this.game.isHost) {
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
    }

    this.spawnEnemies(dt);
  }

  transitionToNextWave(activePlayers) {
    const nextWave = this.game.wave + 1;
    let waveTotal, waveBoss;
    if (nextWave % ConfigModule.BOSS_WAVE_INTERVAL === 0) {
      waveBoss = true;
      let numBosses = 1;
      if (ConfigModule.BOSS_WAVE_INTERVAL > 0) {
        const bossWaveNum = Math.floor(nextWave / ConfigModule.BOSS_WAVE_INTERVAL);
        if (bossWaveNum > 1) {
          numBosses = 1 + (bossWaveNum - 1) * ConfigModule.BOSS_SPAWN_INCREMENT;
        }
      }
      waveTotal = numBosses;
    } else {
      waveBoss = false;
      let baseEnemies = 10 + Math.floor(nextWave * 2.5 + Math.pow(nextWave, 1.2));
      let pCount = activePlayers ? activePlayers.length : 1;
      waveTotal = Math.floor(baseEnemies * (0.5 + pCount * 0.5));
    }
    this.game.networkSync.emitEvent('wave_transition', {
      wave: nextWave,
      waveTotal: waveTotal,
      bossActive: waveBoss
    });
  }

  spawnEnemies(dt) {
    if (!this.game.isHost) return;
    if (this.game.waveTransitionTimer > 0 || this.game.waveEnemiesToSpawn <= 0) return;
    this.game.enemySpawnTimer += 16.67 * dt;
    if (this.game.enemySpawnTimer >= this.game.enemySpawnInterval) {
      this.game.enemySpawnTimer = 0;
      const spawnIndex = this.game.waveTotalEnemies - this.game.waveEnemiesToSpawn;
      const newEnemy = new Enemy(this.game, this.game.bossActive, false, spawnIndex);
      this.game.waveEnemiesToSpawn--;
      this.game.networkSync.emitEvent('enemy_spawn', {
        id: newEnemy.id, x: newEnemy.x, y: newEnemy.y,
        hp: newEnemy.hp, maxHp: newEnemy.maxHp,
        name: newEnemy.name, icon: newEnemy.icon,
        color: newEnemy.color, size: newEnemy.size,
        atk: newEnemy.atk, spd: newEnemy.spd,
        atkRange: newEnemy.atkRange, atkSpeed: newEnemy.atkSpeed,
        moveSpeed: newEnemy.moveSpeed,
        isBoss: newEnemy.isBoss, spawnIndex: spawnIndex,
        bossState: newEnemy.bossState,
        bossChannelTimer: newEnemy.bossChannelTimer,
        bossLaserTimer: newEnemy.bossLaserTimer,
        targetLaserPos: newEnemy.targetLaserPos,
        _bossAction: newEnemy._bossAction,
      });
    }
  }
}
