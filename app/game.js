import { GAME_W, GAME_H, getGroundY, ENV_CONFIG, ENV_LIST, darkenColor, GROUND_TOLERANCE, CLASS_DATA, PRNG, DEAD_BODY_LIFETIME } from './utils.js';
import Player from './player.js';
import Enemy from './enemy.js';
import Projectile from './projectile.js';

export default class Game {
  constructor(app) {
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
    this.lastTime = 0;
    this.enemySpawnTimer = 0;
    this.enemySpawnInterval = 2000;

    this.viewScale = 1;
    this.viewOX = 0;
    this.viewOY = 0;
    this.globalTime = 0;
    this.moveMarker = null;

    this.isHost = false;
    this.syncTimer = 0;
    this.pendingHits = [];

    this.settings = { particles: 1.0, bgElements: 1.0, groundElements: 1.0, atmos: 1.0, autoGraphics: true, autoLimit: true };
    this.atmosEffects = [];

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
      if (this.net.me && data.user !== this.net.me.info.user) {
        if (!this.otherPlayers[data.user]) {
          // Default spawn for other players
          this.otherPlayers[data.user] = new Player(data.user, false, data.data.classType || 'warrior', data.data.x || GAME_W / 2, data.data.y || getGroundY('forest') - 20);
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
            this.spawnParticles(this.otherPlayers[data.user].x, this.otherPlayers[data.user].y - 20, '#ffd700', 60, 10);
            this.spawnParticles(this.otherPlayers[data.user].x, this.otherPlayers[data.user].y - 20, '#fff', 40, 15);
            this.spawnParticles(this.otherPlayers[data.user].x, this.otherPlayers[data.user].y - 20, '#f1c40f', 50, 5);
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
                this.spawnParticles(e.x, e.y - 20, e.color || '#fff', 30, 8);
                this.spawnParticles(e.x, e.y - 20, '#e74c3c', 15, 6);
                if (hit.source) {
                  this.net.send_cmd('set_data', { enemyKilled: hit.source });
                }
                if (this.isHost) {
                  this.waveEnemiesKilled++;
                  if (this.bossActive && e.name === 'BOSS') {
                    this.enemies.forEach(ex => { if (ex.alive) { ex.hp = 0; ex.alive = false; } });
                    this.waveTransitionTimer = 120;
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

        if (data.data.enemyKilled && this.player && data.data.enemyKilled === this.net.me.info.user) {
          if (this.player.addKill()) {
            this.s2Cooldown = 0; // Cooldowns reset
            this.ui.addLog(`🌟 Level Up! Level ${this.player.level}`, 'reward');
            this.ui.updateHUD(this.player);
            this.spawnParticles(this.player.x, this.player.y - 20, '#ffd700', 60, 10);
            this.spawnParticles(this.player.x, this.player.y - 20, '#fff', 40, 15);
            this.spawnParticles(this.player.x, this.player.y - 20, '#f1c40f', 50, 5);
            this.broadcastState();
          }
          if (this.state === 'PLAYING') {
            this.ui.updateScore(this.player, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
          }
        }

        // Handle Host Sync
        if (data.data.hostData && !this.isHost) {
          this.syncHostData(data.data.hostData);
        }
      }
    });
  }

  checkHost() {
    if (!this.net.room || !this.net.room.users) return;
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

    let currentHost = null;
    let currentHostInputTime = 0;

    for (const u of hostCandidates) {
      if (u === (this.net.me && this.net.me.info ? this.net.me.info.user : null)) {
        if (this.isHost) {
          currentHost = u;
          currentHostInputTime = this.player ? (this.player.lastInputTime || 0) : 0;
        }
      } else {
        const op = this.otherPlayers[u] || (this.net.room && this.net.room.users[u] && this.net.room.users[u].data);
        if (op && op.isHost) {
          currentHost = u;
          currentHostInputTime = this.otherPlayers[u] ? (this.otherPlayers[u].lastInputTime || 0) : 0;
        }
      }
    }

    let bestHost = null;
    const now = Date.now();

    if (currentHost && (now - currentHostInputTime <= 5000)) {
      bestHost = currentHost; // Keep current host if they gave input in last 5s
    } else {
      // Find player with most recent input
      bestHost = hostCandidates.sort((a, b) => {
        let aTime = (a === (this.net.me && this.net.me.info ? this.net.me.info.user : null) && this.player)
          ? (this.player.lastInputTime || 0) : (this.otherPlayers[a] ? this.otherPlayers[a].lastInputTime || 0 : 0);
        let bTime = (b === (this.net.me && this.net.me.info ? this.net.me.info.user : null) && this.player)
          ? (this.player.lastInputTime || 0) : (this.otherPlayers[b] ? this.otherPlayers[b].lastInputTime || 0 : 0);
        if (bTime === aTime) return a.localeCompare(b);
        return bTime - aTime;
      })[0];
    }

    const isHost = bestHost === (this.net.me && this.net.me.info ? this.net.me.info.user : null);

    if (this.isHost !== isHost) {
      this.isHost = isHost;
      this.ui.addLog(this.isHost ? '👑 You are the Host!' : '👥 You are a Client', 'reward');
      if (this.isHost) {
        this.net.send_cmd('set_data', { isHost: true });
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

    if (this.wave !== hostData.wave && hostData.wave) {
      if (this.player && !this.player.alive) {
        this.respawnPlayer();
      }
      this.wave = hostData.wave;
      if (!this.prng) this.prng = new PRNG(hostData.seed);
      else this.prng.seed = hostData.seed;
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
      if (eData.color !== undefined) e.color = eData.color;
      if (eData.icon !== undefined) e.icon = eData.icon;
      if (eData.deathTime && eData.deathTime > 0) e.deathTime = eData.deathTime;
    });
    // Remove enemies not in host, but keep dead ones until their death animation finishes
    this.enemies = this.enemies.filter(e => hostData.enemies.find(ex => ex.id === e.id) || (!e.alive && e.deathTime && Date.now() - e.deathTime < DEAD_BODY_LIFETIME));

    if (hostData.items) {
      this.items = hostData.items.map(item => ({ ...item }));
    }
  }

  init() {
    this.resizeObserver = new ResizeObserver(() => this.updateLayout());
    this.resizeObserver.observe(document.getElementById('main-area'));
    this.resizeObserver.observe(document.body);

    window.addEventListener('resize', () => this.updateLayout());
    window.addEventListener('orientationchange', () => this.updateLayout(), { passive: true });

    this.initBgParticles();
    this.updateLayout();
    this.drawMenuBackground();

    requestAnimationFrame((t) => this.loop(t));
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

    this.canvas.addEventListener('click', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      e.preventDefault();
      const p = this.toGameCoords(e.clientX, e.clientY);
      this.player.mouseX = p.x;
      this.player.mouseY = p.y;
      this.handleLeftClick(p.x, p.y);
    });

    this.canvas.addEventListener('mousedown', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      if (e.button === 2) {
        e.preventDefault();
        const p = this.toGameCoords(e.clientX, e.clientY);
        this.startChargingSkill2();
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      if (e.button === 2) {
        e.preventDefault();
        const p = this.toGameCoords(e.clientX, e.clientY);
        this.player.mouseX = p.x;
        this.player.mouseY = p.y;
        this.releaseSkill2();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (this.state === 'PLAYING') {
        e.preventDefault();
      }
    });

    let touchActive = false;
    let touchLongPressTimer = null;

    this.canvas.addEventListener('touchstart', (e) => {
      if (this.state !== 'PLAYING' || !this.player) return;
      e.preventDefault();
      const t = e.touches[0];
      const pos = this.toGameCoords(t.clientX, t.clientY);
      touchActive = true;
      this.player.mouseX = pos.x;
      this.player.mouseY = pos.y;

      clearTimeout(touchLongPressTimer);
      touchLongPressTimer = setTimeout(() => {
        if (!touchActive) return;
        this.startChargingSkill2();
      }, 400);

      // Only do S1/walk if we didn't just release S2. We will just trigger it anyway for now,
      // but maybe if we are charging we shouldn't. startChargingSkill2 handles stopping walk.
      this.handleLeftClick(pos.x, pos.y);
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
      if (this.player && this.player.isChargingS2) {
        this.releaseSkill2();
      }
    });
    this.canvas.addEventListener('touchcancel', () => {
      touchActive = false;
      clearTimeout(touchLongPressTimer);
      if (this.player && this.player.isChargingS2) {
        this.releaseSkill2();
      }
    });
  }

  updateLayout() {
    const parent = this.canvas.parentElement;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = cw * dpr;
    this.canvas.height = ch * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const sx = cw / GAME_W, sy = ch / GAME_H;
    this.viewScale = Math.max(sx, sy);
    const scaledW = GAME_W * this.viewScale;
    const scaledH = GAME_H * this.viewScale;
    this.viewOX = (cw - scaledW) / 2;
    this.viewOY = ch - scaledH;

    this.cachedCanvasRect = this.canvas.getBoundingClientRect();

    if (this.state === 'MENU') this.drawMenuBackground();
  }

  toGameCoords(clientX, clientY) {
    const rect = this.cachedCanvasRect || this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const gameX = (canvasX - this.viewOX) / this.viewScale;
    const gameY = (canvasY - this.viewOY) / this.viewScale;
    return { x: gameX, y: gameY };
  }

  applyViewport(dt = 0) {
    let shakeX = 0, shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake;
      shakeY = (Math.random() - 0.5) * this.screenShake;
      this.screenShake -= dt;
      if (this.screenShake < 0) this.screenShake = 0;
    }
    this.ctx.translate(this.viewOX + shakeX, this.viewOY + shakeY);
    this.ctx.scale(this.viewScale, this.viewScale);
  }

  startGame(selectedClass) {
    this.state = 'PLAYING';
    this.selectedEnv = ENV_LIST[0];
    this.kills = 0;
    this.wave = 1;
    this.waveTotalEnemies = 10;
    this.waveEnemiesKilled = 0;
    this.waveEnemiesToSpawn = 10;
    this.bossActive = false;
    this.waveTransitionTimer = 0;
    this.emptyWaveTimer = 0;
    this.enemySpawnInterval = 1500;
    this.enemySpawnTimer = 0;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    this.floatingTexts = [];
    this.s2Cooldown = 0;
    this.ui.recentLogs = [];
    this.prng = new PRNG(this.wave * 12345);

    // Attempt to inherit current room state if a host exists
    if (this.net && this.net.room && this.net.room.users) {
      for (const u in this.net.room.users) {
        const userData = this.net.room.users[u].data;
        if (userData && userData.isHost && userData.hostData) {
          this.wave = userData.hostData.wave || 1;
          this.waveTotalEnemies = userData.hostData.waveTotal || 10;
          this.waveEnemiesKilled = userData.hostData.waveKilled || 0;
          this.waveEnemiesToSpawn = userData.hostData.waveSpawn || 10;
          this.bossActive = userData.hostData.bossActive || false;
          this.selectedEnv = userData.hostData.env || ENV_LIST[0];
          this.prng = new PRNG(userData.hostData.seed || (this.wave * 12345));
          break;
        }
      }
    }

    this.generateScenery();

    let myData = null;
    if (this.net && this.net.room && this.net.me && this.net.me.info && this.net.room.users[this.net.me.info.user]) {
      myData = this.net.room.users[this.net.me.info.user].data;
    }
    const bonusStats = myData && myData.bonusStatPoints ? myData.bonusStatPoints : 0;
    const resets = myData && myData.resets ? myData.resets : 0;

    const groundY = getGroundY(this.selectedEnv);
    this.player = new Player(this.net.me.info.user, true, selectedClass, GAME_W / 2, groundY - 20);
    this.player.resets = resets;
    this.player.statPoints = (this.player.statPoints || 0) + bonusStats;

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

  upgradeStat(statType) {
    if (!this.player || !this.player.statPoints || this.player.statPoints <= 0) return;
    this.player.statPoints--;

    if (statType === 'atk') {
      this.player.atk += 1.0;
    } else if (statType === 'spd') {
      this.player.spd += 1.0;
    } else if (statType === 'hp') {
      this.player.maxHp += 1;
      this.player.hp += 1;
    }

    this.ui.updateHUD(this.player);
    this.broadcastState();
  }

  requestRebirth() {
    if (!this.player) return;
    const reqLevel = 4 + (this.player.resets || 0) * 5;
    if (this.player.level < reqLevel) return;

    const modal = document.getElementById('rebirth-modal');
    const text = document.getElementById('rebirth-modal-text');
    if (modal && text) {
      text.innerText = `Do you want to Rebirth? You will return to the menu and start over.\nYou will gain ${this.player.level * 2} unallocated bonus stats on your next play!`;
      modal.style.display = 'flex';
    }
  }

  performRebirth() {
    if (!this.player) return;
    const reqLevel = 4 + (this.player.resets || 0) * 5;
    if (this.player.level < reqLevel) return;

    const newResets = (this.player.resets || 0) + 1;

    let oldBonusStats = 0;
    if (this.net && this.net.room && this.net.me && this.net.me.info) {
      const myData = this.net.room.users[this.net.me.info.user]?.data;
      if (myData && myData.bonusStatPoints) oldBonusStats = myData.bonusStatPoints;
    }

    const extraPoints = this.player.level * 2;
    const newBonusStats = oldBonusStats + extraPoints;

    this.net.send_cmd('set_data', { resets: newResets, bonusStatPoints: newBonusStats });

    this.quitToMenu();
  }

  quitToMenu() {
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
      this.net.send_cmd('set_data', { inGame: false, state: 'MENU' });
    }
    this.checkHost();
    this.updateLayout();
  }

  respawnPlayer() {
    document.getElementById('death-overlay').classList.remove('show');
    const groundY = getGroundY(this.selectedEnv);
    if (this.player) {
      this.player.x = GAME_W / 2;
      this.player.y = groundY - 20;
      this.player.hp = this.player.maxHp;
      this.player.alive = true;
    } else {
      this.player = new Player(this.net.me.info.user, true, this.ui.selectedClass, GAME_W / 2, groundY - 20);
    }
    this.ui.updateHUD(this.player);
    this.ui.addLog('✨ Respawned!', 'reward');
    this.broadcastState();
  }

  handleLeftClick(cx, cy) {
    if (!this.player || !this.player.alive) return;
    this.player.lastInputTime = Date.now();
    const groundY = getGroundY(this.selectedEnv);
    const onGround = cy >= groundY - GROUND_TOLERANCE;
    let clickedEnemy = null;

    for (let e of this.enemies) {
      if (!e.alive) continue;

      // Melee classes cannot click or lock onto enemies in the upper half of the screen
      if ((this.player.classType === 'warrior' || this.player.classType === 'magicgladiator') && e.y < GAME_H / 2) {
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
      this.player.moveTargetX = Math.max(20, Math.min(GAME_W - 20, cx));
      this.player.moveTargetY = Math.max(groundY - 50, Math.min(GAME_H - 45, cy));
      this.player.action = 'walk';
      document.getElementById('walk-indicator').innerHTML = '🚶 Walking...';
      document.getElementById('walk-indicator').classList.add('visible');
    }

    this.moveMarker = { x: cx, y: cy, life: 30, maxLife: 30 };
    this.broadcastState();
  }

  doSkill1(tx, ty) {
    this.player.stopWalking(this);
    const cd = CLASS_DATA[this.player.classType];
    const reqLevel = 4 + (this.player.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.player.level - 1) / Math.max(1, reqLevel - 1));
    const weaponY = this.player.y - 40 * lvlScale;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.player.x);
    this.player.animTimer = 15;
    this.player.action = 'attack';
    this.player.lastSkill = 1;
    this.player.facing = tx > this.player.x ? 1 : -1;
    const s1Scale = 1 + (this.player.atk - cd.atk) * 0.02;

    let projProps = { tx, ty, angle: aimAngle, facing: this.player.facing, damage: this.player.atk, critChance: 0.1 };

    switch (this.player.classType) {
      case 'warrior':
        const wScale = 1 + (this.player.atk - cd.atk) * 0.005;
        this.projectiles.push(new Projectile({ type: 'slash', originX: this.player.x, originY: weaponY, life: 15, maxLife: 15, color: cd.s1Color, radius: 60 * wScale * lvlScale, hitInner: 0, hitOuter: 90 * wScale * lvlScale, knockback: 65, knockbackDir: aimAngle, isKnockback: true, damage: this.player.atk * 1.0, ...projProps }));
        this.spawnParticles(this.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, cd.s1Color, 5, 3);
        break;
      case 'mage':
        this.projectiles.push(new Projectile({ type: 'bolt', x: this.player.x, y: weaponY, tx: tx, ty: ty, speed: 8, life: 60, maxLife: 60, color: '#3498db', damage: this.player.atk * 0.9, radius: 6 * s1Scale * lvlScale, ...projProps }));
        this.spawnParticles(this.player.x, weaponY, '#3498db', 3, 2);
        break;
      case 'archer':
        const speed = 10;
        this.projectiles.push(new Projectile({ type: 'arrow', x: this.player.x, y: weaponY, vx: Math.cos(aimAngle) * speed, vy: Math.sin(aimAngle) * speed, speed, life: 50, maxLife: 50, color: '#e74c3c', damage: this.player.atk * 1.1, radius: 12 * s1Scale * lvlScale, ...projProps }));
        this.spawnParticles(this.player.x, weaponY, '#bdc3c7', 4, 3);
        break;
      case 'magicgladiator':
        const mgScale = 1 + (this.player.atk - cd.atk) * 0.005;
        this.projectiles.push(new Projectile({ type: 'slash', originX: this.player.x, originY: weaponY, life: 20, maxLife: 20, color: '#e74c3c', radius: 60 * mgScale * lvlScale, hitInner: 0, hitOuter: 80 * mgScale * lvlScale, damage: this.player.atk * 1.1, critChance: 0.12, ...projProps }));
        this.spawnParticles(this.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, '#e74c3c', 7, 4);
        break;
    }
    this.broadcastState();
  }

  startChargingSkill2() {
    if (this.s2Cooldown > 0 || !this.player) return;
    this.player.lastInputTime = Date.now();
    this.player.autoAttackTarget = null;
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
    this.player.lastInputTime = Date.now();
    this.player.isChargingS2 = false;

    // Calculate dynamic cooldown based on SPD. Starts at 5000ms.
    const baseSpd = CLASS_DATA[this.player.classType].spd;
    const diff = Math.max(0, this.player.spd - baseSpd);
    this.s2MaxCooldown = Math.max(1000, 5000 - diff * 200);
    this.s2Cooldown = this.s2MaxCooldown;

    // SPD controls AOE
    const aoeScale = 1 + (this.player.spd - CLASS_DATA[this.player.classType].spd) * 0.02;
    const reqLevel = 4 + (this.player.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.player.level - 1) / Math.max(1, reqLevel - 1));

    // Charges scale logic:
    // charge = 0 -> 1x
    // charge = 1 -> 1.25x dmg, larger area
    // charge = 2 -> 1.50x dmg
    // charge = 3 -> 1.75x dmg
    const charges = this.player.s2ChargeCount || 0;
    const dmgMulti = 1 + (charges * 0.25);
    const areaMulti = 1 + (charges * 0.15);

    const tx = this.player.mouseX, ty = this.player.mouseY;
    const cd = CLASS_DATA[this.player.classType];
    const weaponY = this.player.y - 30 * lvlScale;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.player.x);
    this.player.facing = tx > this.player.x ? 1 : -1;
    this.player.animTimer = 25; // finalize attack animation
    this.player.action = 'attack';
    this.player.lastSkill = 2;

