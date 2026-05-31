import * as ConfigModule from './config.js';
import { getGroundY, CONFIG_METADATA, ENV_LIST, CLASS_DATA, PRNG, REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, REBIRTH_POINTS_PER_LEVEL, ENEMY_SPAWN_INTERVAL, GAME_INITIAL_WAVE, GAME_INITIAL_KILLS, GAME_INITIAL_WAVE_ENEMIES, POTION_BUFF_DURATION, preloadFlippedImagesForAsset } from './utils.js';
import Player from './player.js';
import Enemy from './enemy.js';
import ParticleManager from './particle-manager.js';
import SceneryManager from './scenery-manager.js';
import AtmosphereManager from './atmosphere-manager.js';
import ItemManager from './item-manager.js';
import InputManager from './input-manager.js';
import ViewportManager from './viewport-manager.js';
import ProgressionManager from './progression-manager.js';
import WaveManager from './wave-manager.js';
import CombatManager from './combat-manager.js';
import NetworkSync from './network-sync.js';
import SettingsManager from './settings-manager.js';
import HudManager from './hud-manager.js';
import Renderer from './renderer.js';

export default class Game {
  constructor(app) {
    this.gameW = ConfigModule.GAME_W || 2560;
    this.gameH = ConfigModule.GAME_H || 1024;
    this.app = app;
    this.ui = app.ui;
    this.net = app.net;
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.webglCanvas = document.getElementById('webgl-canvas');
    this.gl = this.webglCanvas.getContext('webgl') || this.webglCanvas.getContext('experimental-webgl');

    this.state = 'MENU';
    [this.wave, this.kills] = [1, 0];
    [this.waveTotalEnemies, this.waveEnemiesKilled, this.waveEnemiesToSpawn] = [10, 0, 10];
    this.bossActive = false;
    this.waveTransitionTimer = 0;
    this.selectedEnv = 'forest';
    this.scenery = this.horizonFoliage = this.groundFoliage = null;
    this.player = null;
    this.otherPlayers = {};
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bgParticles = [];
    this.items = [];
    this.atmosEffects = [];
    this.s2Cooldown = 0;
    this.s2MaxCooldown = 1000;
    this.mouseDown = this.autoRestartS2 = false;
    this.queuedFireball = null;
    this.lastTime = 0;
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = ENEMY_SPAWN_INTERVAL;
    this.viewScale = 1;
    this.zoomScale = 1;
    this.zoomTarget = 1;
    this.viewOX = 0;
    this.viewOY = 0;
    this.pixelRatio = 1;
    this.layoutRefreshTimer = this.layoutSettledTimer = null;
    this.globalTime = 0;
    this.moveMarker = null;
    this.cameraX = this.cameraY = 0;
    this.cullMinX = this.cullMaxX = this.cullMinY = this.cullMaxY = 0;
    this.cachedCanvasRect = this.savedZoomTarget = null;
    this.screenShake = 0;
    this.nightAlpha = this.dayAlpha = 0;
    this.lightX = this.lightY = this.lightIntensity = 0;
    this.fps = 60;
    this.frameCount = this.lastFpsTime = 0;
    this.isHost = false;
    this.syncTimer = 0;
    this._gameOverEmitted = false;
    this.sessionSeed = Math.floor(Math.random() * 2000000000);
    this.prng = new PRNG(this.sessionSeed + this.wave * 12345);
    this.dropPrng = new PRNG(this.sessionSeed + this.wave * 54321);
    this.gameStartUTC = 0;
    this._clockOffset = 0;
    this._gameWFromHost = false;
    this.hostCheckTimer = this.emptyWaveTimer = 0;
    this._syncRequested = false;
    this._syncRetryTimer = 0;
    this.leftClickInterval = this.touchLeftClickInterval = this.s2HoldTimer = this.gameOverCooldownTimer = null;

    const saved = JSON.parse(localStorage.getItem('nightvibe-settings') || '{}');
    this.settings = {};
    ['particles', 'bgElements', 'groundElements', 'atmos'].forEach(k => this.settings[k] = saved[k] !== undefined ? saved[k] : 2.0);
    this.settings.autoGraphics = saved.autoGraphics !== undefined ? saved.autoGraphics : true;
    this.settings.autoLimit = saved.autoLimit !== undefined ? saved.autoLimit : true;

    this.particleManager = new ParticleManager(this);
    this.sceneryManager = new SceneryManager(this);
    this.atmosphereManager = new AtmosphereManager(this);
    this.itemManager = new ItemManager(this);
    this.inputManager = new InputManager(this);
    this.viewportManager = new ViewportManager(this);
    this.progressionManager = new ProgressionManager(this);
    this.waveManager = new WaveManager(this);
    this.combatManager = new CombatManager(this);
    this.networkSync = new NetworkSync(this);
    this.settingsManager = new SettingsManager(this);
    this.hudManager = new HudManager(this);
    this.renderer = new Renderer(this);

    this.renderer.initWebGL();
    this.networkSync.bindEvents();
    this.inputManager.bindEvents();
    this.scheduleLayoutUpdate();
  }

