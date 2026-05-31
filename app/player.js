import { getGroundY, getArmAnim, CLASS_DATA, PLAYER_MOVE_SPEEDS, LEVEL_UP_STAT_POINTS, REQ_KILLS_BASE_MULT, REQ_KILLS_EXPONENT, REQ_KILLS_SIN_AMP, REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, RANGED_MAX_RANGE, WARRIOR_MELEE_RANGE, MAGICGLADIATOR_MELEE_RANGE, MELEE_RANGE_LVL_SCALE_MULT, PLAYER_INITIAL_LEVEL, PLAYER_INITIAL_KILLS, PLAYER_INITIAL_STAT_POINTS, PLAYER_INITIAL_RESETS, CHAT_MESSAGE_DURATION, CHAT_FADE_OUT_DURATION, LIMIT_LEVEL_TO_REBIRTH_REQ, getCachedImage, getCachedFlippedImage } from './utils.js';
import * as ConfigModule from './config.js';

export default class Player {
  constructor(id, isLocal, classType, x, y) {
    this.id = id;
    this.isLocal = isLocal;
    this.classType = classType;
    const cd = CLASS_DATA[classType] || CLASS_DATA.warrior;

    this.x = x;
    this.y = y;
    this.hp = cd.hp;
    this.maxHp = cd.hp;
    this.atk = cd.atk;
    this.spd = cd.spd;
    this.color = cd.color;
    this.accent = cd.accent;

    this.level = PLAYER_INITIAL_LEVEL;
    this.kills = PLAYER_INITIAL_KILLS;
    this.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(PLAYER_INITIAL_LEVEL, REQ_KILLS_EXPONENT) + Math.sin(PLAYER_INITIAL_LEVEL) * REQ_KILLS_SIN_AMP);
    this.resets = PLAYER_INITIAL_RESETS;
    this.bonusStatPoints = PLAYER_INITIAL_STAT_POINTS;
    this.levelUpStatPoints = 0;
    this.sessionStatPoints = PLAYER_INITIAL_STAT_POINTS;

    this.animTimer = 0;
    this.hitFlash = 0;
    this.alive = true;
    this.facing = 1;
    this.isMoving = false;
    this.moveTargetX = 0;
    this.moveTargetY = 0;

    this.moveSpeed = PLAYER_MOVE_SPEEDS[this.classType] || PLAYER_MOVE_SPEEDS.default;
    this.action = 'idle';
    this.mouseX = x;
    this.mouseY = y;
    this.inGame = isLocal;
    this.state = isLocal ? 'PLAYING' : 'MENU';

    // Multiplayer sync fields
    this.input_data = null;
    this.targetedItemId = null;

    // Inventory & Gear
    this.inventory = []; // Unlimited grid items
    this.equipment = {}; // Key-value for equipped gear (key = slot name)
    if (isLocal) {
      try {
        const savedInv = localStorage.getItem('nightvibe-inventory');
        if (savedInv) this.inventory = JSON.parse(savedInv);
        const savedEq = localStorage.getItem('nightvibe-equipment');
        if (savedEq) this.equipment = JSON.parse(savedEq);
      } catch (e) {
        this.inventory = [];
        this.equipment = {};
      }
    }

    // Smooth movement for remote players - stores target position
    this.targetX = x;
    this.targetY = y;
    this.hasTarget = false;

    this.chatMsg = null;
    this.chatTimer = 0;

