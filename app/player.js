import { getGroundY, getArmAnim, GAME_W, GAME_H, CLASS_DATA } from './utils.js';

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
    
    this.level = 1;
    this.kills = 0;
    this.reqKills = 5;
    
    this.animTimer = 0;
    this.hitFlash = 0;
    this.alive = true;
    this.facing = 1;
    this.isMoving = false;
    this.moveTargetX = 0;
    this.moveTargetY = 0;
    this.moveSpeed = 2.5; // From MOVE_SPEED
    this.action = 'idle';
    this.mouseX = x;
    this.mouseY = y;
    this.inGame = isLocal;
    this.state = isLocal ? 'PLAYING' : 'MENU';
    
    // Multiplayer sync fields
    this.input_data = null;
  }

  addKill() {
    this.kills++;
    this.reqKills = Math.floor(5 * Math.pow(this.level, 1.4) + Math.sin(this.level) * 2);
    if (this.kills >= this.reqKills) {
        this.kills -= this.reqKills;
        this.level++;
        this.levelUp();
        return true; // Leveled up
    }
    return false;
  }

  levelUp() {
      if (this.classType === 'warrior') {
         this.atk += 2; this.maxHp += 20; this.spd += 0.5;
      } else if (this.classType === 'mage') {
         this.atk += 2.5; this.spd += 1; this.maxHp += 10;
      } else if (this.classType === 'archer') {
         this.spd += 1.5; this.atk += 1.5; this.maxHp += 12;
      } else if (this.classType === 'magicgladiator') {
         this.atk += 1.5; this.spd += 1; this.maxHp += 15;
      }
      this.atk += 1;
      this.maxHp += 1;
      this.hp = this.maxHp;
  }

  set(data) {
    if (typeof data === 'object') {
      this.input_data = this.input_data ? Object.assign(this.input_data, data) : data;
    }
  }

  updateFromNetwork() {
    if (this.input_data) {
      if (this.input_data.x !== undefined) this.x = this.input_data.x;
      if (this.input_data.y !== undefined) this.y = this.input_data.y;
      if (this.input_data.hp !== undefined) this.hp = this.input_data.hp;
      if (this.input_data.facing !== undefined) this.facing = this.input_data.facing;
      if (this.input_data.action !== undefined) this.action = this.input_data.action;
      if (this.input_data.classType !== undefined && this.classType !== this.input_data.classType) {
        this.classType = this.input_data.classType;
        const cd = CLASS_DATA[this.classType];
        this.color = cd.color;
        this.accent = cd.accent;
      }
      if (this.input_data.inGame !== undefined) this.inGame = this.input_data.inGame;
      if (this.input_data.state !== undefined) this.state = this.input_data.state;
      if (this.input_data.alive !== undefined) this.alive = this.input_data.alive;
      if (this.input_data.animTimer !== undefined) this.animTimer = this.input_data.animTimer;
      if (this.input_data.hitFlash !== undefined) this.hitFlash = Math.max(this.hitFlash, this.input_data.hitFlash);
      if (this.input_data.level !== undefined) this.level = this.input_data.level;
      if (this.input_data.kills !== undefined) this.kills = this.input_data.kills;
      if (this.input_data.reqKills !== undefined) this.reqKills = this.input_data.reqKills;
      if (this.input_data.maxHp !== undefined) this.maxHp = this.input_data.maxHp;
      if (this.input_data.mouseX !== undefined) this.mouseX = this.input_data.mouseX;
      if (this.input_data.mouseY !== undefined) this.mouseY = this.input_data.mouseY;
      if (this.input_data.isChargingS2 !== undefined) this.isChargingS2 = this.input_data.isChargingS2;
      if (this.input_data.s2ChargeCount !== undefined) this.s2ChargeCount = this.input_data.s2ChargeCount;
      if (this.input_data.projectiles) this.projectiles = this.input_data.projectiles;
      
      this.input_data = null;
    }
  }

  updateMovement(dt, gameInstance) {
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.animTimer > 0) this.animTimer -= dt;

    if (!this.isLocal) {
        this.updateFromNetwork();
        return;
    }

    if (!this.isMoving) return;

    const dx = this.moveTargetX - this.x;
    const dy = this.moveTargetY - this.y;
    const dist = Math.hypot(dx, dy);

    if (dist <= 3) { // MOVE_STOP_DIST
      this.x = this.moveTargetX;
      this.y = this.moveTargetY;
      this.stopWalking(gameInstance);
      return;
    }

    const moveAmt = this.moveSpeed * dt;
    this.x += (dx / dist) * moveAmt;
    this.y += (dy / dist) * moveAmt;

    this.x = Math.max(20, Math.min(GAME_W - 20, this.x));
    const groundY = getGroundY(gameInstance.selectedEnv);
    this.y = Math.max(groundY - 50, Math.min(GAME_H - 45, this.y));

    if (dx > 2) this.facing = 1;
    else if (dx < -2) this.facing = -1;
  }

  stopWalking(gameInstance) {
    if (this.isMoving) {
      this.isMoving = false;
      this.moveTargetX = 0;
      this.moveTargetY = 0;
      gameInstance.moveMarker = null;
      document.getElementById('walk-indicator').classList.remove('visible');
    }
  }

  draw(ctx, dt, gameInstance) {
    const px = this.x, py = this.y;
    const isDead = !this.alive;
    let baseAlpha = 1;
    if (isDead) {
        baseAlpha = 0.3;
    } else if (this.hitFlash > 0) {
        baseAlpha = 0.5 + Math.sin(this.hitFlash * 2) * 0.5;
    }
    ctx.globalAlpha = baseAlpha;

    const cd = CLASS_DATA[this.classType];
    const walkBob = (this.isMoving || this.action === 'walk') ? Math.sin(Date.now() / 100) * 2 : 0;
    const groundY = getGroundY(gameInstance.selectedEnv);

    // Shadow
    const depthRatio = Math.max(0, (this.y - groundY) / (GAME_H - groundY));
    const shadowAlpha = (0.2 + depthRatio * 0.3) * baseAlpha;
    const shadowWidth = 22 + depthRatio * 8 + ((this.isMoving || this.action === 'walk') ? 3 : 0);
    const shadowHeight = 6 + depthRatio * 4;
    ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(px, py, shadowWidth, shadowHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    if (isDead) {
        ctx.globalAlpha = 1;
        return;
    }

    if ((this.isMoving || this.action === 'walk') && Math.random() < 0.15) {
      gameInstance.spawnParticles(px + (Math.random() - 0.5) * 10, groundY - 2, '#888', 1, 1);
    }

    ctx.save();
    ctx.translate(px, py + walkBob);
    if (this.facing < 0) ctx.scale(-1, 1);
    
    // Aim calculations based on synced mouse position
    let rawAim = Math.atan2(this.mouseY - (py - 40), this.mouseX - px);
    let localAim = (this.facing < 0) ? Math.PI - rawAim : rawAim;
    const animP = this.animTimer / 15;
    let armAnim = getArmAnim(this.animTimer);
    
    if (this.isChargingS2) {
       if (this.classType === 'archer') {
           armAnim = 0; // Archer just aims steadily
       } else {
           armAnim = (Date.now() % 400) / 400 * Math.PI * 2;
       }
    }

    if (this.classType === 'warrior') {
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
            shieldRaise = Math.max(0, Math.min(15, (1 - (animP - 0.2)/0.8) * 15));
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
        ctx.rotate(-Math.PI/2 + 0.3); // Point up-forward
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
    else if (this.classType === 'mage') {
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
         ctx.ellipse(0, -62, 28, 5, 0, 0, Math.PI*2); ctx.fill();
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
           const orbGlow = Math.sin(Date.now()/250) * 0.3 + 0.7;
           ctx.shadowColor = '#9b59b6'; ctx.shadowBlur = 15 * orbGlow;
           ctx.fillStyle = '#9b59b6';
           ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, 0, Math.PI*2); ctx.fill();
           ctx.fillStyle = '#c39bd3';
           ctx.beginPath(); ctx.ellipse(0, 0, 6, 6, 0, 0, Math.PI*2); ctx.fill();
           ctx.fillStyle = 'rgba(255,255,255,0.5)';
           ctx.beginPath(); ctx.ellipse(-2, -2, 3, 3, 0, 0, Math.PI*2); ctx.fill();
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
              ctx.beginPath(); ctx.moveTo(-2, i); ctx.lineTo(2, i+3); ctx.stroke();
            }
            ctx.fillStyle = '#d4af37'; ctx.fillRect(-5, -108, 10, 5);
            ctx.fillRect(-5, 100, 10, 5);
            ctx.fillStyle = '#d4af37'; ctx.beginPath();
            ctx.moveTo(0, 130); ctx.lineTo(-5, 122); ctx.lineTo(5, 122); ctx.closePath(); ctx.fill();
            const crystalGlow = Math.sin(Date.now()/300) * 0.3 + 0.7;
            ctx.fillStyle = cd.s1Color; ctx.globalAlpha = crystalGlow;
            ctx.shadowColor = cd.s1Color; ctx.shadowBlur = 14;
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
    else if (this.classType === 'archer') {
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
        ctx.beginPath(); ctx.arc(18, 0, 35, -Math.PI*0.55, Math.PI*0.55); ctx.stroke();
        ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(18, 0, 35, -Math.PI*0.55, -Math.PI*0.35); ctx.stroke();
        ctx.beginPath(); ctx.arc(18, 0, 35, Math.PI*0.35, Math.PI*0.55); ctx.stroke();
        const topX = 18 + Math.cos(-Math.PI*0.55)*35, topY = Math.sin(-Math.PI*0.55)*35;
        const botX = 18 + Math.cos(Math.PI*0.55)*35, botY = Math.sin(Math.PI*0.55)*35;
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
    else if (this.classType === 'magicgladiator') {
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
          Math.sin((1 - gameInstance.s2Cooldown/1000)*Math.PI) * 0.9 : 0; // assuming s2MaxCooldown is 1000

        ctx.save(); ctx.translate(24, -40);
        let rightAngle = localAim;
        if (s2Cross > 0) rightAngle = localAim - 0.6 * s2Cross;
        ctx.rotate(rightAngle + armAnim);
        ctx.fillStyle = '#d8a070'; ctx.fillRect(0, -5, 14, 9);
        ctx.fillStyle = '#d8a070'; ctx.fillRect(14, -5, 10, 9); // Hand
        ctx.save(); ctx.translate(20, -1);
        ctx.rotate(-Math.PI/2 + 0.3);
        ctx.fillStyle = '#8b4513'; ctx.fillRect(-8, -3, 16, 6);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(8, -14, 6, 28);
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(14, -5, 65, 10);
        ctx.fillStyle = '#e8e8e8'; ctx.fillRect(14, -2, 60, 4);
        ctx.beginPath(); ctx.moveTo(79, -5); ctx.lineTo(88, 0); ctx.lineTo(79, 5); ctx.fill();
        if (this.animTimer > 0) {
          ctx.shadowColor = cd.accent; ctx.shadowBlur = 8;
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
        ctx.rotate(-Math.PI/2 + 0.1);
        ctx.fillStyle = '#8b4513'; ctx.fillRect(-8, -3, 16, 6);
        ctx.fillStyle = '#d4af37'; ctx.fillRect(8, -14, 6, 28);
        ctx.fillStyle = '#b0b0b0'; ctx.fillRect(14, -5, 65, 10);
        ctx.fillStyle = '#d8d8d8'; ctx.fillRect(14, -2, 60, 4);
        ctx.beginPath(); ctx.moveTo(79, -5); ctx.lineTo(88, 0); ctx.lineTo(79, 5); ctx.fill();
        if (this.animTimer > 0) {
          ctx.shadowColor = cd.accent; ctx.shadowBlur = 8;
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
        if (gameInstance.s2Cooldown > 0 && this.animTimer > 0) {
          const crossAlpha = Math.sin((1 - gameInstance.s2Cooldown/1000)*Math.PI);
          ctx.globalAlpha = crossAlpha * 0.6;
          ctx.strokeStyle = cd.s2Color; ctx.lineWidth = 4;
          ctx.shadowColor = cd.s2Color; ctx.shadowBlur = 15;
          ctx.beginPath(); ctx.moveTo(-30, -70);
          ctx.lineTo(30, -10); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(30, -70);
          ctx.lineTo(-30, -10); ctx.stroke();
          ctx.shadowBlur = 0; ctx.globalAlpha = 1;
          if (this.isLocal) gameInstance.spawnParticles(this.x, this.y-40, cd.s2Color, 2, 2);
        }
    }

    if ((this.isMoving || this.action === 'walk') && this.animTimer <= 0) {
      ctx.fillStyle = 'rgba(149,165,166,0.5)'; ctx.beginPath();
      const arrowX = this.facing * 30;
      const arrowY = -20;
      ctx.moveTo(arrowX+this.facing*6, arrowY);
      ctx.lineTo(arrowX-this.facing*3, arrowY-4);
      ctx.lineTo(arrowX-this.facing*3, arrowY+4);
      ctx.fill();
    }
    
    ctx.restore();

    // Overhead Player Tag (Not mirrored)
    ctx.save();
    ctx.translate(px, py + walkBob);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(-35, -114, 70, 16);
    ctx.fillStyle = this.isLocal ? '#3498db' : '#ecf0f1';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.id.substring(0, 12), 0, -106);
    
    if (this.isChargingS2) {
      const chargeCount = this.s2ChargeCount || 0;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-30, -130, 60, 10);
      for (let i=0; i<3; i++) {
        if (i < chargeCount) {
          ctx.fillStyle = '#ffd700';
          ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 5;
        } else {
          ctx.fillStyle = '#555';
          ctx.shadowBlur = 0;
        }
        ctx.fillRect(-27 + i*19, -128, 16, 6);
      }
      ctx.shadowBlur = 0;
    }
    
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}
