import { ENEMY_TYPES, ENV_CONFIG, getGroundY, DEAD_BODY_LIFETIME, PRNG, ENEMY_SCALE_WAVE_MULT, ENEMY_SCALE_LVL_MULT, ENEMY_SPEED_SCALE_LVL_MULT, REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, BOSS_BASE_HP, BOSS_BASE_ATK, BOSS_BASE_SPEED, BOSS_BASE_SIZE, BOSS_BASE_SIZE_MULT, BOSS_SIZE_WAVE_MULT, BOSS_BASE_COLOR, BOSS_ATTACK_COOLDOWN, ENEMY_ATTACK_COOLDOWN_BASE, ENEMY_ATTACK_COOLDOWN_RAND, ENEMY_SKY_SPEED_MULTIPLIER, BOSS_PROJECTILE_SPEED, BOSS_PROJECTILE_HOMING, BOSS_LASER_CHANNEL_TIME, BOSS_LASER_DAMAGE_INTERVAL, BOSS_LASER_DAMAGE_PER_SEC, BOSS_LASER_DAMAGE_LEVEL_SCALE, BOSS_PROJECTILE_LIFETIME, ENEMY_BASE_SIZE_MULT, ENEMY_SIZE_WAVE_MULT, getCachedImage } from './utils.js';

export default class Enemy {
  constructor(gameInstance, isBoss = false, isClient = false, spawnIndex = 0) {
    this.game = gameInstance;
    this.spawnIndex = spawnIndex;
    if (isClient) {
      this.id = ''; this.serverX = 0; this.serverY = 0;
      this.alive = true; this.hitFlash = 0; this.stunTimer = 0;
      return;
    }

    // Deterministic random generation per enemy
    const localPrng = new PRNG((gameInstance.prng ? gameInstance.prng.seed : 1) + spawnIndex * 1337);
    this.id = 'E_' + gameInstance.wave + '_' + spawnIndex;
    this.stunTimer = 0;
    const wave = gameInstance.wave;

    // Calculate average player level
    let totalLevel = 0;
    let playerCount = 0;
    if (this.game.player) { totalLevel += this.game.player.level || 1; playerCount++; }
    for (let key in this.game.otherPlayers) {
      let p = this.game.otherPlayers[key];
      if (p.inGame) { totalLevel += p.level || 1; playerCount++; }
    }
    const avgLevel = playerCount > 0 ? (totalLevel / playerCount) : 1;

    // Scale dynamically by Wave and Player Level
    const scale = 1 + (wave - 1) * ENEMY_SCALE_WAVE_MULT + (avgLevel - 1) * ENEMY_SCALE_LVL_MULT;
    const speedScale = 1 + (avgLevel - 1) * ENEMY_SPEED_SCALE_LVL_MULT;

    if (isBoss) {
      this.isBoss = true;
      const available = ENEMY_TYPES.slice(0, Math.min(2 + Math.floor(wave / 2), ENEMY_TYPES.length));
      const baseMonster = available[available.length - 1]; // Pick strongest current monster
      this.name = 'BOSS';
      this.level = Math.ceil(wave);
      this.icon = baseMonster.icon;
      this.hp = Math.round(BOSS_BASE_HP * scale);
      this.maxHp = this.hp;
      this.atk = Math.round(BOSS_BASE_ATK * scale);
      this.speed = BOSS_BASE_SPEED * speedScale;
      const exponentialBossSizeScale = Math.min(Math.pow(1 + (BOSS_SIZE_WAVE_MULT || 0), (wave - 1) + (avgLevel - 1) * 0.5), 4.0);
      this.size = BOSS_BASE_SIZE * (BOSS_BASE_SIZE_MULT || 1.0) * exponentialBossSizeScale;
      this.color = BOSS_BASE_COLOR;
      this.bossState = 'IDLE';

      const totalBosses = gameInstance.waveTotalEnemies > 0 ? gameInstance.waveTotalEnemies : 1;
      const spacing = this.game.gameW * 0.7 / totalBosses;
      const offsetX = this.game.gameW * 0.15 + (spacing / 2) + (spawnIndex * spacing);
      this.x = offsetX;

      const groundY = getGroundY(gameInstance.selectedEnv);
      this.y = groundY - this.size + (spawnIndex % 2 === 0 ? 0 : 20);
    } else {
      this.isBoss = false;
      const available = ENEMY_TYPES.slice(0, Math.min(2 + Math.floor(wave / 2), ENEMY_TYPES.length));
      const type = available[Math.floor(localPrng.nextFloat() * available.length)];
      this.name = type.name;
      this.icon = type.icon;
      this.hp = Math.round(type.hp * scale);
      this.maxHp = this.hp;
      this.atk = Math.round(type.atk * scale);
      this.speed = type.speed * speedScale * (0.8 + localPrng.nextFloat() * 0.4);
      const exponentialSizeScale = Math.min(Math.pow(1 + (ENEMY_SIZE_WAVE_MULT || 0), (wave - 1) + (avgLevel - 1) * 0.5), 4.0);
      this.size = type.size * (ENEMY_BASE_SIZE_MULT || 1.0) * exponentialSizeScale;
      this.color = type.color;

      const pos = this.getSafeSpawnPosition(localPrng);
      this.x = pos.x;
      this.y = pos.y;
    }

    this.alive = true;
    this.hitFlash = 0;
    this.attackTimer = 0;
    this.attackCooldown = isBoss ? BOSS_ATTACK_COOLDOWN : ENEMY_ATTACK_COOLDOWN_BASE + Math.floor(localPrng.nextFloat() * ENEMY_ATTACK_COOLDOWN_RAND);
  }

