import * as ConfigModule from './config.js';
import { getGroundY, CONFIG_METADATA, ENV_CONFIG, ENV_LIST, REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, DEAD_BODY_LIFETIME, preloadFlippedImagesForAsset, PRNG } from './utils.js';
import Player from './player.js';
import Enemy from './enemy.js';
import Projectile from './projectile.js';

export default class NetworkSync {
  constructor(game) {
    this.game = game;
  }

  bindEvents() {
    this.game.net.on('room.info', () => this.game.checkHost());
    this.game.net.on('room.user_join', () => {
      this.game.checkHost();
      if (this.game.isHost) {
        this.game.net.send_cmd('set_data', {
          syncProjectiles: this.game.projectiles.map(p => ({
            type: p.type, x: p.x, y: p.y, vx: p.vx, vy: p.vy, tx: p.tx, ty: p.ty,
            angle: p.angle, life: p.life, maxLife: p.maxLife, radius: p.radius, color: p.color,
            originX: p.originX, originY: p.originY, traveled: p.traveled, damage: p.damage,
            ownerId: p.ownerId, id: p.id, bodyScale: p.bodyScale, charges: p.charges,
            critChance: p.critChance, explodeRadius: p.explodeRadius, explodeDamage: p.explodeDamage,
            casterSpd: p.casterSpd, retargetTimer: p.retargetTimer, wobble: p.wobble,
            trailTimer: p.trailTimer, trailPositions: p.trailPositions || []
          }))
        });
      }
    });
    this.game.net.on('room.msg', (data) => {
      if (data.cmd === 'game.event' && data.data && data.data.type) {
        this.game.handleGameEvent(data.data);
      }
    });
    this.game.net.on('item_pickup', (event) => {
      this.game.itemManager.handleItemPickup(event);
    });
    this.game.net.on('item_drop', (event) => {
      this.game.itemManager.handleItemDrop(event);
    });
    this.game.net.on('room.user_leave', (data) => {
      if (this.game.otherPlayers[data.user]) {
        delete this.game.otherPlayers[data.user];
      }
      this.game.checkHost();
    });
    this.game.net.on('room.user_data', (data) => this.handleUserData(data));
  }

