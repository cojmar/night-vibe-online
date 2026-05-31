import * as ConfigModule from './config.js';
import { getGroundY, CONFIG_METADATA, ENV_CONFIG, ENV_LIST, REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, DEAD_BODY_LIFETIME, preloadFlippedImagesForAsset, PRNG } from './utils.js';
import Player from './player.js';
import Enemy from './enemy.js';
import Projectile from './projectile.js';

export default class NetworkSync {
  constructor(game) {
    this.game = game;
    this._lastSentState = {};
    this._lastConfigStr = '';
    this._broadcastThrottle = 0;
    this._clockSyncInFlight = false;
    this._pendingClockSyncT1 = 0;
    this._lastClockSync = 0;
  }

  bindEvents() {
    this.game.net.on('room.info', () => this.game.checkHost());
    this.game.net.on('room.user_join', () => { this.game.checkHost(); });
    this.game.net.on('item_pickup', (event) => { this.game.itemManager.handleItemPickup(event); });
    this.game.net.on('item_drop', (event) => { this.game.itemManager.handleItemDrop(event); });
    this.game.net.on('room.user_leave', (data) => {
      if (this.game.otherPlayers[data.user]) {
        delete this.game.otherPlayers[data.user];
      }
      this.game.checkHost();
    });
    this.game.net.on('room.user_data', (data) => this.handleUserData(data));

    // Custom events (server relays as { room, user, data })
    this.game.net.on('enemy_spawn', (event) => this.applyEnemySpawn(event.data));
    this.game.net.on('enemy_hit', (event) => this.game.applyEnemyHit(event.data));
    this.game.net.on('enemy_hit_player', (event) => this.applyPlayerHit(event.data));
    this.game.net.on('enemy_killed', (event) => this.applyEnemyKilled(event.data));
    this.game.net.on('projectile_spawn', (event) => this.applyProjectileSpawn(event.data));
    this.game.net.on('player_hit', (event) => this.applyPlayerHit(event.data));
    this.game.net.on('game_over', () => this.game.quitToMenu());
    this.game.net.on('wave_transition', (event) => this.applyWaveTransition(event.data));
    this.game.net.on('request_game_sync', (event) => {
      if (this.game.isHost) this.sendGameSync(event);
    });
    this.game.net.on('game_sync', (event) => {
      if (event.data.targetUserId && event.data.targetUserId !== this.game.net.me.info.user) return;
      this.applyGameSync(event.data);
    });
    this.game.net.on('clock_sync_req', (event) => {
      if (this.game.isHost) {
        this.game.net.send_cmd('clock_sync_resp', {
          t1: event.data.t1,
          t2: Date.now()
        });
      }
    });
    this.game.net.on('clock_sync_resp', (event) => {
      this.processClockSyncResp(event.data);
    });
  }

  emitEvent(type, data) {
    if (!this.game.net || !this.game.net.me || !this.game.net.me.info || !this.game.net.me.info.user) return;
    this.game.net.send_cmd(type, {
      source: this.game.net.me.info.user,
      timestamp: Date.now(),
      ...data
    });
  }

  requestClockSync() {
    if (this._clockSyncInFlight) return;
    this._clockSyncInFlight = true;
    this._pendingClockSyncT1 = Date.now();
    this.game.net.send_cmd('clock_sync_req', {
      t1: this._pendingClockSyncT1
    });
  }

  processClockSyncResp(data) {
    if (!this._clockSyncInFlight) return;
    this._clockSyncInFlight = false;
    const t1 = this._pendingClockSyncT1;
    const t2 = data.t2;
    const t4 = Date.now();
    if (!t1 || !t2) return;
    const offset = t2 - (t1 + t4) / 2;
    this.game._clockOffset = Math.round(offset);
    this._lastClockSync = Date.now();
  }