  getSafeSpawnPosition(localPrng) {
    const groundY = getGroundY(this.game.selectedEnv);
    const minDim = Math.min(this.game.gameW, this.game.gameH);
    const aspectRatio = this.game.gameW / this.game.gameH;
    const safeMargin = Math.max(40, minDim * 0.12);
    const minDist = minDim * 0.25;
    let attempts = 0;
    const player = this.game.player;

    while (attempts < 40) {
      attempts++;
      let sx, sy;
      if (aspectRatio < 0.6) {
        const edge = localPrng.nextFloat();
        if (edge < 0.5) {
          sx = safeMargin + localPrng.nextFloat() * (this.game.gameW - safeMargin * 2);
          sy = -30 - localPrng.nextFloat() * 40;
        } else {
          sx = safeMargin + localPrng.nextFloat() * (this.game.gameW - safeMargin * 2);
          sy = this.game.gameH + 30 + localPrng.nextFloat() * 40;
        }
      } else {
        const roll = localPrng.nextFloat();
        if (roll < 0.45) {
          sx = safeMargin + localPrng.nextFloat() * (this.game.gameW - safeMargin * 2);
          sy = -30 - localPrng.nextFloat() * 40;
        } else if (roll < 0.7) {
          sx = -40 - localPrng.nextFloat() * 50;
          sy = safeMargin + localPrng.nextFloat() * (this.game.gameH - safeMargin * 2);
        } else {
          sx = this.game.gameW + 40 + localPrng.nextFloat() * 50;
          sy = safeMargin + localPrng.nextFloat() * (this.game.gameH - safeMargin * 2);
        }
      }

      if (!player) return { x: sx, y: sy };

      const dx = sx - player.x, dy = sy - player.y, dist = Math.hypot(dx, dy);
      if (dist > minDist) return { x: sx, y: sy };
      const angle = Math.atan2(dy, dx);
      sx += Math.cos(angle) * (minDist + 30);
      sy += Math.sin(angle) * (minDist + 30);
    }

    if (!player) return { x: this.game.gameW / 2, y: groundY - 50 };

    return {
      x: player.x + (localPrng.nextFloat() < 0.5 ? -1 : 1) * (minDist + 50),
      y: Math.min(player.y - minDist * 0.6, groundY - 50)
    };
  }

