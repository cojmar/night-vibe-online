import { circleOverlapsCrescentArc, pointInSweepArc, GAME_W, GAME_H } from './utils.js';

export default class Projectile {
  constructor(props) {
    Object.assign(this, props);
    if (!this.hitIds) this.hitIds = new Set();
    
    // Default initialization based on type
    if (this.type === 'bolt' || this.type === 'fireball' || this.type === 'arrow') {
      if (this.vx === undefined && this.vy === undefined) {
        const a = Math.atan2(this.ty - this.y, this.tx - this.x);
        this.vx = Math.cos(a) * this.speed;
        this.vy = Math.sin(a) * this.speed;
      }
    }
  }

  update(dt, gameInstance) {
    this.life -= dt;
    
    if (this.type === 'shockwave') {
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      this.traveled += this.speed * dt;
      
      if (this.trailTimer > 1.5) {
        this.trailTimer = 0;
        this.trailPositions.push({ x: this.x, y: this.y, life: 20, maxLife: 20 });
        gameInstance.spawnParticles(this.x, this.y, this.color, 2, 2);
      }
      this.trailPositions = this.trailPositions.filter(t => t.life > 0);
      for (let t of this.trailPositions) t.life -= dt;
      
      for (let e of gameInstance.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        if (circleOverlapsCrescentArc(this.originX, this.originY, this.angle, this.traveled, e.x, e.y, e.size)) {
          gameInstance.dealDamage(e, this.damage, this.critChance);
          gameInstance.applyKnockback(e, this.angle, 50);
          this.hitIds.add(e);
          gameInstance.spawnParticles(e.x, e.y, this.color, 6, 3);
        }
      }
      
      if (this.traveled >= this.maxDistance ||
          this.x < -50 || this.x > GAME_W + 50 ||
          this.y < -50 || this.y > GAME_H + 50) {
        gameInstance.spawnParticles(this.x, this.y, this.color, 15, 5);
        this.life = 0;
      }
    }
    else if (this.type === 'slash') {
      for (let e of gameInstance.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        const dx = e.x - this.originX, dy = e.y - this.originY;
        const dist = Math.hypot(dx, dy);
        const hitInner = this.hitInner || 5;
        const hitOuter = this.radius || 140;
        const inHitbox = this.isKnockback ?
          (dist > hitInner && dist < hitOuter) :
          pointInSweepArc(this.originX, this.originY, this.angle, 0.55, hitInner, hitOuter, e.x, e.y);
        
        if (inHitbox) {
          gameInstance.dealDamage(e, this.damage, this.critChance);
          this.hitIds.add(e);
          if (this.isKnockback) gameInstance.applyKnockback(e, this.knockbackDir, this.knockback);
          gameInstance.spawnParticles(e.x, e.y, this.color, 6, 3);
        }
      }
      if (this.life <= this.maxLife * 0.3) { this.life = 0; }
    }
    else if (this.type === 'bolt' || this.type === 'fireball' || this.type === 'arrow') {
      if (this.vx !== undefined) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
      if (this.type === 'arrow') {
        this.angle = Math.atan2(this.vy || 0, this.vx || 1);
      }
      
      if (this.type === 'fireball') {
          this.trailTimer = (this.trailTimer || 0) + dt;
          if (this.trailTimer > 1.5) {
             this.trailTimer = 0;
             if (!this.trailPositions) this.trailPositions = [];
             this.trailPositions.push({ x: this.x, y: this.y, life: 15, maxLife: 15, radius: this.radius || 15 });
             gameInstance.spawnParticles(this.x, this.y, this.color, 2, 2);
          }
          if (this.trailPositions) {
             this.trailPositions = this.trailPositions.filter(t => t.life > 0);
             for (let t of this.trailPositions) t.life -= dt;
          }
      }
      
      if (Math.random() < 0.3) gameInstance.spawnParticles(this.x, this.y, this.color, 1, 1);
      
      for (let e of gameInstance.enemies) {
        if (!e.alive) continue;
        const projHitRadius = (this.type === 'arrow') ? 12 : (this.type === 'bolt' ? 10 : (this.radius || 15));
        if (Math.hypot(this.x - e.x, this.y - e.y) < e.size + projHitRadius) {
          gameInstance.dealDamage(e, this.damage, this.critChance);
          gameInstance.spawnParticles(this.x, this.y, this.color, 8, 4);
          if (this.type !== 'fireball') { this.life = 0; }
          break;
        }
      }
      if (this.x < -100 || this.x > GAME_W + 100 || this.y < -100 || this.y > GAME_H + 100) this.life = 0;
      
      if (this.type === 'fireball' && this.life <= 0) {
        const explosionRadius = (this.radius || 15) * 4;
        for (let e of gameInstance.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(this.x - e.x, this.y - e.y);
          if (d < explosionRadius) gameInstance.dealDamage(e, this.damage * (1 - d / explosionRadius), this.critChance);
        }
        gameInstance.spawnParticles(this.x, this.y, '#e67e22', 20, 6);
        gameInstance.spawnParticles(this.x, this.y, '#ffd700', 10, 4);
      }
    }
    else if (this.type === 'aoe_explosion') {
      for (let e of gameInstance.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(this.x - e.x, this.y - e.y);
        if (d < (this.radius || 100)) {
          gameInstance.dealDamage(e, this.damage * (1 - d / (this.radius * 2)), this.critChance);
        }
      }
    }
  }

