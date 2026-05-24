import { ENEMY_TYPES, ENV_CONFIG, getGroundY, DEAD_BODY_LIFETIME, PRNG, ENEMY_SCALE_WAVE_MULT, ENEMY_SCALE_LVL_MULT, REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, BOSS_BASE_HP, BOSS_BASE_ATK, BOSS_BASE_SPEED, BOSS_BASE_SIZE, BOSS_BASE_COLOR, BOSS_ATTACK_COOLDOWN, ENEMY_ATTACK_COOLDOWN_BASE, ENEMY_ATTACK_COOLDOWN_RAND, ENEMY_SKY_SPEED_MULTIPLIER, BOSS_PROJECTILE_SPEED, BOSS_PROJECTILE_HOMING, BOSS_LASER_CHANNEL_TIME, BOSS_LASER_DAMAGE_INTERVAL, BOSS_LASER_DAMAGE_PER_SEC, BOSS_LASER_DAMAGE_LEVEL_SCALE, BOSS_PROJECTILE_LIFETIME, getCachedImage } from './utils.js';

export default class Enemy {
  constructor(gameInstance, isBoss = false, isClient = false, spawnIndex = 0) {
    this.game = gameInstance;
    if (isClient) {
       this.id = ''; this.serverX = 0; this.serverY = 0;
       this.alive = true; this.hitFlash = 0;
       return;
    }
    
    // Deterministic random generation per enemy
    const localPrng = new PRNG((gameInstance.prng ? gameInstance.prng.seed : 1) + spawnIndex * 1337);
    this.id = 'E_' + gameInstance.wave + '_' + spawnIndex;
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
    
    if (isBoss) {
      this.isBoss = true;
      const available = ENEMY_TYPES.slice(0, Math.min(2 + Math.floor(wave/2), ENEMY_TYPES.length));
      const baseMonster = available[available.length - 1]; // Pick strongest current monster
      this.name = 'BOSS';
      this.level = Math.ceil(wave);
      this.icon = baseMonster.icon;
      this.hp = Math.round(BOSS_BASE_HP * scale);
      this.maxHp = this.hp;
      this.atk = Math.round(BOSS_BASE_ATK * scale);
      this.speed = BOSS_BASE_SPEED;
      this.size = BOSS_BASE_SIZE * Math.min(1 + (wave - 1) * 0.1, 4.0); // Scale massively with waves (up to 4x)
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
      const available = ENEMY_TYPES.slice(0, Math.min(2 + Math.floor(wave/2), ENEMY_TYPES.length));
      const type = available[Math.floor(localPrng.nextFloat() * available.length)];
      this.name = type.name;
      this.icon = type.icon;
      this.hp = Math.round(type.hp * scale);
      this.maxHp = this.hp;
      this.atk = Math.round(type.atk * scale);
      this.speed = type.speed * (0.8 + localPrng.nextFloat() * 0.4);
      this.size = type.size;
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
    const safeMargin = Math.max(40, minDim * 0.12);
    const minDist = minDim * 0.25;
    
    // Consume PRNG exactly 3 times deterministically
    const roll = localPrng.nextFloat();
    const float1 = localPrng.nextFloat();
    const float2 = localPrng.nextFloat();
    
    let sx, sy;
    const aspectRatio = this.game.gameW / this.game.gameH;
    
    if (aspectRatio < 0.6) {
      if (roll < 0.5) {
        sx = safeMargin + float1 * (this.game.gameW - safeMargin * 2);
        sy = -30 - float2 * 40;
      } else {
        sx = safeMargin + float1 * (this.game.gameW - safeMargin * 2);
        sy = this.game.gameH + 30 + float2 * 40;
      }
    } else {
      if (roll < 0.45) {
        sx = safeMargin + float1 * (this.game.gameW - safeMargin * 2);
        sy = -30 - float2 * 40;
      } else if (roll < 0.7) {
        sx = -40 - float1 * 50;
        sy = safeMargin + float2 * (this.game.gameH - safeMargin * 2);
      } else {
        sx = this.game.gameW + 40 + float1 * 50;
        sy = safeMargin + float2 * (this.game.gameH - safeMargin * 2);
      }
    }
    
    // Mathematically offset coordinates away from player if too close
    const player = this.game.player;
    if (player) {
      const dx = sx - player.x;
      const dy = sy - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist < minDist) {
        const angle = dist > 0.01 ? Math.atan2(dy, dx) : (roll * Math.PI * 2);
        sx = player.x + Math.cos(angle) * (minDist + 30);
        sy = player.y + Math.sin(angle) * (minDist + 30);
      }
    }
    
    sy = Math.min(sy, groundY - 50);
    return { x: sx, y: sy };
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
            
            // Deal damage continuously every frame while player is standing inside the laser path
            const lx = this.x;
            const ly = this.y - this.size * 0.75; // Laser originates from the boss's crown
            const tx = this.targetLaserPos.x - lx;
            const ty = this.targetLaserPos.y - ly;
            const len = Math.hypot(tx, ty) || 1;
            const endX = lx + (tx / len) * 3000;
            const endY = ly + (ty / len) * 3000;
            
            const dps = BOSS_LASER_DAMAGE_PER_SEC + ((this.level || Math.ceil(this.game.wave) || 1) * BOSS_LASER_DAMAGE_LEVEL_SCALE);
            const damageThisFrame = dps * (dt * 16.67) / 1000;
            
            for (let p of players) {
                if (p.invulnerable || !p.alive) continue;
                const dx2 = endX - lx;
                const dy2 = endY - ly;
                const lenSq = dx2 * dx2 + dy2 * dy2;
                const t = Math.max(0, Math.min(1, ((p.x - lx) * dx2 + (p.y - ly) * dy2) / lenSq));
                const projX = lx + t * dx2;
                const projY = ly + t * dy2;
                
                // Collision radius is now exactly this.size * 0.125 + player radius
                if (Math.hypot(p.x - projX, p.y - projY) < this.size * 0.125 + (p.size || 15)) {
                    if (this.game.isHost) {
                        p.hp -= damageThisFrame;
                        if (p.hp <= 0) { p.hp = 0; p.alive = false; }
                    }
                }
            }
            
            if (this.bossLaserTimer <= 0) {
                this.bossState = 'IDLE';
            }
            return; // Don't move while firing
       }

