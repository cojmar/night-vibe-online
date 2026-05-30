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
    this.pendingHits = [];
    this.lastProcessedKill = null;
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
    this.sessionSeed = Math.floor(Math.random() * 2000000000);
    this.prng = new PRNG(this.sessionSeed + this.wave * 12345);
    this.dropPrng = new PRNG(this.sessionSeed + this.wave * 54321);
    this.hostGameStartTime = this.gameStartTime = 0;
    this.lastBroadcastStr = {};
    this.hostCheckTimer = this.emptyWaveTimer = 0;
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
  dealDamage(enemy, baseDamage, critChance) { this.combatManager.dealDamage(enemy, baseDamage, critChance); }
  dealDamageToPlayer(damage) { this.combatManager.dealDamageToPlayer(damage); }
  applyKnockback(enemy, dirAngle, distance) { this.combatManager.applyKnockback(enemy, dirAngle, distance); }
  spawnProjectile(props, broadcast) { this.combatManager.spawnProjectile(props, broadcast); }
  getDeterministicHost() { return this.networkSync.getDeterministicHost(); }
  checkHost() { this.networkSync.checkHost(); }
  syncHostData(hostData) { this.networkSync.syncHostData(hostData); }
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
  handleGameEvent(event) { this.itemManager.handleGameEvent(event); }
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
    this.state = 'PLAYING';
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
    this.gameStartTime = Date.now();
    this.hostGameStartTime = 0;

    let hostFound = false;
    const bestHost = this.getDeterministicHost();
    const amIHost = bestHost === (this.net?.me?.info ? this.net.me.info.user : null);

    if (bestHost && !amIHost && this.net?.room?.users[bestHost]) {
      const userData = this.net.room.users[bestHost].data;
      if (userData?.inGame && userData.state === 'PLAYING') {
        hostFound = true;
        this.isHost = false;
        if (userData.gameplayConfig) {
          ConfigModule.updateConfig(userData.gameplayConfig);
          if (userData.gameplayConfigName) ConfigModule.setActivePresetName(userData.gameplayConfigName);
          if (userData.classData) { ConfigModule.updateClassData(userData.classData); Object.values(userData.classData).forEach(c => { if (c.icon && typeof c.icon === 'string') preloadFlippedImagesForAsset(c.icon); }); }
          if (userData.enemyTypes) { ConfigModule.updateEnemyTypes(userData.enemyTypes); userData.enemyTypes.forEach(e => { if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon); }); }
          if (userData.itemsDb) { ConfigModule.updateItemsDb(userData.itemsDb); userData.itemsDb.forEach(item => { if (item.icon && typeof item.icon === 'string') preloadFlippedImagesForAsset(item.icon); }); }
          if (this.ui) { this.ui.buildClassesTab?.(); this.ui.buildMonstersTab?.(); this.ui.buildItemsTab?.(); this.ui.updateClassCarousel?.(); }
          this.ui.addLog(`📥 Synced gameplay balance config from the Host (${bestHost}).`, 'system');
        }
        if (userData.hostData) {
          this.wave = userData.hostData.wave || GAME_INITIAL_WAVE;
          this.waveTotalEnemies = userData.hostData.waveTotal || GAME_INITIAL_WAVE_ENEMIES;
          this.waveEnemiesKilled = userData.hostData.waveKilled || 0;
          this.waveEnemiesToSpawn = userData.hostData.waveSpawn || GAME_INITIAL_WAVE_ENEMIES;
          this.bossActive = userData.hostData.bossActive || false;
          this.selectedEnv = userData.hostData.env || ENV_LIST[0];
          this.sessionSeed = userData.hostData.sessionSeed || 0;
          this.prng = new PRNG(userData.hostData.seed !== undefined ? userData.hostData.seed : (this.sessionSeed + this.wave * 12345));
          this.dropPrng = new PRNG(userData.hostData.dropSeed !== undefined ? userData.hostData.dropSeed : (this.sessionSeed + this.wave * 54321));
          if (userData.hostData.enemies) {
            userData.hostData.enemies.forEach(eData => {
              let e = this.enemies.find(ex => ex.id === eData.id);
              if (e) {
                if (Math.hypot(e.x - eData.x, e.y - eData.y) > 50) { e.x = eData.x; e.y = eData.y; }
                e.serverX = eData.x; e.serverY = eData.y;
                if (e.hp > eData.hp && eData.hp <= 0) e.deathTime = eData.deathTime || Date.now();
                e.hp = eData.hp; e.alive = eData.alive;
                ['bossState', 'bossChannelTimer', 'targetLaserPos', 'bossLaserTimer'].forEach(k => { if (eData[k] !== undefined) e[k] = eData[k]; });
              } else {
                const newE = new Enemy(this, eData.name === 'BOSS', false, eData.id?.startsWith('E_') ? (parseInt(eData.id.split('_')[2]) || 0) : 0);
                newE.id = eData.id;
                if (eData.id?.startsWith('M_')) { newE.name = 'MISSILE'; newE.icon = '🚀'; newE.size = 20; newE.color = '#e74c3c'; }
                newE.x = eData.x || newE.x; newE.y = eData.y || newE.y;
                newE.serverX = eData.x || newE.x; newE.serverY = eData.y || newE.y;
                newE.hp = eData.hp; newE.maxHp = eData.maxHp; newE.alive = eData.alive;
                newE.name = eData.name; newE.size = eData.size;
                this.enemies.push(newE);
              }
            });
          }
          if (userData.hostData.items) this.items = userData.hostData.items.map(item => ({ ...item }));
        }
      }
    }

    if (!hostFound) {
      this.isHost = true;
      this.ui.addLog('👑 You are the Host!', 'reward');
      if (this.net?.me) this.net.send_cmd('set_data', { isHost: true, gameplayConfig: ConfigModule.activeConfig, gameplayConfigName: ConfigModule.activePresetName || 'Default', classData: ConfigModule.CLASS_DATA, enemyTypes: ConfigModule.ENEMY_TYPES, itemsDb: ConfigModule.ITEMS_DB });
    }

    if (this.isHost) {
      Object.values(ConfigModule.CLASS_DATA).forEach(c => { if (c.icon && typeof c.icon === 'string') preloadFlippedImagesForAsset(c.icon); });
      ConfigModule.ENEMY_TYPES.forEach(e => { if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon); });
      ConfigModule.ITEMS_DB.forEach(item => { if (item.icon && typeof item.icon === 'string') preloadFlippedImagesForAsset(item.icon); });
    }

    this.generateScenery();
    let myData = this.net?.room?.users?.[this.net?.me?.info?.user]?.data || null;
    let spawnX = this.gameW / 2;
    let spawnY = (getGroundY(this.selectedEnv) + this.gameH) / 2;

    if (bestHost && !amIHost && this.net?.room?.users[bestHost]) {
      const hd = this.net.room.users[bestHost].data;
      if (hd?.x !== undefined && hd?.y !== undefined) {
        const userHash = this.net.me.info.user.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const spawnPrng = new PRNG(this.sessionSeed + userHash);
        spawnX = Math.max(20, Math.min(this.gameW - 20, hd.x + (spawnPrng.nextFloat() - 0.5) * 150));
        spawnY = Math.max(getGroundY(this.selectedEnv) - 50, Math.min(this.gameH - 45, hd.y + (spawnPrng.nextFloat() - 0.5) * 60));
      }
    }

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
    this.net.send_cmd('set_data', { gameOver: 0 });
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
    document.getElementById('game-btns').style.display = 'none';
    ['hud', 'cd-ring', 'compact-log', 'walk-indicator'].forEach(id => document.getElementById(id).classList.remove('visible'));
    document.getElementById('menu-panel').classList.remove('hidden');
    document.getElementById('main-area').style.display = 'none';
    this.canvas.style.display = 'none';
    document.getElementById('death-overlay').classList.remove('show');
    this.player = null;
    this.enemies = []; this.projectiles = []; this.particles = []; this.items = []; this.floatingTexts = []; this.bgParticles = []; this.pendingHits = [];
    this.wave = 1; this.kills = 0; this.waveTotalEnemies = 10; this.waveEnemiesKilled = 0; this.waveEnemiesToSpawn = 10;
    this.bossActive = false; this.waveTransitionTimer = 0; this.s2Cooldown = 0; this.mouseDown = false; this.autoRestartS2 = false; this.queuedFireball = null; this.enemySpawnTimer = 0;
    this.ui.addLog('🎮 Returned to character selection!', 'player');
    if (this.net?.me) {
      this._resetSessionData();
      this.isHost = false; this.gameStartTime = 0; this.hostGameStartTime = 0; this.lastBroadcastStr = {};
      this.net.send_cmd('set_data', { inGame: false, state: 'MENU', isHost: false, gameStartTime: 0, gameOver: false, hostData: { wave: 1, kills: 0, enemies: [], items: [], bossActive: false }, hits: [], syncProjectiles: [], spawnedProjectile: {}, enemyHitPlayer: {}, gameplayConfig: {}, classData: {}, enemyTypes: [], itemsDb: [] });
    }
    this.checkHost();
    this.updateLayout();
    if (this.ui) { this.ui.buildClassesTab?.(); this.ui.buildMonstersTab?.(); this.ui.updateClassCarousel?.(); }
  }

  loop(time) {
    if (this.state !== 'PLAYING') { this.renderWebGL(); requestAnimationFrame((t) => this.loop(t)); return; }
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 16.67, 3) : 1;
    this.lastTime = time;
    const effectiveStartTime = this.hostGameStartTime || this.gameStartTime;
    if (effectiveStartTime > 0) this.globalTime = (Date.now() - effectiveStartTime) / 1000;
    else this.globalTime += dt * 0.016;
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

    if (this.isHost && activePlayers.length === 0 && this.state === 'PLAYING') {
      this.state = 'GAME_OVER';
      this.net.send_cmd('set_data', { gameOver: Date.now(), state: 'MENU', inGame: false });
      this.quitToMenu();
      this.ctx.restore();
      this.renderWebGL();
      requestAnimationFrame((t) => this.loop(t));
      return;
    }

    for (let e of this.enemies) {
      e.update(dt, activePlayers);
      this.itemManager.dropItemsOnEnemyDeath(e);
      if (!this.isHost && e.alive && e.serverX !== undefined) { e.x += (e.serverX - e.x) * 0.1 * dt; e.y += (e.serverY - e.y) * 0.1 * dt; }
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

    let renderables = [];
    if (this.player?.isMoving && !this.player.autoAttackTarget) {
      renderables.push({ y: this.player.moveTargetY - 1, draw: (ctx) => this.renderer.renderPlayerWalkMarkerRaw(ctx, this.player) });
    }
    for (let e of this.enemies) {
      if (e.x < this.cullMinX || e.x > this.cullMaxX || e.y < this.cullMinY || e.y > this.cullMaxY) continue;
      renderables.push({ y: e.y, draw: (ctx) => { this.renderer.renderEnemyTargetHighlight(e, ctx); e.draw(ctx, getGroundY(this.selectedEnv)); } });
    }
    if (this.player) renderables.push({ y: this.player.y, draw: (ctx) => this.player.draw(ctx, dt, this) });
    for (const key in this.otherPlayers) {
      const p = this.otherPlayers[key];
      if (p.inGame && !(p.x < this.cullMinX || p.x > this.cullMaxX || p.y < this.cullMinY || p.y > this.cullMaxY)) renderables.push({ y: p.y, draw: (ctx) => p.draw(ctx, dt, this) });
    }

    this.itemManager.updateItems(dt);
    if (this.items) {
      for (let item of this.items) {
        if (item.x >= this.cullMinX && item.x <= this.cullMaxX && item.y >= this.cullMinY && item.y <= this.cullMaxY) renderables.push({ y: item.y, draw: (ctx) => this.renderer.renderItem(item, ctx) });
      }
    }
    this.renderer.renderGroundFoliage();
    renderables.sort((a, b) => a.y - b.y);
    renderables.forEach(r => r.draw(this.ctx));

    for (let p of this.projectiles) { p.update(dt, this); if (p.x >= this.cullMinX && p.x <= this.cullMaxX && p.y >= this.cullMinY && p.y <= this.cullMaxY) p.draw(this.ctx); }
    this.projectiles = this.projectiles.filter(p => p.life > 0);

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
    this.hudManager.updateGameTimeDisplay(effectiveStartTime);
    this.hudManager.updateFpsDisplay();

    this.ctx.restore();
    this.renderWebGL();
    requestAnimationFrame((t) => this.loop(t));
  }

}