  sendGameSync(event) {
    const g = this.game;
    const eventData = event.data || event;
    const t1 = eventData.timestamp || 0;
    const t2 = Date.now();
    this.emitEvent('game_sync', {
      targetUserId: eventData.source || eventData.targetUserId,
      clientReqTime: t1,
      hostRecvTime: t2,
      gameStartUTC: g.gameStartUTC || 0,
      gameW: g.gameW || 2560,
      sessionSeed: g.sessionSeed,
      seed: g.prng ? g.prng.seed : 0,
      dropSeed: g.dropPrng ? g.dropPrng.seed : 0,
      env: g.selectedEnv,
      wave: g.wave,
      waveTotal: g.waveTotalEnemies,
      waveKilled: g.waveEnemiesKilled,
      waveSpawn: g.waveEnemiesToSpawn,
      bossActive: g.bossActive,
      enemies: g.enemies.filter(e => e.alive).map(e => ({
        id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp,
        name: e.name, icon: e.icon, color: e.color, size: e.size,
        atk: e.atk, spd: e.spd, atkRange: e.atkRange, atkSpeed: e.atkSpeed,
        moveSpeed: e.moveSpeed, isBoss: e.isBoss, missile: e.missile,
        bossState: e.bossState, bossChannelTimer: e.bossChannelTimer,
        bossLaserTimer: e.bossLaserTimer, targetLaserPos: e.targetLaserPos,
        _bossAction: e._bossAction, spawnIndex: e.spawnIndex
      })),
      items: g.items.map(item => ({ ...item })),
      projectiles: g.projectiles.map(p => ({
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

  applyGameSync(event) {
    const g = this.game;
    g._syncRequested = false;
    g._syncRetryTimer = 0;
    g.gameStartUTC = event.gameStartUTC;

    if (!g.isHost && event.clientReqTime && event.hostRecvTime && event.timestamp) {
      const t1 = event.clientReqTime;
      const t2 = event.hostRecvTime;
      const t3 = event.timestamp;
      const t4 = Date.now();
      const offset = ((t2 - t1) + (t3 - t4)) / 2;
      g._clockOffset = Math.round(offset);
      this._lastClockSync = Date.now();
    }

    if (event.gameW) {
      g.gameW = event.gameW;
      g._gameWFromHost = true;
      if (g.player) g.player.x = Math.max(20, Math.min(event.gameW - 20, g.player.x));
    }
    g.globalTime = (Date.now() + g._clockOffset - event.gameStartUTC) / 1000;
    g.sessionSeed = event.sessionSeed;
    if (!g.prng) g.prng = new PRNG(event.seed);
    else g.prng.seed = event.seed;
    if (!g.dropPrng) g.dropPrng = new PRNG(event.dropSeed);
    else g.dropPrng.seed = event.dropSeed;
    g.selectedEnv = event.env || 'forest';
    g.wave = event.wave || 1;
    g.waveTotalEnemies = event.waveTotal || 0;
    g.waveEnemiesKilled = event.waveKilled || 0;
    g.waveEnemiesToSpawn = event.waveSpawn || 0;
    g.bossActive = event.bossActive || false;

    g.enemies = [];
    if (event.enemies) {
      for (const eData of event.enemies) {
        const e = new Enemy(g, false, false, eData.spawnIndex || 0);
        e.id = eData.id;
        e.x = eData.x; e.y = eData.y; e.hp = eData.hp; e.maxHp = eData.maxHp;
        e.name = eData.name; e.icon = eData.icon; e.color = eData.color; e.size = eData.size;
        e.atk = eData.atk; e.spd = eData.spd; e.atkRange = eData.atkRange;
        e.atkSpeed = eData.atkSpeed; e.moveSpeed = eData.moveSpeed;
        e.alive = true;
        e.isBoss = eData.isBoss;
        e.missile = eData.missile;
        if (eData.isBoss) {
          e.bossState = eData.bossState;
          e.bossChannelTimer = eData.bossChannelTimer;
          e.bossLaserTimer = eData.bossLaserTimer;
          e.targetLaserPos = eData.targetLaserPos;
          e._bossAction = eData._bossAction;
        }
        g.enemies.push(e);
      }
    }

    g.items = event.items ? event.items.map(item => ({ ...item })) : [];
    g.projectiles = [];
    if (event.projectiles) {
      for (const pData of event.projectiles) {
        g.projectiles.push(new Projectile(pData));
      }
    }

    if (g.selectedEnv) {
      g.generateScenery();
      if (g.state === 'PLAYING' && g.ui) g.ui.updateEnvironment(g.selectedEnv);
      g.initBgParticles();
    }

    if (g.state === 'SYNCING' && g._pendingGameStart) {
      const pending = g._pendingGameStart;
      g._pendingGameStart = null;
      g._finalizeGameStart(pending);
    }
  }

  applyEnemySpawn(event) {
    if (this.game.enemies.find(e => e.id === event.id)) return;
    const g = this.game;
    const isBoss = event.isBoss || event.name === 'BOSS';
    const e = new Enemy(g, false, false, event.spawnIndex || 0);
    e.id = event.id;
    e.x = event.x; e.y = event.y; e.hp = event.hp; e.maxHp = event.maxHp;
    e.name = event.name; e.icon = event.icon; e.color = event.color; e.size = event.size;
    e.atk = event.atk; e.spd = event.spd; e.atkRange = event.atkRange;
    e.atkSpeed = event.atkSpeed; e.moveSpeed = event.moveSpeed;
    e.alive = true;
    e.isBoss = isBoss;
    if (isBoss) {
      e.bossState = event.bossState;
      e.bossChannelTimer = event.bossChannelTimer;
      e.bossLaserTimer = event.bossLaserTimer;
      e.targetLaserPos = event.targetLaserPos;
      e._bossAction = event._bossAction;
    }
    g.enemies.push(e);
  }

  applyEnemyKilled(event) {
    const e = this.game.enemies.find(x => x.id === event.enemyId);
    if (e && e.alive) {
      e.alive = false;
      e.deathTime = Date.now();
      e.hp = 0;
      this.game.particleManager.spawnEnemyDeathExplosion(e);
    }

    if (e) {
      this.game.waveEnemiesKilled++;
    }

    if (this.game.isHost && e) {
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

    if (event.playerId === this.game.net.me.info.user) {
      if (this.game.player && this.game.player.addKill()) {
        this.game.s2Cooldown = 0;
        this.game.ui.addLog(`🌟 Level Up! Level ${this.game.player.level}`, 'reward');
        this.game.ui.updateHUD(this.game.player);
        this.game.saveLocalProgression();
      }
    }

    if (this.game.state === 'PLAYING') {
      this.game.ui.updateScore(this.game.player, this.game.wave, this.game.waveEnemiesKilled, this.game.waveTotalEnemies);
    }
  }

  applyProjectileSpawn(event) {
    if (!event.projectile) return;
    this.game.projectiles.push(new Projectile(event.projectile));
    if (this.game.otherPlayers[event.source]) {
      this.game.otherPlayers[event.source].animTimer = 15;
      this.game.otherPlayers[event.source].action = 'attack';
    }
  }

  applyPlayerHit(event) {
    if (event.targetId === this.game.net.me.info.user) {
      this.game.dealDamageToPlayer(event.damage);
    }
  }

  applyWaveTransition(event) {
    this.game.wave = event.wave;
    this.game.waveTotalEnemies = event.waveTotal;
    this.game.waveEnemiesKilled = 0;
    this.game.waveEnemiesToSpawn = event.waveTotal;
    this.game.bossActive = event.bossActive || false;
    this.game.prng = new PRNG(this.game.sessionSeed + this.game.wave * 12345);
    this.game.dropPrng = new PRNG(this.game.sessionSeed + this.game.wave * 54321);

    if (this.game.player && !this.game.player.alive) {
      this.game.respawnPlayer();
    }
    this.game.generateScenery();
    this.game.initBgParticles();
    this.game.enemySpawnTimer = 0;
    if (this.game.bossActive) {
      this.game.ui.showBossWarning?.();
    }
    if (this.game.state === 'PLAYING') {
      this.game.ui.updateEnvironment(this.game.selectedEnv);
      this.game.ui.updateScore(this.game.player, this.game.wave, this.game.waveEnemiesKilled, this.game.waveTotalEnemies);
    }
  }

  handleUserData(data) {
    const userId = data.user;
    if (userId === this.game.net.me.info.user) return;

    // Read merged full state from room.users (always complete, not just delta)
    const roomEntry = this.game.net?.room?.users?.[userId];
    const fullData = roomEntry?.data || data.data;

    if (fullData.inGame === false || fullData.state === 'MENU') {
      if (this.game.otherPlayers[userId]) {
        delete this.game.otherPlayers[userId];
      }
      return;
    }

    if (fullData.state === 'PLAYING' && !this.game.otherPlayers[userId]) {
      this.game.otherPlayers[userId] = new Player(
        userId, false,
        fullData.classType || 'warrior',
        fullData.x || this.game.gameW / 2,
        fullData.y || (getGroundY(this.game.selectedEnv) + this.game.gameH) / 2
      );
      this.game.otherPlayers[userId].state = 'PLAYING';
      this.game.otherPlayers[userId].inGame = true;
    }

    const p = this.game.otherPlayers[userId];
    if (p) {
      p.state = fullData.state || 'PLAYING';
      p.inGame = fullData.inGame !== false;
      p.x = fullData.x;
      p.y = fullData.y;
      p.hp = fullData.hp;
      p._maxHp = fullData.maxHp;
      p.level = fullData.level;
      p.kills = fullData.kills || 0;
      p.facing = fullData.facing;
      p.aimAngle = fullData.aimAngle;
      p.action = fullData.action;
      p.classType = fullData.classType;
      p.alive = fullData.alive !== false;
      p.nick = fullData.nick || '';
      p.hitFlash = fullData.hitFlash || 0;
      p.chatMsg = fullData.chatMsg || null;
      p.lastDataTime = Date.now();
    }

    // Copy host config
    if (!this.game.isHost && fullData.gameplayConfig) {
      const hostId = this.getDeterministicHost();
      const isSenderHost = hostId === userId;
      if (isSenderHost) {
        ConfigModule.updateConfig(fullData.gameplayConfig);
        if (fullData.gameplayConfigName) {
          ConfigModule.setActivePresetName(fullData.gameplayConfigName);
        }
        if (fullData.classData) ConfigModule.updateClassData(fullData.classData);
        if (fullData.enemyTypes) ConfigModule.updateEnemyTypes(fullData.enemyTypes);
        if (fullData.itemsDb) ConfigModule.updateItemsDb(fullData.itemsDb);
        if (fullData.classData) {
          for (const k in fullData.classData) {
            const ic = fullData.classData[k].icon;
            if (ic && typeof ic === 'string') preloadFlippedImagesForAsset(ic);
          }
        }
        if (fullData.enemyTypes) {
          for (const e of fullData.enemyTypes) {
            if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon);
          }
        }
        if (fullData.itemsDb) {
          for (const item of fullData.itemsDb) {
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

    if (!this.game.isHost && fullData.gameW && fullData.gameW !== this.game.gameW) {
      const hostId = this.getDeterministicHost();
      if (hostId === userId) {
        this.game.gameW = fullData.gameW;
        this.game._gameWFromHost = true;
        if (this.game.player && this.game.player.isLocal) {
          this.game.player.x = Math.max(20, Math.min(fullData.gameW - 20, this.game.player.x));
        }
        this.game.generateScenery();
        this.game.initBgParticles();
        if (this.game.updateLayout) this.game.updateLayout();
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
      if (this.game.net.me && this.game.net.me.info && a === this.game.net.me.info.user) timeA = this.game.playerJoinedAt || 0;
      else if (this.game.net.room && this.game.net.room.users && this.game.net.room.users[a] && this.game.net.room.users[a].data) timeA = this.game.net.room.users[a].data.playerJoinedAt || 0;
      if (this.game.net.me && this.game.net.me.info && b === this.game.net.me.info.user) timeB = this.game.playerJoinedAt || 0;
      else if (this.game.net.room && this.game.net.room.users && this.game.net.room.users[b] && this.game.net.room.users[b].data) timeB = this.game.net.room.users[b].data.playerJoinedAt || 0;
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
          gameplayConfig: ConfigModule.activeConfig,
          gameplayConfigName: ConfigModule.activePresetName || 'Default',
          classData: ConfigModule.CLASS_DATA,
          enemyTypes: ConfigModule.ENEMY_TYPES,
          itemsDb: ConfigModule.ITEMS_DB
        });
      }
    }
  }

  broadcastState() {
    if (!this.game.net || !this.game.net.me) return;
    const p = this.game.player;
    if (!p) return;
    const now = Date.now();
    if (now - this._broadcastThrottle < 50) return;
    this._broadcastThrottle = now;

    if (!this.game.isHost && now - this._lastClockSync > 15000) {
      this.requestClockSync();
    }

    const last = this._lastSentState;
    const delta = {};

    const inGame = this.game.state === 'PLAYING';
    if (inGame !== last.inGame) delta.inGame = inGame;
    const state = this.game.state;
    if (state !== last.state) delta.state = state;
    if (p.x !== last.x) delta.x = p.x;
    if (p.y !== last.y) delta.y = p.y;
    if (p.hp !== last.hp) delta.hp = p.hp;

    const maxHp = p._maxHp || p.maxHp;
    if (maxHp !== last.maxHp) delta.maxHp = maxHp;
    if (p.level !== last.level) delta.level = p.level;
    if (p.kills !== last.kills) delta.kills = p.kills;
    if (p.facing !== last.facing) delta.facing = p.facing;
    if (p.aimAngle !== last.aimAngle) delta.aimAngle = p.aimAngle;
    if (p.action !== last.action) delta.action = p.action;
    if (p.classType !== last.classType) delta.classType = p.classType;

    const alive = p.alive !== false;
    if (alive !== last.alive) delta.alive = alive;
    const nick = p.nick || '';
    if (nick !== last.nick) delta.nick = nick;
    const hitFlash = p.hitFlash || 0;
    if (hitFlash !== last.hitFlash) delta.hitFlash = hitFlash;
    const chatMsg = p.chatMsg || null;
    if (chatMsg !== last.chatMsg) delta.chatMsg = chatMsg;

    const playerJoinedAt = this.game.playerJoinedAt || 0;
    if (playerJoinedAt !== last.playerJoinedAt) delta.playerJoinedAt = playerJoinedAt;

    if (this.game.isHost) {
      const gameStartUTC = this.game.gameStartUTC || 0;
      if (gameStartUTC !== last.gameStartUTC) delta.gameStartUTC = gameStartUTC;
      const gameW = this.game.gameW || 0;
      if (gameW !== last.gameW) delta.gameW = gameW;
      const selectedEnv = this.game.selectedEnv;
      if (selectedEnv !== last.selectedEnv) delta.selectedEnv = selectedEnv;

      const configStr = JSON.stringify({
        c: ConfigModule.activeConfig,
        n: ConfigModule.activePresetName,
        cl: ConfigModule.CLASS_DATA,
        et: ConfigModule.ENEMY_TYPES,
        id: ConfigModule.ITEMS_DB
      });
      if (configStr !== this._lastConfigStr) {
        this._lastConfigStr = configStr;
        delta.gameplayConfig = ConfigModule.activeConfig;
        delta.gameplayConfigName = ConfigModule.activePresetName || 'Default';
        delta.classData = ConfigModule.CLASS_DATA;
        delta.enemyTypes = ConfigModule.ENEMY_TYPES;
        delta.itemsDb = ConfigModule.ITEMS_DB;
      }
    }

    if (Object.keys(delta).length === 0) return;
    Object.assign(last, delta);
    this.game.net.send_cmd('set_data', delta);
  }
}