  init() {
    this.resizeObserver = new ResizeObserver(() => this.scheduleLayoutUpdate());
    this.resizeObserver.observe(document.getElementById('main-area'));
    this.resizeObserver.observe(document.body);

    window.addEventListener('resize', () => this.scheduleLayoutUpdate());
    window.addEventListener('orientationchange', () => this.scheduleLayoutUpdate(), { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.scheduleLayoutUpdate(), { passive: true });
      window.visualViewport.addEventListener('scroll', () => this.scheduleLayoutUpdate(), { passive: true });
    }

    this.initBgParticles();
    this.updateLayout();
    this.drawMenuBackground();
    this.ui.initSettings();

    requestAnimationFrame((t) => this.loop(t));
  }

  getGroundY() { return getGroundY(this.selectedEnv); }
  generateScenery() { this.sceneryManager.generateScenery(); }
  initBgParticles() { this.particleManager.initBgParticles(); }
  spawnParticles(x, y, color, count, speed, sizeScale) { this.particleManager.spawnParticles(x, y, color, count, speed, sizeScale); }
  spawnDamageParticles(x, y) { this.particleManager.spawnDamageParticles(x, y); }
  spawnEnemyDeathExplosion(e) { this.particleManager.spawnEnemyDeathExplosion(e); }
  triggerLevelUpAnimation(p) { this.particleManager.triggerLevelUpAnimation(p); }
  handleLeftClick(cx, cy) { this.combatManager.handleLeftClick(cx, cy); }
  doSkill1(tx, ty) { this.combatManager.doSkill1(tx, ty); }
  startChargingSkill2() { this.combatManager.startChargingSkill2(); }
  releaseSkill2() { this.combatManager.releaseSkill2(); }
  dealDamage(enemy, baseDamage, critChance) { this.combatManager.emitEnemyHit(enemy, baseDamage, critChance); }
  applyEnemyHit(event) { this.combatManager.applyEnemyHit(event); }
  dealDamageToPlayer(damage) { this.combatManager.dealDamageToPlayer(damage); }
  applyKnockback(enemy, dirAngle, distance) { this.combatManager.applyKnockback(enemy, dirAngle, distance); }
  spawnProjectile(props, broadcast) { this.combatManager.spawnProjectile(props, broadcast); }
  getDeterministicHost() { return this.networkSync.getDeterministicHost(); }
  checkHost() { this.networkSync.checkHost(); }
  broadcastState() { this.networkSync.broadcastState(); }
  emitEvent(type, data) { this.networkSync.emitEvent(type, data); }
  upgradeStat(statType, amount) { this.progressionManager.upgradeStat(statType, amount); }
  requestRebirth() { this.progressionManager.requestRebirth(); }
  performRebirth() { this.progressionManager.performRebirth(); }
  restoreWebsocketStats(target, myData, selectedClass) { this.progressionManager.restoreWebsocketStats(target, myData, selectedClass); }
  saveLocalProgression() { this.progressionManager.saveLocalProgression(); }
  _resetSessionData() { this.progressionManager._resetSessionData(); }
  respawnPlayer() { this.progressionManager.respawnPlayer(); }
  handleItemPickup(event) { this.itemManager.handleItemPickup(event); }
  handleItemDrop(event) { this.itemManager.handleItemDrop(event); }

