import { GAME_W, GAME_H, getGroundY, ENV_CONFIG, ENV_LIST, darkenColor, GROUND_TOLERANCE, CLASS_DATA, PRNG } from './utils.js';
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
          this.otherPlayers[data.user] = new Player(data.user, false, data.data.classType || 'warrior', data.data.x || GAME_W/2, data.data.y || getGroundY('forest')-20);
        }
        this.otherPlayers[data.user].set(data.data);
        
        // Handle remote hits
        if (data.data.hits) {
           data.data.hits.forEach(hit => {
              let e = this.enemies.find(ex => ex.id === hit.id);
              if (e && e.alive) {
                 e.hp -= hit.damage;
                 e.hitFlash = 8;
                 this.floatingTexts.push({ x: e.x + (Math.random()-0.5)*20, y: e.y - 30, text: (hit.isCrit?'💥 ':'')+hit.damage, color: hit.isCrit ? '#ffd700' : '#fff', life: 40, maxLife: 40, isCrit: hit.isCrit });
                 if (e.hp <= 0) { 
                     e.alive = false; e.deathTime = Date.now(); e.hp = 0;
                     if (hit.source) {
                         this.net.send_cmd('set_data', { enemyKilled: hit.source });
                     }
                     if (this.isHost) {
                         this.waveEnemiesKilled++;
                         if (this.bossActive && e.name === 'BOSS') {
                             this.enemies.forEach(ex => { if(ex.alive) { ex.hp=0; ex.alive=false; } });
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
            this.state = 'GAME_OVER';
            document.getElementById('wait-msg').textContent = 'ALL PLAYERS DEAD! GAME OVER.';
            document.getElementById('death-overlay').classList.add('show');
        }
        
        if (data.data.enemyKilled && this.player && data.data.enemyKilled === this.net.me.info.user) {
            if (this.player.addKill()) {
                this.ui.addLog(`🌟 Level Up! Level ${this.player.level}`, 'reward');
                this.ui.updateHUD(this.player);
                this.spawnParticles(this.player.x, this.player.y - 20, '#ffd700', 40, 6);
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
    const sortedUsers = [...new Set(users)].sort();
    const isHost = sortedUsers[0] === this.net.me.info.user;
    if (this.isHost !== isHost) {
      this.isHost = isHost;
      this.ui.addLog(this.isHost ? '👑 You are the Host!' : '👥 You are a Client', 'reward');
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
    }

    this.wave = hostData.wave;
    this.kills = hostData.kills;
    if (!this.prng) this.prng = new PRNG(hostData.seed);
    else this.prng.seed = hostData.seed;
    
    this.waveTotalEnemies = hostData.waveTotal || 10;
    this.waveEnemiesKilled = hostData.waveKilled || 0;
    this.waveEnemiesToSpawn = hostData.waveSpawn || 10;
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
           e = new Enemy(this, eData.name === 'BOSS', true);
           e.id = eData.id;
           e.x = eData.x;
           e.y = eData.y;
           this.enemies.push(e);
       }
       e.serverX = eData.x;
       e.serverY = eData.y;
       e.hp = eData.hp;
       e.maxHp = eData.maxHp;
       e.alive = eData.alive;
       e.name = eData.name;
       e.size = eData.size;
       e.color = eData.color;
       e.icon = eData.icon;
    });
    // Remove enemies not in host
    this.enemies = this.enemies.filter(e => hostData.enemies.find(ex => ex.id === e.id) || !e.alive);
  }

  init() {
    this.resizeObserver = new ResizeObserver(() => this.updateLayout());
    this.resizeObserver.observe(document.getElementById('main-area'));
    
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
      if(this.state !== 'PLAYING') return;
      const pos = this.toGameCoords(e.clientX, e.clientY);
      if(this.player) {
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

    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.state !== 'PLAYING' || !this.player) return;
      const p = this.toGameCoords(e.clientX, e.clientY);
      this.doSkill2(p.x, p.y);
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
        this.doSkill2(pos.x, pos.y);
        touchActive = false;
      }, 400);
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

    this.canvas.addEventListener('touchend', () => { touchActive = false; clearTimeout(touchLongPressTimer); });
    this.canvas.addEventListener('touchcancel', () => { touchActive = false; clearTimeout(touchLongPressTimer); });
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
    
    if (this.state === 'MENU') this.drawMenuBackground();
  }

  toGameCoords(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const gameX = (canvasX - this.viewOX) / this.viewScale;
    const gameY = (canvasY - this.viewOY) / this.viewScale;
    return { x: gameX, y: gameY };
  }

  applyViewport() {
    this.ctx.translate(this.viewOX, this.viewOY);
    this.ctx.scale(this.viewScale, this.viewScale);
  }

  startGame(selectedClass) {
    this.state = 'PLAYING';
    this.selectedEnv = ENV_LIST[0];
    this.kills = 0;
    this.wave = 1;
    this.waveTotalEnemies = 10 + Math.floor(this.wave * 2.5 + Math.pow(this.wave, 1.2));
    this.waveEnemiesKilled = 0;
    this.waveEnemiesToSpawn = this.waveTotalEnemies;
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
    this.generateScenery();
    
    const groundY = getGroundY(this.selectedEnv);
    this.player = new Player(this.net.me.info.user, true, selectedClass, GAME_W / 2, groundY - 20);
    
    this.ui.updateScore(this.player, this.wave, this.waveEnemiesKilled, this.waveTotalEnemies);
    this.ui.updateEnvironment(this.selectedEnv);
    this.initBgParticles();
    
    document.getElementById('menu-panel').classList.add('hidden');
    this.canvas.style.display = 'block';
    document.getElementById('hud').classList.add('visible');
    document.getElementById('cd-ring').classList.add('visible');
    document.getElementById('compact-log').classList.add('visible');
    document.getElementById('game-btns').style.display = 'flex';
    
    this.ui.addLog('⚔️ Fight started! Tap ground to move, tap enemies to attack!', 'player');
    this.updateLayout();

    // Broadcast our spawn
    this.broadcastState();
  }

  quitToMenu() {
    this.state = 'MENU';
    document.getElementById('game-btns').style.display = 'none';
    document.getElementById('hud').classList.remove('visible');
    document.getElementById('cd-ring').classList.remove('visible');
    document.getElementById('compact-log').classList.remove('visible');
    document.getElementById('walk-indicator').classList.remove('visible');
    document.getElementById('menu-panel').classList.remove('hidden');
    this.canvas.style.display = 'none';
    document.getElementById('death-overlay').classList.remove('show');
    
    this.player = null;
    this.enemies = [];
    this.projectiles = [];
    this.particles = [];
    
    this.ui.addLog('🎮 Returned to character selection!', 'player');
    
    // Broadcast leaving the game
    if (this.net && this.net.me) {
      this.net.send_cmd('set_data', { inGame: false });
    }
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
    const groundY = getGroundY(this.selectedEnv);
    const onGround = cy >= groundY - GROUND_TOLERANCE;
    let clickedEnemy = null;
    
    for (let e of this.enemies) {
      if (!e.alive) continue;
      const dist = Math.hypot(cx - e.x, cy - e.y);
      if (dist < e.size + 15) {
        clickedEnemy = e; break;
      }
    }

    if (!onGround || clickedEnemy) {
      if(clickedEnemy) this.ui.addLog(`⚔️ Attacking ${clickedEnemy.name}!`, 'player');
      else this.ui.addLog('⚡ Attacking!', 'move');
      this.doSkill1(cx, cy);
      return;
    }

    this.player.stopWalking(this);
    this.player.moveTargetX = Math.max(30, Math.min(GAME_W - 30, cx));
    this.player.moveTargetY = Math.max(groundY - 50, Math.min(GAME_H - 10, cy));
    this.player.isMoving = true;
    this.player.action = 'walk';

    this.moveMarker = { x: cx, y: cy, life: 30, maxLife: 30 };
    this.ui.addLog(`🚶 Walking to (${Math.round(cx)}, ${Math.round(cy)})`, 'move');
    this.broadcastState();
  }

  doSkill1(tx, ty) {
    const cd = CLASS_DATA[this.player.classType];
    const weaponY = this.player.y - 40;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.player.x);
    this.player.animTimer = 15;
    this.player.action = 'attack';
    this.player.lastSkill = 1;
    this.player.facing = tx > this.player.x ? 1 : -1;
    
    let projProps = { tx, ty, angle: aimAngle, facing: this.player.facing, damage: this.player.atk, critChance: 0.1 };
    
    switch (this.player.classType) {
      case 'warrior':
        this.projectiles.push(new Projectile({ type:'slash', originX:this.player.x, originY:this.player.y - 50, life:15, maxLife:15, color:cd.s1Color, radius: 85, hitInner: 5, hitOuter: 150, knockback: 65, knockbackDir: aimAngle, isKnockback: true, damage: this.player.atk * 1.0, ...projProps }));
        this.spawnParticles(this.player.x + Math.cos(aimAngle)*40, this.player.y - 50 + Math.sin(aimAngle)*40, cd.s1Color, 5, 3);
        break;
      case 'mage':
        const cRot = Math.max(-1.4, Math.min(1.4, aimAngle * 0.4));
        const cX = this.player.x + 20 + 105 * Math.sin(cRot);
        const cY = this.player.y - 44 - 105 * Math.cos(cRot);
        this.projectiles.push(new Projectile({ type:'bolt', x:cX, y:cY, speed:8, life:60, maxLife:60, color:'#3498db', damage: this.player.atk * 0.9, ...projProps }));
        this.spawnParticles(cX, cY, '#3498db', 3, 2);
        break;
      case 'archer':
        const speed = 10;
        this.projectiles.push(new Projectile({ type:'arrow', x:this.player.x + 22 * this.player.facing, y:this.player.y - 42, speed, vx:Math.cos(aimAngle)*speed, vy:Math.sin(aimAngle)*speed, life:60, maxLife:60, color:'#f1c40f', damage: this.player.atk * 0.95, critChance: 0.15, ...projProps }));
        this.spawnParticles(this.player.x + Math.cos(aimAngle)*20, this.player.y-50, '#f1c40f', 3, 2);
        break;
      case 'magicgladiator':
        this.projectiles.push(new Projectile({ type:'slash', originX:this.player.x + Math.cos(aimAngle)*35, originY:this.player.y - 40 + Math.sin(aimAngle)*35, life:20, maxLife:20, color:'#e74c3c', radius: 80, hitInner: 5, hitOuter: 140, damage: this.player.atk * 1.1, critChance: 0.12, ...projProps }));
        this.spawnParticles(this.player.x + Math.cos(aimAngle)*35, this.player.y - 40 + Math.sin(aimAngle)*35, cd.s1Color, 8, 4);
        break;
    }
    this.ui.addLog(cd.s1Name+' → target!');
    this.broadcastState();
  }

  doSkill2(tx, ty) {
    if (this.s2Cooldown > 0) { this.ui.addLog('⏳ Skill 2 on cooldown!', 'enemy'); return; }
    this.s2Cooldown = this.s2MaxCooldown;
    
    const cd = CLASS_DATA[this.player.classType];
    const weaponY = this.player.y - 30;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.player.x);
    this.player.facing = tx > this.player.x ? 1 : -1;
    this.player.animTimer = 15;
    this.player.action = 'attack';
    this.player.lastSkill = 2;
    
    let projProps = { tx, ty, angle: aimAngle, facing: this.player.facing };
    
    switch (this.player.classType) {
      case 'warrior':
    this.projectiles.push(new Projectile({ type:'shockwave', originX:this.player.x, originY:weaponY, x:this.player.x, y:weaponY, speed:5.5, life:50, maxLife:50, color:'#ffd700', damage:this.player.atk*2.5, critChance:0.2, maxDistance:250, traveled:0, trailTimer:0, trailPositions:[], ...projProps }));
        this.spawnParticles(this.player.x + Math.cos(aimAngle)*10, weaponY + Math.sin(aimAngle)*10, '#ffd700', 12, 4);
        break;
      case 'mage':
        const sfX = this.player.x + 20 + Math.cos(aimAngle) * 105;
        const sfY = this.player.y - 44 + Math.sin(aimAngle) * 105;
        this.projectiles.push(new Projectile({ type:'fireball', x:sfX, y:sfY, speed:5, life:80, maxLife:80, color:'#e67e22', damage:this.player.atk*2.2, critChance:0.15, ...projProps }));
        this.spawnParticles(sfX, sfY, '#e67e22', 8, 4);
        break;
      case 'archer':
        const bowX = this.player.x + 22 * this.player.facing;
        for (let i = -1; i <= 1; i++) {
          const a = aimAngle + i*0.2;
          const speed = 11;
          this.projectiles.push(new Projectile({ type:'arrow', x:bowX, y:this.player.y - 42, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, speed, life:50, maxLife:50, color:'#e74c3c', damage:this.player.atk*1.3, critChance:0.15, angle:a }));
        }
        break;
      case 'magicgladiator':
        this.projectiles.push(new Projectile({ type:'aoe_explosion', x:this.player.x, y:this.player.y-40, radius:130, life:25, maxLife:25, color:'#ffd700', damage:this.player.atk*3.0, critChance:0.25, ...projProps }));
        this.spawnParticles(this.player.x, this.player.y, '#ffd700', 30, 8);
        break;
    }
    this.ui.addLog(cd.s2Name+' Used!');
    this.broadcastState();
  }

  executeSkill2(cd, projProps) {
    if (this.s2Cooldown > 0) return;
    
    // Calculate dynamic cooldown based on SPD. Starts at 5000ms.
    const baseSpd = CLASS_DATA[this.player.classType].spd;
    const diff = Math.max(0, this.player.spd - baseSpd);
    this.s2MaxCooldown = Math.max(1000, 5000 - diff * 200);
    this.s2Cooldown = this.s2MaxCooldown;
    
    // Dynamic ATK radius scale
    const atkScale = 1 + (this.player.atk - CLASS_DATA[this.player.classType].atk) * 0.05;
    
    this.player.action = 'attack';
    this.player.animTimer = 25;
    this.player.lastSkill = 2;
    switch(this.player.classType) {
      case 'warrior':
        this.projectiles.push(new Projectile({ type:'shockwave', x:this.player.x, y:this.player.y, vx:(this.player.facing)*12, vy:0, speed:12, life:40, maxLife:40, color:'#ffd700', damage:this.player.atk*2.5, critChance:0.1, radius:40*atkScale, ...projProps }));
        break;
      case 'mage':
        this.projectiles.push(new Projectile({ type:'aoe_explosion', x:this.player.mouseX, y:this.player.mouseY, radius:100*atkScale, life:20, maxLife:20, color:'#e67e22', damage:this.player.atk*2.2, critChance:0.2, ...projProps }));
        this.spawnParticles(this.player.mouseX, this.player.mouseY, '#e67e22', 20*atkScale, 5);
        break;
      case 'archer':
        const bowX = this.player.x + (this.player.facing)*20;
        const aimAngle = Math.atan2(this.player.mouseY - (this.player.y - 42), this.player.mouseX - bowX);
        const arrowCount = Math.min(7, 3 + Math.floor((this.player.atk - CLASS_DATA.archer.atk) / 8));
        for(let i=0; i<arrowCount; i++) {
          const a = aimAngle + (i - Math.floor(arrowCount/2)) * 0.2;
          const speed = 11;
          this.projectiles.push(new Projectile({ type:'arrow', x:bowX, y:this.player.y - 42, vx:Math.cos(a)*speed, vy:Math.sin(a)*speed, speed, life:50, maxLife:50, color:'#e74c3c', damage:this.player.atk*1.3, critChance:0.15, angle:a }));
        }
        break;
      case 'magicgladiator':
        this.projectiles.push(new Projectile({ type:'aoe_explosion', x:this.player.x, y:this.player.y-40, radius:130*atkScale, life:25, maxLife:25, color:'#ffd700', damage:this.player.atk*3.0, critChance:0.25, ...projProps }));
        this.spawnParticles(this.player.x, this.player.y, '#ffd700', 30*atkScale, 8);
        break;
    }
    this.ui.addLog(cd.s2Name+' Used!');
    this.broadcastState();
  }

  broadcastState() {
    if(this.state !== 'PLAYING' || !this.player) return;
    const data = {
      inGame: true,
      x: this.player.x,
      y: this.player.y,
      hp: this.player.hp,
      facing: this.player.facing,
      action: this.player.action,
      classType: this.player.classType,
      animTimer: this.player.animTimer,
      lastSkill: this.player.lastSkill || 1,
      mouseX: this.player.mouseX,
      mouseY: this.player.mouseY,
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
        enemies: this.enemies.filter(e => e.alive || (Date.now() - e.deathTime < 2000)).map(e => ({
            id: e.id, x: e.x, y: e.y, hp: e.hp, maxHp: e.maxHp, alive: e.alive, name: e.name, size: e.size, color: e.color, icon: e.icon
        }))
      };
    }
    this.net.send_cmd('set_data', data);
  }

  dealDamageToPlayer(damage) {
      if (!this.player || !this.player.alive) return;
      this.player.hp -= damage;
      this.player.hitFlash = 10;
      this.spawnParticles(this.player.x, this.player.y - 40, '#e74c3c', 10, 5);
      this.ui.updateHUD(this.player);
      this.ui.addLog(`💔 Took -${damage} damage!`, 'enemy');
      this.floatingTexts.push({
          x: this.player.x + (Math.random() - 0.5) * 20, y: this.player.y - 60,
          text: '-' + damage, color: '#e74c3c', life: 35, maxLife: 35
      });
      if (this.player.hp <= 0) {
          this.player.hp = 0;
          this.player.alive = false;
          // Move body behind horizon
          this.player.y = GAME_H * 0.45; 
          this.broadcastState();
          // Keep state PLAYING so the network host continues to run the simulation
          this.ui.showDeathScreen(this.kills, this.wave);
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
           this.floatingTexts.push({ x: e.x + (Math.random()-0.5)*20, y: e.y - 30, text: (isCrit?'💥 ':'')+damage, color: isCrit ? '#ffd700' : '#fff', life: 40, maxLife: 40, isCrit: isCrit });
           if (e.hp <= 0) {
               e.alive = false; e.deathTime = Date.now(); e.hp = 0;
               this.net.send_cmd('set_data', { enemyKilled: this.net.me.info.user });
               this.waveEnemiesKilled++;
               if (this.bossActive && e.name === 'BOSS') {
                   this.enemies.forEach(ex => { if(ex.alive) { ex.hp=0; ex.alive=false; } });
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

  spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random()*Math.PI*2;
      const spd = (0.5+Math.random())*speed;
      this.particles.push({
        x, y, vx: Math.cos(angle)*spd, vy: Math.sin(angle)*spd-1,
        life: 20+Math.floor(Math.random()*20), maxLife: 40, color,
        size: 1.5+Math.random()*3
      });
    }
  }

  initBgParticles() {
    this.bgParticles = [];
    const groundY = getGroundY(this.selectedEnv);
    for (let i = 0; i < 40; i++) {
      this.bgParticles.push({
        x: Math.random()*GAME_W, y: 10 + Math.random() * (groundY - 30),
        vx: (Math.random()-0.5)*0.5, vy: -Math.random()*0.8-0.2,
        size: Math.random()*2+1, alpha: Math.random()*0.5+0.2
      });
    }
  }

  generateScenery() {
    this.scenery = [];
    const env = ENV_CONFIG[this.selectedEnv] || ENV_CONFIG.forest;
    let localPrng = new PRNG(this.wave * 9999);
    for(let i=0; i<15; i++) {
       const w = 40 + localPrng.nextFloat() * 60;
       const h = 50 + localPrng.nextFloat() * 120;
       this.scenery.push({
          x: localPrng.nextFloat() * GAME_W, w, h,
          color: darkenColor(env.ground, 0.2 + localPrng.nextFloat()*0.3)
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
    
    const skyGrad = this.ctx.createLinearGradient(0,0,0,gY);
    skyGrad.addColorStop(0, env.skyTop);
    skyGrad.addColorStop(0.5, env.skyMid);
    skyGrad.addColorStop(1, env.skyBot);
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0,0,GAME_W,gY);

    const cycle = (this.globalTime % 300) / 300; 
    let nightAlpha = 0;
    if (cycle > 0.4 && cycle <= 0.5) nightAlpha = (cycle - 0.4) * 10;
    else if (cycle > 0.5 && cycle <= 0.9) nightAlpha = 1;
    else if (cycle > 0.9) nightAlpha = Math.max(0, 1 - (cycle - 0.9) * 10);

    const cx = GAME_W/2, cy = gY;
    const angle = cycle * Math.PI * 2;
    const sunX = cx - Math.cos(angle) * 350;
    const sunY = cy + Math.sin(angle) * 250;
    if (sunY < gY + 40) {
      this.ctx.fillStyle = '#f1c40f'; this.ctx.beginPath(); this.ctx.arc(sunX, sunY, 35, 0, Math.PI*2); this.ctx.fill();
      this.ctx.fillStyle = 'rgba(241, 196, 15, 0.3)'; this.ctx.beginPath(); this.ctx.arc(sunX, sunY, 50, 0, Math.PI*2); this.ctx.fill();
    }
    const moonAngle = angle + Math.PI;
    const moonX = cx - Math.cos(moonAngle) * 350;
    const moonY = cy + Math.sin(moonAngle) * 250;
    if (moonY < gY + 40) {
      this.ctx.fillStyle = '#ecf0f1'; this.ctx.beginPath(); this.ctx.arc(moonX, moonY, 28, 0, Math.PI*2); this.ctx.fill();
    }
    
    if (nightAlpha > 0) {
      this.ctx.fillStyle = `rgba(5, 5, 20, ${nightAlpha * 0.6})`;
      this.ctx.fillRect(0,0,GAME_W,gY);
    }
    
    if (!this.scenery) this.generateScenery();
    for (let s of this.scenery) {
       this.ctx.fillStyle = s.color;
       this.ctx.beginPath();
       this.ctx.moveTo(s.x, gY);
       this.ctx.lineTo(s.x + s.w/2, gY - s.h);
       this.ctx.lineTo(s.x + s.w, gY);
       this.ctx.fill();
    }

    this.ctx.fillStyle = env.ground;
    this.ctx.fillRect(0, gY, GAME_W, GAME_H - gY);
    if (nightAlpha > 0) {
      this.ctx.fillStyle = `rgba(0, 0, 10, ${nightAlpha * 0.4})`;
      this.ctx.fillRect(0, gY, GAME_W, GAME_H - gY);
    }
  }

  loop(time) {
    if (this.state === 'PLAYING') {
      const dt = this.lastTime ? Math.min((time - this.lastTime) / 16.67, 3) : 1;
      this.lastTime = time;
      this.globalTime += dt * 0.016;

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      
      this.ctx.save();
      this.applyViewport();

      // Background
      this.drawEnvironment();
      
      for (let p of this.bgParticles) {
        p.x += p.vx*dt;
        p.y += p.vy*dt;
        const groundY = getGroundY(this.selectedEnv);
        if (p.y > groundY - 5) {
          p.y = 10 + Math.random() * (groundY - 30);
          p.x = Math.random()*GAME_W;
        }
        if (p.x < -10) p.x = GAME_W+10;
        if (p.x > GAME_W+10) p.x = -10;
        this.ctx.fillStyle = `rgba(255,255,255,${p.alpha*0.3})`;
        this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size, 0, Math.PI*2); this.ctx.fill();
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
          this.net.send_cmd('set_data', { gameOver: true });
          document.getElementById('wait-msg').textContent = 'ALL PLAYERS DEAD! GAME OVER.';
          document.getElementById('death-overlay').classList.add('show');
      }

      for (let e of this.enemies) { 
          if (this.isHost) {
              e.update(dt, activePlayers); 
          } else {
              e.hitFlash = Math.max(0, e.hitFlash - dt);
              if (e.alive && e.serverX) {
                 e.x += (e.serverX - e.x) * 0.2 * dt;
                 e.y += (e.serverY - e.y) * 0.2 * dt;
              }
          }
      }
      
      if(this.player) {
         this.player.updateMovement(dt, this);
         if(this.player.action === 'attack' && this.player.animTimer <= 0) {
             this.player.action = 'idle';
             this.broadcastState();
         } else if (this.player.action === 'walk' && !this.player.isMoving) {
             this.player.action = 'idle';
             this.broadcastState();
         }
      }
      
      Object.values(this.otherPlayers).forEach(p => {
          p.updateMovement(dt, this);
      });

      // Z-Sorting (Y-Sorting) for perspective rendering
      let renderables = [];
      
      for (let e of this.enemies) {
          renderables.push({ y: e.y, draw: (ctx) => e.draw(ctx, getGroundY(this.selectedEnv)) });
      }
      
      if (this.player) {
          renderables.push({ y: this.player.y, draw: (ctx) => this.player.draw(ctx, dt, this) });
      }
      
      Object.values(this.otherPlayers).forEach(p => {
          if (p.inGame) {
              renderables.push({ y: p.y, draw: (ctx) => {
                  p.draw(ctx, dt, this);
                  if (p.projectiles) {
                      for (let projData of p.projectiles) {
                          new Projectile(projData).draw(ctx);
                      }
                  }
              }});
          }
      });
      
      // Sort so entities with higher Y (lower on screen) are drawn last (on top)
      renderables.sort((a, b) => a.y - b.y);
      renderables.forEach(r => r.draw(this.ctx));

      for (let p of this.projectiles) { p.update(dt, this); p.draw(this.ctx); }
      this.projectiles = this.projectiles.filter(p => p.life > 0);

      // Effects
      for (let p of this.particles) {
        p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 0.05*dt; p.life -= dt;
        const progress = Math.max(0, p.life/p.maxLife);
        this.ctx.globalAlpha = progress;
        this.ctx.fillStyle = p.color; this.ctx.beginPath(); this.ctx.arc(p.x, p.y, p.size*progress, 0, Math.PI*2); this.ctx.fill();
      }
      this.ctx.globalAlpha = 1;
      this.particles = this.particles.filter(p => p.life > 0);

      for (let ft of this.floatingTexts) {
        ft.y -= 0.8*dt; ft.life -= dt;
        this.ctx.globalAlpha = ft.life/ft.maxLife;
        this.ctx.font = `bold ${ft.isCrit?18:14}px sans-serif`; this.ctx.textAlign = 'center';
        this.ctx.fillStyle = '#000'; this.ctx.fillText(ft.text, ft.x+1, ft.y+1);
        this.ctx.fillStyle = ft.color; this.ctx.fillText(ft.text, ft.x, ft.y);
      }
      this.ctx.globalAlpha = 1;
      this.floatingTexts = this.floatingTexts.filter(ft => ft.life > 0);

      // UI
      this.ui.updatePartyList(this.otherPlayers);
      if (this.s2Cooldown > 0) { this.s2Cooldown = Math.max(0, this.s2Cooldown - 16.67 * dt); }
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
               this.selectedEnv = ENV_LIST[(this.wave - 1) % ENV_LIST.length];
               this.generateScenery();
               this.ui.updateEnvironment(this.selectedEnv);
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
        } else {
           this.enemySpawnTimer += 16.67 * dt;
           const nonBossCount = this.enemies.filter(e => e.alive && e.name !== 'BOSS').length;
           if (this.enemySpawnTimer >= this.enemySpawnInterval && nonBossCount < (4 + Math.floor(this.wave/2)) && this.waveEnemiesToSpawn > 0) {
             this.enemySpawnTimer = 0;
             this.enemies.push(new Enemy(this, this.bossActive));
             this.waveEnemiesToSpawn--;
           }
        }
      }
      
      this.syncTimer += 16.67 * dt;
      if (this.syncTimer >= 50) {
         this.syncTimer = 0;
         this.broadcastState();
      }

      this.ctx.restore();
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}