    let projProps = { tx, ty, angle: aimAngle, facing: this.player.facing };

    switch (this.player.classType) {
      case 'warrior':
        const waveCount = 1 + charges;
        const spdDiff = Math.max(0, this.player.spd - CLASS_DATA.warrior.spd);
        const waveDistance = (120 + spdDiff * 6) * areaMulti;
        const waveSpread = 0.12 + (aoeScale - 1) * 0.08;

        for (let i = 0; i < waveCount; i++) {
          const a = aimAngle + (i - (waveCount - 1) / 2) * waveSpread;
          this.projectiles.push(new Projectile({ type: 'shockwave', originX: this.player.x, originY: weaponY, x: this.player.x, y: weaponY, speed: 5.5, life: 50, maxLife: 50, color: '#ffd700', damage: this.player.atk * 2.5 * dmgMulti, critChance: 0.2, maxDistance: waveDistance, radius: 15 * aoeScale * areaMulti * lvlScale, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps, angle: a, charges: charges }));
        }
        this.spawnParticles(this.player.x + Math.cos(aimAngle) * 10, weaponY + Math.sin(aimAngle) * 10, '#ffd700', 12 + charges * 5, 4);
        break;
      case 'mage':
        const fbRadius = 15 + charges * 15;
        this.projectiles.push(new Projectile({ type: 'fireball', x: this.player.x, y: weaponY, speed: 5, life: 80, maxLife: 80, color: '#e67e22', damage: this.player.atk * 2.2 * dmgMulti, critChance: 0.2, radius: fbRadius * aoeScale * lvlScale, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps }));
        this.spawnParticles(this.player.x, weaponY, '#e67e22', 20 * aoeScale + charges * 10, 5);
        break;
      case 'archer':
        const arrowCount = Math.min(7, 3 + Math.floor((this.player.spd - CLASS_DATA.archer.spd) / 8)) + charges;
        for (let i = 0; i < arrowCount; i++) {
          const a = aimAngle + (i - Math.floor(arrowCount / 2)) * (0.2 + (aoeScale - 1) * 0.1);
          const speed = 11;
          this.projectiles.push(new Projectile({ type: 'arrow', x: this.player.x, y: weaponY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed, life: 50, maxLife: 50, color: '#e74c3c', damage: this.player.atk * 1.3 * dmgMulti, critChance: 0.15, angle: a, radius: 12 * aoeScale * lvlScale }));
        }
        this.spawnParticles(this.player.x, weaponY, '#e74c3c', 10 + charges * 5, 4);
        break;
      case 'magicgladiator':
        this.projectiles.push(new Projectile({ type: 'aoe_explosion', x: this.player.x, y: weaponY, radius: 130 * aoeScale * areaMulti * lvlScale, life: 25, maxLife: 25, color: '#ffd700', damage: this.player.atk * 3.0 * dmgMulti, critChance: 0.25, ...projProps }));
        this.spawnParticles(this.player.x, weaponY, '#ffd700', 30 * aoeScale + charges * 15, 8);
        this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.atk * 0.5 * dmgMulti);
        break;
    }
    this.broadcastState();
  }

  broadcastState() {
    if (!this.player) return;
    const data = {
      inGame: true,
      nick: this.player.nick,
      state: this.state,
      alive: this.player.alive,
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
      maxHp: this.player.maxHp,
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
      buffManaTimer: this.player.buffManaTimer,
      projectiles: this.projectiles.map(p => ({
        type: p.type, x: p.x, y: p.y, angle: p.angle, life: p.life, maxLife: p.maxLife,
        radius: p.radius, color: p.color, originX: p.originX, originY: p.originY, trailPositions: p.trailPositions
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
          id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, alive: e.alive, name: e.name, size: e.size, color: e.color, icon: e.icon, deathTime: e.deathTime
        })),
        items: this.items
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
    this.spawnParticles(this.player.x, this.player.y - 40, '#e74c3c', 20, 12);
    this.spawnParticles(this.player.x, this.player.y - 40, '#c0392b', 15, 16);
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
      this.player.y = GAME_H * 0.45;
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

    if (this.isHost) {
      let e = this.enemies.find(ex => ex.id === enemy.id);
      if (e && e.alive) {
        e.hp -= damage;
        e.hitFlash = 8;
        this.floatingTexts.push({ x: e.x + (Math.random() - 0.5) * 20, y: e.y - 30, text: (isCrit ? '💥 ' : '') + damage, color: isCrit ? '#ffd700' : '#fff', life: 40, maxLife: 40, isCrit: isCrit });
        if (e.hp <= 0) {
          e.alive = false; e.deathTime = Date.now(); e.hp = 0;
          this.spawnParticles(e.x, e.y - 20, e.color || '#fff', 30, 8);
          this.spawnParticles(e.x, e.y - 20, '#e74c3c', 15, 6);
          this.net.send_cmd('set_data', { enemyKilled: this.net.me.info.user });
          this.waveEnemiesKilled++;
          if (this.bossActive && e.name === 'BOSS') {
            this.enemies.forEach(ex => { if (ex.alive) { ex.hp = 0; ex.alive = false; } });
            this.waveTransitionTimer = 120;
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
    enemy.x = Math.max(enemy.size, Math.min(GAME_W - enemy.size, enemy.x));
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

  initBgParticles() {
    this.bgParticles = [];
    const groundY = getGroundY(this.selectedEnv);
    for (let i = 0; i < 40; i++) {
      this.bgParticles.push({
        x: Math.random() * GAME_W, y: 10 + Math.random() * (groundY - 30),
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
    const currentDay = Math.floor(this.globalTime / 300);
    let localPrng = new PRNG((currentDay + 1) * 9999);

    const sceneryCount = Math.floor(15 * (this.settings ? this.settings.bgElements : 1.0));
    for (let i = 0; i < sceneryCount; i++) {
      const w = 40 + localPrng.nextFloat() * 60;
      const h = 50 + localPrng.nextFloat() * 120;
      this.scenery.push({
        x: localPrng.nextFloat() * GAME_W, w, h,
        color: darkenColor(env.ground, 0.2 + localPrng.nextFloat() * 0.3)
      });
    }

    const horizonCount = Math.floor(25 * (this.settings ? this.settings.bgElements : 1.0));
    for (let i = 0; i < horizonCount; i++) {
      this.horizonFoliage.push({
        x: localPrng.nextFloat() * GAME_W,
        h: 20 + localPrng.nextFloat() * 50,
        w: 15 + localPrng.nextFloat() * 30,
        phase: localPrng.nextFloat() * Math.PI * 2,
        speed: 0.5 + localPrng.nextFloat() * 1.5,
        color: env.horizonColor || darkenColor(env.ground, 0.4),
        type: env.horizonType || 'trees'
      });
    }

    const groundY = GAME_H * env.groundY;
    const groundCount = Math.floor(60 * (this.settings ? this.settings.groundElements : 1.0));
    for (let i = 0; i < groundCount; i++) {
      this.groundFoliage.push({
        x: localPrng.nextFloat() * GAME_W,
        y: groundY + 5 + localPrng.nextFloat() * (GAME_H - groundY - 10),
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

    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, GAME_H);
    skyGrad.addColorStop(0, env.skyTop);
    skyGrad.addColorStop(0.5, env.skyMid);
    skyGrad.addColorStop(1, env.skyBot);
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, GAME_W, GAME_H);

    const gY = GAME_H * env.groundY;
    this.ctx.fillStyle = env.ground;
    this.ctx.fillRect(0, gY, GAME_W, GAME_H - gY);

    this.ctx.fillStyle = 'rgba(255,215,0,0.2)';
    this.ctx.font = 'bold 24px sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('🎮 SELECT CLASS & PRESS START', GAME_W / 2, GAME_H / 2);

    this.ctx.restore();
  }

  drawEnvironment() {
    const env = ENV_CONFIG[this.selectedEnv];
    const gY = GAME_H * env.groundY;

    const skyGrad = this.ctx.createLinearGradient(0, 0, 0, gY);
    skyGrad.addColorStop(0, env.skyTop);
    skyGrad.addColorStop(0.5, env.skyMid);
    skyGrad.addColorStop(1, env.skyBot);
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, GAME_W, gY);

    const nightAlpha = this.nightAlpha || 0;
    const dayAlpha = this.dayAlpha || 0;
    const cycle = (this.globalTime % 300) / 300;

    const cx = GAME_W / 2, cy = gY;
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
      this.ctx.fillStyle = `rgba(5, 5, 20, ${nightAlpha * 0.4})`;
      this.ctx.fillRect(0, 0, GAME_W, gY);
    }

    this.ctx.save();
    let filter = 'none';
    if (nightAlpha > 0) {
      filter = `grayscale(${nightAlpha * 95}%) brightness(${100 - nightAlpha * 25}%)`;
    } else if (dayAlpha > 0) {
      filter = `sepia(${dayAlpha * 60}%) brightness(${100 + dayAlpha * 25}%)`;
    }
    this.ctx.filter = filter;

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
    this.ctx.fillRect(0, gY, GAME_W, GAME_H - gY);
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
            this.generateScenery();
          }
        }
      }

      const cycle = (this.globalTime % 300) / 300;
      this.nightAlpha = 0;
      if (cycle > 0.45 && cycle <= 0.55) this.nightAlpha = (cycle - 0.45) * 10;
      else if (cycle > 0.55 && cycle <= 0.95) this.nightAlpha = 1;
      else if (cycle > 0.95) this.nightAlpha = Math.max(0, 1 - (cycle - 0.95) * 20);

      this.dayAlpha = 0;
      if (cycle > 0.0 && cycle < 0.5) {
        this.dayAlpha = Math.max(0, Math.sin(cycle * 2 * Math.PI));
      }

      if (this.isHost) {
        const currentDay = Math.floor(this.globalTime / 300);
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
              x: Math.random() * GAME_W,
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
          this.atmosEffects.push({
            type: 'cloud',
            x: Math.random() < 0.5 ? -150 : GAME_W + 150,
            y: Math.random() * (GAME_H * 0.5),
            vx: (Math.random() < 0.5 ? 1 : -1) * (0.1 + Math.random() * 0.3),
            vy: 0,
            color: isNight ? `rgba(255,255,255,${0.03 + Math.random() * 0.05})` : `rgba(0,0,0,${0.03 + Math.random() * 0.05})`,
            size: 60 + Math.random() * 80,
            life: 1.0
          });
        }

        if (Math.random() < 0.02 * this.settings.atmos * dt) {
          const groundY = getGroundY(this.selectedEnv);
          this.atmosEffects.push({
            type: 'smoke',
            x: Math.random() * GAME_W,
            y: groundY + (Math.random() * (GAME_H - groundY)),
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
        if (ef.type === 'rain' && ef.y > GAME_H) dead = true;
        if (ef.type === 'cloud' && (ef.x < -200 || ef.x > GAME_W + 200)) dead = true;
        if (ef.type === 'smoke') {
          ef.life -= 0.005 * dt;
          ef.size += 0.2 * dt;
          if (ef.life <= 0) dead = true;
        }
        if (dead) this.atmosEffects.splice(i, 1);
      }

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

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
          p.x = Math.random() * GAME_W;
        }
        if (p.x < -10) p.x = GAME_W + 10;
        if (p.x > GAME_W + 10) p.x = -10;
        this.ctx.fillStyle = `rgba(255,255,255,${p.alpha * 0.3})`;
        this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); this.ctx.fill();
      }

      if (this.moveMarker && this.moveMarker.life > 0) {
        const progress = this.moveMarker.life / this.moveMarker.maxLife;
        this.ctx.globalAlpha = progress * 0.6;
        this.ctx.strokeStyle = '#95a5a6'; this.ctx.lineWidth = 2; this.ctx.setLineDash([4, 4]);
        this.ctx.beginPath(); this.ctx.arc(this.moveMarker.x, this.moveMarker.y, 12 * progress, 0, Math.PI * 2); this.ctx.stroke();
        this.ctx.setLineDash([]);
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
          const dropChance = Math.max(0.04, 0.35 - (this.wave * 0.025));
          if (Math.random() < dropChance) {
            const type = Math.random() < 0.55 ? 'red' : 'blue';
            const lifeTime = 15000 + this.wave * 2000;
            this.items.push({ id: Math.random().toString(36).substr(2, 9), type: type, x: e.x, y: e.y, life: lifeTime, vy: 0, falling: true });
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
          const chargeSpeed = (this.player.buffManaTimer && this.player.buffManaTimer > 0) ? 5 : 1;
          this.player.s2ChargeTime = (this.player.s2ChargeTime || 0) + dt * 16.67 * chargeSpeed;
          const maxCharges = 3 + (this.player.resets || 0);
          const newCount = Math.min(maxCharges, Math.floor(this.player.s2ChargeTime / 1000));
          if (newCount > (this.player.s2ChargeCount || 0)) {
            this.player.s2ChargeCount = newCount;
            this.spawnParticles(this.player.x, this.player.y - 40, '#ffd700', 15, 4);
            this.broadcastState();
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
            ctx.globalAlpha = 0.5 + Math.sin(Date.now() / 150) * 0.2;
            ctx.fillStyle = '#2ecc71';
            ctx.beginPath();
            ctx.ellipse(this.player.moveTargetX, this.player.moveTargetY, 15, 7.5, 0, 0, Math.PI * 2);
            ctx.fill();
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
        for (let i = 0; i < this.items.length; i++) {
          let item = this.items[i];
          item.life -= dt * 16.67;
          if (item.life <= 0) {
            this.items.splice(i, 1); i--; continue;
          }

          // Fall to ground if still falling
          if (item.falling) {
            item.vy += 0.3 * dt;
            item.y += item.vy * dt;
            const groundY = getGroundY(this.selectedEnv);
            if (item.y >= groundY - 5) {
              item.y = groundY - 5;
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
                  pickedUp = true;
                  if (this.isHost) {
                    if (item.type === 'red') {
                      const healAmount = Math.floor(p.obj.maxHp * 0.25);
                      p.obj.hp = Math.min(p.obj.maxHp, p.obj.hp + healAmount);
                      this.spawnParticles(p.obj.x, p.obj.y - 20, '#e74c3c', 30, 6);
                      this.floatingTexts.push({ x: p.obj.x, y: p.obj.y - 50, text: '+' + healAmount, color: '#2ecc71', life: 60, maxLife: 60, isCrit: false });
                    }
                    p.obj.buffManaTimer = item.type === 'blue' ? 10000 : (p.obj.buffManaTimer || 0);
                    this.spawnParticles(p.obj.x, p.obj.y - 20, item.type === 'red' ? '#e74c3c' : '#3498db', 20, 5);
                    this.ui.addLog(item.type === 'red' ? '❤️ Healed 25% HP!' : '⚡ Skill Cooldown Buff!', 'reward');
                  } else {
                    this.net.send_cmd('set_data', { giveBuff: { type: item.type, target: p.id, id: Math.random() } });
                  }
                  break;
                }
             }
            if (pickedUp) {
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
                     const healAmount = Math.floor(this.player.maxHp * 0.25);
                     this.player.hp = Math.min(this.player.maxHp, this.player.hp + healAmount);
                     this.spawnParticles(this.player.x, this.player.y - 20, '#e74c3c', 30, 6);
                     this.floatingTexts.push({ x: this.player.x, y: this.player.y - 50, text: '+' + healAmount, color: '#2ecc71', life: 60, maxLife: 60, isCrit: false });
                     this.ui.addLog('❤️ Healed 25% HP!', 'reward');
                   } else {
                     this.player.buffManaTimer = 10000;
                     this.ui.addLog('⚡ Skill Cooldown Buff!', 'reward');
                   }
                   this.spawnParticles(this.player.x, this.player.y - 20, buff.type === 'red' ? '#e74c3c' : '#3498db', 20, 5);
                 }
              }
            }
          }

          renderables.push({
            y: item.y, draw: (ctx) => {
              ctx.save();
              const floatOffset = Math.sin(this.globalTime / 200) * 5;
              const pulse = Math.abs(Math.sin(this.globalTime / 150));
              ctx.translate(item.x, item.y - 10 + floatOffset);
              ctx.globalAlpha = Math.min(1, item.life / 1000);

              // Pulsating Aura
              ctx.beginPath();
              ctx.arc(0, 0, 10 + pulse * 6, 0, Math.PI * 2);
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

      // Effects
      for (let p of this.particles) {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 0.05 * dt; p.life -= dt;
        const progress = Math.max(0, p.life / p.maxLife);
        this.ctx.globalAlpha = progress;
        this.ctx.fillStyle = p.color; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2); this.ctx.fill();
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
          } else if (ef.type === 'cloud' || ef.type === 'smoke') {
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
         this.ui.updateBuffs(0, this.player.buffManaTimer);
       } else {
         this.ui.updateBuffs(0, 0);
       }

      let cdSpeedMultiplier = 1;
      if (this.player && this.player.alive && this.state === 'PLAYING') {
        if (this.player.buffManaTimer > 0) {
          this.player.buffManaTimer -= 16.67 * dt;
          cdSpeedMultiplier = 5; // 5x cooldown recovery speed
          if (Math.random() < 0.1) this.spawnParticles(this.player.x + (Math.random() - 0.5) * 30, this.player.y - Math.random() * 50, '#3498db', 1, 3);
        }
      }

      if (this.s2Cooldown > 0) { this.s2Cooldown = Math.max(0, this.s2Cooldown - 16.67 * dt * cdSpeedMultiplier); }
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
            if (this.wave % 5 === 0) {
              this.bossActive = true;
              this.waveTotalEnemies = 1;
              this.waveEnemiesToSpawn = 1;
              this.ui.showBossWarning();
            } else {
              this.bossActive = false;
              let baseEnemies = 10 + Math.floor(this.wave * 2.5 + Math.pow(this.wave, 1.2));
              let pCount = activePlayers ? activePlayers.length : 1;
              this.waveTotalEnemies = Math.floor(baseEnemies * (0.5 + pCount * 0.5));
              this.waveEnemiesToSpawn = this.waveTotalEnemies;
            }
            this.waveEnemiesKilled = 0;
            this.ui.updateScore(this.kills, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
          }
        }
      }

      if (this.isHost && this.waveTransitionTimer <= 0 && this.waveEnemiesToSpawn > 0) {
        this.enemySpawnTimer += 16.67 * dt;
        const nonBossCount = this.enemies.filter(e => e.alive && e.name !== 'BOSS').length;
        if (this.enemySpawnTimer >= this.enemySpawnInterval && nonBossCount < (4 + Math.floor(this.wave / 2))) {
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
        this.broadcastState();
      }

      // Global Day/Night Lighting Overlays
      if (this.nightAlpha > 0) {
        const env = ENV_CONFIG[this.selectedEnv];
        const gY = GAME_H * (env ? env.groundY : 0.5);
        const nightGrad = this.ctx.createLinearGradient(0, 0, 0, GAME_H);
        // Moon illuminates the sky and background scenery
        nightGrad.addColorStop(0, `rgba(15, 20, 40, ${this.nightAlpha * 0.25})`);
        nightGrad.addColorStop(gY / GAME_H, `rgba(5, 10, 25, ${this.nightAlpha * 0.35})`);
        // Ground stays very dark
        nightGrad.addColorStop(gY / GAME_H + 0.01, `rgba(0, 0, 5, ${this.nightAlpha * 0.5})`);
        nightGrad.addColorStop(1, `rgba(0, 0, 0, ${this.nightAlpha * 0.65})`);

        this.ctx.fillStyle = nightGrad;
        this.ctx.fillRect(0, 0, GAME_W, GAME_H);
      }
      if (this.dayAlpha > 0) {
        this.ctx.fillStyle = `rgba(255, 230, 150, ${this.dayAlpha * 0.1})`;
        this.ctx.fillRect(0, 0, GAME_W, GAME_H);
      }

      this.ctx.restore();
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}