  handleUserData(data) {
    if (data.data && data.data.enemyKilled && this.game.player && typeof data.data.enemyKilled === 'string') {
      if (data.data.enemyKilled !== this.game.lastProcessedKill && data.data.enemyKilled.split('_')[0] === this.game.net.me.info.user) {
        this.game.lastProcessedKill = data.data.enemyKilled;
        if (this.game.player.addKill()) {
          this.game.s2Cooldown = 0;
          this.game.ui.addLog(`🌟 Level Up! Level ${this.game.player.level}`, 'reward');
          this.game.ui.updateHUD(this.game.player);
          this.game.particleManager.triggerLevelUpAnimation(this.game.player);
          this.game.broadcastState();
          this.game.saveLocalProgression();
        }
        if (this.game.state === 'PLAYING') {
          this.game.ui.updateScore(this.game.player, this.game.wave, this.game.waveEnemiesKilled, this.game.waveTotalEnemies);
        }
      }
    }

    if (this.game.net.me && data.user !== this.game.net.me.info.user) {
      const fullData = (this.game.net.room.users[data.user] && this.game.net.room.users[data.user].data) ? this.game.net.room.users[data.user].data : data.data;
      if (!this.game.otherPlayers[data.user]) {
        this.game.otherPlayers[data.user] = new Player(data.user, false, fullData.classType || 'warrior', fullData.x || this.game.gameW / 2, fullData.y || (getGroundY(this.game.selectedEnv) + this.game.gameH) / 2);
      }

      if (this.game.isHost && data.data.requestSync) {
        this.game.net.send_cmd('set_data', {
          syncProjectiles: this.game.projectiles.map(p => ({
            type: p.type, x: p.x, y: p.y, vx: p.vx, vy: p.vy, tx: p.tx, ty: p.ty,
            angle: p.angle, life: p.life, maxLife: p.maxLife, radius: p.radius, color: p.color,
            originX: p.originX, originY: p.originY, traveled: p.traveled, damage: p.damage,
            ownerId: p.ownerId, id: p.id, bodyScale: p.bodyScale, charges: p.charges,
            critChance: p.critChance, explodeRadius: p.explodeRadius, explodeDamage: p.explodeDamage,
            casterSpd: p.casterSpd, retargetTimer: p.retargetTimer, wobble: p.wobble,
            trailTimer: p.trailTimer, trailPositions: p.trailPositions || []
          }))
        });
      }

      if (this.game.state === 'PLAYING' && data.data.spawnedProjectile) {
        if (!this.game.projectiles.find(p => p.id === data.data.spawnedProjectile.id)) {
          this.game.projectiles.push(new Projectile(data.data.spawnedProjectile));
          if (this.game.otherPlayers[data.user]) {
            this.game.otherPlayers[data.user].animTimer = 15;
            this.game.otherPlayers[data.user].action = 'attack';
          }
        }
      }
      if (this.game.state === 'PLAYING' && data.data.syncProjectiles) {
        for (let sp of data.data.syncProjectiles) {
          if (!this.game.projectiles.find(p => p.id === sp.id)) {
            this.game.projectiles.push(new Projectile(sp));
          }
        }
      }

      const oldInGame = this.game.otherPlayers[data.user].inGame;
      const oldState = this.game.otherPlayers[data.user].state;
      const oldIsHost = this.game.otherPlayers[data.user].isHost;
      const oldHitFlash = this.game.otherPlayers[data.user].hitFlash || 0;

      this.game.otherPlayers[data.user].set(fullData);

      if (data.data.hitFlash !== undefined && data.data.hitFlash > oldHitFlash) {
        this.game.particleManager.spawnDamageParticles(this.game.otherPlayers[data.user].x, this.game.otherPlayers[data.user].y);
      }

      if (data.data.state === 'MENU' || data.data.inGame === false) {
        this.game.otherPlayers[data.user].projectiles = [];
        this.game.otherPlayers[data.user].hp = 0;
      }

      this.game.otherPlayers[data.user].lastDataTime = Date.now();
      if (data.data.lastInputTime !== undefined) {
        this.game.otherPlayers[data.user].lastInputTime = data.data.lastInputTime;
      }
      if (data.data.inGame !== undefined) {
        this.game.otherPlayers[data.user].inGame = data.data.inGame;
      }
      if (data.data.state !== undefined) {
        this.game.otherPlayers[data.user].state = data.data.state;
      }

      if (data.data.level !== undefined) {
        const oldLevel = this.game.otherPlayers[data.user].level || 1;
        if (data.data.level > oldLevel) {
          this.game.particleManager.triggerLevelUpAnimation(this.game.otherPlayers[data.user]);
        }
      }

      if (this.game.otherPlayers[data.user].inGame !== oldInGame || this.game.otherPlayers[data.user].state !== oldState || this.game.otherPlayers[data.user].isHost !== oldIsHost) {
        this.game.checkHost();
      }

      if (this.game.state === 'PLAYING' && data.data.hits) {
        data.data.hits.forEach(hit => {
          let e = this.game.enemies.find(ex => ex.id === hit.id);
          if (e && e.alive) {
            e.hp -= hit.damage;
            e.hitFlash = 8;
            this.game.floatingTexts.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 30, text: (hit.isCrit ? '💥 ' : '') + hit.damage, color: hit.isCrit ? '#ffd700' : '#fff', life: 40, maxLife: 40, isCrit: hit.isCrit });
            if (e.hp <= 0) {
              e.alive = false; e.deathTime = Date.now(); e.hp = 0;
              this.game.particleManager.spawnEnemyDeathExplosion(e);
              if (this.game.isHost) {
                if (hit.source) {
                  this.game.net.send_cmd('set_data', { enemyKilled: hit.source + '_' + Math.random() });
                }
                this.game.waveEnemiesKilled++;
                if (this.game.bossActive && e.name === 'BOSS') {
                  const aliveBosses = this.game.enemies.filter(ex => ex.name === 'BOSS' && ex.alive);
                  if (aliveBosses.length === 0) {
                    this.game.enemies.forEach(ex => { if (ex.alive) { ex.hp = 0; ex.alive = false; } });
                    this.game.waveTransitionTimer = 120;
                  }
                } else if (!this.game.bossActive && this.game.waveEnemiesKilled >= this.game.waveTotalEnemies) {
                  this.game.waveTransitionTimer = 120;
                }
              }
            }
          }
        });
      }

      if (data.data.enemyHitPlayer) {
        if (data.data.enemyHitPlayer.id === this.game.net.me.info.user) {
          this.game.dealDamageToPlayer(data.data.enemyHitPlayer.dmg);
        }
      }

      if (data.data.gameOver) {
        this.game.quitToMenu();
      }