       this.missileTimer = (this.missileTimer || 0) + dt;
       if (this.missileTimer > 150) { 
           this.missileTimer = 0;
           
           if (this.game.wave >= 2 && Math.random() < 0.4) {
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
    } else if (closestDist > 50) {
      this.x += (dx / closestDist) * this.speed * speedMultiplier * dt;
      this.y += (dy / closestDist) * this.speed * speedMultiplier * dt;
    }

    if (closestDist < 55) {
      this.attackTimer += dt;
      if (this.attackTimer >= this.attackCooldown) {
        this.attackTimer = 0;
        
        if (targetPlayer.isLocal) {
            this.game.dealDamageToPlayer(this.atk);
        } else {
            this.game.net.send_cmd('set_data', { enemyHitPlayer: { id: targetPlayer.id, dmg: this.atk } });
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
  }

  draw(ctx, groundY) {
    if (!this.alive) return;
    const now = Date.now();
    ctx.globalAlpha = 1;
    if (this.hitFlash > 0 && this.alive) ctx.globalAlpha *= 0.5 + Math.sin(this.hitFlash * 3) * 0.5;

    // Shadow
    const eDepth = Math.max(0, Math.min(1, (this.y - groundY) / (this.game.gameH - groundY)));
    const eShadowAlpha = 0.15 + eDepth * 0.2;
    const eShadowW = this.size * 0.7 + eDepth * this.size * 0.3;
    const eShadowH = this.size * 0.2 + eDepth * this.size * 0.15;
    ctx.fillStyle = `rgba(0,0,0,${eShadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + this.size * 0.4, eShadowW, eShadowH, 0, 0, Math.PI * 2);
    ctx.fill();

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

    if (this.name === 'BOSS') {
       if (this.bossState === 'CHANNELING_LASER') {
            ctx.strokeStyle = `rgba(255, 0, 0, ${0.2 + (1 - this.bossChannelTimer / BOSS_LASER_CHANNEL_TIME)})`;
            ctx.lineWidth = 2;
            ctx.setLineDash([15, 15]);
            ctx.beginPath();
            ctx.moveTo(this.x, drawY - this.size * 0.75); // Start at the crown 👑
            ctx.lineTo(this.targetLaserPos.x, this.targetLaserPos.y);
            ctx.stroke();
            ctx.setLineDash([]);
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

    ctx.font = `${this.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.icon && typeof this.icon === 'string' && (this.icon.startsWith('data:image/') || this.icon.startsWith('http'))) {
        const img = getCachedImage(this.icon);
        if (img) {
            ctx.drawImage(img, this.x - this.size / 2, drawY - this.size / 2, this.size, this.size);
        } else {
            ctx.fillText('👾', this.x, drawY);
        }
    } else {
        ctx.fillText(this.icon || '👾', this.x, drawY);
    }
    if (this.name === 'BOSS') {
        const originalFont = ctx.font;
        ctx.font = `${Math.floor(this.size * 0.7)}px sans-serif`;
        ctx.fillText('👑', this.x, drawY - this.size * 0.75);
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
