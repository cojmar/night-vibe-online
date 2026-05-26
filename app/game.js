import * as ConfigModule from './config.js';
import { CONFIG_METADATA, getGroundY, ENV_CONFIG, ENV_LIST, darkenColor, GROUND_TOLERANCE, CLASS_DATA, PRNG, DEAD_BODY_LIFETIME, REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, REBIRTH_POINTS_PER_LEVEL, ENEMY_SPAWN_INTERVAL, POTION_BUFF_DURATION, POTION_LIFESTEAL_PERCENT, GAME_INITIAL_WAVE, GAME_INITIAL_KILLS, GAME_INITIAL_WAVE_ENEMIES, PLAYER_INITIAL_LEVEL, PLAYER_INITIAL_KILLS, PLAYER_INITIAL_STAT_POINTS, PLAYER_INITIAL_RESETS, REQ_KILLS_BASE_MULT, REQ_KILLS_EXPONENT, REQ_KILLS_SIN_AMP, getCachedImage, preloadFlippedImagesForAsset } from './utils.js';
import Player from './player.js';
import Enemy from './enemy.js';
import Projectile from './projectile.js';

export default class Game {
  constructor(app) {
    this.gameW = ConfigModule.GAME_W || 2560;
    this.gameH = ConfigModule.GAME_H || 1024;
    this.app = app;
    this.ui = app.ui;
    this.net = app.net;

    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    this.state = 'MENU';
    this.wave = 1;
    this.kills = 0;
    this.waveTotalEnemies = 10;
    this.waveEnemiesKilled = 0;
    this.waveEnemiesToSpawn = 10;
    this.bossActive = false;
    this.waveTransitionTimer = 0;
    this.selectedEnv = 'forest';
    this.scenery = null;

    this.player = null; // Local player
    this.otherPlayers = {}; // Remote players
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.bgParticles = [];
    this.items = [];

    this.s2Cooldown = 0;
    this.s2MaxCooldown = 1000;
    this.mouseDown = false;
    this.autoRestartS2 = false;
    this.queuedFireball = null;
    this.lastTime = 0;
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 1000;

    this.viewScale = 1;
    this.zoomScale = 1;
    this.zoomTarget = 1;
    this.viewOX = 0;
    this.viewOY = 0;
    this.pixelRatio = 1;
    this.layoutRefreshTimer = null;
    this.layoutSettledTimer = null;
    this.globalTime = 0;
    this.moveMarker = null;

    this.isHost = false;
    this.syncTimer = 0;
    this.pendingHits = [];
    this.lastProcessedKill = null;
    this.sessionSeed = Math.floor(Math.random() * 2000000000);
    this.prng = new PRNG(this.sessionSeed + this.wave * 12345);

    const saved = JSON.parse(localStorage.getItem('nightvibe-settings') || '{}');
    this.settings = {
      particles: saved.particles !== undefined ? saved.particles : 2.0,
      bgElements: saved.bgElements !== undefined ? saved.bgElements : 2.0,
      groundElements: saved.groundElements !== undefined ? saved.groundElements : 2.0,
      atmos: saved.atmos !== undefined ? saved.atmos : 2.0,
      autoGraphics: saved.autoGraphics !== undefined ? saved.autoGraphics : true,
      autoLimit: saved.autoLimit !== undefined ? saved.autoLimit : true
    };
    this.atmosEffects = [];

    this.restoreWebsocketStats = this.restoreWebsocketStats.bind(this);
    this.saveLocalProgression = this.saveLocalProgression.bind(this);

    this.bindEvents();

    // Bind network events
    this.net.on('room.info', () => this.checkHost());
    this.net.on('room.user_join', () => this.checkHost());
    this.net.on('room.user_leave', (data) => {
      if (this.otherPlayers[data.user]) {
        delete this.otherPlayers[data.user];
      }
      this.checkHost();
    });
    this.net.on('room.user_data', (data) => {
      // Process enemyKilled for ourselves even if it comes from our own user data broadcast
      if (data.data && data.data.enemyKilled && this.player && typeof data.data.enemyKilled === 'string') {
        if (data.data.enemyKilled !== this.lastProcessedKill && data.data.enemyKilled.split('_')[0] === this.net.me.info.user) {
          this.lastProcessedKill = data.data.enemyKilled;
          if (this.player.addKill()) {
            this.s2Cooldown = 0;
            this.ui.addLog(`🌟 Level Up! Level ${this.player.level}`, 'reward');
            this.ui.updateHUD(this.player);
            this.triggerLevelUpAnimation(this.player);
            this.broadcastState();
            this.saveLocalProgression();
          }
          if (this.state === 'PLAYING') {
            this.ui.updateScore(this.player, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
          }
        }
      }

      if (this.net.me && data.user !== this.net.me.info.user) {
        if (!this.otherPlayers[data.user]) {
          // Default spawn for other players
          this.otherPlayers[data.user] = new Player(data.user, false, data.data.classType || 'warrior', data.data.x || this.gameW / 2, data.data.y || (getGroundY(this.selectedEnv) + this.gameH) / 2);
        }

        const oldInGame = this.otherPlayers[data.user].inGame;
        const oldState = this.otherPlayers[data.user].state;
        const oldHitFlash = this.otherPlayers[data.user].hitFlash || 0;

        this.otherPlayers[data.user].set(data.data);

        if (data.data.hitFlash !== undefined && data.data.hitFlash > oldHitFlash) {
          this.spawnParticles(this.otherPlayers[data.user].x, this.otherPlayers[data.user].y - 40, '#e74c3c', 20, 12);
          this.spawnParticles(this.otherPlayers[data.user].x, this.otherPlayers[data.user].y - 40, '#c0392b', 15, 16);
        }

        this.otherPlayers[data.user].lastDataTime = Date.now();
        if (data.data.lastInputTime !== undefined) {
          this.otherPlayers[data.user].lastInputTime = data.data.lastInputTime;
        }

        // Apply immediately if relevant to checkHost
        if (data.data.inGame !== undefined) {
          this.otherPlayers[data.user].inGame = data.data.inGame;
        }
        if (data.data.state !== undefined) {
          this.otherPlayers[data.user].state = data.data.state;
        }

        if (data.data.level !== undefined) {
          const oldLevel = this.otherPlayers[data.user].level || 1;
          if (data.data.level > oldLevel) {
            this.triggerLevelUpAnimation(this.otherPlayers[data.user]);
            this.ui.addLog(`🌟 ${data.user.substring(0, 8)} Leveled Up! (Lv.${data.data.level})`, 'reward');
          }
        }

        if (this.otherPlayers[data.user].inGame !== oldInGame || this.otherPlayers[data.user].state !== oldState) {
          this.checkHost();
        }

        // Handle remote hits
        if (data.data.hits) {
          data.data.hits.forEach(hit => {
            let e = this.enemies.find(ex => ex.id === hit.id);
            if (e && e.alive) {
              e.hp -= hit.damage;
              e.hitFlash = 8;
              this.floatingTexts.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 30, text: (hit.isCrit ? '💥 ' : '') + hit.damage, color: hit.isCrit ? '#ffd700' : '#fff', life: 40, maxLife: 40, isCrit: hit.isCrit });
              if (e.hp <= 0) {
                e.alive = false; e.deathTime = Date.now(); e.hp = 0;
                this.spawnEnemyDeathExplosion(e);
                if (this.isHost) {
                  if (hit.source) {
                    this.net.send_cmd('set_data', { enemyKilled: hit.source + '_' + Math.random() });
                  }
                  this.waveEnemiesKilled++;
                  if (this.bossActive && e.name === 'BOSS') {
                    const aliveBosses = this.enemies.filter(ex => ex.name === 'BOSS' && ex.alive);
                    if (aliveBosses.length === 0) {
                      this.enemies.forEach(ex => { if (ex.alive) { ex.hp = 0; ex.alive = false; } });
                      this.waveTransitionTimer = 120;
                    }
                  } else if (!this.bossActive && this.waveEnemiesKilled >= this.waveTotalEnemies) {
                    this.waveTransitionTimer = 120;
                  }
                }
              }
            }
          });
        }

        if (data.data.enemyHitPlayer) {
          if (data.data.enemyHitPlayer.id === this.net.me.info.user) {
            this.dealDamageToPlayer(data.data.enemyHitPlayer.dmg);
          }
        }

        if (data.data.gameOver) {
          this.quitToMenu();
        }

        if (this.isHost && data.data.spawnItem) {
          this.items.push(data.data.spawnItem);
        }

        // Handle Host Sync
        if (data.data.hostData && !this.isHost) {
          this.syncHostData(data.data.hostData);
        }

        // Sync Gameplay balance config from the Host
        if (data.data.gameplayConfig && !this.isHost) {
          const op = this.otherPlayers[data.user];
          const isSenderHost = data.data.isHost || (op && op.isHost);
          if (isSenderHost) {
            ConfigModule.updateConfig(data.data.gameplayConfig);
            if (data.data.gameplayConfigName) {
              ConfigModule.setActivePresetName(data.data.gameplayConfigName);
            }
            if (data.data.classData) ConfigModule.updateClassData(data.data.classData);
            if (data.data.enemyTypes) ConfigModule.updateEnemyTypes(data.data.enemyTypes);
            if (data.data.itemsDb) ConfigModule.updateItemsDb(data.data.itemsDb);
            
            // Pre-cache all custom base64 images and their flipped versions to prevent mid-game lag
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
            
            if (this.updateLayout) this.updateLayout();
            if (this.ui) {
              if (this.ui.buildClassesTab) this.ui.buildClassesTab();
              if (this.ui.buildMonstersTab) this.ui.buildMonstersTab();
              if (this.ui.buildItemsTab) this.ui.buildItemsTab();
              if (this.ui.updateClassCarousel) this.ui.updateClassCarousel();
            }
          }
        }
      }
    });
  }

  checkHost() {
    if (!this.net || !this.net.room || !this.net.room.users || !this.net.me || !this.net.me.info) {
      if (this.isHost) {
        this.isHost = false;
        this.ui.addLog('👥 You are a Client', 'reward');
      }
      return;
    }
    
    // Players in the menu cannot be hosts
    if (this.state !== 'PLAYING') {
      if (this.isHost) {
        this.isHost = false;
        this.ui.addLog('👥 You are a Client', 'reward');
      }
      return;
    }
    const users = Object.keys(this.net.room.users);
    if (this.net.me && this.net.me.info) users.push(this.net.me.info.user);
    const uniqueUsers = [...new Set(users)];

    // Filter users to only those who are actively playing (in status 'PLAYING' and not in menu or game over)
    const activeUsers = uniqueUsers.filter(user => {
      if (this.net.me && this.net.me.info && user === this.net.me.info.user) {
        // Local player: must be playing and not in menu or game over
        return this.state === 'PLAYING' && this.state !== 'MENU' && this.state !== 'GAME_OVER';
      } else {
        // Remote player: check inGame status and state from otherPlayers or from room data
        const otherPlayer = this.otherPlayers[user];
        if (otherPlayer) {
          // If the player hasn't sent any network data in 3 seconds, consider them idle/inactive
          if (otherPlayer.lastDataTime && Date.now() - otherPlayer.lastDataTime > 3000) {
            return false;
          }
          return otherPlayer.inGame && otherPlayer.state !== 'MENU' && otherPlayer.state !== 'GAME_OVER';
        }
        const roomUser = this.net.room.users[user];
        if (roomUser && roomUser.data) {
          const inGame = roomUser.data.inGame;
          const state = roomUser.data.state;
          return inGame === true && state !== 'MENU' && state !== 'GAME_OVER';
        }
        return false;
      }
    });

    const hostCandidates = activeUsers;

    if (hostCandidates.length === 0) {
      if (this.isHost) {
        this.isHost = false;
        this.net.send_cmd('set_data', { isHost: false });
      }
      return;
    }

    let currentHosts = [];

    for (const u of hostCandidates) {
      if (u === (this.net.me && this.net.me.info ? this.net.me.info.user : null)) {
        if (this.isHost) {
          currentHosts.push(u);
        }
      } else {
        const op = this.otherPlayers[u] || (this.net.room && this.net.room.users[u] && this.net.room.users[u].data);
        if (op && op.isHost) {
          currentHosts.push(u);
        }
      }
    }

    let bestHost = null;

    if (currentHosts.length > 0) {
      // Keep the current host (or resolve ties alphabetically if multiple claim to be host)
      bestHost = currentHosts.sort((a, b) => a.localeCompare(b))[0];
    } else if (hostCandidates.length > 0) {
      // No current host exists among active players, pick a new one alphabetically
      bestHost = hostCandidates.sort((a, b) => a.localeCompare(b))[0];
    } else {
      bestHost = null; // No one is playing
    }

    const isHost = bestHost === (this.net.me && this.net.me.info ? this.net.me.info.user : null);

    if (this.isHost !== isHost) {
      this.isHost = isHost;
      this.ui.addLog(this.isHost ? '👑 You are the Host!' : '👥 You are a Client', 'reward');
      if (this.isHost) {
        this.net.send_cmd('set_data', { 
            isHost: true, 
            gameplayConfig: ConfigModule.activeConfig,
            classData: ConfigModule.CLASS_DATA,
            enemyTypes: ConfigModule.ENEMY_TYPES,
            itemsDb: ConfigModule.ITEMS_DB
        });
        // If we just became host, make sure we sync the global time to avoid jump
        if (this.globalTime) {
          // Time is already matched
        }
      } else {
        this.net.send_cmd('set_data', { isHost: false });
      }
    }
  }

  syncHostData(hostData) {
    if (hostData.time !== undefined) {
      this.globalTime = hostData.time;
    }

    if (hostData.sessionSeed !== undefined) {
      this.sessionSeed = hostData.sessionSeed;
    }
    if (hostData.seed !== undefined) {
      if (!this.prng) this.prng = new PRNG(hostData.seed);
      else this.prng.seed = hostData.seed;
    }

    if (this.wave !== hostData.wave && hostData.wave) {
      if (this.player && !this.player.alive) {
        this.respawnPlayer();
      }
      this.wave = hostData.wave;
    }

    // Always sync these, so a new host doesn't lose spawn state
    if (hostData.waveTotal !== undefined) this.waveTotalEnemies = hostData.waveTotal;
    if (hostData.waveSpawn !== undefined) this.waveEnemiesToSpawn = hostData.waveSpawn;

    this.kills = hostData.kills;
    this.waveEnemiesKilled = hostData.waveKilled || 0;
    this.bossActive = hostData.bossActive || false;

    if (this.state === 'PLAYING') {
      this.ui.updateScore(this.player, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
    }

    if (this.selectedEnv !== hostData.env) {
      this.selectedEnv = hostData.env || 'forest';
      this.generateScenery();
      if (this.state === 'PLAYING') this.ui.updateEnvironment(this.selectedEnv);
      this.initBgParticles();
    }

    // Sync enemies position/hp to host
    hostData.enemies.forEach(eData => {
      let e = this.enemies.find(ex => ex.id === eData.id);
      if (!e) {
        let isBoss = eData.name === 'BOSS';
        let spawnIndex = 0;
        if (eData.id && eData.id.startsWith('E_')) {
          const parts = eData.id.split('_');
          if (parts.length === 3) spawnIndex = parseInt(parts[2]) || 0;
        }

        // Generate full visual properties using deterministic PRNG
        e = new Enemy(this, isBoss, false, spawnIndex);
        e.id = eData.id;

        // If it's a missile, fix properties
        if (eData.id && eData.id.startsWith('M_')) {
          e.name = 'MISSILE';
          e.icon = '🚀';
          e.size = 20;
          e.color = '#e74c3c';
        }

        e.x = eData.x || e.x;
        e.y = eData.y || e.y;
        this.enemies.push(e);
      }
      if (eData.x !== undefined) e.serverX = eData.x;
      if (eData.y !== undefined) e.serverY = eData.y;
      if (eData.hp !== undefined) e.hp = eData.hp;
      if (eData.maxHp !== undefined) e.maxHp = eData.maxHp;
      if (eData.alive !== undefined) e.alive = eData.alive;
      if (eData.name !== undefined) e.name = eData.name;
      if (eData.size !== undefined) e.size = eData.size;
      if (eData.bossState !== undefined) e.bossState = eData.bossState;
      if (eData.bossChannelTimer !== undefined) e.bossChannelTimer = eData.bossChannelTimer;
      if (eData.targetLaserPos !== undefined) e.targetLaserPos = eData.targetLaserPos;
      if (eData.bossLaserTimer !== undefined) e.bossLaserTimer = eData.bossLaserTimer;
      // Icons and colors are locally deterministic or default, no need to sync from network
      if (eData.deathTime && eData.deathTime > 0) e.deathTime = eData.deathTime;
    });
    // Remove enemies not in host, but keep dead ones until their death animation finishes
    this.enemies = this.enemies.filter(e => hostData.enemies.find(ex => ex.id === e.id) || (!e.alive && e.deathTime && Date.now() - e.deathTime < DEAD_BODY_LIFETIME));

    if (hostData.items) {
      this.items = hostData.items.map(item => ({ ...item }));
    }
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

  scheduleLayoutUpdate() {
    this.updateLayout();

    // Run again on the next two animation frames — after orientation changes
    // some devices (notably Samsung S24 FE) report stale viewport sizes for
    // one or two frames, so a single updateLayout() leaves a black strip.
    requestAnimationFrame(() => {
      this.updateLayout();
      requestAnimationFrame(() => this.updateLayout());
    });

    clearTimeout(this.layoutRefreshTimer);
    clearTimeout(this.layoutSettledTimer);
    this.layoutRefreshTimer = setTimeout(() => this.updateLayout(), 120);
    this.layoutSettledTimer = setTimeout(() => this.updateLayout(), 500);
  }

  bindEvents() {
    const mainArea = document.getElementById('main-area');

    mainArea.addEventListener('mousemove', (e) => {
      if (this.state !== 'PLAYING') return;
      const pos = this.toGameCoords(e.clientX, e.clientY);
      if (this.player) {
        this.player.mouseX = pos.x;
        this.player.mouseY = pos.y;
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      if (e.button === 0) {
        e.preventDefault();
        const p = this.toGameCoords(e.clientX, e.clientY);
        this.player.mouseX = p.x;
        this.player.mouseY = p.y;
        this.handleLeftClick(p.x, p.y);
        this.leftClickInterval = setInterval(() => {
          if (this.state === 'PLAYING' && this.player) {
            this.handleLeftClick(this.player.mouseX, this.player.mouseY);
          }
        }, 100);
      }
      if (e.button === 2) {
        e.preventDefault();
        this.mouseDown = true;
        const p = this.toGameCoords(e.clientX, e.clientY);
        this.player.mouseX = p.x;
        this.player.mouseY = p.y;
        if (!this.s2HoldTimer) {
          this.s2HoldTimer = setTimeout(() => {
            if (this.state === 'PLAYING' && this.mouseDown && this.player && this.s2Cooldown <= 0) {
              this.player.s2HoldStartTime = Date.now();
              this.startChargingSkill2();
            }
            this.s2HoldTimer = null;
          }, 300);
        }
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      if (e.button === 0) {
        e.preventDefault();
        clearInterval(this.leftClickInterval);
      }
      if (e.button === 2) {
        e.preventDefault();
        this.mouseDown = false;
        clearInterval(this.leftClickInterval);
        if (this.s2HoldTimer) {
          clearTimeout(this.s2HoldTimer);
          this.s2HoldTimer = null;
        }
        if (!this.player.isChargingS2) {
          const p = this.toGameCoords(e.clientX, e.clientY);
          this.player.mouseX = p.x;
          this.player.mouseY = p.y;
          this.startChargingSkill2();
          this.releaseSkill2();
        } else {
          const p = this.toGameCoords(e.clientX, e.clientY);
          this.player.mouseX = p.x;
          this.player.mouseY = p.y;
          this.releaseSkill2();
        }
      }
    });

    this.canvas.addEventListener('mouseleave', (e) => {
      if (this.state !== 'PLAYING') return;
      clearInterval(this.leftClickInterval);
    });

    document.addEventListener('contextmenu', (e) => {
      if (this.state === 'PLAYING') {
        e.preventDefault();
      }
    });

    // Mouse wheel zoom
    this.canvas.addEventListener('wheel', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomTarget *= zoomFactor;

      const cw = this.canvas.width / (this.pixelRatio || 1);
      const ch = this.canvas.height / (this.pixelRatio || 1);

      // Lowest zoom (most zoomed out): full map fills screen in BOTH dimensions
      const zoomOutMinWidth = (cw / this.gameW) / this.viewScale;
      const zoomOutMinHeight = (ch / this.gameH) / this.viewScale;
      const zoomOutMin = Math.max(zoomOutMinWidth, zoomOutMinHeight);

      // Highest zoom (most zoomed in): character fills most of screen
      const zoomInMax = Math.max(5, (ch / 30) / this.viewScale);

      this.zoomTarget = Math.max(zoomOutMin, Math.min(zoomInMax, this.zoomTarget));
    }, { passive: false });

  let touchActive = false;
    let touchLongPressTimer = null;
    let touchLeftClickTimer = null;

    this.canvas.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      e.preventDefault();
      const t = e.touches[0];
      const pos = this.toGameCoords(t.clientX, t.clientY);
      touchActive = true;
      this.player.mouseX = pos.x;
      this.player.mouseY = pos.y;

      clearTimeout(touchLongPressTimer);
      clearTimeout(touchLeftClickTimer);
      touchLongPressTimer = setTimeout(() => {
        if (!touchActive) return;
        clearTimeout(touchLeftClickTimer);
        this.startChargingSkill2();
      }, 400);

      // Only do S1/walk if we didn't just release S2. We will just trigger it anyway for now,
      // but maybe if we are charging we shouldn't. startChargingSkill2 handles stopping walk.
      this.handleLeftClick(pos.x, pos.y);
      touchLeftClickTimer = setTimeout(() => {
        if (!touchActive) return;
        const interval = setInterval(() => {
          if (!touchActive || this.player.isChargingS2) {
            clearInterval(interval);
            return;
          }
          this.handleLeftClick(this.player.mouseX, this.player.mouseY);
        }, 100);
        this.touchLeftClickInterval = interval;
      }, 150);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      e.preventDefault();
      const t = e.touches[0];
      const pos = this.toGameCoords(t.clientX, t.clientY);
      this.player.mouseX = pos.x;
      this.player.mouseY = pos.y;
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => {
      touchActive = false;
      clearTimeout(touchLongPressTimer);
      clearTimeout(touchLeftClickTimer);
      clearInterval(this.touchLeftClickInterval);
      if (this.player && this.player.isChargingS2) {
        this.mouseDown = false;
        this.releaseSkill2();
      }
    });
    this.canvas.addEventListener('touchcancel', () => {
      touchActive = false;
      clearTimeout(touchLongPressTimer);
      clearTimeout(touchLeftClickTimer);
      clearInterval(this.touchLeftClickInterval);
      if (this.player && this.player.isChargingS2) {
        this.mouseDown = false;
        this.releaseSkill2();
      }
    });

  const cdRingBtn = document.getElementById('cd-ring');
    const startUltBtn = (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      e.preventDefault(); e.stopPropagation();
      this.mouseDown = true;
      this.startChargingSkill2();
    };
    const endUltBtn = (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      e.preventDefault(); e.stopPropagation();
      if (this.player.isChargingS2) {
        this.mouseDown = false;
        this.releaseSkill2();
      } else {
        this.mouseDown = false;
      }
    };
    cdRingBtn.addEventListener('mousedown', startUltBtn);
    cdRingBtn.addEventListener('touchstart', startUltBtn, { passive: false });
    cdRingBtn.addEventListener('mouseup', endUltBtn);
    cdRingBtn.addEventListener('mouseleave', endUltBtn);
    cdRingBtn.addEventListener('touchend', endUltBtn);
    cdRingBtn.addEventListener('touchcancel', endUltBtn);
  }

  updateLayout() {
    // Trust the browser's own layout: the canvas is CSS-sized to fill the
    // viewport-pinned main-area (position:absolute; inset:0). Read whatever
    // size it actually ended up with via getBoundingClientRect() — this is
    // the only reliable measurement across devices. Earlier attempts to use
    // parent.clientWidth or visualViewport.width gave stale/under-reported
    // numbers on some Samsung phones, leaving a black strip on the right.
    const rect = this.canvas.getBoundingClientRect();
    const cw = Math.round(rect.width);
    const ch = Math.round(rect.height);
    if (cw <= 0 || ch <= 0) return;

    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
    const isTouchDisplay = navigator.maxTouchPoints > 0;
    const maxMobilePixels = 900000;
    const pixelBudgetDpr = Math.sqrt(maxMobilePixels / (cw * ch));
    const dpr = isTouchDisplay ? Math.max(1, Math.min(rawDpr, pixelBudgetDpr)) : rawDpr;
    this.pixelRatio = dpr;
    this.canvas.width = cw * dpr;
    this.canvas.height = ch * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Lock scaling to the screen height to provide native side-scrolling experience
    this.viewScale = ch / this.gameH;

    // Dynamically adjust this.gameW if the screen is wider than the configured width
    const requiredGameW = Math.ceil(cw / this.viewScale);
    const baseConfigW = ConfigModule.activeConfig.GAME_W || 2560;
    const targetW = Math.max(baseConfigW, requiredGameW);

    if (targetW !== this.gameW) {
      this.gameW = targetW;
      if (this.player && this.player.isLocal) {
        this.player.x = Math.max(20, Math.min(targetW - 20, this.player.x));
      }
      this.generateScenery();
      this.initBgParticles();
    }

    const scaledW = this.gameW * this.viewScale;

    // If the game width is wider than the screen, left-align and let side-scrolling handle offsets.
    // Otherwise, center the game world horizontally on screen.
    if (cw < scaledW) {
      this.viewOX = 0;
    } else {
      this.viewOX = (cw - scaledW) / 2;
    }
    this.viewOY = 0;

    this.cachedCanvasRect = this.canvas.getBoundingClientRect();

    if (this.state === 'MENU') this.drawMenuBackground();
  }

  toGameCoords(clientX, clientY) {
    const rect = this.cachedCanvasRect || this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const effectiveScale = this.viewScale * this.zoomScale;
    const cw = this.canvas.width / (this.pixelRatio || 1);
    const ch = this.canvas.height / (this.pixelRatio || 1);
    const camX = this.cameraX || 0;
    const camY = this.cameraY ?? (this.player ? this.player.y : this.gameH / 2);
    const viewOX = this.viewOX || 0;
    const gameX = (canvasX - cw / 2 - viewOX) / effectiveScale + camX;
    const gameY = (canvasY - ch / 2) / effectiveScale + camY;
    return { x: gameX, y: gameY };
  }

  applyViewport(dt = 0) {
    // Smooth zoom transition
    if (Math.abs(this.zoomScale - this.zoomTarget) > 0.001) {
      this.zoomScale += (this.zoomTarget - this.zoomScale) * Math.min(0.2, 0.15 * dt);
    } else {
      this.zoomScale = this.zoomTarget;
    }

    let shakeX = 0, shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
      this.screenShake -= dt;
      if (this.screenShake < 0) this.screenShake = 0;
    }

    const effectiveScale = this.viewScale * this.zoomScale;
    const cw = this.canvas.width / (this.pixelRatio || 1);
    const ch = this.canvas.height / (this.pixelRatio || 1);

    // Camera centered on player with edge clamping
    if (this.player && this.canvas) {
      const halfViewportX = (cw / 2) / effectiveScale;
      const halfViewportY = (ch / 2) / effectiveScale;

      if (halfViewportX >= this.gameW / 2) {
        // Visible area >= game width: center the game world
        this.cameraX = this.gameW / 2;
      } else {
        // Visible area < game width: center on player
        this.cameraX = Math.max(halfViewportX, Math.min(this.gameW - halfViewportX, this.player.x));
      }

      // Center vertically on player, clamp to map edges to avoid empty space
      this.cameraY = Math.max(halfViewportY, Math.min(this.gameH - halfViewportY, this.player.y));
    } else {
      this.cameraX = this.gameW / 2;
      this.cameraY = this.gameH / 2;
    }

    const camX = this.cameraX;
    const camY = this.cameraY;
    const viewOX = this.viewOX || 0;

    // Center transform: translate to screen center, scale, translate by camera offset
    this.ctx.translate(cw / 2 + viewOX + shakeX, ch / 2 + shakeY);
    this.ctx.scale(effectiveScale, effectiveScale);
    this.ctx.translate(-camX, -camY);
  }

  startGame(selectedClass) {
    if (this.ui && this.ui.saveLastGameConfig) {
      this.ui.saveLastGameConfig();
    }
    // Ensure all menu/previous session parameters are fully reset
    this._resetSessionData();
    
    this.state = 'PLAYING';
    this.selectedEnv = ENV_LIST[0];
    this.kills = GAME_INITIAL_KILLS;
    this.wave = ConfigModule.GAME_INITIAL_WAVE;
    if (this.wave % ConfigModule.BOSS_WAVE_INTERVAL === 0) {
      this.bossActive = true;
      let numBosses = 1;
      if (ConfigModule.BOSS_WAVE_INTERVAL > 0) {
        const bossWaveNum = Math.floor(this.wave / ConfigModule.BOSS_WAVE_INTERVAL);
        if (bossWaveNum > 1) {
          numBosses = 1 + (bossWaveNum - 1) * ConfigModule.BOSS_SPAWN_INCREMENT;
        }
      }
      this.waveTotalEnemies = numBosses;
      this.waveEnemiesToSpawn = numBosses;
    } else {
      this.bossActive = false;
      this.waveTotalEnemies = ConfigModule.GAME_INITIAL_WAVE_ENEMIES;
      this.waveEnemiesToSpawn = ConfigModule.GAME_INITIAL_WAVE_ENEMIES;
    }
    this.waveEnemiesKilled = 0;
    this.waveTransitionTimer = 0;
    this.emptyWaveTimer = 0;
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

    // Attempt to inherit current room state and gameplay configuration if a host exists
    let hostFound = false;
    if (this.net && this.net.room && this.net.room.users) {
      for (const u in this.net.room.users) {
        if (this.net.me && this.net.me.info && u === this.net.me.info.user) continue;
        const userData = this.net.room.users[u].data;
        if (userData && userData.isHost && userData.inGame && userData.state === 'PLAYING') {
          hostFound = true;
          this.isHost = false;
          if (userData.gameplayConfig) {
            ConfigModule.updateConfig(userData.gameplayConfig);
            if (userData.gameplayConfigName) {
              ConfigModule.setActivePresetName(userData.gameplayConfigName);
            }
            if (userData.classData) {
                ConfigModule.updateClassData(userData.classData);
                for (const k in userData.classData) {
                    if (userData.classData[k].icon && typeof userData.classData[k].icon === 'string') preloadFlippedImagesForAsset(userData.classData[k].icon);
                }
              }
            if (userData.enemyTypes) {
                ConfigModule.updateEnemyTypes(userData.enemyTypes);
                for (const e of userData.enemyTypes) {
                    if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon);
                }
              }
            if (userData.itemsDb) {
                ConfigModule.updateItemsDb(userData.itemsDb);
                for (const item of userData.itemsDb) {
                    if (item.icon && typeof item.icon === 'string') preloadFlippedImagesForAsset(item.icon);
                }
              }
            if (this.ui) {
              if (this.ui.buildClassesTab) this.ui.buildClassesTab();
              if (this.ui.buildMonstersTab) this.ui.buildMonstersTab();
              if (this.ui.buildItemsTab) this.ui.buildItemsTab();
              if (this.ui.updateClassCarousel) this.ui.updateClassCarousel();
            }
            this.ui.addLog(`📥 Synced gameplay balance config from the Host (${u}).`, 'system');
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
            
            // Sync ground items and monsters instantly on game entry
            if (userData.hostData.enemies) {
              this.enemies = [];
              userData.hostData.enemies.forEach(eData => {
                let isBoss = eData.name === 'BOSS';
                let spawnIndex = 0;
                if (eData.id && eData.id.startsWith('E_')) {
                  const parts = eData.id.split('_');
                  if (parts.length === 3) spawnIndex = parseInt(parts[2]) || 0;
                }
                const e = new Enemy(this, isBoss, false, spawnIndex);
                e.id = eData.id;
                if (eData.id && eData.id.startsWith('M_')) {
                  e.name = 'MISSILE';
                  e.icon = '🚀';
                  e.size = 20;
                  e.color = '#e74c3c';
                }
                e.x = eData.x || e.x;
                e.y = eData.y || e.y;
                e.serverX = eData.x || e.x;
                e.serverY = eData.y || e.y;
                e.hp = eData.hp;
                e.maxHp = eData.maxHp;
                e.alive = eData.alive;
                e.name = eData.name;
                e.size = eData.size;
                if (eData.bossState !== undefined) e.bossState = eData.bossState;
                if (eData.bossChannelTimer !== undefined) e.bossChannelTimer = eData.bossChannelTimer;
                if (eData.targetLaserPos !== undefined) e.targetLaserPos = eData.targetLaserPos;
                if (eData.bossLaserTimer !== undefined) e.bossLaserTimer = eData.bossLaserTimer;
                if (eData.deathTime) e.deathTime = eData.deathTime;
                this.enemies.push(e);
              });
            }
            if (userData.hostData.items) {
              this.items = userData.hostData.items.map(item => ({ ...item }));
            }
          }
          break;
        }
      }
    }

    if (!hostFound) {
      this.isHost = true;
      this.ui.addLog('👑 You are the Host!', 'reward');
      if (this.net && this.net.me) {
        this.net.send_cmd('set_data', { 
            isHost: true, 
            gameplayConfig: ConfigModule.activeConfig,
            gameplayConfigName: ConfigModule.activePresetName || 'Default',
            classData: ConfigModule.CLASS_DATA,
            enemyTypes: ConfigModule.ENEMY_TYPES,
            itemsDb: ConfigModule.ITEMS_DB
        });
      }
    }

    // Pre-cache images for local host
    if (this.isHost) {
      for (const k in ConfigModule.CLASS_DATA) {
        const ic = ConfigModule.CLASS_DATA[k].icon;
        if (ic && typeof ic === 'string') preloadFlippedImagesForAsset(ic);
      }
      for (const e of ConfigModule.ENEMY_TYPES) {
        if (e.icon && typeof e.icon === 'string') preloadFlippedImagesForAsset(e.icon);
      }
      for (const item of ConfigModule.ITEMS_DB) {
        if (item.icon && typeof item.icon === 'string') preloadFlippedImagesForAsset(item.icon);
      }
    }

    this.generateScenery();

    let myData = null;
    if (this.net && this.net.room && this.net.me && this.net.me.info && this.net.room.users[this.net.me.info.user]) {
      myData = this.net.room.users[this.net.me.info.user].data;
    }

    this.player = new Player(this.net.me.info.user, true, selectedClass, this.gameW / 2, (getGroundY(this.selectedEnv) + this.gameH) / 2);

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
    document.getElementById('hud').classList.add('visible');
    document.getElementById('cd-ring').classList.add('visible');
    document.getElementById('compact-log').classList.add('visible');
    document.getElementById('game-btns').style.display = 'flex';

    this.ui.addLog('⚔️ Fight started! Tap ground to move, tap enemies to attack!', 'player');
    this.updateLayout();
    setTimeout(() => {
      if (this.state === 'PLAYING') this.updateLayout();
    }, 100);
    setTimeout(() => {
      if (this.state === 'PLAYING') this.updateLayout();
    }, 500);

    // Recheck host status since we are now playing
    this.checkHost();

    // Clear any lingering game over state
    this.net.send_cmd('set_data', { gameOver: 0 });

    // Broadcast our spawn
    this.broadcastState();
  }

  upgradeStat(statType, amount = 1) {
    if (!this.player || !this.player.statPoints || this.player.statPoints <= 0) return;

    let count = amount === 'all' ? this.player.statPoints : parseInt(amount, 10);
    if (isNaN(count) || count <= 0) count = 1;
    count = Math.min(count, this.player.statPoints);
    if (count <= 0) return;

    let remaining = count;
    while (remaining > 0) {
      this.player.statPoints--;
      remaining--;
    }

    if (statType === 'atk') {
      this.player._atk += 1.0 * count;
    } else if (statType === 'spd') {
      this.player._spd += 1.0 * count;
    } else if (statType === 'hp') {
      this.player._maxHp += 1 * count;
      this.player.hp += 1 * count;
    }

    this.ui.updateHUD(this.player);
    this.broadcastState();
    if (this.net && this.net.me && this.net.me.info) {
      this.net.send_cmd('set_data', {
        statPoints: this.player.statPoints,
        sessionStatPoints: this.player.sessionStatPoints
      });
    }
    this.saveLocalProgression();
  }

   async requestRebirth() {
      if (!this.player) return;
      const reqLevel = REBIRTH_BASE_LEVEL + (this.player.resets || 0) * REBIRTH_LEVEL_STEP;
      if (this.player.level < reqLevel) return;

      await this.ui.showRebirthConfirm(
        "🔄 Rebirth",
        `Do you want to Rebirth? You will return to the menu and start over.\nYou will gain ${this.player.level * REBIRTH_POINTS_PER_LEVEL} unallocated bonus stats on your next play!`,
        () => { this.performRebirth(); },
      );
    }

  performRebirth() {
    if (!this.player) return;
    const reqLevel = REBIRTH_BASE_LEVEL + (this.player.resets || 0) * REBIRTH_LEVEL_STEP;
    if (this.player.level < reqLevel) return;

    const newResets = (this.player.resets || 0) + 1;

    // The old bonus stats come from localStorage (the persistent account value)
    const oldBonusStats = parseInt(localStorage.getItem('nightvibe-statpoints'), 10) || 0;

    const extraPoints = this.player.level * REBIRTH_POINTS_PER_LEVEL;
    const newBonusStats = oldBonusStats + extraPoints;

    localStorage.setItem('nightvibe-resets', newResets);
    localStorage.setItem('nightvibe-statpoints', newBonusStats);

    const base = CLASS_DATA[this.player.classType] || CLASS_DATA.warrior;

    // Reset local player object state for a fresh start on next game.
    // Persistent progression (resets, bonusStatPoints) is already saved to localStorage.
    this.player.level = 1;
    this.player.kills = 0;
    this.player.resets = newResets;
    this.player.bonusStatPoints = newBonusStats;
    this.player.sessionStatPoints = newBonusStats;
    this.player.levelUpStatPoints = 0;
    this.player.atk = base.atk;
    this.player.spd = base.spd;
    this.player.maxHp = base.hp;
    this.player.hp = base.hp;
    this.player.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(1, REQ_KILLS_EXPONENT) + Math.sin(1) * REQ_KILLS_SIN_AMP);

    this.net.send_cmd('set_data', {
      resets: newResets,
      bonusStatPoints: newBonusStats,
      statPoints: newBonusStats
    });

    this.quitToMenu();
  }

  restoreWebsocketStats(target, myData, selectedClass) {
    // Read resets and statPoints from localStorage as default fallbacks
    const hasSavedResets = localStorage.getItem('nightvibe-resets') !== null;
    const hasSavedStatPoints = localStorage.getItem('nightvibe-statpoints') !== null;

    const savedResets = hasSavedResets ? parseInt(localStorage.getItem('nightvibe-resets'), 10) : PLAYER_INITIAL_RESETS;
    const savedStatPoints = hasSavedStatPoints ? parseInt(localStorage.getItem('nightvibe-statpoints'), 10) : PLAYER_INITIAL_STAT_POINTS;

    target.resets = savedResets;
    target.sessionStatPoints = savedStatPoints;
    target.levelUpStatPoints = 0;

    try {
      const savedInv = localStorage.getItem('nightvibe-inventory');
      if (savedInv) target.inventory = JSON.parse(savedInv);
      const savedEq = localStorage.getItem('nightvibe-equipment');
      if (savedEq) target.equipment = JSON.parse(savedEq);
    } catch (e) {
      console.error('Failed to parse saved items', e);
    }

    if (!myData) return;

    // If they explicitly cleared localStorage, we ignore stale websocket progression data
    // to allow a true fresh start with 0 resets and 0 stats.
    const isLocalStorageCleared = !hasSavedResets && !hasSavedStatPoints;

    if (!isLocalStorageCleared) {
      // Socket takes priority, fallback to localStorage
      if (myData.resets !== undefined && myData.resets > 0) {
        target.resets = myData.resets;
      }

      const socketBonusStats = myData.bonusStatPoints !== undefined ? myData.bonusStatPoints : (myData.statPoints !== undefined ? myData.statPoints : undefined);
      if (socketBonusStats !== undefined) {
        target.sessionStatPoints = socketBonusStats;
      }
    }

    // Only restore in-game progression if we are reconnecting to an active session
    const isReconnecting = myData.inGame === true && (myData.state === 'PLAYING' || myData.state === 'GAME_OVER');

    if (myData.classType === selectedClass && isReconnecting) {
      if (myData.level !== undefined) target.level = myData.level;
      if (myData.atk !== undefined) target.atk = myData.atk;
      if (myData.spd !== undefined) target.spd = myData.spd;
      if (myData.maxHp !== undefined) {
        target.maxHp = myData.maxHp;
        target.hp = myData.maxHp;
      }
      if (myData.kills !== undefined) target.kills = myData.kills;
      target.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(target.level, REQ_KILLS_EXPONENT) + Math.sin(target.level) * REQ_KILLS_SIN_AMP);
    }
  }

  saveLocalProgression() {
    if (!this.player) return;
    localStorage.setItem('nightvibe-resets', this.player.resets || 0);
    localStorage.setItem('nightvibe-inventory', JSON.stringify(this.player.inventory || []));
    localStorage.setItem('nightvibe-equipment', JSON.stringify(this.player.equipment || {}));
  }

  quitToMenu() {
    if (this.ui && this.ui.saveLastGameConfig) {
      this.ui.saveLastGameConfig();
    }
    this.saveLocalProgression();
    this.state = 'MENU';
    document.getElementById('game-btns').style.display = 'none';
    document.getElementById('hud').classList.remove('visible');
    document.getElementById('cd-ring').classList.remove('visible');
    document.getElementById('compact-log').classList.remove('visible');
    document.getElementById('walk-indicator').classList.remove('visible');
    document.getElementById('menu-panel').classList.remove('hidden');
    document.getElementById('main-area').style.display = 'none';
    this.canvas.style.display = 'none';
    document.getElementById('death-overlay').classList.remove('show');

    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];

    this.ui.addLog('🎮 Returned to character selection!', 'player');

    // Broadcast leaving the game
    if (this.net && this.net.me) {
      
      // Reset in-game progression stats locally so next game starts fresh at level 1.
      // Persistent progression (resets, bonusStatPoints) is already saved in localStorage
      // and will be restored by restoreWebsocketStats() on the next game start.
      this._resetSessionData();
      this.isHost = false;
      this.net.send_cmd('set_data', { inGame: false, state: 'MENU', isHost: false });
    }

    this.checkHost();
    this.updateLayout();
    if (this.ui) {
      if (this.ui.buildClassesTab) this.ui.buildClassesTab();
      if (this.ui.buildMonstersTab) this.ui.buildMonstersTab();
      if (this.ui.updateClassCarousel) this.ui.updateClassCarousel();
    }
  }

  _resetSessionData() {
    const base = CLASS_DATA.warrior;
    const savedResets = parseInt(localStorage.getItem('nightvibe-resets'), 10) || 0;
    const savedStatPoints = parseInt(localStorage.getItem('nightvibe-statpoints'), 10) || 0;

    if (this.net && this.net.room && this.net.me && this.net.me.info && this.net.room.users[this.net.me.info.user]) {
      const myData = this.net.room.users[this.net.me.info.user].data;
      myData.resets = savedResets;
      myData.bonusStatPoints = savedStatPoints;
      myData.statPoints = savedStatPoints;
      myData.level = 1;
      myData.kills = 0;
      myData.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(1, REQ_KILLS_EXPONENT) + Math.sin(1) * REQ_KILLS_SIN_AMP);
      myData.atk = base.atk;
      myData.spd = base.spd;
      myData.maxHp = base.hp;
      myData.hp = base.hp;
    }
  }

  respawnPlayer() {
    document.getElementById('death-overlay').classList.remove('show');
    if (this.player) {
      this.player.x = this.gameW / 2;
      this.player.y = (getGroundY(this.selectedEnv) + this.gameH) / 2;
      this.player.hp = this.player.maxHp;
      this.player.alive = true;
    } else {
      this.player = new Player(this.net.me.info.user, true, this.ui.selectedClass, this.gameW / 2, (getGroundY(this.selectedEnv) + this.gameH) / 2);
    }
    this.ui.updateHUD(this.player);
    this.ui.addLog('✨ Respawned!', 'reward');
    this.broadcastState();
  }

 handleLeftClick(cx, cy) {
    if (!this.player || !this.player.alive) return;
    this.autoRestartS2 = false;
    this.player.lastInputTime = Date.now();
    const groundY = getGroundY(this.selectedEnv);
    const onGround = cy >= groundY - GROUND_TOLERANCE;
    let clickedEnemy = null;
    let clickedItem = null;

    // Check if player clicked a potion on the ground
    if (this.items) {
      for (let item of this.items) {
        const dist = Math.hypot(cx - item.x, cy - item.y);
        if (dist < 40) {
          clickedItem = item;
          break;
        }
      }
    }

    if (clickedItem) {
      this.player.autoAttackTarget = null;
      this.player.targetedItemId = clickedItem.id;
      this.player.isMoving = true;
      this.player.moveTargetX = clickedItem.x;
      this.player.moveTargetY = clickedItem.y;
      this.player.action = 'walk';

      // Visual feedback
      this.moveMarker = { x: clickedItem.x, y: clickedItem.y, life: 30, maxLife: 30, color: 'green' };
      const typeStr = clickedItem.type === 'red' ? '❤️ Potion' : '⚡ Potion';
      document.getElementById('walk-indicator').innerHTML = `🧪 Collecting ${typeStr}...`;
      document.getElementById('walk-indicator').classList.add('visible');
      this.broadcastState();
      return;
    }

    // Clear item target if clicked elsewhere
    this.player.targetedItemId = null;

    for (let e of this.enemies) {
      if (!e.alive) continue;

      // Melee classes cannot click or lock onto enemies in the upper half of the screen
      if ((this.player.classType === 'warrior' || this.player.classType === 'magicgladiator') && e.y < this.gameH / 2) {
        continue;
      }

      const dist = Math.hypot(cx - e.x, cy - e.y);
      if (dist < e.size + 30) {
        clickedEnemy = e; break;
      }
    }

    if (!onGround || clickedEnemy) {
      if (clickedEnemy) {
        this.player.autoAttackTarget = clickedEnemy;
        // UI Indicator
        document.getElementById('walk-indicator').innerHTML = '⚔️ Attacking...';
        document.getElementById('walk-indicator').classList.add('visible');

        // Let updateMovement handle the chasing/attacking loop for ALL classes
        // But if they are ranged, they might just shoot immediately.
        // The updateMovement will handle distance checks.
        // Wait, range check depends on class!
        return;
      }

      this.player.autoAttackTarget = null;
      this.doSkill1(cx, cy);
    } else {
      this.player.autoAttackTarget = null;
      this.player.isMoving = true;
      this.player.moveTargetX = Math.max(20, Math.min(this.gameW - 20, cx));
      this.player.moveTargetY = Math.max(groundY - 50, Math.min(this.gameH - 45, cy));
      this.player.action = 'walk';
      document.getElementById('walk-indicator').innerHTML = '🚶 Walking...';
      document.getElementById('walk-indicator').classList.add('visible');
    }

    this.moveMarker = { x: cx, y: cy, life: 30, maxLife: 30, color: 'yellow' };
    this.broadcastState();
  }

  doSkill1(tx, ty) {
    this.player.stopWalking(this);
    const cd = CLASS_DATA[this.player.classType] || CLASS_DATA.warrior;
    const reqLevel = 4 + (this.player.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.player.level - 1) / Math.max(1, reqLevel - 1));
    const weaponY = this.player.y - 40 * lvlScale;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.player.x);
    this.player.animTimer = 15;
    this.player.action = 'attack';
    this.player.lastSkill = 1;
    this.player.facing = tx > this.player.x ? 1 : -1;
    const s1Scale = Math.min(3.0, 1 + (this.player.atk - cd.atk) * 0.02);

    let projProps = { tx, ty, angle: aimAngle, facing: this.player.facing, damage: this.player.atk, critChance: 0.1 };

    const skillType = cd.s1Name;
    if (skillType === 'Bash' || this.player.classType === 'warrior') {
      const wScale = 1 + (this.player.atk - cd.atk) * 0.005;
      this.projectiles.push(new Projectile({ type: 'slash', originX: this.player.x, originY: weaponY, life: 15, maxLife: 15, color: cd.s1Color || '#d4af37', radius: 60 * wScale * lvlScale, hitInner: 0, hitOuter: 90 * wScale * lvlScale, knockback: 65, knockbackDir: aimAngle, isKnockback: true, damage: this.player.atk * 1.0, ...projProps }));
      this.spawnParticles(this.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, cd.s1Color || '#d4af37', 5, 3);
    } else if (skillType === 'Magic Bolt' || this.player.classType === 'mage') {
      const mageBaseAtk = cd.atk;
      const mageRangeMult = Math.pow(this.player.atk / mageBaseAtk, ConfigModule.E1_RANGE_ATK_EXPONENT);
      const mageLife = Math.round(60 * mageRangeMult);
      this.projectiles.push(new Projectile({ type: 'bolt', x: this.player.x, y: weaponY, tx: tx, ty: ty, speed: 8, life: mageLife, maxLife: mageLife, color: cd.s1Color || '#3498db', damage: this.player.atk * 0.9, radius: 6 * s1Scale * lvlScale, ...projProps }));
      this.spawnParticles(this.player.x, weaponY, cd.s1Color || '#3498db', 3, 2);
   } else if (skillType === 'Quick Shot' || this.player.classType === 'archer') {
       const archerBaseAtk = cd.atk;
       const archerRangeMult = Math.pow(this.player.atk / archerBaseAtk, ConfigModule.E1_RANGE_ATK_EXPONENT);
       const archerLife = Math.round(50 * archerRangeMult);
       const speed = 10;
       const archerS1Scale = Math.min(5, 1 + (this.player.atk - archerBaseAtk) * 0.0227);
       const arrowRadius = 12 * archerS1Scale * lvlScale;
       this.projectiles.push(new Projectile({ type: 'arrow', x: this.player.x, y: weaponY, vx: Math.cos(aimAngle) * speed, vy: Math.sin(aimAngle) * speed, speed, life: archerLife, maxLife: archerLife, color: cd.s1Color || '#e74c3c', damage: this.player.atk * 1.1, radius: arrowRadius, ...projProps }));
       const extraArrows = Math.max(0, Math.floor((this.player.atk - 100) / 100));
       if (extraArrows > 0) {
         let nearest = null, nearDist = Infinity;
         for (let e of this.enemies) {
           if (!e.alive) continue;
           const d = Math.hypot(e.x - this.player.x, e.y - weaponY);
           if (d < nearDist) { nearDist = d; nearest = e; }
         }
         if (nearest) {
           const targetAngle = Math.atan2(nearest.y - weaponY, nearest.x - this.player.x);
           const spread = 0.12;
           for (let i = 0; i < extraArrows; i++) {
             const offset = (i - (extraArrows - 1) / 2) * spread;
             const a = targetAngle + offset;
             this.projectiles.push(new Projectile({ type: 'arrow', x: this.player.x, y: weaponY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed, life: archerLife, maxLife: archerLife, color: cd.s1Color || '#e74c3c', damage: this.player.atk * 1.1, radius: arrowRadius, tx: nearest.x, ty: nearest.y, angle: a, facing: this.player.facing, critChance: 0.1 }));
           }
         }
       }
       this.spawnParticles(this.player.x, weaponY, cd.s1Color || '#e74c3c', 4, 3);
    } else if (skillType === 'Psionic Slash' || this.player.classType === 'magicgladiator') {
      const mgScale = 1 + (this.player.atk - cd.atk) * 0.005;
      this.projectiles.push(new Projectile({ type: 'slash', originX: this.player.x, originY: weaponY, life: 20, maxLife: 20, color: cd.s1Color || '#e74c3c', radius: 60 * mgScale * lvlScale, hitInner: 0, hitOuter: 80 * mgScale * lvlScale, damage: this.player.atk * 1.1, critChance: 0.12, ...projProps }));
      this.spawnParticles(this.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, cd.s1Color || '#e74c3c', 7, 4);
    } else {
      // Default fallback is Warrior Bash style
      const wScale = 1 + (this.player.atk - cd.atk) * 0.005;
      this.projectiles.push(new Projectile({ type: 'slash', originX: this.player.x, originY: weaponY, life: 15, maxLife: 15, color: cd.s1Color || '#d4af37', radius: 60 * wScale * lvlScale, hitInner: 0, hitOuter: 90 * wScale * lvlScale, knockback: 65, knockbackDir: aimAngle, isKnockback: true, damage: this.player.atk * 1.0, ...projProps }));
      this.spawnParticles(this.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, cd.s1Color || '#d4af37', 5, 3);
    }
    this.broadcastState();
  }

  startChargingSkill2() {
    if (this.s2Cooldown > 0 || !this.player) return;
    this.player.lastInputTime = Date.now();
    this.player.autoAttackTarget = null;
    this.player.targetedItemId = null;
    this.player.stopWalking(this);
    this.player.isChargingS2 = true;
    this.player.s2ChargeTime = 0;
    this.player.s2ChargeCount = 0;
    this.player.action = 'attack';
    this.player.animTimer = 9999;
    this.player.lastSkill = 2;
    this.broadcastState();
  }

