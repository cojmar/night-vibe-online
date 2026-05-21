import { ENEMY_TYPES, ENV_CONFIG, getGroundY, GAME_H, GAME_W, DEAD_BODY_LIFETIME, PRNG } from './utils.js';

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
    const scale = 1 + (wave - 1) * 0.15 + (avgLevel - 1) * 0.12;
    
    if (isBoss) {
      this.name = 'BOSS';
      this.icon = '👑';
      this.hp = Math.round(250 * scale);
      this.maxHp = this.hp;
      this.atk = Math.round(18 * scale);
      this.speed = 0.2;
      this.size = 48;
      this.color = '#8e44ad';
      this.x = GAME_W * 0.15 + localPrng.nextFloat() * GAME_W * 0.7;
      const groundY = getGroundY(gameInstance.selectedEnv);
      this.y = groundY - 48;
    } else {
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
    this.attackCooldown = isBoss ? 120 : 60 + Math.floor(localPrng.nextFloat() * 40);
  }

  getSafeSpawnPosition(localPrng) {
    const groundY = getGroundY(this.game.selectedEnv);
    const minDim = Math.min(GAME_W, GAME_H);
    const aspectRatio = GAME_W / GAME_H;
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
          sx = safeMargin + localPrng.nextFloat() * (GAME_W - safeMargin * 2);
          sy = -30 - localPrng.nextFloat() * 40;
        } else {
          sx = safeMargin + localPrng.nextFloat() * (GAME_W - safeMargin * 2);
          sy = GAME_H + 30 + localPrng.nextFloat() * 40;
        }
      } else {
        const roll = localPrng.nextFloat();
        if (roll < 0.45) {
          sx = safeMargin + localPrng.nextFloat() * (GAME_W - safeMargin * 2);
          sy = -30 - localPrng.nextFloat() * 40;
        } else if (roll < 0.7) {
          sx = -40 - localPrng.nextFloat() * 50;
          sy = safeMargin + localPrng.nextFloat() * (GAME_H - safeMargin * 2);
        } else {
          sx = GAME_W + 40 + localPrng.nextFloat() * 50;
          sy = safeMargin + localPrng.nextFloat() * (GAME_H - safeMargin * 2);
        }
      }
      
      if(!player) return {x: sx, y: sy};
      
      const dx = sx - player.x, dy = sy - player.y, dist = Math.hypot(dx, dy);
      if (dist > minDist) return { x: sx, y: sy };
      const angle = Math.atan2(dy, dx);
      sx += Math.cos(angle) * (minDist + 30);
      sy += Math.sin(angle) * (minDist + 30);
    }
    
    if(!player) return {x: GAME_W/2, y: groundY - 50};
    
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
      this.missileTimer = (this.missileTimer || 0) + dt;
      if (this.missileTimer > 150) { 
          this.missileTimer = 0;
          // Increment a custom missile index so IDs are unique
          this.missileIndex = (this.missileIndex || 0) + 1;
          let missile = new Enemy(this.game, false, false, this.missileIndex);
          missile.name = 'MISSILE';
          missile.icon = '🚀';
          missile.hp = Math.round(50 * (1 + (this.game.wave - 1) * 0.15));
          missile.maxHp = missile.hp;
          missile.atk = this.atk;
          missile.size = 20;
          missile.color = '#e74c3c';
          missile.x = this.x;
          missile.y = this.y - 20;
          missile.attackCooldown = 0;
          missile.id = 'M_' + this.id + '_' + this.missileIndex;
          
          if (targetPlayer) {
              const dx = targetPlayer.x - missile.x;
              const dy = targetPlayer.y - missile.y;
              const dist = Math.hypot(dx, dy) || 1;
              missile.vx = (dx / dist) * this.speed * 2.5; // faster than boss, no homing
              missile.vy = (dy / dist) * this.speed * 2.5;
          } else {
              missile.vx = 0; missile.vy = this.speed * 2.5;
          }
          this.game.enemies.push(missile);
      }
    }

    if (this.name === 'MISSILE') {
        // Missile just goes straight
        this.x += (this.vx || 0) * dt;
        this.y += (this.vy || 0) * dt;
        // Don't home in!
    } else if (closestDist > 50) {
      this.x += (dx / closestDist) * this.speed * dt;
      this.y += (dy / closestDist) * this.speed * dt;
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
        
        if (this.name === 'MISSILE') {
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
    let alpha = 1;
    if (!this.alive) {
        if (!this.deathTime || Date.now() - this.deathTime > 2000) return;
        const progress = (Date.now() - this.deathTime) / 2000;
        alpha = 1 - progress;
    }
    const now = Date.now();
    ctx.globalAlpha = alpha;
    if (this.hitFlash > 0 && this.alive) ctx.globalAlpha *= 0.5 + Math.sin(this.hitFlash * 3) * 0.5;

    // Shadow
    const eDepth = Math.max(0, Math.min(1, (this.y - groundY) / (GAME_H - groundY)));
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

    ctx.font = `${this.size}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, this.x, this.y);
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