    this.buffHpTimer = 0;
    this.buffManaTimer = 0;
    this.isChargingS2 = false;
    this.s2ChargeCount = 0;
  }

  get atk() {
    let bonus = 0;
    if (this.equipment) {
      for (let slot in this.equipment) {
        if (this.equipment[slot] && this.equipment[slot].stats && this.equipment[slot].stats.atk) {
          bonus += this.equipment[slot].stats.atk;
        }
      }
    }
    return (this._atk || 0) + bonus;
  }
  set atk(val) { this._atk = val; }

  get maxHp() {
    let bonus = 0;
    if (this.equipment) {
      for (let slot in this.equipment) {
        if (this.equipment[slot] && this.equipment[slot].stats && this.equipment[slot].stats.hp) {
          bonus += this.equipment[slot].stats.hp;
        }
      }
    }
    return (this._maxHp || 0) + bonus;
  }
  set maxHp(val) { this._maxHp = val; }

  get spd() {
    let bonus = 0;
    if (this.equipment) {
      for (let slot in this.equipment) {
        if (this.equipment[slot] && this.equipment[slot].stats && this.equipment[slot].stats.spd) {
          bonus += this.equipment[slot].stats.spd;
        }
      }
    }
    return (this._spd || 0) + bonus;
  }
  set spd(val) { this._spd = val; }

  get statPoints() {
    return (this.bonusStatPoints || 0) + (this.levelUpStatPoints || 0) + (this.sessionStatPoints || 0);
  }

  set statPoints(val) {
    const current = (this.bonusStatPoints || 0) + (this.levelUpStatPoints || 0) + (this.sessionStatPoints || 0);
    if (val === current - 1) {
      if ((this.levelUpStatPoints || 0) > 0) {
        this.levelUpStatPoints--;
      } else if ((this.sessionStatPoints || 0) > 0) {
        this.sessionStatPoints--;
      } else if ((this.bonusStatPoints || 0) > 0) {
        this.bonusStatPoints--;
      }
    } else {
      this.bonusStatPoints = val;
      this.levelUpStatPoints = 0;
    }
  }

  addKill() {
    this.kills++;
    this.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(this.level, REQ_KILLS_EXPONENT) + Math.sin(this.level) * REQ_KILLS_SIN_AMP);
    if (this.kills >= this.reqKills) {
      const reqLevel = REBIRTH_BASE_LEVEL + (this.resets || 0) * REBIRTH_LEVEL_STEP;
      if (!LIMIT_LEVEL_TO_REBIRTH_REQ || this.level < reqLevel) {
        this.kills -= this.reqKills;
        this.level++;
        this.levelUp();
        // Immediately recalculate required kills for the new level so HUD stays perfectly in sync!
        this.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(this.level, REQ_KILLS_EXPONENT) + Math.sin(this.level) * REQ_KILLS_SIN_AMP);
        return true; // Leveled up
      } else {
        this.kills = this.reqKills; // cap
      }
    }
    return false;
  }

  levelUp() {
    this.levelUpStatPoints = (this.levelUpStatPoints || 0) + LEVEL_UP_STAT_POINTS;
    this.hp = this.maxHp;
  }

  set(data) {
    if (typeof data === 'object') {
      this.input_data = this.input_data ? Object.assign(this.input_data, data) : data;
    }
  }

  updateFromNetwork() {
    if (this.input_data) {
      if (this.input_data.inGame !== undefined) {
        if (!this.inGame && this.input_data.inGame) {
          // Transitioning from menu to game: reset snap flag so they teleport to new spawn
          this.hasReceivedFirstPosition = false;
        }
        this.inGame = this.input_data.inGame;
      }
      if (this.input_data.nick !== undefined) this.nick = this.input_data.nick;
      if (this.input_data.x !== undefined) this.targetX = this.input_data.x;
      if (this.input_data.y !== undefined) this.targetY = this.input_data.y;
      if (this.input_data.x !== undefined || this.input_data.y !== undefined) {
        this.hasTarget = true;
        if (!this.hasReceivedFirstPosition) {
          this.x = this.targetX;
          this.y = this.targetY;
          this.hasReceivedFirstPosition = true;
        }
      }
      if (this.input_data.hp !== undefined) this.hp = this.input_data.hp;
      if (this.input_data.facing !== undefined) this.facing = this.input_data.facing;
      if (this.input_data.action !== undefined) {
        if (this.input_data.action !== this.action && (this.input_data.action === 'attack' || this.input_data.action === 'skill')) {
          this.animTimer = 15;
        }
        this.action = this.input_data.action;
      }
      if (this.input_data.classType !== undefined && this.classType !== this.input_data.classType) {
        this.classType = this.input_data.classType;
        const cd = CLASS_DATA[this.classType];
        this.color = cd.color;
        this.accent = cd.accent;
      }
      if (this.input_data.state !== undefined) this.state = this.input_data.state;
      if (this.input_data.alive !== undefined) this.alive = this.input_data.alive;
      if (this.input_data.animTimer !== undefined) this.animTimer = this.input_data.animTimer;
      if (this.input_data.hitFlash !== undefined) this.hitFlash = Math.max(this.hitFlash, this.input_data.hitFlash);
      if (this.input_data.level !== undefined) this.level = this.input_data.level;
      if (this.input_data.resets !== undefined) this.resets = this.input_data.resets;
      if (this.input_data.kills !== undefined) this.kills = this.input_data.kills;
      if (this.input_data.reqKills !== undefined) this.reqKills = this.input_data.reqKills;
      if (this.input_data.maxHp !== undefined) this.maxHp = this.input_data.maxHp;
      if (this.input_data.atk !== undefined) this.atk = this.input_data.atk;
      if (this.input_data.spd !== undefined) this.spd = this.input_data.spd;
      if (this.input_data.moveSpeed !== undefined) this.moveSpeed = this.input_data.moveSpeed;
      if (this.input_data.chatMsg !== undefined && this.input_data.chatMsg !== this.chatMsg) {
        this.chatMsg = this.input_data.chatMsg;
        if (this.chatMsg) {
          this.chatTimer = CHAT_MESSAGE_DURATION;
          if (typeof window !== 'undefined' && window.gameInstance && window.gameInstance.ui) {
            window.gameInstance.ui.addLog(`💬 [${this.nick || this.id.substring(0, 8)}]: ${this.chatMsg}`, 'player');
          }
        }
      }
      if (this.input_data.aimAngle !== undefined) this.aimAngle = this.input_data.aimAngle;
      if (this.input_data.isChargingS2 !== undefined) this.isChargingS2 = this.input_data.isChargingS2;
      if (this.input_data.s2ChargeCount !== undefined) {
        // Spawn charge particles locally when we receive a charge count increase from a remote player
        if (this.input_data.s2ChargeCount > (this.s2ChargeCount || 0) && typeof window !== 'undefined' && window.gameInstance) {
          window.gameInstance.spawnParticles(this.x, this.y - 40, '#ffd700', 15, 4);
        }
        this.s2ChargeCount = this.input_data.s2ChargeCount;
      }
      if (this.input_data.projectiles) this.projectiles = this.input_data.projectiles;
      if (this.input_data.inventory !== undefined) this.inventory = this.input_data.inventory;
      if (this.input_data.equipment !== undefined) this.equipment = this.input_data.equipment;
      if (this.input_data.targetedItemId !== undefined) this.targetedItemId = this.input_data.targetedItemId;

      this.input_data = null;
    }
  }

  updateMovement(dt, gameInstance) {
    if (this.isChargingS2 && this.classType === 'magicgladiator' && Math.random() < 0.15 * dt) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 25;
      if (typeof window !== 'undefined' && window.gameInstance) {
        window.gameInstance.particles.push({
          x: this.x + Math.cos(angle) * dist,
          y: this.y - 40 + Math.sin(angle) * dist,
          vx: Math.cos(angle) * 0.3,
          vy: Math.sin(angle) * 0.3 - 0.5,
          life: 40, maxLife: 40, color: '#9b4dff', size: 3
        });
      }
    }

    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.animTimer > 0) this.animTimer -= dt;
    
    if (this.chatTimer > 0) {
      this.chatTimer -= dt * 16.67;
      if (this.chatTimer <= 0) {
        this.chatMsg = null;
        if (this.isLocal) gameInstance.broadcastState();
      }
    }

    if (!this.isLocal) {
      this.updateFromNetwork();
      // Smooth lerp toward network target position based on moveSpeed
      if (this.hasTarget) {
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);
        
        if (dist > 300) {
          this.x = this.targetX;
          this.y = this.targetY;
          this.hasTarget = false;
        } else if (dist > 0.5) {
          // moveSpeed units per 16.67ms (1 frame at 60fps)
          // Scale dt to match this: dt is in frame units (dt=1 = 16.67ms)
          const speedPerFrame = this.moveSpeed || 2.5;
          const moveAmount = speedPerFrame * dt;
          if (moveAmount >= dist) {
            this.x = this.targetX;
            this.y = this.targetY;
            this.hasTarget = false;
          } else {
            this.x += (dx / dist) * moveAmount;
            this.y += (dy / dist) * moveAmount;
          }
        } else {
          this.x = this.targetX;
          this.y = this.targetY;
          this.hasTarget = false;
        }
      }
      return;
    }

    if (!this.isMoving && !this.autoAttackTarget) return;

    if (this.autoAttackTarget) {
      if (!this.autoAttackTarget.alive) {
        this.autoAttackTarget = null;
        this.stopWalking(gameInstance);
      } else {
        const e = this.autoAttackTarget;
        const cd = CLASS_DATA[this.classType] || CLASS_DATA.warrior;
        const wScale = 1 + (this.atk - cd.atk) * 0.005;
        const reqLevel = REBIRTH_BASE_LEVEL + (this.resets || 0) * REBIRTH_LEVEL_STEP;
        const lvlScale = 0.5 + 0.5 * ((this.level - 1) / Math.max(1, reqLevel - 1));

        let maxRange = RANGED_MAX_RANGE; // default for other classes
        const skill1 = cd.s1Name;
        if (skill1 === 'Bash') {
          maxRange = WARRIOR_MELEE_RANGE * wScale * lvlScale * MELEE_RANGE_LVL_SCALE_MULT;
        } else if (skill1 === 'Psionic Slash') {
          maxRange = MAGICGLADIATOR_MELEE_RANGE * wScale * lvlScale * MELEE_RANGE_LVL_SCALE_MULT;
        } else if (skill1 === 'Magic Bolt') {
          const mageBaseAtk = cd.atk;
          const mageRangeMult = Math.pow(this.atk / mageBaseAtk, ConfigModule.E1_RANGE_ATK_EXPONENT);
          maxRange = 8 * 60 * mageRangeMult;
        } else if (skill1 === 'Quick Shot') {
          const archerBaseAtk = cd.atk;
          const archerRangeMult = Math.pow(this.atk / archerBaseAtk, ConfigModule.E1_RANGE_ATK_EXPONENT);
          maxRange = 10 * 50 * archerRangeMult;
        }

        const weaponY = this.y - 40 * lvlScale;
        const distToE = Math.hypot(e.x - this.x, e.y - weaponY);

        // Force aim to target
        this.mouseX = e.x;
        this.mouseY = e.y;

        if (distToE <= maxRange) {
          if (this.animTimer <= 0) {
            gameInstance.doSkill1(e.x, e.y);
          }
          this.isMoving = false;
          return;
        } else {
          this.moveTargetX = Math.max(20, Math.min(gameInstance.gameW - 20, e.x));
          const groundY = getGroundY(gameInstance.selectedEnv);
          this.moveTargetY = Math.max(groundY - 50, Math.min(gameInstance.gameH - 45, e.y));
          this.isMoving = true;
        }
      }
    }

    if (!this.isMoving) return;

    const dx = this.moveTargetX - this.x;
    const dy = this.moveTargetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 3 && !this.autoAttackTarget) { // MOVE_STOP_DIST
      this.x = this.moveTargetX;
      this.y = this.moveTargetY;
      this.stopWalking(gameInstance);
      return;
    }

    const moveAmt = this.moveSpeed * dt;
    this.x += (dx / dist) * moveAmt;
    this.y += (dy / dist) * moveAmt;

    this.x = Math.max(20, Math.min(gameInstance.gameW - 20, this.x));
    const groundY = getGroundY(gameInstance.selectedEnv);
    this.y = Math.max(groundY - 50, Math.min(gameInstance.gameH - 45, this.y));

    if (dx > 2) this.facing = 1;
    else if (dx < -2) this.facing = -1;
  }

  stopWalking(gameInstance) {
    if (this.isMoving) {
      this.isMoving = false;
      this.moveTargetX = 0;
      this.moveTargetY = 0;
      this.targetedItemId = null;
      gameInstance.moveMarker = null;
      if (!this.autoAttackTarget) {
        document.getElementById('walk-indicator').classList.remove('visible');
      }
    }
  }

  draw(ctx, dt, gameInstance) {
    const px = this.x, py = this.y;
    const isDead = !this.alive;
    let baseAlpha = 1;
    if (isDead) {
      // Pulse alpha smoothly between 0.1 and 0.3
      baseAlpha = 0.2 + Math.sin(Date.now() / 400) * 0.1;
    } else if (this.hitFlash > 0) {
      baseAlpha = 0.5 + Math.sin(this.hitFlash * 2) * 0.5;
    }
    ctx.globalAlpha = baseAlpha;

    const cd = CLASS_DATA[this.classType] || CLASS_DATA.warrior;
    const renderType = cd.bodyType || (['warrior', 'mage', 'archer', 'magicgladiator'].includes(this.classType) ? this.classType : 'warrior');
    const walkBob = (this.isMoving || this.action === 'walk') ? Math.sin(Date.now() / 100) * 2 : 0;
    const groundY = getGroundY(gameInstance.selectedEnv);

    // Shadow at feet
    const feetOffsets = { warrior: 16, mage: 18, archer: 18, magicgladiator: 16 };
    const feetOffset = feetOffsets[renderType] || 38;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(px, py + feetOffset, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;



    const reqLevel = 4 + (this.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.level - 1) / Math.max(1, reqLevel - 1));

    if ((this.isMoving || this.action === 'walk') && Math.random() < 0.5) {
      const trailX = px - this.facing * (8 + Math.random() * 10) * lvlScale;
      gameInstance.spawnParticles(trailX, py + 40 * lvlScale, '#a09080', 2 + Math.floor(Math.random() * 2), 0.8, lvlScale * 1.6);
    }

    ctx.save();

    ctx.translate(px, py + walkBob);
    ctx.scale(lvlScale, lvlScale);
    if (this.facing < 0) ctx.scale(-1, 1);

    // Adjust py offset in calculations since we scaled
    const unscaledPy = py;
    // Aim calculations based on synced mouse position
    let rawAim;
    if (this.isLocal) {
      rawAim = Math.atan2(this.mouseY - (py - 40), this.mouseX - px);
    } else {
      rawAim = this.aimAngle !== undefined ? this.aimAngle : (this.facing > 0 ? 0 : Math.PI);
    }
    let localAim = (this.facing < 0) ? Math.PI - rawAim : rawAim;
    const animP = this.animTimer / 15;
    let armAnim = getArmAnim(this.animTimer);

    if (this.isChargingS2) {
      if (renderType === 'archer') {
        armAnim = 0; // Archer just aims steadily
      } else {
        armAnim = (Date.now() % 400) / 400 * Math.PI * 2;
      }
    }

    if (cd.icon && typeof cd.icon === 'string' && (cd.icon.startsWith('data:image/') || cd.icon.startsWith('http') || cd.icon.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i))) {
      const img = this.facing < 0 ? getCachedFlippedImage(cd.icon) : getCachedImage(cd.icon);
      if (img) {
        ctx.drawImage(img, -40, -80, 80, 80);
      } else {
        ctx.font = '50px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👾', 0, -40);
      }
      
      // Weapon rendering for custom classes based on their body type
      if (renderType === 'warrior') {
        ctx.save(); ctx.translate(15, -20);
        ctx.rotate(localAim + armAnim);
        ctx.fillStyle = '#d8a070'; ctx.fillRect(0, -5, 12, 10);
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(12, -4, 60, 8);
        ctx.restore();
      } else if (renderType === 'mage') {
        ctx.save(); ctx.translate(15, -20);
        ctx.rotate(localAim + armAnim);
        ctx.fillStyle = '#d8a070'; ctx.fillRect(0, -5, 12, 10);
        ctx.fillStyle = '#6b4226'; ctx.fillRect(12, -40, 6, 80);
        ctx.fillStyle = cd.s1Color;
        ctx.beginPath(); ctx.arc(15, -45, 10, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      } else if (renderType === 'archer') {
        ctx.save(); ctx.translate(15, -20);
        ctx.rotate(localAim + armAnim);
        ctx.fillStyle = '#d8a070'; ctx.fillRect(0, -5, 12, 10);
        ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(12, 0, 25, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
        ctx.restore();
      }
    } else if (renderType === 'warrior') {
      ctx.fillStyle = cd.color; ctx.fillRect(-18, -55, 36, 60);
      ctx.fillStyle = cd.accent; ctx.fillRect(-5, -45, 10, 40);
      ctx.fillStyle = '#8b6914'; ctx.fillRect(-16, -10, 32, 6);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(-3, -12, 6, 10);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(-12, -78, 24, 25);
      ctx.fillStyle = '#708090'; ctx.fillRect(-14, -82, 28, 10);
      ctx.fillRect(-16, -75, 4, 18); ctx.fillRect(12, -75, 4, 18);
      ctx.fillStyle = '#4a5568'; ctx.fillRect(-10, -72, 20, 3);
      ctx.fillStyle = '#000'; ctx.fillRect(1, -70, 4, 4); ctx.fillRect(-5, -70, 4, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(2, -69, 2, 2); ctx.fillRect(-4, -69, 2, 2);

      ctx.save(); ctx.translate(-28, -42);
      let shieldRaise = 0;
      if (this.isChargingS2) {
        shieldRaise = 15;
      } else if (this.animTimer > 0 && animP > 0.2) {
        shieldRaise = Math.max(0, Math.min(15, (1 - (animP - 0.2) / 0.8) * 15));
      }
      ctx.translate(0, -shieldRaise);
      ctx.rotate(localAim + armAnim);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(-14, -6, 14, 10);
      ctx.fillRect(-20, 4, 8, 15);
      ctx.fillStyle = '#d4af37'; ctx.beginPath();
      ctx.moveTo(0, -30); ctx.lineTo(-16, -20); ctx.lineTo(-20, 5);
      ctx.lineTo(-18, 22); ctx.lineTo(0, 32); ctx.lineTo(18, 22);
      ctx.lineTo(20, 5); ctx.lineTo(16, -20); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = cd.accent; ctx.beginPath();
      ctx.moveTo(0, -18); ctx.lineTo(-8, -6); ctx.lineTo(-6, 10);
      ctx.lineTo(0, 18); ctx.lineTo(6, 10); ctx.lineTo(8, -6);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath();
      ctx.moveTo(0, -26); ctx.lineTo(-8, -18); ctx.lineTo(-6, -4);
      ctx.lineTo(0, -10); ctx.closePath(); ctx.fill();
      ctx.restore();

      ctx.save(); ctx.translate(24, -42);
      ctx.rotate(localAim + armAnim);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(0, -6, 14, 10);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(14, -6, 10, 10); // Hand
      ctx.save(); ctx.translate(20, -1);
      ctx.rotate(-Math.PI / 2 + 0.3); // Point up-forward
      ctx.fillStyle = '#8b4513'; ctx.fillRect(-8, -4, 16, 8); // Handle
      ctx.fillStyle = '#d4af37'; ctx.fillRect(8, -16, 6, 32); // Crossguard
      ctx.fillStyle = '#c0c0c0'; ctx.fillRect(14, -6, 70, 12); // Blade
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(14, -2, 66, 4); // Edge shine
      ctx.beginPath(); ctx.moveTo(84, -6); ctx.lineTo(95, 0); ctx.lineTo(84, 6); ctx.fill(); // Tip
      ctx.restore();
      ctx.restore();

      ctx.fillStyle = '#555'; ctx.fillRect(-14, 5, 12, 30);
      ctx.fillRect(2, 5, 12, 30);
      ctx.fillStyle = '#333'; ctx.fillRect(-16, 30, 16, 8);
      ctx.fillRect(0, 30, 16, 8);
    }
    // Implement other classes (mage, archer, magicgladiator) exactly as they were
    else if (renderType === 'mage') {
      ctx.fillStyle = '#5a5a6a'; ctx.beginPath();
      ctx.moveTo(-20, -55); ctx.quadraticCurveTo(-24, 0, -22, 42);
      ctx.lineTo(22, 42); ctx.quadraticCurveTo(24, 0, 20, -55);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#7a7a8a'; ctx.fillRect(-3, -48, 6, 85);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-12, -40); ctx.lineTo(-14, 40); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(12, -40); ctx.lineTo(14, 40); ctx.stroke();
      ctx.fillStyle = '#4a4a5a'; ctx.fillRect(-22, 34, 44, 8);
      ctx.fillStyle = '#6b4226'; ctx.fillRect(-20, -10, 40, 7);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(-4, -12, 8, 11);
      ctx.fillStyle = '#6b4226'; ctx.fillRect(-2, -10, 4, 7);
      ctx.fillStyle = '#4a4a5a';
      ctx.beginPath();
      ctx.ellipse(0, -62, 28, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-14, -62);
      ctx.quadraticCurveTo(-16, -82, -10, -108);
      ctx.quadraticCurveTo(-2, -114, 6, -110);
      ctx.quadraticCurveTo(10, -82, 14, -62);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#3a3a4a'; ctx.fillRect(-14, -68, 28, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.moveTo(4, -106); ctx.quadraticCurveTo(8, -82, 12, -64);
      ctx.lineTo(8, -64); ctx.quadraticCurveTo(4, -82, 2, -104);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d8a070'; ctx.fillRect(-10, -72, 20, 16);
      ctx.fillStyle = '#fff'; ctx.fillRect(1, -68, 5, 4);
      ctx.fillRect(-6, -68, 5, 4);
      ctx.fillStyle = '#2c3e50'; ctx.fillRect(3, -67, 2, 2);
      ctx.fillRect(-4, -67, 2, 2);
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.moveTo(-10, -62);
      ctx.quadraticCurveTo(-14, -40, -10, -28);
      ctx.quadraticCurveTo(-6, -18, 0, -22);
      ctx.quadraticCurveTo(6, -18, 10, -28);
      ctx.quadraticCurveTo(14, -40, 10, -62);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(-4, -58); ctx.lineTo(-5, -30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -56); ctx.lineTo(0, -25); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -58); ctx.lineTo(5, -30); ctx.stroke();
      ctx.fillStyle = '#c0c0c0';
      ctx.fillRect(-8, -71, 8, 3);
      ctx.fillRect(0, -71, 8, 3);
      ctx.fillStyle = '#d8d8d8';
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.quadraticCurveTo(-8, -56, -12, -52);
      ctx.lineTo(-8, -54);
      ctx.quadraticCurveTo(-3, -56, 0, -56);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(0, -58);
      ctx.quadraticCurveTo(8, -56, 12, -52);
      ctx.lineTo(8, -54);
      ctx.quadraticCurveTo(3, -56, 0, -56);
      ctx.closePath(); ctx.fill();

      ctx.save(); ctx.translate(-20, -42);
      let orbAngle = 0;
      if (this.lastSkill === 2 && this.action === 'attack') orbAngle = localAim + armAnim;
      ctx.rotate(orbAngle);
      ctx.fillStyle = '#5a5a6a'; ctx.fillRect(-2, -8, 16, 10);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(10, -8, 10, 10);
      ctx.translate(25, -3);
      const orbGlow = Math.sin(Date.now() / 250) * 0.3 + 0.7;
      ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 6 * orbGlow;
      ctx.fillStyle = '#9b59b6';
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c39bd3';
      ctx.beginPath(); ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath(); ctx.ellipse(-2, -2, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();

      ctx.save(); ctx.translate(20, -44);
      let staffAngle = Math.max(-1.4, Math.min(1.4, localAim * 0.4 + armAnim * 0.3));
      if (this.lastSkill === 1 && this.action === 'attack') staffAngle = localAim + armAnim;
      ctx.rotate(staffAngle);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(-6, -7, 12, 14);
      ctx.fillStyle = '#6b4226'; ctx.fillRect(-3, -115, 6, 230);
      ctx.fillStyle = '#5a3520'; ctx.fillRect(-1, -110, 1, 220);
      ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 0.5;
      for (let i = -105; i < 110; i += 12) {
        ctx.beginPath(); ctx.moveTo(-2, i); ctx.lineTo(2, i + 3); ctx.stroke();
      }
      ctx.fillStyle = '#d4af37'; ctx.fillRect(-5, -108, 10, 5);
      ctx.fillRect(-5, 100, 10, 5);
      ctx.fillStyle = '#d4af37'; ctx.beginPath();
      ctx.moveTo(0, 130); ctx.lineTo(-5, 122); ctx.lineTo(5, 122); ctx.closePath(); ctx.fill();
      const crystalGlow = Math.sin(Date.now() / 300) * 0.3 + 0.7;
      ctx.fillStyle = cd.s1Color; ctx.globalAlpha = crystalGlow;
      ctx.shadowColor = cd.s1Color; ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.moveTo(0, -120); ctx.lineTo(-10, -100);
      ctx.lineTo(0, -80); ctx.lineTo(10, -100); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(0, -110); ctx.lineTo(-4, -100);
      ctx.lineTo(0, -90); ctx.lineTo(4, -100); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#d4af37'; ctx.fillRect(-6, -103, 12, 5);
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      ctx.fillStyle = '#d8a070';
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillRect(-9, -6, 5, 12);
      ctx.fillRect(4, -6, 5, 12);
      ctx.fillRect(-5, -11, 10, 5);
      ctx.fillRect(-5, 6, 10, 5);
      ctx.restore();
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-14, 5, 12, 28);
      ctx.fillRect(2, 5, 12, 28);
      ctx.fillStyle = '#2a1a0a'; ctx.fillRect(-16, 28, 14, 8);
      ctx.fillRect(0, 28, 14, 8);
    }
    else if (renderType === 'archer') {
      ctx.fillStyle = cd.color; ctx.fillRect(-16, -52, 32, 55);
      ctx.fillStyle = cd.accent; ctx.fillRect(-4, -44, 8, 45);
      ctx.fillStyle = '#8b6914'; ctx.fillRect(-16, -8, 32, 5);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(-11, -72, 22, 22);
      ctx.fillStyle = '#8b4513'; ctx.fillRect(-13, -76, 26, 8);
      ctx.fillRect(10, -74, 6, 16);
      ctx.fillStyle = '#000'; ctx.fillRect(1, -66, 4, 4);
      ctx.fillRect(-5, -66, 4, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(2, -65, 2, 2);

      ctx.save(); ctx.translate(22, -42);
      ctx.rotate(localAim + armAnim);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(0, -5, 18, 10); // Arm straight to bow center
      ctx.strokeStyle = '#8b6914'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(18, 0, 35, -Math.PI * 0.55, Math.PI * 0.55); ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(18, 0, 35, -Math.PI * 0.55, -Math.PI * 0.35); ctx.stroke();
      ctx.beginPath(); ctx.arc(18, 0, 35, Math.PI * 0.35, Math.PI * 0.55); ctx.stroke();
      const topX = 18 + Math.cos(-Math.PI * 0.55) * 35, topY = Math.sin(-Math.PI * 0.55) * 35;
      const botX = 18 + Math.cos(Math.PI * 0.55) * 35, botY = Math.sin(Math.PI * 0.55) * 35;
      let stringPull = 0;
      if (this.isChargingS2) {
        stringPull = 18;
      } else if (this.animTimer > 0) {
        stringPull = Math.max(0, Math.min(18, (1 - animP) * 18));
      }
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(topX, topY);
      ctx.lineTo(18 - stringPull, 0); ctx.lineTo(botX, botY); ctx.stroke();

      // Arrow
      const arrowMidX = 18 - stringPull * 0.5, arrowMidY = 0;
      ctx.strokeStyle = '#a07828'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(18 - stringPull, arrowMidY);
      ctx.lineTo(arrowMidX + 15, arrowMidY); ctx.stroke();
      ctx.fillStyle = '#888'; ctx.beginPath(); ctx.moveTo(arrowMidX + 15, arrowMidY);
      ctx.lineTo(arrowMidX + 10, arrowMidY - 3);
      ctx.lineTo(arrowMidX + 10, arrowMidY + 3); ctx.closePath(); ctx.fill();
      ctx.restore();

      // Right arm pulling string
      ctx.fillStyle = '#d8a070'; ctx.save(); ctx.translate(-26, -42);
      ctx.rotate(localAim + armAnim);
      ctx.fillRect(0, -5, 44 - stringPull, 10);
      ctx.restore();

      ctx.fillStyle = '#5a4a3a'; ctx.fillRect(-13, 5, 11, 28);
      ctx.fillRect(2, 5, 11, 28);
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-15, 28, 14, 8);
      ctx.fillRect(0, 28, 14, 8);
      ctx.fillStyle = '#6b4423'; ctx.fillRect(-18, -50, 10, 20);
      ctx.fillStyle = '#a07828'; ctx.fillRect(-17, -48, 2, 16);
      ctx.fillRect(-14, -47, 2, 15); ctx.fillRect(-11, -49, 2, 17);
    }
    else if (renderType === 'magicgladiator') {
      ctx.fillStyle = cd.color; ctx.fillRect(-18, -55, 36, 60);
      ctx.fillStyle = cd.accent; ctx.fillRect(-10, -50, 20, 8);
      ctx.fillRect(-10, -38, 20, 8); ctx.fillRect(-10, -26, 20, 8);
      ctx.fillStyle = '#8b6914'; ctx.fillRect(-16, -10, 32, 6);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(-12, -78, 24, 25);
      ctx.fillStyle = cd.accent; ctx.fillRect(-2, -86, 4, 10);
      ctx.fillStyle = '#8b4513'; ctx.fillRect(-14, -80, 28, 6);
      ctx.fillRect(-14, -74, 4, 16); ctx.fillRect(10, -74, 4, 16);
      ctx.fillStyle = '#000'; ctx.fillRect(1, -70, 4, 4);
      ctx.fillRect(-5, -70, 4, 4);
      ctx.fillStyle = '#fff'; ctx.fillRect(2, -69, 2, 2);
      ctx.fillRect(-4, -69, 2, 2);

      let s2Cross = (gameInstance.s2Cooldown > 0 && this.animTimer > 0) ?
        Math.sin((1 - gameInstance.s2Cooldown / 1000) * Math.PI) * 0.9 : 0; // assuming s2MaxCooldown is 1000

      ctx.save(); ctx.translate(24, -40);
      let rightAngle = localAim;
      if (s2Cross > 0) rightAngle = localAim - 0.6 * s2Cross;
      ctx.rotate(rightAngle + armAnim);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(0, -5, 14, 9);
      ctx.fillStyle = '#d8a070'; ctx.fillRect(14, -5, 10, 9); // Hand
      ctx.save(); ctx.translate(20, -1);
      ctx.rotate(-Math.PI / 2 + 0.3);
      ctx.fillStyle = '#8b4513'; ctx.fillRect(-8, -3, 16, 6);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(8, -14, 6, 28);
      ctx.fillStyle = '#c0c0c0'; ctx.fillRect(14, -5, 65, 10);
      ctx.fillStyle = '#e8e8e8'; ctx.fillRect(14, -2, 60, 4);
      ctx.beginPath(); ctx.moveTo(79, -5); ctx.lineTo(88, 0); ctx.lineTo(79, 5); ctx.fill();
      if (this.animTimer > 0) {
        ctx.shadowColor = cd.accent; ctx.shadowBlur = 3;
        ctx.fillStyle = cd.s1Color; ctx.globalAlpha = animP * 0.5;
        ctx.fillRect(14, -7, 70, 14);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      ctx.restore();
      ctx.restore();

      ctx.save(); ctx.translate(-22, -38);
      let leftAngle = localAim;
      if (s2Cross > 0) leftAngle = localAim + 0.6 * s2Cross;
      ctx.rotate(leftAngle + armAnim);
      ctx.fillStyle = '#c89060'; ctx.fillRect(0, -5, 14, 9);
      ctx.fillStyle = '#c89060'; ctx.fillRect(14, -5, 10, 9);
      ctx.save(); ctx.translate(20, -1);
      ctx.rotate(-Math.PI / 2 + 0.1);
      ctx.fillStyle = '#8b4513'; ctx.fillRect(-8, -3, 16, 6);
      ctx.fillStyle = '#d4af37'; ctx.fillRect(8, -14, 6, 28);
      ctx.fillStyle = '#b0b0b0'; ctx.fillRect(14, -5, 65, 10);
      ctx.fillStyle = '#d8d8d8'; ctx.fillRect(14, -2, 60, 4);
      ctx.beginPath(); ctx.moveTo(79, -5); ctx.lineTo(88, 0); ctx.lineTo(79, 5); ctx.fill();
      if (this.animTimer > 0) {
        ctx.shadowColor = cd.accent; ctx.shadowBlur = 3;
        ctx.fillStyle = cd.s1Color; ctx.globalAlpha = animP * 0.5;
        ctx.fillRect(14, -7, 70, 14);
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      ctx.restore();
      ctx.restore();

      ctx.fillStyle = '#555'; ctx.fillRect(-14, 5, 12, 30);
      ctx.fillRect(2, 5, 12, 30);
      ctx.fillStyle = '#333'; ctx.fillRect(-16, 30, 16, 8);
      ctx.fillRect(0, 30, 16, 8);
    }

    if ((this.isMoving || this.action === 'walk') && this.animTimer <= 0) {
      ctx.fillStyle = 'rgba(149,165,166,0.5)'; ctx.beginPath();
      const arrowX = this.facing * 30;
      const arrowY = -20;
      ctx.moveTo(arrowX + this.facing * 6, arrowY);
      ctx.lineTo(arrowX - this.facing * 3, arrowY - 4);
      ctx.lineTo(arrowX - this.facing * 3, arrowY + 4);
      ctx.fill();
    }

    ctx.restore();

    // Overhead Player Tag (Not mirrored)
    ctx.save();
    ctx.translate(px, py + walkBob);

    // Scale offset based on character size
    const tagBaseY = -90 * lvlScale - 15;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-45, tagBaseY - 8, 90, 16);
    ctx.fillStyle = this.isLocal ? '#f39c12' : '#ecf0f1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const dispName = (this.nick && this.nick.trim() !== '') ? this.nick : this.id.substring(0, 12);
    ctx.fillText(dispName, 0, tagBaseY);

    // Chat Bubble
    if (this.chatMsg && this.chatTimer > 0) {
      ctx.save();
      ctx.font = 'bold 14px sans-serif';
      const msgWidth = Math.max(40, ctx.measureText(this.chatMsg).width + 20);
      const msgHeight = 28;
      const bubbleY = tagBaseY - 25; // above the name

      const alpha = Math.min(1, this.chatTimer / CHAT_FADE_OUT_DURATION); // fade out at end
      ctx.globalAlpha = alpha;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 2;

      // draw bubble
      const bx = -msgWidth / 2;
      const by = bubbleY - msgHeight / 2;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(bx, by, msgWidth, msgHeight, 8);
      } else {
        ctx.rect(bx, by, msgWidth, msgHeight);
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // draw tail
      ctx.beginPath();
      ctx.moveTo(-6, by + msgHeight);
      ctx.lineTo(6, by + msgHeight);
      ctx.lineTo(0, by + msgHeight + 6);
      ctx.fill();

      ctx.fillStyle = '#2c3e50';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.chatMsg, 0, bubbleY);
      ctx.restore();
    }

    if (this.isChargingS2) {
      const chargeCount = this.s2ChargeCount || 0;
      const maxCharges = 3 + (this.resets || 0);
      const chargeBaseY = tagBaseY - 24;

      const boxWidth = maxCharges * 19 + 3;
      const startX = -boxWidth / 2;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(startX, chargeBaseY - 4, boxWidth, 10);
      for (let i = 0; i < maxCharges; i++) {
        if (i < chargeCount) {
          ctx.fillStyle = '#ffd700';
          ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 2;
        } else {
          ctx.fillStyle = '#555';
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(startX + 3 + i * 19, chargeBaseY - 2, 16, 6);
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }
}