  scheduleLayoutUpdate() { this.viewportManager.scheduleLayoutUpdate(); }
  updateLayout() { this.viewportManager.updateLayout(); }
  toGameCoords(clientX, clientY) { return this.viewportManager.toGameCoords(clientX, clientY); }
  applyViewport(dt) { this.viewportManager.applyViewport(dt); }
  drawMenuBackground() { this.renderer.drawMenuBackground(); }
  drawEnvironment() { this.renderer.drawEnvironment(); }
  renderWebGL() { this.renderer.renderWebGL(); }

  startGame(selectedClass) {
    if (this.ui?.saveLastGameConfig) this.ui.saveLastGameConfig();
    this._resetSessionData();
    this._gameOverEmitted = false;
    this.networkSync._lastSentState = {};
    this.selectedEnv = ENV_LIST[0];
    this.kills = GAME_INITIAL_KILLS;
    this.wave = GAME_INITIAL_WAVE;
    this.waveManager.initWaves();
    this.enemySpawnInterval = ENEMY_SPAWN_INTERVAL;
    this.enemySpawnTimer = 0;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    if (ConfigModule.CLEAR_ITEMS_ON_START) this.items = [];
    this.s2Cooldown = 0;
    this.ui.recentLogs = [];
    this.sessionSeed = Math.floor(Math.random() * 2000000000);
    this.prng = new PRNG(this.sessionSeed + this.wave * 12345);
    this.dropPrng = new PRNG(this.sessionSeed + this.wave * 54321);
    this.gameStartUTC = 0;

    const bestHost = this.getDeterministicHost();
    const amIHost = bestHost === (this.net?.me?.info ? this.net.me.info.user : null);

    if (bestHost && !amIHost && this.net?.room?.users[bestHost]) {
      const userData = this.net.room.users[bestHost].data;
      if (userData?.inGame && userData.state === 'PLAYING') {
        this.isHost = false;
        if (userData.gameplayConfig) {
          ConfigModule.updateConfig(userData.gameplayConfig);
          if (userData.gameplayConfigName) ConfigModule.setActivePresetName(userData.gameplayConfigName);
          if (userData.classData) { ConfigModule.updateClassData(userData.classData); Object.values(userData.classData).forEach(c => { if (c.icon && typeof c.icon === 'string') preloadFlippedImagesForAsset(c.icon); }); }
          if (userData.enemyTypes) { ConfigModule.updateEnemyTypes(userData.enemyTypes); userData.enemyTypes.forEach(e => { if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon); }); }
          if (userData.itemsDb) { ConfigModule.updateItemsDb(userData.itemsDb); userData.itemsDb.forEach(item => { if (item.icon && typeof item.icon === 'string') preloadFlippedImagesForAsset(item.icon); }); }
          if (this.ui) { this.ui.buildClassesTab?.(); this.ui.buildMonstersTab?.(); this.ui.updateClassCarousel?.(); }
          this.ui.addLog(`📥 Synced gameplay balance config from the Host (${bestHost}).`, 'system');
        }
        this.selectedEnv = userData.env || userData.selectedEnv || ENV_LIST[0];
        this.playerJoinedAt = Date.now();

        let spawnX = this.gameW / 2;
        let spawnY = (getGroundY(this.selectedEnv) + this.gameH) / 2;
        const hd = this.net.room.users[bestHost].data;
        if (hd?.x !== undefined && hd?.y !== undefined) {
          const userHash = this.net.me.info.user.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          const spawnPrng = new PRNG(this.sessionSeed + userHash);
          spawnX = Math.max(20, Math.min(this.gameW - 20, hd.x + (spawnPrng.nextFloat() - 0.5) * 150));
          spawnY = Math.max(getGroundY(this.selectedEnv) - 50, Math.min(this.gameH - 45, hd.y + (spawnPrng.nextFloat() - 0.5) * 60));
        }

        this._pendingGameStart = {
          selectedClass, spawnX, spawnY,
          nick: document.getElementById('nick-input')?.value || '',
          myData: this.net?.room?.users?.[this.net?.me?.info?.user]?.data || null
        };

        this.emitEvent('request_game_sync', {});
        this._syncRequested = true;
        this.state = 'SYNCING';
        this.ui.addLog('⏳ Syncing with host...', 'system');
        return;
      }
    }