  update(dt, players) {
    if (!this.alive) return;
    if (!players || players.length === 0) return;

    let closestDist = Infinity;
    let targetPlayer = null;
    for (let p of players) {
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const dist = Math.hypot(dx, dy);
      if (dist < closestDist) {
        closestDist = dist;
        targetPlayer = p;
      }
    }

    if (!targetPlayer) return;

    const dx = targetPlayer.x - this.x;
    const dy = targetPlayer.y - this.y;

    if (this.name === 'BOSS') {
      if (this.bossState === 'CHANNELING_LASER') {
        this.bossChannelTimer -= dt;
        if (this.bossChannelTimer <= 0) {
          this.bossState = 'FIRING_LASER';
          this.bossLaserTimer = 120; // Laser lasts 120 frames (2 seconds)
        }
        return; // Don't move while channeling
      } else if (this.bossState === 'FIRING_LASER') {
        this.bossLaserTimer -= dt;

        const lx = this.x;
        const ly = this.y - this.size * 0.75;
        const tx = this.targetLaserPos.x - lx;
        const ty = this.targetLaserPos.y - ly;
        const len = Math.hypot(tx, ty) || 1;
        const endX = lx + (tx / len) * 3000;
        const endY = ly + (ty / len) * 3000;

        const dps = BOSS_LASER_DAMAGE_PER_SEC + ((this.level || Math.ceil(this.game.wave) || 1) * BOSS_LASER_DAMAGE_LEVEL_SCALE);
        const damageThisFrame = dps * (dt * 16.67) / 1000;

        // Accumulate laser damage and emit player_hit in ticks (every attackCooldown frames)
        this.laserAccum = (this.laserAccum || 0) + damageThisFrame;
        for (let p of players) {
          if (p.invulnerable || !p.alive) continue;
          if (p.id !== this.game.net?.me?.info?.user) continue;
          const dx2 = endX - lx;
          const dy2 = endY - ly;
          const lenSq = dx2 * dx2 + dy2 * dy2;
          const t = Math.max(0, Math.min(1, ((p.x - lx) * dx2 + (p.y - ly) * dy2) / lenSq));
          const projX = lx + t * dx2;
          const projY = ly + t * dy2;

          if (Math.hypot(p.x - projX, p.y - projY) < this.size * 0.125 + (p.size || 15)) {
            this.laserPlayerInBeam = true;
          }
        }

        if (this.laserTimer === undefined) this.laserTimer = 0;
        this.laserTimer += dt;
        if (this.laserTimer >= this.attackCooldown && this.laserAccum > 0 && this.laserPlayerInBeam) {
          this.laserTimer = 0;
          const totalDmg = Math.round(this.laserAccum);
          this.laserAccum = 0;
          this.laserPlayerInBeam = false;
          if (this.game.net?.me?.info?.user) {
            this.game.networkSync.emitEvent('enemy_hit_player', { targetId: this.game.net.me.info.user, damage: totalDmg });
          }
        }
        if (!this.laserPlayerInBeam) this.laserAccum = 0;

        if (this.bossLaserTimer <= 0) {
          this.bossState = 'IDLE';
        }
        return; // Don't move while firing
      }

      this.missileTimer = (this.missileTimer || 0) + dt;
      if (this.missileTimer > 150) {
        this.missileTimer = 0;

        this._bossAction = (this._bossAction || 0) + 1;
        const gameTimeSec = Math.floor(this.game.globalTime || (Date.now() + (this.game._clockOffset || 0) - this.game.gameStartUTC) / 1000);
        const bossActionPrng = new PRNG(this.spawnIndex * 7777 + gameTimeSec * 1337);
        if (this.game.wave >= 2 && bossActionPrng.nextFloat() < 0.4) {
          this.bossState = 'CHANNELING_LASER';
          this.bossChannelTimer = BOSS_LASER_CHANNEL_TIME;
          this.targetLaserPos = { x: targetPlayer.x, y: targetPlayer.y };
        } else {
          this.missileIndex = (this.missileIndex || 0) + 1;
          let missile = new Enemy(this.game, false, false, this.missileIndex);
          missile.name = 'BOMB';
          missile.icon = '💣';
          missile.hp = Math.round(50 * (1 + (this.game.wave - 1) * 0.15));
          missile.maxHp = missile.hp;
          missile.atk = this.atk;
          missile.size = 20;
          missile.color = '#e74c3c';
          missile.x = this.x;
          missile.y = this.y - 20;
          missile.attackCooldown = 0;
          missile.id = 'M_' + this.id + '_' + this.missileIndex;
          missile.spawnTime = Date.now();
          missile.selfDmgTimer = 0;

          if (targetPlayer) {
            const dx = targetPlayer.x - missile.x;
            const dy = targetPlayer.y - missile.y;
            const dist = Math.hypot(dx, dy) || 1;
            missile.vx = (dx / dist) * BOSS_PROJECTILE_SPEED;
            missile.vy = (dy / dist) * BOSS_PROJECTILE_SPEED;
          } else {
            missile.vx = 0; missile.vy = BOSS_PROJECTILE_SPEED;
          }
          this.game.enemies.push(missile);
        }
      }
    }

    // Missile/BOMB self-detonation timer
    if ((this.name === 'MISSILE' || this.name === 'BOMB') && BOSS_PROJECTILE_LIFETIME > 0) {
      this.selfDmgTimer = (this.selfDmgTimer || 0) + dt * 16.67;
      if (this.selfDmgTimer >= BOSS_PROJECTILE_LIFETIME) {
        this.hp = 0;
        this.alive = false;
        this.deathTime = Date.now();
        this.dealtHit = true;
        this.game.spawnParticles(this.x, this.y, '#e74c3c', 15, 8);
        this.game.spawnParticles(this.x, this.y, '#f39c12', 10, 6);
        return;
      }
    }

    const groundY = getGroundY(this.game.selectedEnv);
    const speedMultiplier = (this.y < groundY) ? ENEMY_SKY_SPEED_MULTIPLIER : 1.0;

    if (this.name === 'MISSILE' || this.name === 'BOMB') {
      if (BOSS_PROJECTILE_HOMING && closestDist > 50) {
        const tx = targetPlayer.x - this.x;
        const ty = targetPlayer.y - this.y;
        const tdist = Math.hypot(tx, ty) || 1;
        const tvx = (tx / tdist) * BOSS_PROJECTILE_SPEED;
        const tvy = (ty / tdist) * BOSS_PROJECTILE_SPEED;
        this.vx = this.vx * 0.96 + tvx * 0.04;
        this.vy = this.vy * 0.96 + tvy * 0.04;
      }
      this.x += (this.vx || 0) * dt;
      this.y += (this.vy || 0) * dt;
      this.moveDirX = (this.vx || 0) < 0 ? -1 : 1;
    } else if (closestDist > 50) {
      this.x += (dx / closestDist) * this.speed * speedMultiplier * dt;
      this.y += (dy / closestDist) * this.speed * speedMultiplier * dt;
      this.moveDirX = dx < 0 ? -1 : 1;
    }

    if (closestDist < 55) {
      this.attackTimer += dt;
      if (this.attackTimer >= this.attackCooldown) {
        this.attackTimer = 0;

        if (targetPlayer.id === this.game.net.me.info.user) {
          this.game.networkSync.emitEvent('enemy_hit_player', { targetId: targetPlayer.id, damage: this.atk });
        }

        if (this.name === 'MISSILE' || this.name === 'BOMB') {
          this.hp = 0;
          this.alive = false;
          this.deathTime = Date.now();
          this.game.spawnParticles(this.x, this.y, '#e74c3c', 20, 5);
        }
      }
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
    if (this.stunTimer > 0) this.stunTimer -= dt;
  }

  draw(ctx, groundY) {
    if (!this.alive) return;
    const now = Date.now();
    ctx.globalAlpha = 1;
    if (this.hitFlash > 0 && this.alive) ctx.globalAlpha *= 0.5 + Math.sin(this.hitFlash * 3) * 0.5;

    if (this.y + this.size * 0.5 >= groundY) {
      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + this.size * 0.5 + 3.5, this.size * 0.6, this.size * 0.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Body
    ctx.fillStyle = this.hitFlash > 0 ? '#fff' : '#e74c3c';
    ctx.beginPath();
    ctx.arc(this.x - 6, this.y - 4, 3, 0, Math.PI * 2);
    ctx.arc(this.x + 6, this.y - 4, 3, 0, Math.PI * 2);
    ctx.fill();

    // Add smooth animation bobbing for moving monsters
    let drawY = this.y;
    if (this.alive && this.name !== 'MISSILE' && this.name !== 'BOMB' && this.bossState !== 'CHANNELING_LASER' && this.bossState !== 'FIRING_LASER') {
      const bounce = Math.sin(now / 120 + this.x * 0.05) * 3.5;
      drawY += bounce;
    }

    // Stun stars
    if (this.stunTimer > 0 && this.alive && this.name !== 'MISSILE' && this.name !== 'BOMB') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const starCount = 5;
      for (let i = 0; i < starCount; i++) {
        const angle = (now / 200 + i * Math.PI * 2 / starCount) % (Math.PI * 2);
        const dist = 14 + Math.sin(now / 100 + i * 1.5) * 4;
        const sx = this.x + Math.cos(angle) * dist;
        const sy = drawY - this.size * 0.6 + Math.sin(angle) * dist * 0.4 - 8;
        const size = 2.5 + Math.sin(now / 80 + i * 2) * 1;
        const alpha = Math.min(1, this.stunTimer / 15) * (0.5 + Math.sin(now / 60 + i) * 0.5);
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#fff';
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 3;
        
        // Draw 4-point star
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const sa = s * Math.PI / 4;
          const sr = s % 2 === 0 ? size : size * 0.35;
          const px = sx + Math.cos(sa - Math.PI / 2) * sr;
          const py = sy + Math.sin(sa - Math.PI / 2) * sr;
          s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    if (this.name === 'BOSS') {
      if (this.bossState === 'CHANNELING_LASER') {
        const progress = 1 - (this.bossChannelTimer / BOSS_LASER_CHANNEL_TIME);
        const startX = this.x;
        const startY = drawY - this.size * 0.75; // Start at the crown 👑
        const targetX = this.targetLaserPos.x;
        const targetY = this.targetLaserPos.y;

        // 1. Targeting Beam
        ctx.save();
        const beamAlpha = 0.1 + progress * 0.5;
        const beamPulse = Math.abs(Math.sin(now / 50));
        ctx.strokeStyle = `rgba(255, 50, 50, ${beamAlpha + beamPulse * 0.2})`;
        ctx.lineWidth = 1 + progress * 3;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 2 + progress * 4;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.restore();

        // 2. Targeting Reticle
        ctx.save();
        ctx.translate(targetX, targetY);
        ctx.rotate(now / 200 + progress * Math.PI * 4);
        const reticleSize = 30 - progress * 15;
        ctx.strokeStyle = `rgba(255, 0, 0, ${0.5 + progress * 0.5})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(0, 0, reticleSize, 0, Math.PI * 2);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-reticleSize - 5, 0);
        ctx.lineTo(reticleSize + 5, 0);
        ctx.moveTo(0, -reticleSize - 5);
        ctx.lineTo(0, reticleSize + 5);
        ctx.stroke();
        ctx.restore();

        // 3. Energy Orb (Crown)
        ctx.save();
        const orbSize = 5 + progress * 25 + Math.random() * 5;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8})`;
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 6 + progress * 10;
        ctx.beginPath();
        ctx.arc(startX, startY, orbSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#ffcccc';
        ctx.shadowBlur = 2;
        ctx.beginPath();
        ctx.arc(startX, startY, orbSize * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (this.bossState === 'FIRING_LASER') {
        const lx = this.x;
        const ly = drawY - this.size * 0.75; // Start at the crown 👑
        const tx = this.targetLaserPos.x - lx;
        const ty = this.targetLaserPos.y - ly;
        const len = Math.hypot(tx, ty) || 1;

        ctx.strokeStyle = 'red';
        ctx.lineWidth = this.size * 0.25; // Adjusted thickness (25% of body size)
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + (tx / len) * 3000, ly + (ty / len) * 3000);
        ctx.stroke();

        // Add a bright core to the laser 
        ctx.strokeStyle = 'white';
        ctx.lineWidth = this.size * 0.08; // Core thickness (approx. 1/3 of laser width)
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + (tx / len) * 3000, ly + (ty / len) * 3000);
        ctx.stroke();
      }
    }

    const flip = (this.moveDirX || 1) < 0;
    if (this.icon && typeof this.icon === 'string' && (this.icon.startsWith('data:image/') || this.icon.startsWith('http') || this.icon.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i))) {
      let img = flip ? getCachedFlippedImage(this.icon) : getCachedImage(this.icon);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (img) {
        ctx.drawImage(img, this.x - this.size / 2, drawY - this.size / 2, this.size, this.size);
      } else {
        ctx.font = `${this.size}px serif`;
        ctx.fillText('👾', this.x, drawY);
      }
    } else {
      ctx.save();
      ctx.translate(this.x, drawY);
      if (flip) {
        ctx.scale(-1, 1);
      }
      ctx.font = `${this.size}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.icon || '👾', 0, 0);
      ctx.restore();
    }
    if (this.name === 'BOSS') {
      const originalFont = ctx.font;
      let crownSize = Math.floor(this.size * 0.7);
      
      ctx.save(); // Save before applying shadows
      
      if (this.bossState === 'CHANNELING_LASER') {
        const glowPhase = Math.abs(Math.sin(now / 100));
        ctx.shadowColor = '#e74c3c';
        ctx.shadowBlur = 4 + glowPhase * 8;
        crownSize = Math.floor(this.size * 0.7) + glowPhase * 8;
      } else if (this.bossState === 'FIRING_LASER') {
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 10;
        crownSize = Math.floor(this.size * 0.85);
      }
      
      ctx.translate(this.x, drawY - this.size * 0.75);
      if (flip) {
        ctx.scale(-1, 1);
      }
      ctx.font = `${crownSize}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('👑', 0, 0);
      
      ctx.restore(); // Restores shadowBlur and shadowColor to defaults
      
      ctx.font = originalFont;
    }
    ctx.textBaseline = 'alphabetic';

    // HP Bar
    const displayHp = this.alive ? this.hp : 0;
    const hpRatio = Math.max(0, displayHp / this.maxHp);
    const barW = this.size * 2, barH = 4, barX = this.x - barW / 2, barY = this.y - this.size - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#2ecc71';
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.font = '9px sans-serif';
    ctx.fillStyle = '#ccc';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.name}${this.name === 'BOSS' ? ' 👑' : ''} Lv.${Math.ceil(this.game.wave)}`, this.x, barY - 4);

    ctx.globalAlpha = 1;
  }
}