      if (this.game.isHost && data.data.spawnItem) {
        this.game.items.push(data.data.spawnItem);
      }

      if (this.game.state === 'PLAYING' && data.data.hostData && !this.game.isHost) {
        const currentBestHost = this.game.getDeterministicHost();
        if (data.user === currentBestHost) {
          this.game.syncHostData(data.data.hostData);
        }
      }

      if (data.data.gameplayConfig && !this.game.isHost) {
        const op = this.game.otherPlayers[data.user];
        const isSenderHost = (data.data.isHost || (op && op.isHost)) && op && op.state !== 'MENU';
        if (isSenderHost) {
          ConfigModule.updateConfig(data.data.gameplayConfig);
          if (data.data.gameplayConfigName) {
            ConfigModule.setActivePresetName(data.data.gameplayConfigName);
          }
          if (data.data.classData) ConfigModule.updateClassData(data.data.classData);
          if (data.data.enemyTypes) ConfigModule.updateEnemyTypes(data.data.enemyTypes);
          if (data.data.itemsDb) ConfigModule.updateItemsDb(data.data.itemsDb);
          if (data.data.classData) {
            for (const k in data.data.classData) {
              const ic = data.data.classData[k].icon;
              if (ic && typeof ic === 'string') preloadFlippedImagesForAsset(ic);
            }
          }
          if (data.data.enemyTypes) {
            for (const e of data.data.enemyTypes) {
              if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon);
            }
          }
          if (data.data.itemsDb) {
            for (const item of data.data.itemsDb) {
              if (item.icon && typeof item.icon === 'string') preloadFlippedImagesForAsset(item.icon);
            }
          }
          if (this.game.updateLayout) this.game.updateLayout();
          if (this.game.ui) {
            if (this.game.ui.buildClassesTab) this.game.ui.buildClassesTab();
            if (this.game.ui.buildMonstersTab) this.game.ui.buildMonstersTab();
            if (this.game.ui.buildItemsTab) this.game.ui.buildItemsTab();
            if (this.game.ui.updateClassCarousel) this.game.ui.updateClassCarousel();
          }
        }
      }
    }
  }

  getDeterministicHost() {
    if (!this.game.net || !this.game.net.room || !this.game.net.room.users) return null;
    const users = Object.keys(this.game.net.room.users);
    if (this.game.net.me && this.game.net.me.info && !users.includes(this.game.net.me.info.user)) {
      users.push(this.game.net.me.info.user);
    }
    const activeUsers = users.filter(user => {
      if (this.game.net.room && this.game.net.room.users && this.game.net.room.users[user]) {
        const uInfo = this.game.net.room.users[user].info;
        if (uInfo && uInfo.disconnected !== false && uInfo.disconnected !== undefined) return false;
      }
      if (this.game.net.me && this.game.net.me.info && user === this.game.net.me.info.user) {
        return this.game.state === 'PLAYING';
      } else {
        const roomUser = this.game.net.room && this.game.net.room.users && this.game.net.room.users[user];
        if (!roomUser || !roomUser.data) return false;
        return roomUser.data.inGame === true && roomUser.data.state === 'PLAYING';
      }
    });
    if (activeUsers.length === 0) return null;
    const hostCandidates = activeUsers.sort((a, b) => {
      let timeA = 0, timeB = 0;
      if (this.game.net.me && this.game.net.me.info && a === this.game.net.me.info.user) timeA = this.game.gameStartTime || 0;
      else if (this.game.net.room && this.game.net.room.users && this.game.net.room.users[a] && this.game.net.room.users[a].data) timeA = this.game.net.room.users[a].data.gameStartTime || 0;
      if (this.game.net.me && this.game.net.me.info && b === this.game.net.me.info.user) timeB = this.game.gameStartTime || 0;
      else if (this.game.net.room && this.game.net.room.users && this.game.net.room.users[b] && this.game.net.room.users[b].data) timeB = this.game.net.room.users[b].data.gameStartTime || 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.localeCompare(b);
    });
    return hostCandidates[0];
  }

  checkHost() {
    if (!this.game.net || !this.game.net.room || !this.game.net.room.users || !this.game.net.me || !this.game.net.me.info) {
      if (this.game.isHost) { this.game.isHost = false; this.game.ui.addLog('👥 You are a Client', 'reward'); }
      return;
    }
    if (this.game.state !== 'PLAYING') {
      if (this.game.isHost) { this.game.isHost = false; this.game.ui.addLog('👥 You are a Client', 'reward'); }
      return;
    }
    const bestHost = this.getDeterministicHost();
    const isHost = bestHost === this.game.net.me.info.user;
    if (this.game.isHost !== isHost) {
      this.game.isHost = isHost;
      this.game.ui.addLog(this.game.isHost ? '👑 You are the Host!' : '👥 You are a Client', 'reward');
      if (this.game.isHost) {
        this.game.net.send_cmd('set_data', {
          isHost: true,
          gameplayConfig: ConfigModule.activeConfig,
          classData: ConfigModule.CLASS_DATA,
          enemyTypes: ConfigModule.ENEMY_TYPES,
          itemsDb: ConfigModule.ITEMS_DB
        });
      } else {
        this.game.net.send_cmd('set_data', { isHost: false });
      }
    }
  }

  syncHostData(hostData) {
    if (hostData.gameStartTime !== undefined) this.game.hostGameStartTime = hostData.gameStartTime;
    if (hostData.time !== undefined) this.game.globalTime = hostData.time;
    if (hostData.sessionSeed !== undefined) this.game.sessionSeed = hostData.sessionSeed;
    if (hostData.seed !== undefined) {
      if (!this.game.prng) this.game.prng = new PRNG(hostData.seed);
      else this.game.prng.seed = hostData.seed;
    }
    if (hostData.dropSeed !== undefined) {
      if (!this.game.dropPrng) this.game.dropPrng = new PRNG(hostData.dropSeed);
      else this.game.dropPrng.seed = hostData.dropSeed;
    }
    if (this.game.wave !== hostData.wave && hostData.wave) {
      if (this.game.player && !this.game.player.alive) this.game.respawnPlayer();
      this.game.wave = hostData.wave;
    }
    if (hostData.waveTotal !== undefined) this.game.waveTotalEnemies = hostData.waveTotal;
    if (hostData.waveSpawn !== undefined) this.game.waveEnemiesToSpawn = hostData.waveSpawn;
    this.game.kills = hostData.kills;
    this.game.waveEnemiesKilled = hostData.waveKilled || 0;
    this.game.bossActive = hostData.bossActive || false;
    if (this.game.state === 'PLAYING') {
      this.game.ui.updateScore(this.game.player, this.game.wave, this.game.waveEnemiesKilled, this.game.waveTotalEnemies);
    }
    if (this.game.selectedEnv !== hostData.env) {
      this.game.selectedEnv = hostData.env || 'forest';
      this.game.generateScenery();
      if (this.game.state === 'PLAYING') this.game.ui.updateEnvironment(this.game.selectedEnv);
      this.game.initBgParticles();
    }
    const hostEnemyIds = hostData.enemies.map(e => e.id);
    this.game.enemies = this.game.enemies.filter(e => hostEnemyIds.includes(e.id));
    hostData.enemies.forEach(eData => {
      let e = this.game.enemies.find(ex => ex.id === eData.id);
      if (!e) {
        let isBoss = eData.name === 'BOSS';
        let spawnIndex = 0;
        if (eData.id && eData.id.startsWith('E_')) {
          const parts = eData.id.split('_');
          if (parts.length === 3) spawnIndex = parseInt(parts[2]) || 0;
        }
        e = new Enemy(this.game, isBoss, false, spawnIndex);
        e.id = eData.id;
        if (eData.id && eData.id.startsWith('M_')) { e.name = 'MISSILE'; e.icon = '🚀'; e.size = 20; e.color = '#e74c3c'; }
        e.x = eData.x || e.x;
        e.y = eData.y || e.y;
        this.game.enemies.push(e);
      }
      if (eData.x !== undefined) e.serverX = eData.x;
      if (eData.y !== undefined) e.serverY = eData.y;
      if (eData.hp !== undefined) e.hp = eData.hp;
      if (eData.maxHp !== undefined) e.maxHp = eData.maxHp;
      if (eData.alive !== undefined) {
        if (e.alive && !eData.alive) this.game.particleManager.spawnEnemyDeathExplosion(e);
        e.alive = eData.alive;
      }
      if (eData.name !== undefined) e.name = eData.name;
      if (eData.size !== undefined) e.size = eData.size;
      if (eData.bossState !== undefined) e.bossState = eData.bossState;
      if (eData.bossChannelTimer !== undefined) e.bossChannelTimer = eData.bossChannelTimer;
      if (eData.targetLaserPos !== undefined) e.targetLaserPos = eData.targetLaserPos;
      if (eData.bossLaserTimer !== undefined) e.bossLaserTimer = eData.bossLaserTimer;
      if (eData.deathTime && eData.deathTime > 0) e.deathTime = eData.deathTime;
    });
    this.game.enemies = this.game.enemies.filter(e => hostData.enemies.find(ex => ex.id === e.id) || (!e.alive && e.deathTime && Date.now() - e.deathTime < DEAD_BODY_LIFETIME));
    if (hostData.items) {
      this.game.items = hostData.items.map(item => ({ ...item }));
    }
  }

  broadcastState() {
    if (!this.game.player) return;
    const activeConfig = {};
    for (const key in CONFIG_METADATA) activeConfig[key] = ConfigModule[key];
    const reqLevel = 4 + (this.game.player.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.game.player.level - 1) / Math.max(1, reqLevel - 1));
    const weaponY = this.game.player.y - 40 * lvlScale;
    const computedAimAngle = parseFloat(Math.atan2(this.game.player.mouseY - weaponY, this.game.player.mouseX - this.game.player.x).toFixed(1));
    const data = {
      inGame: true, gameStartTime: this.game.gameStartTime || 0, state: this.game.state,
      nick: this.game.player.nick, alive: this.game.player.alive,
      x: this.game.player.x, y: this.game.player.y, hp: this.game.player.hp,
      maxHp: this.game.player._maxHp, atk: this.game.player._atk, spd: this.game.player._spd,
      level: this.game.player.level, resets: this.game.player.resets,
      kills: this.game.player.kills, reqKills: this.game.player.reqKills,
      facing: this.game.player.facing, aimAngle: computedAimAngle,
      action: this.game.player.action, classType: this.game.player.classType,
      hitFlash: this.game.player.hitFlash, lastInputTime: this.game.player.lastInputTime || 0,
      lastSkill: this.game.player.lastSkill || 1, isChargingS2: this.game.player.isChargingS2,
      s2ChargeCount: this.game.player.s2ChargeCount, chatMsg: this.game.player.chatMsg,
      targetedItemId: this.game.player.targetedItemId,
    };
    if (this.game.pendingHits && this.game.pendingHits.length > 0) {
      data.hits = this.game.pendingHits;
      this.game.pendingHits = [];
    }
    if (this.game.isHost) {
      data.hostData = {
        gameStartTime: this.game.hostGameStartTime || this.game.gameStartTime,
        wave: this.game.wave, kills: this.game.kills, seed: this.game.prng.seed,
        dropSeed: this.game.dropPrng ? this.game.dropPrng.seed : 0,
        sessionSeed: this.game.sessionSeed, env: this.game.selectedEnv,
        waveTotal: this.game.waveTotalEnemies, waveKilled: this.game.waveEnemiesKilled,
        waveSpawn: this.game.waveEnemiesToSpawn, bossActive: this.game.bossActive,
        enemies: this.game.enemies.filter(e => e.alive || (Date.now() - e.deathTime < DEAD_BODY_LIFETIME)).map(e => ({
          id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, alive: e.alive, name: e.name, size: e.size, deathTime: e.deathTime
        })),
        items: this.game.items.map(i => ({
          ...i,
          icon: (i.icon && typeof i.icon === 'string' && i.icon.startsWith('data:image/')) ? '📦' : i.icon
        }))
      };
    }
    if (!this.game.lastBroadcastStr) this.game.lastBroadcastStr = {};
    const delta = {};
    let hasChanges = false;
    for (const key in data) {
      const valStr = JSON.stringify(data[key]);
      if (valStr !== this.game.lastBroadcastStr[key]) {
        this.game.lastBroadcastStr[key] = valStr;
        if (data[key] !== undefined) { delta[key] = data[key]; hasChanges = true; }
      }
    }
    if (hasChanges && this.game.net && this.game.net.me) {
      this.game.net.send_cmd('set_data', delta);
      delete this.game.lastBroadcastStr['hits'];
      delete this.game.lastBroadcastStr['enemyHitPlayer'];
      delete this.game.lastBroadcastStr['spawnedProjectile'];
      delete this.game.lastBroadcastStr['enemyKilled'];
      delete this.game.lastBroadcastStr['spawnItem'];
    }
  }

  emitEvent(type, data) {
    if (!this.game.net || !this.game.net.me) return;
    this.game.net.send_cmd('room.msg', {
      cmd: 'game.event',
      data: { type, source: this.game.net.me.info.user, timestamp: Date.now(), ...data }
    });
  }
}
