import { ENEMY_TYPES, ENV_CONFIG, getGroundY, GAME_H, GAME_W, DEAD_BODY_LIFETIME } from './utils.js';

export default class Enemy {
  constructor(gameInstance, isBoss = false, isClient = false) {
    this.game = gameInstance;
    if (isClient) {
       this.id = ''; this.serverX = 0; this.serverY = 0;
       this.alive = true; this.hitFlash = 0;
       return;
    }
    this.id = this.game.prng.nextFloat().toString(36).substr(2, 9);
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
      this.x = GAME_W * 0.15 + this.game.prng.nextFloat() * GAME_W * 0.7;
      const groundY = getGroundY(gameInstance.selectedEnv);
      this.y = groundY - 48;
    } else {
      const available = ENEMY_TYPES.slice(0, Math.min(2 + Math.floor(wave/2), ENEMY_TYPES.length));
      const type = available[Math.floor(this.game.prng.nextFloat() * available.length)];
      this.name = type.name;
      this.icon = type.icon;
      this.hp = Math.round(type.hp * scale);
      this.maxHp = this.hp;
      this.atk = Math.round(type.atk * scale);
      this.speed = type.speed * (0.8 + this.game.prng.nextFloat() * 0.4);
      this.size = type.size;
      this.color = type.color;
      
      const pos = this.getSafeSpawnPosition();
      this.x = pos.x;
      this.y = pos.y;
    }

    this.alive = true;
    this.hitFlash = 0;
    this.attackTimer = 0;
    this.attackCooldown = isBoss ? 120 : 60 + Math.floor(this.game.prng.nextFloat() * 40);
  }

  getSafeSpawnPosition() {
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
        const edge = this.game.prng.nextFloat();
        if (edge < 0.5) {
          sx = safeMargin + this.game.prng.nextFloat() * (GAME_W - safeMargin * 2);
          sy = -30 - this.game.prng.nextFloat() * 40;
        } else {
          sx = safeMargin + this.game.prng.nextFloat() * (GAME_W - safeMargin * 2);
          sy = GAME_H + 30 + this.game.prng.nextFloat() * 40;
        }
      } else {
        const roll = this.game.prng.nextFloat();
        if (roll < 0.45) {
          sx = safeMargin + this.game.prng.nextFloat() * (GAME_W - safeMargin * 2);
          sy = -30 - this.game.prng.nextFloat() * 40;
        } else if (roll < 0.7) {
          sx = -40 - this.game.prng.nextFloat() * 50;
          sy = safeMargin + this.game.prng.nextFloat() * (GAME_H - safeMargin * 2);
        } else {
          sx = GAME_W + 40 + this.game.prng.nextFloat() * 50;
          sy = safeMargin + this.game.prng.nextFloat() * (GAME_H - safeMargin * 2);
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
      x: player.x + (this.game.prng.nextFloat() < 0.5 ? -1 : 1) * (minDist + 50),
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

    if (closestDist > 50) {
      this.x += (dx / closestDist) * this.speed * dt;
      this.y += (dy / closestDist) * this.speed * dt;
    }
    
    const depthTop = GAME_H * 0.55;
    if (this.y < depthTop) this.y = depthTop;
    if (this.y > GAME_H - 10) this.y = GAME_H - 10;

    if (closestDist < 55) {
      this.attackTimer += dt;
      if (this.attackTimer >= this.attackCooldown) {
        this.attackTimer = 0;
        
        if (targetPlayer.isLocal) {
            this.game.dealDamageToPlayer(this.atk);
        } else {
            this.game.net.send_cmd('set_data', { enemyHitPlayer: { id: targetPlayer.id, dmg: this.atk } });
        }
      }
    }
    if (this.hitFlash > 0) this.hitFlash -= dt;
  }

  draw(ctx, groundY) {
    const now = Date.now();
    if (!this.alive && this.deathTime) {
      const timeSinceDeath = now - this.deathTime;
      const fadeOut = Math.max(0, 1 - timeSinceDeath / DEAD_BODY_LIFETIME);
      ctx.globalAlpha = 0.35 * fadeOut;
    } else {
      ctx.globalAlpha = 1;
      if (this.hitFlash > 0) ctx.globalAlpha *= 0.5 + Math.sin(this.hitFlash * 3) * 0.5;
    }

    // Shadow
    const eDepth = Math.max(0, Math.min(1, (this.y - groundY) / (GAME_H - groundY)));
    const eShadowAlpha = 0.15 + eDepth * 0.2;
    const eShadowW = this.size * 0.7 + eDepth * this.size * 0.3;
    const eShadowH = this.size * 0.2 + eDepth * this.size * 0.15;
    ctx.fillStyle = `rgba(0,0,0,${eShadowAlpha})`;
    ctx.beginPath();
    ctx.ellipse(this.x, groundY, eShadowW, eShadowH, 0, 0, Math.PI * 2);
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