    this.isHost = true;
    this.state = 'PLAYING';
    this.gameStartUTC = Date.now();
    this.ui.addLog('👑 You are the Host!', 'reward');
    if (this.net?.me) this.net.send_cmd('set_data', { gameplayConfig: ConfigModule.activeConfig, gameplayConfigName: ConfigModule.activePresetName || 'Default', classData: ConfigModule.CLASS_DATA, enemyTypes: ConfigModule.ENEMY_TYPES, itemsDb: ConfigModule.ITEMS_DB });

    Object.values(ConfigModule.CLASS_DATA).forEach(c => { if (c.icon && typeof c.icon === 'string') preloadFlippedImagesForAsset(c.icon); });
    ConfigModule.ENEMY_TYPES.forEach(e => { if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon); });
    ConfigModule.ITEMS_DB.forEach(item => { if (item.icon && typeof item.icon === 'string') preloadFlippedImagesForAsset(item.icon); });

    this.playerJoinedAt = Date.now();
    this.generateScenery();
    let myData = this.net?.room?.users?.[this.net?.me?.info?.user]?.data || null;
    let spawnX = this.gameW / 2;
    let spawnY = (getGroundY(this.selectedEnv) + this.gameH) / 2;

    this.player = new Player(this.net.me.info.user, true, selectedClass, spawnX, spawnY);
    this.checkHost();
    this.restoreWebsocketStats(this.player, myData, selectedClass);
    this.player.hp = this.player.maxHp;
    const nickInput = document.getElementById('nick-input');
    if (nickInput) this.player.nick = nickInput.value;
    this.ui.updateScore(this.player, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
    this.ui.updateHUD(this.player);
    this.ui.updateEnvironment(this.selectedEnv);
    this.initBgParticles();
    document.getElementById('menu-panel').classList.add('hidden');
    document.getElementById('main-area').style.display = 'flex';
    this.canvas.style.display = 'block';
    ['hud', 'cd-ring', 'compact-log'].forEach(id => document.getElementById(id).classList.add('visible'));
    document.getElementById('game-btns').style.display = 'flex';
    this.ui.addLog('⚔️ Fight started! Tap ground to move, tap enemies to attack!', 'player');
    this.updateLayout();
    [100, 500].forEach(d => setTimeout(() => { if (this.state === 'PLAYING') this.updateLayout(); }, d));
    this.checkHost();
    this.broadcastState();
  }

  _finalizeGameStart(pending) {
    const { selectedClass, spawnX, spawnY, nick, myData } = pending;
    this.state = 'PLAYING';
    this.player = new Player(this.net.me.info.user, true, selectedClass, spawnX, spawnY);
    this.restoreWebsocketStats(this.player, myData, selectedClass);
    this.player.hp = this.player.maxHp;
    this.player.nick = nick;
    this.ui.updateScore(this.player, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
    this.ui.updateHUD(this.player);
    this.ui.updateEnvironment(this.selectedEnv);
    document.getElementById('menu-panel').classList.add('hidden');
    document.getElementById('main-area').style.display = 'flex';
    this.canvas.style.display = 'block';
    ['hud', 'cd-ring', 'compact-log'].forEach(id => document.getElementById(id).classList.add('visible'));
    document.getElementById('game-btns').style.display = 'flex';
    this.ui.addLog('⚔️ Fight started! Tap ground to move, tap enemies to attack!', 'player');
    this.updateLayout();
    [100, 500].forEach(d => setTimeout(() => { if (this.state === 'PLAYING') this.updateLayout(); }, d));
    this.checkHost();
    this.broadcastState();
  }

  quitToMenu() {
    if (this.player) {
      const reqLevel = REBIRTH_BASE_LEVEL + (this.player.resets || 0) * REBIRTH_LEVEL_STEP;
      if (this.player.level >= reqLevel) {
        this.ui.addLog(`✨ Auto-Rebirth applied! (+${this.player.level * REBIRTH_POINTS_PER_LEVEL} Stats)`, 'reward');
        this.performRebirth();
        return;
      }
    }
    if (this.ui?.saveLastGameConfig) this.ui.saveLastGameConfig();
    this.saveLocalProgression();
    this.state = 'MENU';
    this._syncRequested = false;
    this._syncRetryTimer = 0;
    this._gameOverEmitted = false;
    document.getElementById('game-btns').style.display = 'none';
    ['hud', 'cd-ring', 'compact-log', 'walk-indicator'].forEach(id => document.getElementById(id).classList.remove('visible'));
    document.getElementById('menu-panel').classList.remove('hidden');
    document.getElementById('main-area').style.display = 'none';
    this.canvas.style.display = 'none';
    document.getElementById('death-overlay').classList.remove('show');
    this.player = null;
    this.enemies = []; this.projectiles = []; this.particles = []; this.items = []; this.floatingTexts = []; this.bgParticles = [];
    this.wave = 1; this.kills = 0; this.waveTotalEnemies = 10; this.waveEnemiesKilled = 0; this.waveEnemiesToSpawn = 10;
    this.bossActive = false; this.waveTransitionTimer = 0; this.s2Cooldown = 0; this.mouseDown = false; this.autoRestartS2 = false; this.queuedFireball = null; this.enemySpawnTimer = 0;
    this.ui.addLog('🎮 Returned to character selection!', 'player');
    if (this.net?.me) {
      this._resetSessionData();
      this.isHost = false; this.gameStartUTC = 0; this._clockOffset = 0; this._gameWFromHost = false;
      this.net.send_cmd('set_data', { inGame: false, state: 'MENU', gameplayConfig: {}, classData: {}, enemyTypes: [], itemsDb: [] });
    }
    this.checkHost();
    this.updateLayout();
    if (this.ui) { this.ui.buildClassesTab?.(); this.ui.buildMonstersTab?.(); this.ui.updateClassCarousel?.(); }
  }

  loop(time) {
    if (this._syncRequested && !this.isHost) {
      this._syncRetryTimer = (this._syncRetryTimer || 0) + 16.67;
      if (this._syncRetryTimer > 2000) {
        this._syncRetryTimer = 0;
        this.emitEvent('request_game_sync', {});
      }
    }
    if (this.state !== 'PLAYING') { this.renderWebGL(); requestAnimationFrame((t) => this.loop(t)); return; }
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 16.67, 3) : 1;
    this.lastTime = time;
    this.globalTime = (Date.now() + this._clockOffset - this.gameStartUTC) / 1000;
    this.frameCount = (this.frameCount || 0) + 1;
    if (!this.lastFpsTime) this.lastFpsTime = Date.now();
    if (Date.now() - this.lastFpsTime >= 2000) { this.fps = this.frameCount / 2; this.frameCount = 0; this.lastFpsTime = Date.now(); this.settingsManager.adjustAutoQuality(); }

    const cycle = (this.globalTime % ConfigModule.DAY_CYCLE_DURATION) / ConfigModule.DAY_CYCLE_DURATION;
    const dayFraction = 14 / 24;
    const mappedCycle = cycle <= dayFraction ? (cycle / dayFraction) * 0.5 : 0.5 + ((cycle - dayFraction) / (1 - dayFraction)) * 0.5;
    const sunAltitude = Math.sin(mappedCycle * 2 * Math.PI);
    this.dayAlpha = Math.max(0, sunAltitude);
    this.nightAlpha += ((sunAltitude > 0.2 ? 0 : sunAltitude > 0 ? 0.4 * (1 - sunAltitude / 0.2) : Math.min(0.85, 0.4 + 0.45 * Math.min(1, -sunAltitude / 0.5))) - this.nightAlpha) * Math.min(1, 0.02 * dt);

    if (this.isHost && this.player?.alive) {
      const envIndex = Math.floor(this.globalTime / (ConfigModule.ENV_CYCLE_DURATION || 300)) % ENV_LIST.length;
      const newEnv = ENV_LIST[envIndex];
      if (newEnv && newEnv !== this.selectedEnv) { this.selectedEnv = newEnv; this.generateScenery(); this.ui.updateEnvironment(this.selectedEnv); this.initBgParticles(); }
    } else {
      this.hostCheckTimer = (this.hostCheckTimer || 0) + dt * 16.67;
      if (this.hostCheckTimer > 1000) { this.hostCheckTimer = 0; this.checkHost(); }
    }

    this.atmosphereManager.processAtmosEffects(dt);
    this.atmosphereManager.updateAtmosEffects(dt);
    const dpr = this.pixelRatio || 1;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);
    this.ctx.save();
    this.applyViewport(dt);
    this.drawEnvironment();
    this.renderer.renderBgParticles();
    this.renderer.renderMoveMarker();

    let activePlayers = [];
    if (this.player?.alive) activePlayers.push(this.player);
    for (let key in this.otherPlayers) { let p = this.otherPlayers[key]; if (p.inGame && p.hp > 0 && p.alive) activePlayers.push(p); }

    if (activePlayers.length === 0 && this.state === 'PLAYING' && !this._gameOverEmitted) {
      this._gameOverEmitted = true;
      this.emitEvent('game_over', {});
      this.quitToMenu();
      this.ctx.restore();
      this.renderWebGL();
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    for (let e of this.enemies) {
      e.update(dt, activePlayers);
      this.itemManager.dropItemsOnEnemyDeath(e);
    }

    if (this.player) {
      this.player.updateMovement(dt, this);
      if (this.player.isChargingS2) {
        this.combatManager.updateS2Charge(dt);
      }
      if (this.player.action === 'attack' && this.player.animTimer <= 0 && !this.player.isChargingS2) { this.player.action = 'idle'; this.broadcastState(); }
      else if (this.player.action === 'walk' && !this.player.isMoving) { this.player.action = 'idle'; this.broadcastState(); }
    }
    for (const key in this.otherPlayers) { this.otherPlayers[key].updateMovement(dt, this); }

    let drawItems = [];
    if (this.player?.isMoving && !this.player.autoAttackTarget) {
      drawItems.push({ y: this.player.moveTargetY - 1, t: 0 });
    }
    for (let e of this.enemies) {
      if (e.x < this.cullMinX || e.x > this.cullMaxX || e.y < this.cullMinY || e.y > this.cullMaxY) {
        if (!(e.name === 'BOSS' && (e.bossState === 'CHANNELING_LASER' || e.bossState === 'FIRING_LASER'))) continue;
      }
      drawItems.push({ y: e.y, t: 1, r: e });
    }
    if (this.player) drawItems.push({ y: this.player.y, t: 2 });
    for (const key in this.otherPlayers) {
      const p = this.otherPlayers[key];
      if (p.inGame && !(p.x < this.cullMinX || p.x > this.cullMaxX || p.y < this.cullMinY || p.y > this.cullMaxY)) drawItems.push({ y: p.y, t: 3, r: p });
    }

    this.itemManager.updateItems(dt);
    if (this.items) {
      for (let item of this.items) {
        if (item.x >= this.cullMinX && item.x <= this.cullMaxX && item.y >= this.cullMinY && item.y <= this.cullMaxY) drawItems.push({ y: item.y, t: 4, r: item });
      }
    }
    this.renderer.renderGroundFoliage();
    drawItems.sort((a, b) => a.y - b.y);
    for (let i = 0, di; i < drawItems.length; i++) {
      di = drawItems[i];
      if (di.t === 0) {
        this.renderer.renderPlayerWalkMarkerRaw(this.ctx, this.player);
      } else if (di.t === 1) {
        this.renderer.renderEnemyTargetHighlight(di.r, this.ctx);
        di.r.draw(this.ctx, getGroundY(this.selectedEnv));
      } else if (di.t === 2) {
        this.player.draw(this.ctx, dt, this);
      } else if (di.t === 3) {
        di.r.draw(this.ctx, dt, this);
      } else if (di.t === 4) {
        this.renderer.renderItem(di.r, this.ctx);
      }
    }

    for (let p of this.projectiles) { p.update(dt, this); if (p.x >= this.cullMinX && p.x <= this.cullMaxX && p.y >= this.cullMinY && p.y <= this.cullMaxY) p.draw(this.ctx); }
    for (let i = this.projectiles.length - 1; i >= 0; i--) { if (this.projectiles[i].life <= 0) this.projectiles.splice(i, 1); }

    if (this.queuedFireball && this.player) {
      const qf = this.queuedFireball;
      const spawnX = qf.x || qf.spawnX, spawnY = qf.y || qf.spawnY;
      let canSpawn = true;
      for (let p of this.projectiles) {
        if (p.type === 'fireball' && p.life > 0 && Math.hypot(p.x - spawnX, p.y - spawnY) < (qf.radius || 15) + (p.radius || 15) + 10) { canSpawn = false; break; }
      }
      if (canSpawn) {
        this.spawnProjectile({ type: 'fireball', x: spawnX, y: spawnY, speed: qf.speed || 5, life: qf.fbLife || 80, maxLife: qf.fbLife || 80, color: qf.color || '#e67e22', damage: qf.damage || 1, critChance: 0.2, radius: qf.radius || 15, traveled: 0, trailTimer: 0, trailPositions: [], tx: qf.tx, ty: qf.ty, angle: qf.angle, facing: qf.facing });
        this.spawnParticles(spawnX, spawnY, qf.color || '#e67e22', 15, 4);
        this.queuedFireball = null;
      }
    }

    this.renderer.renderParticles();
    this.renderer.renderAtmosEffects();
    this.renderer.renderFloatingTexts();

    this.ui.updatePartyList(this.otherPlayers);
    this.ui.updateBuffs(this.player?.alive && this.state === 'PLAYING' ? this.player.buffHpTimer : 0, this.player?.alive && this.state === 'PLAYING' ? this.player.buffManaTimer : 0);

    let cdSpeedMultiplier = 1;
    if (this.player?.alive && this.state === 'PLAYING') {
      if (this.player.buffHpTimer > 0) {
        this.player.buffHpTimer -= 16.67 * dt;
        if (this.player.buffHpTimer <= 0) this.ui.addLog('💔 Vampirism buff expired!', 'system');
        if (Math.random() < 0.1) this.spawnParticles(this.player.x + (Math.random() - 0.5) * 30, this.player.y - Math.random() * 50, '#e74c3c', 1, 3);
      }
      if (this.player.buffManaTimer > 0) {
        this.player.buffManaTimer -= 16.67 * dt;
        if (this.player.buffManaTimer <= 0) this.ui.addLog('⚡ Skill Cooldown buff expired!', 'system');
        cdSpeedMultiplier = ConfigModule.POTION_BLUE_CD_MULTIPLIER;
        if (Math.random() < 0.1) this.spawnParticles(this.player.x + (Math.random() - 0.5) * 30, this.player.y - Math.random() * 50, '#3498db', 1, 3);
      }
    }
    if (this.s2Cooldown > 0) {
      this.s2Cooldown = Math.max(0, this.s2Cooldown - 16.67 * dt * cdSpeedMultiplier);
      if (this.s2Cooldown <= 0 && this.autoRestartS2 && this.player && !this.player.isMoving) { this.autoRestartS2 = false; this.startChargingSkill2(); }
    }
    this.ui.updateCooldownRing(this.s2Cooldown, this.s2MaxCooldown);
    this.waveManager.updateWaveTransitions(dt, activePlayers);
    this.syncTimer = (this.syncTimer || 0) + 16.67 * dt;
    if (this.syncTimer >= 100) { this.syncTimer = 0; this.checkHost(); this.broadcastState(); }

    this.renderer.renderDayNightOverlays();
    this.hudManager.updateTargetPanel();
    this.hudManager.updateGameTimeDisplay(this.gameStartUTC);
    this.hudManager.updateFpsDisplay();

    this.ctx.restore();
    this.renderWebGL();
    requestAnimationFrame((t) => this.loop(t));
  }

}