  draw(ctx) {
    const alpha = Math.min(1, this.life / (this.maxLife * 0.3));
    ctx.globalAlpha = alpha;
    
    if (this.type === 'shockwave') {
      const rot = this.angle;
      const a1 = Math.PI / 4;
      const a2 = Math.PI * 1.75;
      const rx = 90; const ry = 30;
      const irx = rx * 0.75; const iry = ry * 0.75;
      
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(rot + Math.PI);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a1, a2);
      ctx.strokeStyle = this.color; ctx.lineWidth = 7;
      ctx.shadowColor = this.color; ctx.shadowBlur = 18; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, a1, a2);
      ctx.lineTo(irx * Math.cos(a2), iry * Math.sin(a2));
      ctx.ellipse(0, 0, irx, iry, 0, a2, a1, true); ctx.closePath();
      ctx.fillStyle = this.color;
      ctx.globalAlpha = alpha * 0.35; ctx.fill();
      ctx.beginPath(); ctx.ellipse(0, 0, irx, iry, 0, a1 + 0.1, a2 - 0.1);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.shadowBlur = 8; ctx.globalAlpha = alpha; ctx.stroke();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1; ctx.restore();
      
      for (let i = 0; i < this.trailPositions.length; i++) {
        const tp = this.trailPositions[i];
        const progress = tp.life / tp.maxLife;
        ctx.globalAlpha = progress * 0.2;
        ctx.save(); ctx.translate(tp.x, tp.y); ctx.rotate(rot + Math.PI);
        ctx.beginPath(); ctx.ellipse(0, 0, rx * progress, ry * progress, 0, a1, a2);
        ctx.strokeStyle = this.color; ctx.lineWidth = 3 * progress; ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = alpha;
    }
    else if (this.type === 'slash') {
      const arcRadius = this.radius || 70;
      const progress = 1 - (this.life / this.maxLife);
      const sweepAngle = progress * Math.PI * 0.7;
      ctx.strokeStyle = this.color; ctx.lineWidth = 3;
      ctx.shadowColor = this.color; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, arcRadius, this.angle - sweepAngle*0.5, this.angle + sweepAngle*0.5);
      ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.globalAlpha = alpha*0.5; ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, arcRadius-8, this.angle - sweepAngle*0.3, this.angle + sweepAngle*0.3);
      ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.shadowBlur = 5;
      const ep1X = this.originX+Math.cos(this.angle-sweepAngle*0.5)*arcRadius;
      const ep1Y = this.originY+Math.sin(this.angle-sweepAngle*0.5)*arcRadius;
      const ep2X = this.originX+Math.cos(this.angle+sweepAngle*0.5)*arcRadius;
      const ep2Y = this.originY+Math.sin(this.angle+sweepAngle*0.5)*arcRadius;
      ctx.beginPath(); ctx.arc(ep1X, ep1Y, 3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ep2X, ep2Y, 3, 0, Math.PI*2); ctx.fill();
      ctx.shadowBlur = 0;
    }
    else if (this.type === 'fireball') {
      if (this.trailPositions) {
        for (let t of this.trailPositions) {
           const prog = Math.max(0, t.life / t.maxLife);
           ctx.globalAlpha = alpha * prog * 0.6;
           ctx.fillStyle = this.color;
           ctx.beginPath(); ctx.arc(t.x, t.y, Math.max(0.1, t.radius * prog), 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.globalAlpha = alpha;
      const r = this.radius || 15;
      const grad = ctx.createRadialGradient(this.x, this.y, r * 0.2, this.x, this.y, r);
      grad.addColorStop(0, '#fff');
      grad.addColorStop(0.3, this.color);
      grad.addColorStop(1, 'rgba(230,126,34,0)');
      ctx.fillStyle = grad; ctx.beginPath();
      ctx.arc(this.x, this.y, r, 0, Math.PI*2); ctx.fill();
    }
    else if (this.type === 'bolt') {
      ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(this.x, this.y, 6, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(this.x-3, this.y); ctx.lineTo(this.x+3, this.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x, this.y-3); ctx.lineTo(this.x, this.y+3); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    else if (this.type === 'arrow') {
      const a = this.angle || Math.atan2(this.vy || 0, this.vx || 1);
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a);
      ctx.fillStyle = '#a07828'; ctx.fillRect(-12, -1.5, 24, 3);
      ctx.fillStyle = '#888'; ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(7, -4); ctx.lineTo(7, 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.color; ctx.beginPath();
      ctx.moveTo(-12, -1.5); ctx.lineTo(-16, -5);
      ctx.lineTo(-10, -1.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, 1.5); ctx.lineTo(-16, 5);
      ctx.lineTo(-10, 1.5); ctx.closePath(); ctx.fill();
      ctx.shadowColor = this.color; ctx.shadowBlur = 8;
      ctx.fillStyle = this.color;
      ctx.globalAlpha = alpha * 0.5;
      ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
      ctx.globalAlpha = alpha; ctx.shadowBlur = 0;
      ctx.restore();
    }
    else if (this.type === 'aoe_explosion') {
      const progress = 1 - this.life / this.maxLife;
      ctx.strokeStyle = this.color; ctx.lineWidth = 4 * (1 - progress);
      ctx.beginPath();
      ctx.arc(this.x, this.y - 40, progress * this.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = `rgba(255,215,0,${alpha * 0.2 * (1 - progress)})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y - 40, progress * this.radius, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