releaseSkill2() {
    if (!this.player || !this.player.isChargingS2) return;
    this.queuedFireball = null;
    this.player.lastInputTime = Date.now();
    this.player.isChargingS2 = false;
    this.autoRestartS2 = this.mouseDown;

    const cd = CLASS_DATA[this.player.classType] || CLASS_DATA.warrior;

    // Calculate dynamic cooldown based on SPD. Starts at 5000ms.
    const baseSpd = cd.spd;
    const diff = Math.max(0, this.player.spd - baseSpd);
    this.s2MaxCooldown = Math.max(1000, 5000 - diff * 200);
    this.s2Cooldown = this.s2MaxCooldown;

    // SPD controls AOE
    const aoeScale = 1 + (this.player.spd - baseSpd) * 0.02;
    const reqLevel = 4 + (this.player.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.player.level - 1) / Math.max(1, reqLevel - 1));

    // Charges scale logic:
    // charge = 0 -> 1x
    // charge = 1 -> 1.25x dmg, larger area
    // charge = 2 -> 1.50x dmg
    // charge = 3 -> 1.75x dmg
    const charges = this.player.s2ChargeCount || 0;
    const dmgMulti = 1 + (charges * 0.15);
    const areaMulti = 1 + (charges * 0.08);

    const tx = this.player.mouseX, ty = this.player.mouseY;
    const weaponY = this.player.y - 30 * lvlScale;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.player.x);
    this.player.facing = tx > this.player.x ? 1 : -1;
    this.player.animTimer = 25; // finalize attack animation
    this.player.action = 'attack';
    this.player.lastSkill = 2;

    let projProps = { tx, ty, angle: aimAngle, facing: this.player.facing };

    const skillType = cd.s2Name;
    if (skillType === 'Sword Slash' || this.player.classType === 'warrior') {
      const waveCount = 1 + charges;
      const spdDiff = Math.max(0, this.player.spd - cd.spd);
      const waveDistance = Math.min(this.gameW * 0.25, (120 + spdDiff * 6) * areaMulti);
      const waveSpread = 0.12 + (aoeScale - 1) * 0.08;

      const areaMultiRadius = Math.min(2.0, areaMulti);
      for (let i = 0; i < waveCount; i++) {
        const a = aimAngle + (i - (waveCount - 1) / 2) * waveSpread;
        this.projectiles.push(new Projectile({ type: 'shockwave', originX: this.player.x, originY: weaponY, x: this.player.x, y: weaponY, speed: 5.5, life: 50, maxLife: 50, color: cd.s2Color || '#ffd700', damage: this.player.atk * 2.0 * dmgMulti, critChance: 0.2, maxDistance: waveDistance, radius: 15 * aoeScale * areaMultiRadius * lvlScale, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps, angle: a, charges: charges }));
      }
      this.spawnParticles(this.player.x + Math.cos(aimAngle) * 10, weaponY + Math.sin(aimAngle) * 10, cd.s2Color || '#ffd700', 12 + charges * 5, 4);
    } else if (skillType === 'Fireball' || this.player.classType === 'mage') {
      const fbRadius = Math.min(60, 15 + charges * 5);
      const newFireballRadius = fbRadius * aoeScale * lvlScale;
      const spawnX = this.player.x;
      const spawnY = weaponY;
      const spdDiff = Math.max(0, this.player.spd - 200);
      const fbLifeMult = 1 + Math.floor(spdDiff / 50) * 0.2;
      const fbLife = Math.round(80 * fbLifeMult);
      let canSpawn = true;
      for (let p of this.projectiles) {
        if (p.type === 'fireball' && p.life > 0) {
          const existingRadius = p.radius || newFireballRadius;
          const dist = Math.hypot(p.x - spawnX, p.y - spawnY);
          if (dist < newFireballRadius + existingRadius + 10) {
            canSpawn = false;
            break;
          }
        }
      }
      if (canSpawn) {
        this.projectiles.push(new Projectile({ type: 'fireball', x: spawnX, y: spawnY, speed: 5, life: fbLife, maxLife: fbLife, color: cd.s2Color || '#e67e22', damage: this.player.atk * 1.0 * dmgMulti, critChance: 0.2, radius: newFireballRadius, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps }));
        this.spawnParticles(spawnX, spawnY, cd.s2Color || '#e67e22', 20 * aoeScale + charges * 5, 5);
      } else if (!this.queuedFireball) {
        this.queuedFireball = { spawnX, spawnY, speed: 5, radius: newFireballRadius, color: cd.s2Color || '#e67e22', damage: this.player.atk * 1.0 * dmgMulti, ...projProps, fbLife };
      }
    } else if (skillType === 'Arrow Barrage' || this.player.classType === 'archer') {
      const maxArrowCount = 24;
      const minArrowCount = 4;
      const arrowRadius = 12 + charges * 0.9;
      const arrowBodyScale = 1 + charges * 0.075;
      const maxSpreadSpd = baseSpd + 100;
      const baseArrowCount = Math.min(maxArrowCount, Math.max(minArrowCount, 4 + Math.floor((this.player.spd - baseSpd) * 20 / (maxSpreadSpd - baseSpd))));
      const extraArrows = Math.max(0, Math.floor((this.player.spd - maxSpreadSpd) / 50));
      const totalArrowCount = baseArrowCount + extraArrows;
      const spreadRatio = totalArrowCount >= maxArrowCount ? 1 : (totalArrowCount - minArrowCount) / (maxArrowCount - minArrowCount);
      const spreadAngle = 0.15 + spreadRatio * (2 * Math.PI - 0.15);
      const facingAngle = aimAngle;
      for (let i = 0; i < totalArrowCount; i++) {
        const a = totalArrowCount === 1 ? facingAngle : facingAngle + (i / (totalArrowCount - 1) * 2 - 1) * spreadAngle / 2;
        const speed = 11;
        this.projectiles.push(new Projectile({ type: 'arrow', x: this.player.x, y: weaponY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed, life: 50, maxLife: 50, color: cd.s2Color || '#e74c3c', damage: this.player.atk * 2.0 * dmgMulti, critChance: 0.15, angle: a, radius: arrowRadius, bodyScale: arrowBodyScale }));
      }
      this.spawnParticles(this.player.x, weaponY, cd.s2Color || '#e74c3c', 10 + charges * 5, 4);
    } else if (skillType === 'Evil Spirits' || this.player.classType === 'magicgladiator') {
      const existingSpirits = this.projectiles.filter(p => p.type === 'spirit').length;
      const spiritCount = Math.min(8 + charges * 4, 50 - existingSpirits);
      const spiritDamage = this.player.atk * 0.8 * dmgMulti;
      const spiritRadius = Math.min(20, 10 + charges * 1.5);
      const spiritLife = Math.round(90 + charges * 15);
      const spiritColor = cd.s2Color || '#ffd700';

      for (let i = 0; i < spiritCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 3;
        const sizeMult = 0.8 + Math.random() * 0.5;

        this.projectiles.push(new Projectile({
          type: 'spirit',
          x: this.player.x + Math.cos(angle) * 15,
          y: weaponY + Math.sin(angle) * 15,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          speed: speed,
          life: spiritLife,
          maxLife: spiritLife,
          color: spiritColor,
          damage: spiritDamage * sizeMult,
          critChance: 0.25,
          radius: spiritRadius * sizeMult,
          wobble: Math.random() * 100,
          trailTimer: 0,
          trailPositions: [],
          tx: this.player.mouseX,
          ty: this.player.mouseY,
          angle: angle,
          facing: 1
        }));
      }
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.atk * 0.5 * dmgMulti);
      this.ui.updateHUD(this.player);
    } else {
      // Default fallback: Warrior Shockwave style
      const waveCount = 1 + charges;
      const spdDiff = Math.max(0, this.player.spd - cd.spd);
      const waveDistance = Math.min(this.gameW * 0.25, (120 + spdDiff * 6) * areaMulti);
      const waveSpread = 0.12 + (aoeScale - 1) * 0.08;

      const areaMultiRadius = Math.min(2.0, areaMulti);
      for (let i = 0; i < waveCount; i++) {
        const a = aimAngle + (i - (waveCount - 1) / 2) * waveSpread;
        this.projectiles.push(new Projectile({ type: 'shockwave', originX: this.player.x, originY: weaponY, x: this.player.x, y: weaponY, speed: 5.5, life: 50, maxLife: 50, color: cd.s2Color || '#ffd700', damage: this.player.atk * 2.0 * dmgMulti, critChance: 0.2, maxDistance: waveDistance, radius: 15 * aoeScale * areaMultiRadius * lvlScale, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps, angle: a, charges: charges }));
      }
      this.spawnParticles(this.player.x + Math.cos(aimAngle) * 10, weaponY + Math.sin(aimAngle) * 10, cd.s2Color || '#ffd700', 12 + charges * 5, 4);
    }
    this.broadcastState();
  }

  broadcastState() {
    if (!this.player) return;

    const activeConfig = {};
    for (const key in CONFIG_METADATA) {
      activeConfig[key] = ConfigModule[key];
    }

    const data = {
      inGame: true,
      nick: this.player.nick,
      state: this.state,
      alive: this.player.alive,
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
      maxHp: this.player._maxHp,
      atk: this.player._atk,
      spd: this.player._spd,
      level: this.player.level,
      resets: this.player.resets,
      kills: this.player.kills,
      reqKills: this.player.reqKills,
      facing: this.player.facing,
      action: this.player.action,
      classType: this.player.classType,
      animTimer: this.player.animTimer,
      hitFlash: this.player.hitFlash,
      lastInputTime: this.player.lastInputTime || 0,
      lastSkill: this.player.lastSkill || 1,
      isChargingS2: this.player.isChargingS2,
      s2ChargeCount: this.player.s2ChargeCount,
      mouseX: this.player.mouseX,
      mouseY: this.player.mouseY,
      chatMsg: this.player.chatMsg,
      buffHpTimer: this.player.buffHpTimer,
      buffManaTimer: this.player.buffManaTimer,
      targetedItemId: this.player.targetedItemId,
      // Intentionally omitting inventory and equipment to prevent buffer overflow (BSON limit) with custom gear
      projectiles: this.projectiles.map(p => ({
        type: p.type, x: p.x, y: p.y, angle: p.angle, life: p.life, maxLife: p.maxLife,
        radius: p.radius, color: p.color, originX: p.originX, originY: p.originY, trailPositions: p.trailPositions,
        vx: p.vx, vy: p.vy, wobble: p.wobble, trailTimer: p.trailTimer
      }))
    };
    if (this.pendingHits && this.pendingHits.length > 0) {
      data.hits = this.pendingHits;
      this.pendingHits = [];
    }
    if (this.isHost) {
      data.hostData = {
        wave: this.wave, kills: this.kills, seed: this.prng.seed, env: this.selectedEnv, time: this.globalTime,
        waveTotal: this.waveTotalEnemies, waveKilled: this.waveEnemiesKilled, waveSpawn: this.waveEnemiesToSpawn, bossActive: this.bossActive,
        enemies: this.enemies.filter(e => e.alive || (Date.now() - e.deathTime < DEAD_BODY_LIFETIME)).map(e => ({
          id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, alive: e.alive, name: e.name, size: e.size, deathTime: e.deathTime
        })),
        items: this.items.map(i => ({
          ...i,
          icon: (i.icon && typeof i.icon === 'string' && i.icon.startsWith('data:image/')) ? '📦' : i.icon
        }))
      };
    }
    this.net.send_cmd('set_data', data);
  }

  dealDamageToPlayer(damage) {
    if (!this.player || !this.player.alive) return;

    const armor = Math.floor(this.player.maxHp / 10);
    const reductionRatio = Math.min(0.9, armor * 0.005);
    const actualDamage = Math.max(1, Math.round(damage * (1 - reductionRatio)));

    this.player.hp -= actualDamage;
    this.player.hitFlash = 15;
    this.screenShake = 15;
    const px = this.player.x, py = this.player.y - 5;
    const count = Math.floor(6 * (this.settings ? this.settings.particles : 1.0));
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: px, y: py,
        vx: (Math.random() - 0.5) * 3,
        vy: -Math.random() * 2.5 - 0.5,
        life: 25, maxLife: 25,
        color: '#8b0000',
        size: 5 + Math.random() * 3,
        isBlood: true
      });
    }
    this.ui.updateHUD(this.player);
    this.ui.addLog(`💔 Took -${actualDamage} damage!`, 'enemy');
    this.floatingTexts.push({
      x: this.player.x + (Math.random() - 0.5) * 20, y: this.player.y - 60,
      text: '-' + actualDamage, color: '#e74c3c', life: 35, maxLife: 35
    });
    if (this.player.hp <= 0) {
      this.player.hp = 0;
      this.player.alive = false;
      // Move body behind horizon
      this.player.y = this.gameH * 0.45;
      this.broadcastState();
      // Keep state PLAYING so the network host continues to run the simulation
      this.ui.showDeathScreen(this.kills, this.wave);
    } else {
      this.broadcastState();
    }
  }

  dealDamage(enemy, baseDamage, critChance) {
    if (!enemy.alive) return;
    const isCrit = Math.random() < critChance;
    const damage = Math.round(baseDamage * (isCrit ? 2.0 : 1.0) * (0.9 + Math.random() * 0.2));

    this.pendingHits.push({ id: enemy.id, damage: damage, isCrit: isCrit, source: this.net.me.info.user });

    // Local Vampirism healing (heals 75% of damage dealt)
    if (this.player && this.player.buffHpTimer > 0 && this.player.hp > 0) {
      const healAmount = Math.floor(damage * POTION_LIFESTEAL_PERCENT);
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
      if (healAmount > 0) {
        this.floatingTexts.push({ x: this.player.x, y: this.player.y - 60, text: '+' + healAmount, color: '#2ecc71', life: 40, maxLife: 40, isCrit: false });
      }
      this.ui.updateHUD(this.player);
    }

    if (this.isHost) {
      let e = this.enemies.find(ex => ex.id === enemy.id);
      if (e && e.alive) {
        e.hp -= damage;
        e.hitFlash = 8;
        this.floatingTexts.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 30, text: (isCrit ? '💥 ' : '') + damage, color: isCrit ? '#ffd700' : '#fff', life: 40, maxLife: 40, isCrit: isCrit });
        if (e.hp <= 0) {
          e.alive = false; e.deathTime = Date.now(); e.hp = 0;
          this.spawnEnemyDeathExplosion(e);
          this.net.send_cmd('set_data', { enemyKilled: this.net.me.info.user + '_' + Math.random() });
          this.waveEnemiesKilled++;
          if (this.bossActive && e.name === 'BOSS') {
            const aliveBosses = this.enemies.filter(ex => ex.name === 'BOSS' && ex.alive);
            if (aliveBosses.length === 0) {
              this.enemies.forEach(ex => { if (ex.alive) { ex.hp = 0; ex.alive = false; } });
              this.waveTransitionTimer = 120;
            }
          } else if (!this.bossActive && this.waveEnemiesKilled >= this.waveTotalEnemies) {
            this.waveTransitionTimer = 120;
          }
        }
      }
    }
  }

  applyKnockback(enemy, dirAngle, distance) {
    if (!enemy.alive) return;
    enemy.x += Math.cos(dirAngle) * distance;
    enemy.y += Math.sin(dirAngle) * distance * 0.4;
    const groundY = getGroundY(this.selectedEnv);
    enemy.x = Math.max(enemy.size, Math.min(this.gameW - enemy.size, enemy.x));
    enemy.y = Math.max(enemy.size, Math.min(groundY - enemy.size, enemy.y));
    if (enemy.attackTimer !== undefined) enemy.attackTimer = Math.max(enemy.attackTimer, 30);
  }

  spawnParticles(x, y, color, count = 20, speed = 5, sizeScale = 1.0) {
    const finalCount = Math.floor(count * (this.settings ? this.settings.particles : 1.0));
    for (let i = 0; i < finalCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.5 + Math.random()) * speed;
      this.particles.push({
        x, y, vx: Math.cos(angle) * spd, vy: Math.sin(angle) * spd - 1,
        life: 20 + Math.floor(Math.random() * 20), maxLife: 40, color,
        size: (1.5 + Math.random() * 3) * sizeScale
      });
    }
  }

  spawnEnemyDeathExplosion(e) {
    const size = e.size || 30;
    const pCount = Math.floor(45 * (this.settings ? this.settings.particles : 1.0));
    
    // 1. Shatter/dissolve starting positions all across the monster's visual area
    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.3 + Math.random() * 0.7) * 4.5;
      const r = Math.random() * (size * 0.45);
      const startAngle = Math.random() * Math.PI * 2;
      const px = e.x + Math.cos(startAngle) * r;
      const py = (e.y - size * 0.4) + Math.sin(startAngle) * r;
      
      this.particles.push({
        x: px, y: py,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 0.5,
        life: 25 + Math.floor(Math.random() * 25),
        maxLife: 50,
        color: e.color || '#e74c3c',
        size: (2.0 + Math.random() * 4.5) * (size / 30)
      });
    }

    // 2. Extra sparks/smoke for dense texture
    const sparksCount = Math.floor(20 * (this.settings ? this.settings.particles : 1.0));
    for (let i = 0; i < sparksCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.2 + Math.random() * 0.5) * 2.5;
      this.particles.push({
        x: e.x + (Math.random() - 0.5) * size * 0.6,
        y: e.y - size * 0.4 + (Math.random() - 0.5) * size * 0.6,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 1.2,
        life: 30 + Math.floor(Math.random() * 30),
        maxLife: 60,
        color: '#ff7979',
        size: (3.0 + Math.random() * 5) * (size / 30)
      });
    }


  }

  triggerLevelUpAnimation(p) {
    const size = p.level ? Math.max(24, 24 * (0.5 + 0.5 * (p.level / 10))) : 28;
    
    // 1. Moderate Expanding Golden Halo (Sun crown wave) at player's feet
    this.particles.push({
      x: p.x, y: p.y + 10,
      vx: 0, vy: -0.6,
      life: 30, maxLife: 30,
      color: 'rgba(255, 215, 0, 0.7)',
      size: size * 1.3, // Scaled down halo
      isHalo: true
    });

    // 2. Rising sunburst rays radiating 360 degrees outward (optimized count)
    const rayCount = 12; // Reduced from 36 to 12
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.1;
      const spd = 1.2 + Math.random() * 2.0;
      const length = size * 1.5 + Math.random() * size * 0.5; // Scaled down ray lengths
      
      this.particles.push({
        x: p.x,
        y: p.y - size * 0.4, // radiate from player's chest center
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 25 + Math.floor(Math.random() * 15),
        maxLife: 40,
        color: i % 2 === 0 ? '#ffd700' : '#fffae0',
        size: 1.2 + Math.random() * 1.2, // thinner rays
        length: length,
        isRay: true
      });
    }

    // 3. Dense rising sparkling light stars all over the character's body (optimized count)
    const sparkleCount = 18; // Reduced from 50 to 18
    for (let i = 0; i < sparkleCount; i++) {
      this.particles.push({
        x: p.x + (Math.random() - 0.5) * 24,
        y: p.y + (Math.random() - 0.5) * 35 - 15,
        vx: (Math.random() - 0.5) * 0.8,
        vy: -1.8 - Math.random() * 2.5,
        life: 20 + Math.floor(Math.random() * 15),
        maxLife: 35,
        color: '#fffbe0',
        size: 1.0 + Math.random() * 1.5, // smaller sparkles
        isSparkle: true
      });
    }
  }

  initBgParticles() {
    this.bgParticles = [];
    const groundY = getGroundY(this.selectedEnv);
    for (let i = 0; i < 40; i++) {
      this.bgParticles.push({
        x: Math.random() * this.gameW, y: 10 + Math.random() * (groundY - 30),
        vx: (Math.random() - 0.5) * 0.5, vy: -Math.random() * 0.8 - 0.2,
        size: Math.random() * 2 + 1, alpha: Math.random() * 0.5 + 0.2
      });
    }
  }

  generateScenery() {
    this.scenery = [];
    this.horizonFoliage = [];
    this.groundFoliage = [];
    const env = ENV_CONFIG[this.selectedEnv] || ENV_CONFIG.forest;
    const currentDay = Math.floor(this.globalTime / ConfigModule.DAY_CYCLE_DURATION);
    let localPrng = new PRNG((currentDay + 1) * 9999);

    const sceneryCount = Math.floor(15 * (this.settings ? this.settings.bgElements : 1.0));
    for (let i = 0; i < sceneryCount; i++) {
      const w = 40 + localPrng.nextFloat() * 60;
      const h = 50 + localPrng.nextFloat() * 120;
      this.scenery.push({
        x: localPrng.nextFloat() * this.gameW, w, h,
        color: darkenColor(env.ground, 0.2 + localPrng.nextFloat() * 0.3)
      });
    }

    const horizonCount = Math.floor(25 * (this.settings ? this.settings.bgElements : 1.0));
    for (let i = 0; i < horizonCount; i++) {
      this.horizonFoliage.push({
        x: localPrng.nextFloat() * this.gameW,
        h: 20 + localPrng.nextFloat() * 50,
        w: 15 + localPrng.nextFloat() * 30,
        phase: localPrng.nextFloat() * Math.PI * 2,
        speed: 0.5 + localPrng.nextFloat() * 1.5,
        color: env.horizonColor || darkenColor(env.ground, 0.4),
        type: env.horizonType || 'trees'
      });
    }

    const groundY = this.gameH * env.groundY;
    const groundCount = Math.floor(60 * (this.settings ? this.settings.groundElements : 1.0));
    for (let i = 0; i < groundCount; i++) {
      this.groundFoliage.push({
        x: localPrng.nextFloat() * this.gameW,
        y: groundY + 5 + localPrng.nextFloat() * (this.gameH - groundY - 10),
        size: 4 + localPrng.nextFloat() * 12,
        phase: localPrng.nextFloat() * Math.PI * 2,
        color: env.groundColor || darkenColor(env.ground, 0.1),
        type: env.groundType || 'grass'
      });
    }
  }

  drawMenuBackground() {
    const env = ENV_CONFIG[this.ui.selectedClass ? ENV_LIST[0] : 'forest'];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.applyViewport();

    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, this.gameH);
    skyGrad.addColorStop(0, env.skyTop);
    skyGrad.addColorStop(0.5, env.skyMid);
    skyGrad.addColorStop(1, env.skyBot);
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.gameW, this.gameH);

    const gY = this.gameH * env.groundY;
    this.ctx.fillStyle = env.ground;
    this.ctx.fillRect(0, gY, this.gameW, this.gameH - gY);

    this.ctx.fillStyle = 'rgba(255,215,0,0.2)';
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('🎮 SELECT CLASS & PRESS START', this.gameW / 2, this.gameH / 2);

    this.ctx.restore();
  }

  drawEnvironment() {
    const env = ENV_CONFIG[this.selectedEnv];
    const gY = this.gameH * env.groundY;

    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, gY);
    skyGrad.addColorStop(0, env.skyTop);
    skyGrad.addColorStop(0.5, env.skyMid);
    skyGrad.addColorStop(1, env.skyBot);
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(-2000, 0, this.gameW + 4000, gY);

    const nightAlpha = this.nightAlpha || 0;
    const dayAlpha = this.dayAlpha || 0;
    const cycle = (this.globalTime % ConfigModule.DAY_CYCLE_DURATION) / ConfigModule.DAY_CYCLE_DURATION;

    const cx = this.gameW / 2, cy = gY;
    // Shift angle so cycle=0 is sunrise (angle = PI)
    const angle = cycle * Math.PI * 2 + Math.PI;
    const sunX = cx - Math.cos(angle) * 350;
    const sunY = cy + Math.sin(angle) * 250;
    if (sunY < gY + 40) {
      this.ctx.fillStyle = '#f1c40f'; this.ctx.beginPath(); this.ctx.arc(sunX, sunY, 35, 0, Math.PI * 2); this.ctx.fill();
      this.ctx.fillStyle = 'rgba(241, 196, 15, 0.3)'; this.ctx.beginPath(); this.ctx.arc(sunX, sunY, 50, 0, Math.PI * 2); this.ctx.fill();
    }
    const moonAngle = angle + Math.PI;
    const moonX = cx - Math.cos(moonAngle) * 350;
    const moonY = cy + Math.sin(moonAngle) * 250;
    if (moonY < gY + 40) {
      const moonGlow = this.ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 250);
      moonGlow.addColorStop(0, `rgba(220, 230, 255, ${nightAlpha * 0.4})`);
      moonGlow.addColorStop(1, `rgba(220, 230, 255, 0)`);
      this.ctx.fillStyle = moonGlow;
      this.ctx.beginPath(); this.ctx.arc(moonX, moonY, 250, 0, Math.PI * 2); this.ctx.fill();

      this.ctx.fillStyle = '#ecf0f1'; this.ctx.beginPath(); this.ctx.arc(moonX, moonY, 28, 0, Math.PI * 2); this.ctx.fill();
    }

    if (nightAlpha > 0) {
      this.ctx.fillStyle = `rgba(5, 5, 20, ${nightAlpha * 0.75})`;
      this.ctx.fillRect(-2000, 0, this.gameW + 4000, gY);
    }

    this.ctx.save();
    const sepiaAmt = dayAlpha * 45;
    const grayscaleAmt = nightAlpha * 95;
    const brightnessAmt = 100 + (dayAlpha * 50) - (nightAlpha * 75);
    this.ctx.filter = `sepia(${sepiaAmt}%) grayscale(${grayscaleAmt}%) brightness(${brightnessAmt}%)`;

    // Draw background clouds affected by biome atmospheric filters
    if (this.atmosEffects && this.atmosEffects.length > 0) {
      for (let ef of this.atmosEffects) {
        if (ef.type === 'cloud') {
          this.ctx.fillStyle = ef.color;
          this.ctx.beginPath();
          this.ctx.arc(ef.x, ef.y, ef.size * 0.6, 0, Math.PI * 2);
          this.ctx.arc(ef.x + ef.size * 0.5, ef.y - ef.size * 0.2, ef.size * 0.5, 0, Math.PI * 2);
          this.ctx.arc(ef.x - ef.size * 0.5, ef.y - ef.size * 0.1, ef.size * 0.4, 0, Math.PI * 2);
          this.ctx.arc(ef.x + ef.size * 0.8, ef.y + ef.size * 0.2, ef.size * 0.35, 0, Math.PI * 2);
          this.ctx.arc(ef.x - ef.size * 0.8, ef.y + ef.size * 0.2, ef.size * 0.3, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
    }

    if (!this.scenery) this.generateScenery();
    for (let s of this.scenery) {
      this.ctx.fillStyle = s.color;
      this.ctx.beginPath();
      this.ctx.moveTo(s.x, gY);
      this.ctx.lineTo(s.x + s.w / 2, gY - s.h);
      this.ctx.lineTo(s.x + s.w, gY);
      this.ctx.fill();
    }

    if (this.horizonFoliage) {
      for (let h of this.horizonFoliage) {
        this.ctx.fillStyle = h.color;
        const sway = Math.sin(this.globalTime * h.speed + h.phase) * (h.h * 0.1);
        this.ctx.beginPath();
        if (h.type === 'trees' || h.type === 'pines' || h.type === 'deadtrees') {
          this.ctx.moveTo(h.x + sway, gY - h.h);
          this.ctx.lineTo(h.x - h.w / 2, gY);
          this.ctx.lineTo(h.x + h.w / 2, gY);
        } else if (h.type === 'walls') {
          this.ctx.fillRect(h.x - h.w / 2, gY - h.h, h.w, h.h);
        } else {
          this.ctx.ellipse(h.x + sway, gY - h.h / 2, h.w / 2, h.h / 2, 0, 0, Math.PI * 2);
        }
        this.ctx.fill();
      }
    }
    this.ctx.restore();

    this.ctx.fillStyle = env.ground;
    this.ctx.fillRect(-2000, gY, this.gameW + 4000, this.gameH - gY);
  }

  loop(time) {
    if (this.state === 'PLAYING') {
      const dt = this.lastTime ? Math.min((time - this.lastTime) / 16.67, 3) : 1;
      this.lastTime = time;
      this.globalTime += dt * 0.016;

      this.frameCount = (this.frameCount || 0) + 1;
      const now = Date.now();
      if (!this.lastFpsTime) this.lastFpsTime = now;
      if (now - this.lastFpsTime >= 2000) {
        this.fps = this.frameCount / 2;
        this.frameCount = 0;
        this.lastFpsTime = now;

        if (this.settings && this.settings.autoGraphics && !document.hidden && document.hasFocus()) {
          let changed = false;
          const minLim = this.settings.autoLimit ? 0.5 : 0.0;

          if (this.settings.particles < minLim) { this.settings.particles = minLim; changed = true; }
          if (this.settings.bgElements < minLim) { this.settings.bgElements = minLim; changed = true; }
          if (this.settings.groundElements < minLim) { this.settings.groundElements = minLim; changed = true; }
          if (this.settings.atmos < minLim) { this.settings.atmos = minLim; changed = true; }

          if (this.fps < 40) {
            this.settings.particles = Math.max(minLim, this.settings.particles - 0.10);
            this.settings.bgElements = Math.max(minLim, this.settings.bgElements - 0.10);
            this.settings.groundElements = Math.max(minLim, this.settings.groundElements - 0.10);
            this.settings.atmos = Math.max(minLim, this.settings.atmos - 0.10);
            changed = true;
          } else if (this.fps >= 55 && (this.settings.particles < 2.0 || this.settings.bgElements < 2.0 || this.settings.groundElements < 2.0 || this.settings.atmos < 2.0)) {
            this.settings.particles = Math.min(2.0, this.settings.particles + 0.05);
            this.settings.bgElements = Math.min(2.0, this.settings.bgElements + 0.05);
            this.settings.groundElements = Math.min(2.0, this.settings.groundElements + 0.05);
            this.settings.atmos = Math.min(2.0, this.settings.atmos + 0.05);
            changed = true;
          }
          if (changed) {
            document.getElementById('particles-slider').value = Math.round(this.settings.particles * 100);
            document.getElementById('particles-val').textContent = `${Math.round(this.settings.particles * 100)}%`;
            document.getElementById('bg-slider').value = Math.round(this.settings.bgElements * 100);
            document.getElementById('bg-val').textContent = `${Math.round(this.settings.bgElements * 100)}%`;
            document.getElementById('ground-slider').value = Math.round(this.settings.groundElements * 100);
            document.getElementById('ground-val').textContent = `${Math.round(this.settings.groundElements * 100)}%`;
            document.getElementById('atmos-slider').value = Math.round(this.settings.atmos * 100);
            document.getElementById('atmos-val').textContent = `${Math.round(this.settings.atmos * 100)}%`;
            localStorage.setItem('nightvibe-settings', JSON.stringify(this.settings));
            this.generateScenery();
          }
        }
      }

      const cycle = (this.globalTime % ConfigModule.DAY_CYCLE_DURATION) / ConfigModule.DAY_CYCLE_DURATION;
      
      // Calculate celestial body heights (0 at horizon, 1 at peak)
      const sunHeight = Math.max(0, Math.sin(cycle * 2 * Math.PI));
      const moonHeight = Math.max(0, Math.sin(cycle * 2 * Math.PI - Math.PI));
      
      this.dayAlpha = sunHeight;
      
      // Sky darkness: 0 at noon, 1 at twilight, 0.6 at midnight (moonlight)
      this.nightAlpha = Math.max(0, 1.0 - sunHeight - (moonHeight * 0.4));

      if (this.isHost) {
        const currentDay = Math.floor(this.globalTime / ConfigModule.DAY_CYCLE_DURATION);
        const newEnv = ENV_LIST[currentDay % ENV_LIST.length];
        if (this.selectedEnv !== newEnv) {
          this.selectedEnv = newEnv;
          this.generateScenery();
          this.ui.updateEnvironment(this.selectedEnv);
          this.initBgParticles();
        }
      } else {
        // Periodically check if host is idle while we are a client
        this.hostCheckTimer = (this.hostCheckTimer || 0) + dt * 16.67;
        if (this.hostCheckTimer > 1000) {
          this.hostCheckTimer = 0;
          this.checkHost();
        }
      }

      // Atmospheric effects processing
      if (this.settings.atmos > 0) {
        const isNight = this.nightAlpha > 0.3;
        const rainColorsNight = ['rgba(255,255,255,0.4)', 'rgba(255,50,50,0.4)', 'rgba(50,255,50,0.4)'];
        const rainColorsDay = ['rgba(0,0,0,0.4)', 'rgba(100,0,0,0.4)'];
        const rColors = isNight ? rainColorsNight : rainColorsDay;

        const rainDensity = Math.floor(3 * this.settings.atmos * dt);
        for (let i = 0; i < rainDensity; i++) {
          if (Math.random() < 0.2) {
            this.atmosEffects.push({
              type: 'rain',
              x: Math.random() * this.gameW,
              y: -10,
              vx: -1 + Math.random() * 2,
              vy: 10 + Math.random() * 5,
              color: rColors[Math.floor(Math.random() * rColors.length)],
              size: 1 + Math.random() * 1.5,
              life: 1.0
            });
          }
        }

        if (Math.random() < 0.005 * this.settings.atmos * dt) {
          const clouds = this.atmosEffects.filter(ef => ef.type === 'cloud');
          const maxClouds = Math.max(1, Math.floor(4 * this.settings.atmos));

          if (clouds.length < maxClouds) {
            const groundY = getGroundY(this.selectedEnv);
            const size = 60 + Math.random() * 80;
            const maxCloudY = groundY - size * 0.6 - 20;

            // Divide the sky into 3 horizontal lanes to prevent overlaps
            const laneHeight = maxCloudY / 3;
            const laneCounts = [0, 0, 0];
            for (let c of clouds) {
              const laneIndex = Math.min(2, Math.floor(c.y / laneHeight));
              laneCounts[laneIndex]++;
            }

            // Choose the lane with the fewest clouds
            let minLane = 0;
            let minVal = Infinity;
            for (let i = 0; i < 3; i++) {
              if (laneCounts[i] < minVal) {
                minVal = laneCounts[i];
                minLane = i;
              }
            }

            // Calculate vertical position inside the chosen lane with random offset
            const spawnedY = minLane * laneHeight + Math.random() * (laneHeight - 10) + 5;

            // Align cloud spawn side and vx vector to cross the screen without immediate deletion
            const spawnLeft = Math.random() < 0.5;
            const x = spawnLeft ? -150 : this.gameW + 150;
            const vx = (spawnLeft ? 1 : -1) * (0.1 + Math.random() * 0.3);

            this.atmosEffects.push({
              type: 'cloud',
              x: x,
              y: spawnedY,
              vx: vx,
              vy: 0,
              color: isNight ? `rgba(255,255,255,${0.03 + Math.random() * 0.05})` : `rgba(0,0,0,${0.03 + Math.random() * 0.05})`,
              size: size,
              life: 1.0
            });
          }
        }

        if (Math.random() < 0.02 * this.settings.atmos * dt) {
          const groundY = getGroundY(this.selectedEnv);
          this.atmosEffects.push({
            type: 'smoke',
            x: Math.random() * this.gameW,
            y: groundY + (Math.random() * (this.gameH - groundY)),
            vx: -0.5 + Math.random(),
            vy: -0.5 - Math.random() * 0.5,
            color: isNight ? `rgba(150,255,150,${0.05 + Math.random() * 0.1})` : `rgba(50,50,50,${0.05 + Math.random() * 0.1})`,
            size: 10 + Math.random() * 15,
            life: 1.0
          });
        }
      }

      for (let i = this.atmosEffects.length - 1; i >= 0; i--) {
        let ef = this.atmosEffects[i];
        ef.x += ef.vx * dt;
        ef.y += ef.vy * dt;
        let dead = false;
        if (ef.type === 'rain' && ef.y > this.gameH) dead = true;
        if (ef.type === 'cloud' && (ef.x < -200 || ef.x > this.gameW + 200)) dead = true;
        if (ef.type === 'smoke') {
          ef.life -= 0.005 * dt;
          ef.size += 0.2 * dt;
          if (ef.life <= 0) dead = true;
        }
        if (dead) this.atmosEffects.splice(i, 1);
      }

      const dpr = this.pixelRatio || 1;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

      this.ctx.save();
      this.applyViewport(dt);

      // Background
      this.drawEnvironment();

      for (let p of this.bgParticles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const groundY = getGroundY(this.selectedEnv);
        if (p.y > groundY - 5) {
          p.y = 10 + Math.random() * (groundY - 30);
          p.x = Math.random() * this.gameW;
        }
        if (p.x < -10) p.x = this.gameW + 10;
        if (p.x > this.gameW + 10) p.x = -10;
        this.ctx.fillStyle = `rgba(255,255,255,${p.alpha * 0.3})`;
        this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); this.ctx.fill();
      }

      if (this.moveMarker && this.moveMarker.life > 0) {
        const progress = this.moveMarker.life / this.moveMarker.maxLife;
        this.ctx.globalAlpha = progress * 0.8;

        const isGreen = this.moveMarker.color === 'green';
        if (isGreen) {
          // Green expanding star/crosshair splash for item collection!
          this.ctx.strokeStyle = '#2ecc71';
          this.ctx.shadowColor = '#2ecc71';
          this.ctx.shadowBlur = 10;
          this.ctx.lineWidth = 2.5;
          const cx = this.moveMarker.x;
          const cy = this.moveMarker.y;
          const r = 15 * progress;

          this.ctx.beginPath();
          // Star cross lines
          this.ctx.moveTo(cx - r, cy); this.ctx.lineTo(cx + r, cy);
          this.ctx.moveTo(cx, cy - r); this.ctx.lineTo(cx, cy + r);
          this.ctx.stroke();

          // Outer pulsing ring
          this.ctx.beginPath();
          this.ctx.arc(cx, cy, r * 0.7, 0, Math.PI * 2);
          this.ctx.stroke();
        } else {
          // Standard walk click splash: glowing transparent yellow expanding dashed ring
          this.ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)';
          this.ctx.shadowColor = '#f1c40f';
          this.ctx.shadowBlur = 10;
          this.ctx.lineWidth = 2.5;
          this.ctx.setLineDash([4, 4]);
          this.ctx.beginPath();
          this.ctx.arc(this.moveMarker.x, this.moveMarker.y, 14 * progress, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.setLineDash([]);
        }

        this.ctx.shadowBlur = 0;
        this.moveMarker.life -= dt;
      }
      this.ctx.globalAlpha = 1;

      // Entities
      let activePlayers = [];
      if (this.player && this.player.alive) activePlayers.push(this.player);
      for (let key in this.otherPlayers) {
        let p = this.otherPlayers[key];
        if (p.inGame && p.hp > 0) activePlayers.push(p);
      }

      if (this.isHost && activePlayers.length === 0 && this.state === 'PLAYING') {
        this.state = 'GAME_OVER';
        this.net.send_cmd('set_data', { gameOver: Date.now(), state: 'MENU', inGame: false });
        this.quitToMenu();
      }

      for (let e of this.enemies) {
        e.update(dt, activePlayers);

        if (this.isHost && !e.alive && !e.deadProcessed) {
          e.deadProcessed = true;
          const groundY = getGroundY(this.selectedEnv);

          if (e.name !== 'MISSILE' && e.name !== 'BOMB') {
            if (Math.random() < ConfigModule.POTION_RED_DROP_CHANCE) {
              const lifeTime = 15000 + this.wave * 2000;
              const dropY = groundY + 20 + Math.random() * Math.min(250, this.gameH - groundY - 40);
              this.items.push({ id: Math.random().toString(36).substr(2, 9), type: 'red', x: e.x, y: e.y, life: lifeTime, vy: 0, falling: true, targetY: dropY });
            }

            if (Math.random() < ConfigModule.POTION_BLUE_DROP_CHANCE) {
              const lifeTime = 15000 + this.wave * 2000;
              const dropY = groundY + 20 + Math.random() * Math.min(250, this.gameH - groundY - 40);
              this.items.push({ id: Math.random().toString(36).substr(2, 9), type: 'blue', x: e.x, y: e.y, life: lifeTime, vy: 0, falling: true, targetY: dropY });
            }
          }

          if (e.name === 'MISSILE' || e.name === 'BOMB') {
            // boss projectiles don't drop gear
          } else if (ConfigModule.GEAR_DROP_ONLY_BOSS && e.name !== 'BOSS') {
            // do nothing
          } else if (Math.random() < ConfigModule.GEAR_DROP_RATE) {
            let rarity = 'normal'; let color = '#ecf0f1'; let numAffixes = 1;
            let randRarity = Math.random();
            const totalWeight = ConfigModule.GEAR_RARITY_NORMAL + ConfigModule.GEAR_RARITY_MAGIC + ConfigModule.GEAR_RARITY_RARE;
            const rareThreshold = ConfigModule.GEAR_RARITY_RARE / totalWeight;
            const magicThreshold = rareThreshold + (ConfigModule.GEAR_RARITY_MAGIC / totalWeight);

            if (randRarity < rareThreshold) { rarity = 'rare'; color = '#f1c40f'; numAffixes = 3; }
            else if (randRarity < magicThreshold) { rarity = 'magic'; color = '#3498db'; numAffixes = 2; }


            const lvl = e.isBoss ? (e.level || this.wave) * 1.5 : (e.level || this.wave);
            const baseStat = lvl * ConfigModule.GEAR_STAT_MULTIPLIER;
            const variance = ConfigModule.GEAR_STAT_VARIANCE;
            const finalStat = Math.floor(baseStat * (1 - variance + Math.random() * variance * 2));

            let stats = {}; let icon = '💎';
            let category = 'Ring'; let itemName = 'Unknown Item';

            const useCustom = (ConfigModule.ITEMS_DB && ConfigModule.ITEMS_DB.length > 0);
            if (useCustom) {
              const matchingItems = ConfigModule.ITEMS_DB.filter(item => (item.rarity || 'normal') === rarity);
              const templateList = matchingItems.length > 0 ? matchingItems : ConfigModule.ITEMS_DB;
              const template = templateList[Math.floor(Math.random() * templateList.length)];
              category = template.gearType;
              itemName = template.name;
              icon = template.icon;
              rarity = template.rarity || rarity;
              color = template.color || color;
              // Scale custom base stats by finalStat/10 (so an atk:10 item scales up linearly)
              let scale = finalStat / 10;
              if (template.stats) {
                if (template.stats.atk) stats.atk = Math.max(1, Math.floor(template.stats.atk * scale));
                if (template.stats.maxHp) stats.maxHp = Math.max(1, Math.floor(template.stats.maxHp * scale));
                if (template.stats.spd) stats.spd = Math.max(0.01, template.stats.spd * scale);
              }
              // Safeguard to ensure every item has at least one stat populated
              if (Object.keys(stats).length === 0) {
                if (category === 'Weapon') { stats.atk = Math.max(1, finalStat); }
                else if (category === 'Armor') { stats.maxHp = Math.max(5, finalStat * 10); }
                else { stats.spd = Math.max(0.1, finalStat * 0.1); }
              }
            } else {
              const categories = ['Weapon', 'Armor', 'Ring'];
              category = categories[Math.floor(Math.random() * categories.length)];
              if (category === 'Weapon') { stats.atk = Math.max(1, finalStat); icon = '🗡️'; }
              else if (category === 'Armor') { stats.maxHp = Math.max(5, finalStat * 10); icon = '🛡️'; }
              else { stats.spd = Math.max(0.1, finalStat * 0.1); icon = '💍'; }

              const possibleAffixes = ['atk', 'maxHp', 'spd'];
              let affixesAdded = 1; let sanity = 0;
              while (affixesAdded < numAffixes && sanity < 10) {
                sanity++;
                let randAffix = possibleAffixes[Math.floor(Math.random() * possibleAffixes.length)];
                if (!stats[randAffix]) {
                  if (randAffix === 'atk') stats.atk = Math.max(1, Math.floor(finalStat * 0.5));
                  if (randAffix === 'maxHp') stats.maxHp = Math.max(2, Math.floor(finalStat * 5));
                  if (randAffix === 'spd') stats.spd = Math.max(0.05, finalStat * 0.05);
                  affixesAdded++;
                }
              }
              const prefixes = rarity === 'rare' ? ['Epic', 'Legendary', 'Godly'] : (rarity === 'magic' ? ['Glowing', 'Mystic', 'Enchanted'] : ['Rusty', 'Common', 'Basic']);
              itemName = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${category}`;
            }


            const dropY = groundY + 20 + Math.random() * Math.min(250, this.gameH - groundY - 40);
            this.items.push({
              id: Math.random().toString(36).substr(2, 9),
              type: 'gear', gearType: category, rarity: rarity, color: color,
              name: itemName, stats: stats, icon: icon,
              x: e.x, y: e.y, life: 30000, vy: 0, falling: true, targetY: dropY
            });
          }
        }

        if (!this.isHost) {
          // Soft sync towards host position if they drift too far
          if (e.alive && e.serverX !== undefined) {
            e.x += (e.serverX - e.x) * 0.1 * dt;
            e.y += (e.serverY - e.y) * 0.1 * dt;
          }
        }
      }

      if (this.player) {
        this.player.updateMovement(dt, this);

        if (this.player.isChargingS2) {
          let chargeSpeed = (this.player.buffManaTimer && this.player.buffManaTimer > 0) ? ConfigModule.POTION_BLUE_CD_MULTIPLIER : 1;
          const cd = CLASS_DATA[this.player.classType] || CLASS_DATA.warrior;
          const spdDiff = Math.max(0, this.player.spd - cd.spd);
          chargeSpeed *= (1 + spdDiff * 0.05); // SPD speeds up charge
          if (this.player.classType === 'archer') chargeSpeed *= 1.35;
          this.player.s2ChargeTime = (this.player.s2ChargeTime || 0) + dt * 16.67 * chargeSpeed;
          const maxCharges = 3 + (this.player.resets || 0);
          const newCount = Math.min(maxCharges, Math.floor(this.player.s2ChargeTime / 1000));
          if (newCount > (this.player.s2ChargeCount || 0)) {
            this.player.s2ChargeCount = newCount;
            this.spawnParticles(this.player.x, this.player.y - 40, '#ffd700', 15, 4);
            this.broadcastState();
          }

          // Magic Gladiator charge: spawn floating purple spirit particles
          if (this.player.classType === 'magicgladiator' && Math.random() < 0.15 * dt) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 25;
            this.particles.push({
              x: this.player.x + Math.cos(angle) * dist,
              y: this.player.y - 40 + Math.sin(angle) * dist,
              vx: Math.cos(angle) * 0.3,
              vy: -0.5 - Math.random() * 0.5,
              life: 15 + Math.floor(Math.random() * 15),
              maxLife: 30,
              color: cd.s2Color || '#9b4dff',
              size: 1.5 + Math.random() * 2,
              isSparkle: true
            });
          }

          if (this.player.s2ChargeCount >= maxCharges && this.player.s2ChargeTime >= maxCharges * 1000 + 150) {
            this.releaseSkill2();
          }
        }

        if (this.player.action === 'attack' && this.player.animTimer <= 0 && !this.player.isChargingS2) {
          this.player.action = 'idle';
          this.broadcastState();
        } else if (this.player.action === 'walk' && !this.player.isMoving) {
          this.player.action = 'idle';
          this.broadcastState();
        }
      }

      for (const key in this.otherPlayers) {
        this.otherPlayers[key].updateMovement(dt, this);
      }

      // Z-Sorting (Y-Sorting) for perspective rendering
      let renderables = [];

      // Persistent movement marker on the ground
      if (this.player && this.player.isMoving && !this.player.autoAttackTarget) {
        renderables.push({
          y: this.player.moveTargetY - 1, draw: (ctx) => {
            ctx.save();
            ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 150) * 0.2;

            const isCollecting = !!this.player.targetedItemId;
            if (isCollecting) {
              // Draw a beautiful rotating star/diamond for item collection!
              ctx.fillStyle = '#2ecc71';
              ctx.shadowColor = '#2ecc71';
              ctx.shadowBlur = 10;

              const size = 10;
              ctx.translate(this.player.moveTargetX, this.player.moveTargetY);
              ctx.rotate(Date.now() / 200);

              ctx.beginPath();
              for (let j = 0; j < 4; j++) {
                ctx.rotate(Math.PI / 2);
                ctx.lineTo(size, 0);
                ctx.lineTo(size / 3, size / 3);
              }
              ctx.closePath();
              ctx.fill();
            } else {
              // Draw standard walk transparent yellow ellipse
              ctx.fillStyle = 'rgba(241, 196, 15, 0.6)';
              ctx.shadowColor = '#f1c40f';
              ctx.shadowBlur = 10;
              ctx.beginPath();
              ctx.ellipse(this.player.moveTargetX, this.player.moveTargetY, 15, 7.5, 0, 0, Math.PI * 2);
              ctx.fill();
            }

            ctx.restore();
          }
        });
      }

      for (let e of this.enemies) {
        renderables.push({
          y: e.y, draw: (ctx) => {
            if (this.player && this.player.autoAttackTarget === e) {
              ctx.save();
              ctx.shadowColor = '#e74c3c';
              ctx.shadowBlur = 15;
              ctx.strokeStyle = '#e74c3c';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.ellipse(e.x, e.y, e.size * 1.2, e.size * 0.6, 0, 0, Math.PI * 2);
              ctx.stroke();
              ctx.restore();
            }
            e.draw(ctx, getGroundY(this.selectedEnv));
          }
        });
      }

      if (this.player) {
        renderables.push({ y: this.player.y, draw: (ctx) => this.player.draw(ctx, dt, this) });
      }

      for (const key in this.otherPlayers) {
        const p = this.otherPlayers[key];
        if (p.inGame) {
          renderables.push({
            y: p.y, draw: (ctx) => {
              p.draw(ctx, dt, this);
              if (p.projectiles) {
                for (let projData of p.projectiles) {
                  Projectile.prototype.draw.call(projData, ctx);
                }
              }
            }
          });
        }
      }

      if (this.items) {
        if (this.player && this.player.targetedItemId) {
          const exists = this.items.some(item => item.id === this.player.targetedItemId);
          if (!exists) {
            this.player.targetedItemId = null;
          }
        }

        for (let i = 0; i < this.items.length; i++) {
          let item = this.items[i];
          item.life -= dt * 16.67;
          if (item.life <= 0) {
            if (this.player && this.player.targetedItemId === item.id) {
              this.player.targetedItemId = null;
            }
            this.items.splice(i, 1); i--; continue;
          }

          // Fall to target position if still falling
          if (item.falling) {
            item.vy += 1.0 * dt;
            item.y += item.vy * dt;
            if (item.y >= item.targetY) {
              item.y = item.targetY;
              item.falling = false;
              item.vy = 0;
            }
          }

          if (this.isHost) {
            let activePlayersList = [{ id: this.net.me ? this.net.me.info.user : 'host', obj: this.player }];
            for (let key in this.otherPlayers) {
              if (this.otherPlayers[key].inGame && this.otherPlayers[key].hp > 0) {
                activePlayersList.push({ id: key, obj: this.otherPlayers[key] });
              }
            }

            let pickedUp = false;
            for (let p of activePlayersList) {
              if (!p.obj || !p.obj.alive || p.obj.hp <= 0) continue;
              if (Math.hypot(p.obj.x - item.x, p.obj.y - item.y) < 40) {
                if (item.type === 'gear' && p.obj.targetedItemId !== item.id) {
                  continue;
                }
                pickedUp = true;
                if (this.isHost) {
                  if (item.type === 'gear') {
                    if (p.id === 'host' || p.id === (this.net.me ? this.net.me.info.user : null)) {
                      p.obj.inventory.push(item);
                      let statsStr = '';
                      if (item.stats) {
                        let parts = [];
                        if (item.stats.atk) parts.push(`+${item.stats.atk} ATK`);
                        if (item.stats.maxHp) parts.push(`+${item.stats.maxHp} HP`);
                        if (item.stats.spd) parts.push(`+${Number(item.stats.spd).toFixed(1)} SPD`);
                        if (parts.length > 0) statsStr = ` (${parts.join(', ')})`;
                      }
                      this.floatingTexts.push({ x: p.obj.x, y: p.obj.y - 50, text: `🎒 Looted: ${item.name}${statsStr}!`, color: item.color, life: 60, maxLife: 60, isCrit: false });
                      this.ui.addLog(`🎒 You picked up a ${item.name}${statsStr}!`, 'reward');
                      if (this.ui) this.ui.renderInventory();
                      this.saveLocalProgression();
                      this.broadcastState();
                    } else {
                      this.net.send_cmd('set_data', { giveItem: { item: item, target: p.id, id: Math.random() } });
                    }
                  } else if (item.type === 'red') {
                    p.obj.buffHpTimer = POTION_BUFF_DURATION;
                    this.spawnParticles(p.obj.x, p.obj.y - 20, '#e74c3c', 30, 6);
                    this.floatingTexts.push({ x: p.obj.x, y: p.obj.y - 50, text: `🩸 Vampirism ${Math.round(POTION_BUFF_DURATION / 1000)}s!`, color: '#e74c3c', life: 60, maxLife: 60, isCrit: false });
                    this.ui.addLog(`🩸 Vampirism! Heal on hit for ${Math.round(POTION_BUFF_DURATION / 1000)}s`, 'reward');
                  } else if (item.type === 'blue') {
                    p.obj.buffManaTimer = ConfigModule.POTION_BLUE_BUFF_DURATION;
                    this.spawnParticles(p.obj.x, p.obj.y - 20, '#3498db', 30, 6);
                    this.floatingTexts.push({ x: p.obj.x, y: p.obj.y - 50, text: `⚡ Mana Buff ${Math.round(ConfigModule.POTION_BLUE_BUFF_DURATION / 1000)}s!`, color: '#3498db', life: 60, maxLife: 60, isCrit: false });
                    this.ui.addLog(`⚡ Skill Cooldown Buff for ${Math.round(ConfigModule.POTION_BLUE_BUFF_DURATION / 1000)}s!`, 'reward');
                  }
                } else {
                  if (item.type !== 'gear') {
                    this.net.send_cmd('set_data', { giveBuff: { type: item.type, target: p.id, id: Math.random() } });
                  }
                }
                break;
              }
            }
            if (pickedUp) {
              if (this.player && this.player.targetedItemId === item.id) {
                this.player.targetedItemId = null;
              }
              this.items.splice(i, 1); i--; continue;
            }
          } else {
            // Process buffs assigned to us by the host
            let hostUserId = null;
            if (this.net && this.net.room && this.net.room.users) {
              for (let u in this.net.room.users) {
                if (this.net.room.users[u].data && this.net.room.users[u].data.isHost) {
                  hostUserId = u;
                  break;
                }
              }
            }
            if (hostUserId && this.net.room.users[hostUserId].data) {
              const hData = this.net.room.users[hostUserId].data;
              if (hData && hData.giveBuff) {
                const buff = hData.giveBuff;
                if (buff.target === (this.net.me ? this.net.me.info.user : null) && buff.id !== this.lastProcessedBuffId) {
                  this.lastProcessedBuffId = buff.id;
                  if (buff.type === 'red') {
                    this.player.buffHpTimer = POTION_BUFF_DURATION;
                    this.spawnParticles(this.player.x, this.player.y - 20, '#e74c3c', 30, 6);
                    this.floatingTexts.push({ x: this.player.x, y: this.player.y - 50, text: `🩸 Vampirism ${Math.round(POTION_BUFF_DURATION / 1000)}s!`, color: '#e74c3c', life: 60, maxLife: 60, isCrit: false });
                    this.ui.addLog(`🩸 Vampirism! Heal on hit for ${Math.round(POTION_BUFF_DURATION / 1000)}s`, 'reward');
                  } else {
                    this.player.buffManaTimer = ConfigModule.POTION_BLUE_BUFF_DURATION;
                    this.floatingTexts.push({ x: this.player.x, y: this.player.y - 50, text: `⚡ Mana Buff ${Math.round(ConfigModule.POTION_BLUE_BUFF_DURATION / 1000)}s!`, color: '#3498db', life: 60, maxLife: 60, isCrit: false });
                    this.ui.addLog(`⚡ Skill Cooldown Buff for ${Math.round(ConfigModule.POTION_BLUE_BUFF_DURATION / 1000)}s!`, 'reward');
                  }
                  this.spawnParticles(this.player.x, this.player.y - 20, buff.type === 'red' ? '#e74c3c' : '#3498db', 20, 5);
                }
              }
              if (hData && hData.giveItem) {
                const gi = hData.giveItem;
                if (gi.target === (this.net.me ? this.net.me.info.user : null) && gi.id !== this.lastProcessedItemId) {
                  this.lastProcessedItemId = gi.id;
                  this.player.inventory.push(gi.item);
                  let statsStr = '';
                  if (gi.item.stats) {
                    let parts = [];
                    if (gi.item.stats.atk) parts.push(`+${gi.item.stats.atk} ATK`);
                    if (gi.item.stats.maxHp) parts.push(`+${gi.item.stats.maxHp} HP`);
                    if (gi.item.stats.spd) parts.push(`+${Number(gi.item.stats.spd).toFixed(1)} SPD`);
                    if (parts.length > 0) statsStr = ` (${parts.join(', ')})`;
                  }
                  this.floatingTexts.push({ x: this.player.x, y: this.player.y - 50, text: `🎒 Looted: ${gi.item.name}${statsStr}!`, color: gi.item.color, life: 60, maxLife: 60, isCrit: false });
                  this.ui.addLog(`🎒 You picked up a ${gi.item.name}${statsStr}!`, 'reward');
                  if (this.ui) this.ui.renderInventory();
                  this.saveLocalProgression();
                  this.broadcastState();
                }
              }
            }
          }

          renderables.push({
            y: item.y, draw: (ctx) => {
              if (this.player && this.player.targetedItemId === item.id) {
                // Ground selector circle
                ctx.save();
                ctx.shadowColor = '#2ecc71';
                ctx.shadowBlur = 15;
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 2.5;
                ctx.beginPath();
                ctx.ellipse(item.x, item.y, 22, 11, 0, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();

                // Animated dotted connection line from player to item
                ctx.save();
                ctx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
                ctx.lineWidth = 2.5;
                ctx.setLineDash([5, 5]);
                ctx.lineDashOffset = -this.globalTime / 15; // Moving dashes flow effect
                ctx.beginPath();
                ctx.moveTo(this.player.x, this.player.y);
                ctx.lineTo(item.x, item.y);
                ctx.stroke();
                ctx.restore();
              }

              ctx.save();
              const floatOffset = Math.sin(this.globalTime / 200) * 5;
              const pulse = Math.abs(Math.sin(this.globalTime / 150));
              ctx.translate(item.x, item.y - 10 + floatOffset);
              ctx.globalAlpha = Math.min(1, item.life / 1000);

              if (item.type === 'gear') {
                // Gear Aura - oval base shadow for perspective
                ctx.beginPath();
                ctx.ellipse(0, 8, (14 + pulse * 6) * 1.3, (14 + pulse * 6) * 0.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = item.color || '#ecf0f1';
                ctx.globalAlpha = (0.0125 + pulse * 0.01875) * Math.min(1, item.life / 1000);
                ctx.fill();

                ctx.globalAlpha = Math.min(1, item.life / 1000);
                ctx.shadowColor = item.color || '#ecf0f1';
                ctx.shadowBlur = 10 + pulse * 10;

                let resolvedIcon = item.icon || '💎';
                if (resolvedIcon === '📦') {
                  const template = ConfigModule.ITEMS_DB.find(t => t.name === item.name);
                  if (template && template.icon) resolvedIcon = template.icon;
                }

                if (resolvedIcon && typeof resolvedIcon === 'string' && (resolvedIcon.startsWith('data:image/') || resolvedIcon.startsWith('http'))) {
                  const img = getCachedImage(resolvedIcon);
                  if (img) {
                    ctx.drawImage(img, -15, -15, 30, 30);
                  } else {
                    ctx.font = '22px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText('📦', 0, 0);
                  }
                } else {
                  ctx.font = '22px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'middle';
                  ctx.fillText(resolvedIcon || '💎', 0, 0);
                }

                // Gear Stats Hover
                ctx.shadowBlur = 4;
                ctx.font = 'bold 10px sans-serif';
                ctx.fillStyle = item.color || '#ecf0f1';
                ctx.fillText(item.name || 'Gear', 0, -28 - pulse * 2);

                ctx.fillStyle = '#ffffff';
                ctx.font = '9px sans-serif';
                let statStr = item.stats ? Object.entries(item.stats).map(([k, v]) => `+${Math.floor(v)} ${k.toUpperCase()}`).join('  ') : '';
                ctx.fillText(statStr, 0, -16 - pulse * 2);
              } else {
                // Pulsating Aura for Potions - oval base shadow for perspective
                ctx.beginPath();
                ctx.ellipse(0, 8, (10 + pulse * 6) * 1.3, (10 + pulse * 6) * 0.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = item.type === 'red' ? `rgba(231, 76, 60, ${0.3 + pulse * 0.3})` : `rgba(52, 152, 219, ${0.3 + pulse * 0.3})`;
                ctx.fill();

                // Core Orb
                ctx.fillStyle = item.type === 'red' ? '#e74c3c' : '#3498db';
                ctx.shadowColor = item.type === 'red' ? '#ff7979' : '#7ed6df';
                ctx.shadowBlur = 10 + pulse * 15;
                ctx.beginPath();
                ctx.arc(0, 0, 7 + pulse * 2, 0, Math.PI * 2);
                ctx.fill();

                // Icon
                ctx.fillStyle = 'white';
                ctx.shadowBlur = 0;
                ctx.font = 'bold 12px sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(item.type === 'red' ? '❤️' : '⚡', 0, -18 - pulse * 2);
              }

              // Bobbing green downward arrow indicator above the targeted item
              if (this.player && this.player.targetedItemId === item.id) {
                ctx.save();
                ctx.fillStyle = '#2ecc71';
                ctx.shadowColor = '#2ecc71';
                ctx.shadowBlur = 8;
                const arrowY = -36 + Math.sin(this.globalTime / 100) * 3;
                ctx.beginPath();
                ctx.moveTo(0, arrowY);
                ctx.lineTo(-5, arrowY - 8);
                ctx.lineTo(5, arrowY - 8);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
              }

              ctx.restore();
            }
          });
        }
      }

      if (this.groundFoliage) {
        for (let gf of this.groundFoliage) {
          renderables.push({
            y: gf.y, draw: (ctx) => {
              ctx.save();
              let filter = 'none';
              if (this.nightAlpha > 0) {
                filter = `grayscale(${this.nightAlpha * 95}%) brightness(${100 - this.nightAlpha * 25}%)`;
              } else if (this.dayAlpha > 0) {
                filter = `sepia(${this.dayAlpha * 60}%) brightness(${100 + this.dayAlpha * 25}%)`;
              }
              ctx.filter = filter;
              ctx.fillStyle = gf.color;
              ctx.beginPath();
              if (gf.type === 'grass') {
                const sway = Math.sin(this.globalTime * 2 + gf.phase) * 3;
                ctx.moveTo(gf.x + sway, gf.y - gf.size);
                ctx.lineTo(gf.x - gf.size / 3, gf.y);
                ctx.lineTo(gf.x + gf.size / 3, gf.y);
              } else if (gf.type === 'mud' || gf.type === 'cracks') {
                ctx.ellipse(gf.x, gf.y, gf.size, gf.size * 0.4, 0, 0, Math.PI * 2);
              } else { // stones, shells, ice
                ctx.arc(gf.x, gf.y, gf.size / 2, 0, Math.PI * 2);
              }
              ctx.fill();
              ctx.restore();
            }
          });
        }
      }

      // Sort so entities with higher Y (lower on screen) are drawn last (on top)
      renderables.sort((a, b) => a.y - b.y);
      renderables.forEach(r => r.draw(this.ctx));

      for (let p of this.projectiles) { p.update(dt, this); p.draw(this.ctx); }
      this.projectiles = this.projectiles.filter(p => p.life > 0);

      if (this.queuedFireball && this.player) {
        const qf = this.queuedFireball;
        const spawnX = qf.x || qf.spawnX;
        const spawnY = qf.y || qf.spawnY;
        let canSpawn = true;
        for (let p of this.projectiles) {
          if (p.type === 'fireball' && p.life > 0) {
            const existingRadius = p.radius || (qf.radius || 15);
            const dist = Math.hypot(p.x - spawnX, p.y - spawnY);
            if (dist < (qf.radius || 15) + existingRadius + 10) {
              canSpawn = false;
              break;
            }
          }
        }
        if (canSpawn) {
          const qfLife = qf.fbLife || 80;
          this.projectiles.push(new Projectile({ type: 'fireball', x: spawnX, y: spawnY, speed: qf.speed || 5, life: qfLife, maxLife: qfLife, color: qf.color || '#e67e22', damage: qf.damage || 1, critChance: 0.2, radius: qf.radius || 15, traveled: 0, trailTimer: 0, trailPositions: [], tx: qf.tx, ty: qf.ty, angle: qf.angle, facing: qf.facing }));
          this.spawnParticles(spawnX, spawnY, qf.color || '#e67e22', 15, 4);
          this.queuedFireball = null;
        }
      }

      // Effects
      for (let p of this.particles) {
        if (!p.isShockwave && !p.isHalo && !p.isRay && !p.isSparkle) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vy += 0.05 * dt;
        } else if (p.isHalo || p.isRay || p.isSparkle) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }
        p.life -= dt;
        const progress = Math.max(0, p.life / p.maxLife);
        this.ctx.globalAlpha = (p.isBlood ? (1 - progress) * 0.5 + 0.5 : progress);
        
        if (p.isShockwave) {
          const currentSize = p.size * (1 + (1 - progress) * 1.5);
          const grad = this.ctx.createRadialGradient(p.x, p.y, currentSize * 0.1, p.x, p.y, currentSize);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.3, p.color);
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (p.isHalo) {
          const currentSize = p.size * (1 + (1 - progress) * 1.85);
          this.ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
          this.ctx.shadowColor = '#ffd700';
          this.ctx.shadowBlur = 6; // Reduced from 15 for better mobile/low-end performance
          this.ctx.lineWidth = 3 * progress;
          this.ctx.beginPath();
          this.ctx.ellipse(p.x, p.y, currentSize, currentSize * 0.45, 0, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.shadowBlur = 0;
        } else if (p.isRay) {
          this.ctx.strokeStyle = p.color;
          this.ctx.lineWidth = p.size * progress;
          this.ctx.beginPath();
          this.ctx.moveTo(p.x, p.y);
          const len = p.length * progress;
          const vdist = Math.hypot(p.vx, p.vy) || 1;
          this.ctx.lineTo(p.x + (p.vx / vdist) * len, p.y + (p.vy / vdist) * len);
          this.ctx.stroke();
        } else if (p.isSparkle) {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
          this.ctx.fill();
          
          if (Math.random() < 0.20) {
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 0.8;
            this.ctx.beginPath();
            this.ctx.moveTo(p.x - p.size * 2, p.y); this.ctx.lineTo(p.x + p.size * 2, p.y);
            this.ctx.moveTo(p.x, p.y - p.size * 2); this.ctx.lineTo(p.x, p.y + p.size * 2);
            this.ctx.stroke();
          }
        } else {
          this.ctx.fillStyle = p.color;
          this.ctx.beginPath();
          this.ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
          this.ctx.fill();
        }
      }
      this.ctx.globalAlpha = 1;
      this.particles = this.particles.filter(p => p.life > 0);

      // Render atmospheric effects behind UI
      if (this.atmosEffects && this.atmosEffects.length > 0) {
        for (let ef of this.atmosEffects) {
          this.ctx.fillStyle = ef.color;
          this.ctx.beginPath();
          if (ef.type === 'rain') {
            this.ctx.fillRect(ef.x, ef.y, ef.size, ef.size * 6);
          } else if (ef.type === 'smoke') {
            this.ctx.arc(ef.x, ef.y, ef.size, 0, Math.PI * 2);
            this.ctx.fill();
          }
        }
      }

      for (let ft of this.floatingTexts) {
        ft.y -= 0.8 * dt; ft.life -= dt;
        const fadeStart = ft.maxLife * 0.4;
        this.ctx.globalAlpha = ft.life > fadeStart ? 1 : Math.max(0, ft.life / fadeStart);
        this.ctx.font = `bold ${ft.isCrit ? 18 : 14}px sans-serif`; this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#000'; this.ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
        this.ctx.fillStyle = ft.color; this.ctx.fillText(ft.text, ft.x, ft.y);
      }
      this.ctx.globalAlpha = 1;
      this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);

      // UI
      this.ui.updatePartyList(this.otherPlayers);
      if (this.player && this.player.alive && this.state === 'PLAYING') {
        this.ui.updateBuffs(this.player.buffHpTimer, this.player.buffManaTimer);
      } else {
        this.ui.updateBuffs(0, 0);
      }

      let cdSpeedMultiplier = 1;
      if (this.player && this.player.alive && this.state === 'PLAYING') {
        if (this.player.buffHpTimer > 0) {
          this.player.buffHpTimer -= 16.67 * dt;
          if (this.player.buffHpTimer <= 0) {
            this.ui.addLog('💔 Vampirism buff expired!', 'system');
          }
          if (Math.random() < 0.1) this.spawnParticles(this.player.x + (Math.random() - 0.5) * 30, this.player.y - Math.random() * 50, '#e74c3c', 1, 3);
        }
        if (this.player.buffManaTimer > 0) {
          this.player.buffManaTimer -= 16.67 * dt;
          if (this.player.buffManaTimer <= 0) {
            this.ui.addLog('⚡ Skill Cooldown buff expired!', 'system');
          }
          cdSpeedMultiplier = ConfigModule.POTION_BLUE_CD_MULTIPLIER; // Configurable cooldown recovery speed
          if (Math.random() < 0.1) this.spawnParticles(this.player.x + (Math.random() - 0.5) * 30, this.player.y - Math.random() * 50, '#3498db', 1, 3);
        }
      }

   if (this.s2Cooldown > 0) {
        this.s2Cooldown = Math.max(0, this.s2Cooldown - 16.67 * dt * cdSpeedMultiplier);
        if (this.s2Cooldown <= 0 && this.autoRestartS2 && this.player && !this.player.isMoving) {
          this.autoRestartS2 = false;
          this.startChargingSkill2();
        }
      }
      this.ui.updateCooldownRing(this.s2Cooldown, this.s2MaxCooldown);



      if (this.isHost) {
        this.enemies = this.enemies.filter(e => e.alive || (Date.now() - e.deathTime < 2000));

        const aliveCount = this.enemies.filter(e => e.alive).length;
        if (aliveCount === 0 && this.waveTransitionTimer <= 0 && this.waveEnemiesToSpawn === 0) {
          this.emptyWaveTimer = (this.emptyWaveTimer || 0) + dt * 16.67;
          if (this.emptyWaveTimer > 60000) {
            this.waveTransitionTimer = 120; // Force transition fallback
            this.emptyWaveTimer = 0;
          }
        } else {
          this.emptyWaveTimer = 0;
        }

        if (this.waveTransitionTimer > 0) {
          this.waveTransitionTimer -= dt;
          if (this.waveTransitionTimer <= 0) {
            if (this.player && !this.player.alive) this.respawnPlayer();
            this.wave++;
            this.prng = new PRNG(this.wave * 12345);
            this.generateScenery();

            if (this.state === 'MENU') {
              document.getElementById('main-area').style.display = 'none';
            }
            this.initBgParticles();
            if (this.wave % ConfigModule.BOSS_WAVE_INTERVAL === 0) {
              this.bossActive = true;
              let numBosses = 1;
              if (ConfigModule.BOSS_WAVE_INTERVAL > 0) {
                const bossWaveNum = Math.floor(this.wave / ConfigModule.BOSS_WAVE_INTERVAL);
                if (bossWaveNum > 1) {
                  numBosses = 1 + (bossWaveNum - 1) * ConfigModule.BOSS_SPAWN_INCREMENT;
                }
              }
              this.waveTotalEnemies = numBosses;
              this.waveEnemiesToSpawn = numBosses;
              this.ui.showBossWarning();
            } else {
              this.bossActive = false;
              let baseEnemies = 10 + Math.floor(this.wave * 2.5 + Math.pow(this.wave, 1.2));
              let pCount = activePlayers ? activePlayers.length : 1;
              this.waveTotalEnemies = Math.floor(baseEnemies * (0.5 + pCount * 0.5));
              this.waveEnemiesToSpawn = this.waveTotalEnemies;
            }
            this.waveEnemiesKilled = 0;
            this.ui.updateScore(this.player, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
          }
        }
      }

      if (this.isHost && this.waveTransitionTimer <= 0 && this.waveEnemiesToSpawn > 0) {
        this.enemySpawnTimer += 16.67 * dt;
        if (this.enemySpawnTimer >= this.enemySpawnInterval) {
          this.enemySpawnTimer = 0;
          const spawnIndex = this.waveTotalEnemies - this.waveEnemiesToSpawn;
          const newEnemy = new Enemy(this, this.bossActive, false, spawnIndex);
          if (!this.enemies.find(e => e.id === newEnemy.id)) {
            this.enemies.push(newEnemy);
          }
          this.waveEnemiesToSpawn--;
        }
      }

      this.syncTimer += 16.67 * dt;
      if (this.syncTimer >= 100) {
        this.syncTimer = 0;
        this.checkHost();
        this.broadcastState();
      }

      // Global Day/Night Lighting Overlays
      if (this.nightAlpha > 0) {
        const env = ENV_CONFIG[this.selectedEnv];
        const gY = this.gameH * (env ? env.groundY : 0.5);
        const nightGrad = this.ctx.createLinearGradient(0, 0, 0, this.gameH);
        // Moon illuminates the sky and background scenery
        nightGrad.addColorStop(0, `rgba(15, 20, 40, ${this.nightAlpha * 0.25})`);
        nightGrad.addColorStop(gY / this.gameH, `rgba(5, 10, 25, ${this.nightAlpha * 0.35})`);
        // Ground stays very dark
        nightGrad.addColorStop(gY / this.gameH + 0.01, `rgba(0, 0, 5, ${this.nightAlpha * 0.5})`);
        nightGrad.addColorStop(1, `rgba(0, 0, 0, ${this.nightAlpha * 0.65})`);

        this.ctx.fillStyle = nightGrad;
        this.ctx.fillRect(0, 0, this.gameW, this.gameH);
      }
      if (this.dayAlpha > 0) {
        this.ctx.fillStyle = `rgba(255, 230, 150, ${this.dayAlpha * 0.1})`;
        this.ctx.fillRect(0, 0, this.gameW, this.gameH);
      }

      // UI Target Info Update
      if (this.player && this.ui.updateTargetPanel) {
        let currentTarget = null;
        let isHover = false;
        const cx = this.player.mouseX, cy = this.player.mouseY;
        let hoveredEnemy = null;
        let hoveredItem = null;
        for (let e of this.enemies) {
          if (!e.alive) continue;
          if (Math.hypot(cx - e.x, cy - e.y) < e.size + 30) { hoveredEnemy = e; break; }
        }
        if (!hoveredEnemy && this.items) {
          for (let item of this.items) {
            if (Math.hypot(cx - item.x, cy - item.y) < 40) { hoveredItem = item; break; }
          }
        }
        
        if (hoveredEnemy) {
          currentTarget = hoveredEnemy;
          isHover = true;
        } else if (hoveredItem) {
          currentTarget = hoveredItem;
          isHover = true;
        } else if (this.player.autoAttackTarget && this.player.autoAttackTarget.alive) {
          currentTarget = this.player.autoAttackTarget;
        } else if (this.player.targetedItemId) {
          currentTarget = this.items.find(i => i.id === this.player.targetedItemId);
        }
        
        this.ui.updateTargetPanel(currentTarget, isHover);
      }

      this.ctx.restore();
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}
