import { circleOverlapsCrescentArc, pointInSweepArc, PROJ_HIT_RADIUS_ARROW, PROJ_HIT_RADIUS_BOLT, PROJ_HIT_RADIUS_DEFAULT } from './utils.js';

export default class Projectile {
  constructor(props) {
    Object.assign(this, props);
    if (!this.hitIds) this.hitIds = new Set();
    
    // Default initialization based on type
    if (this.type === 'bolt' || this.type === 'fireball' || this.type === 'arrow' || this.type === 'psionic_slash') {
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
      }
      for (let i = this.trailPositions.length - 1; i >= 0; i--) { if (this.trailPositions[i].life <= 0) this.trailPositions.splice(i, 1); }
      for (let t of this.trailPositions) t.life -= dt;
      
      for (let e of gameInstance.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        const pLifeHit = 1 - (this.life / this.maxLife);
        const scaleHit = Math.min(3.0, (this.radius || 30) / 30);
        const rx = (30 + pLifeHit * 30) * scaleHit + e.size; 
        const ry = (60 + pLifeHit * 70) * scaleHit + e.size; 
        const sweepHalf = Math.min(Math.PI, Math.PI * 0.4 + (this.charges || 0) * 0.15);
        
        const dx = e.x - this.x, dy = e.y - this.y;
        const cosA = Math.cos(-this.angle), sinA = Math.sin(-this.angle);
        const localX = dx * cosA - dy * sinA;
        const localY = dx * sinA + dy * cosA;
        
        // Outer ellipse check
        const inOuter = (localX * localX) / (rx * rx) + (localY * localY) / (ry * ry) <= 1;
        // Inner ellipse check (with inner shift -8)
        const inrx = (rx - e.size) * 0.8 - e.size;
        const inry = (ry - e.size) * 0.85 - e.size;
        const inInner = inrx > 0 && inry > 0 ? ((localX + 8) * (localX + 8)) / (inrx * inrx) + (localY * localY) / (inry * inry) < 1 : false;
        // Angle check
        const inAngle = Math.abs(Math.atan2(localY, localX)) <= sweepHalf;
        
        if (inOuter && !inInner && inAngle) {
          if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage, this.critChance);
          gameInstance.applyKnockback(e, this.angle, 50);
          this.hitIds.add(e);
        }
      }
      
      if (this.traveled >= this.maxDistance ||
          this.x < -50 || this.x > gameInstance.gameW + 50 ||
          this.y < -50 || this.y > gameInstance.gameH + 50) {
        this.life = 0;
      }
    }
    else if (this.type === 'slash') {
      for (let e of gameInstance.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        const dx = e.x - this.originX, dy = e.y - this.originY;
        const dist = Math.hypot(dx, dy);
        const hitInner = this.hitInner !== undefined ? this.hitInner : 5;
        const hitOuter = this.hitOuter || (this.radius || 140);
        const inHitbox = this.isKnockback ?
          (dist > hitInner && dist < hitOuter) :
          pointInSweepArc(this.originX, this.originY, this.angle, 0.55, hitInner, hitOuter, e.x, e.y);
        
        if (inHitbox) {
          if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage, this.critChance);
          this.hitIds.add(e);
          // Only apply stun/knockback if enemy is not already stunned or in cooldown
          if (e.stunTimer <= 0 && e.stunCooldown <= 0) {
            if (this.isKnockback) {
              const stunFrames = Math.floor(this.damage / 300 * 60 * 1.15);
              if (stunFrames > e.stunTimer) {
                e.stunTimer = stunFrames;
                e._stunDuration = stunFrames;
              }
              if (e.attackTimer !== undefined) e.attackTimer = Math.max(e.attackTimer, 30);
              e.x += e.x > this.originX ? 8 : -8;
              e.x = Math.max(e.size, Math.min(gameInstance.gameW - e.size, e.x));
            } else {
              e.stunTimer = Math.max(e.stunTimer, 12);
            }
          }
          gameInstance.spawnParticles(e.x, e.y, this.color, 6, 3);
          // Star burst particles on hit
          for (let i = 0; i < 5; i++) {
            const a = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 2.5;
            gameInstance.spawnParticles(e.x, e.y - 10, i % 2 === 0 ? '#ffd700' : '#fff', 1, speed, 1.5);
          }
        }
      }
      if (this.life <= this.maxLife * 0.3) { this.life = 0; }
    }
    else if (this.type === 'psionic_slash') {
      if (this.vx !== undefined) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
      this.traveled = (this.traveled || 0) + this.speed * dt;
      this.currentRadius = (this.radius || 40) + this.traveled * 0.25;

      for (let e of gameInstance.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        const hitX = this.x + Math.cos(this.angle) * this.currentRadius * 0.3;
        const hitY = this.y + Math.sin(this.angle) * this.currentRadius * 0.3;
        if (Math.hypot(hitX - e.x, hitY - e.y) < e.size + this.currentRadius * 0.6) {
          if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage, this.critChance);
          this.hitIds.add(e);
          gameInstance.spawnParticles(e.x, e.y, this.color, 6, 3);
        }
      }
      
      if (this.life <= 0 || this.x < -100 || this.x > gameInstance.gameW + 100 || this.y < -100 || this.y > gameInstance.gameH + 100) this.life = 0;
    }
    else if (this.type === 'bolt' || this.type === 'fireball' || this.type === 'arrow' || this.type === 'psionic_slash') {
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
              for (let i = this.trailPositions.length - 1; i >= 0; i--) { if (this.trailPositions[i].life <= 0) this.trailPositions.splice(i, 1); }
              for (let t of this.trailPositions) t.life -= dt;
          }
      }
      
      if (Math.random() < 0.3) gameInstance.spawnParticles(this.x, this.y, this.color, 1, 1);
      
      for (let e of gameInstance.enemies) {
        if (!e.alive) continue;
        if (e.name === 'MISSILE' || e.name === 'BOMB') continue;
        const projHitRadius = (this.type === 'arrow') ? PROJ_HIT_RADIUS_ARROW : (this.type === 'bolt' ? PROJ_HIT_RADIUS_BOLT : (this.radius || PROJ_HIT_RADIUS_DEFAULT));
        if (Math.hypot(this.x - e.x, this.y - e.y) < e.size + projHitRadius) {
          if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage, this.critChance);
          gameInstance.spawnParticles(this.x, this.y, this.color, 8, 4);
          if (this.type !== 'fireball') {
            if (this.type === 'arrow' && this.explodeRadius && this.explodeDamage) {
              for (let e2 of gameInstance.enemies) {
                if (!e2.alive) continue;
                if (e2.name === 'MISSILE' || e2.name === 'BOMB') continue;
                const d = Math.hypot(this.x - e2.x, this.y - e2.y);
                if (d < this.explodeRadius) if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e2, this.explodeDamage * (1 - d / (this.explodeRadius * 2)), this.critChance);
              }
              gameInstance.spawnParticles(this.x, this.y, this.color, 15, 5);
              gameInstance.spawnParticles(this.x, this.y, '#ffd700', 8, 3);
            }
            this.life = 0;
          }
          break;
        }
      }
      if (this.x < -100 || this.x > gameInstance.gameW + 100 || this.y < -100 || this.y > gameInstance.gameH + 100) this.life = 0;
      
      if (this.type === 'arrow' && this.life <= 0 && this.explodeRadius && this.explodeDamage) {
        for (let e of gameInstance.enemies) {
          if (!e.alive) continue;
          if (e.name === 'MISSILE' || e.name === 'BOMB') continue;
          const d = Math.hypot(this.x - e.x, this.y - e.y);
          if (d < this.explodeRadius) if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.explodeDamage * (1 - d / (this.explodeRadius * 2)), this.critChance);
        }
        gameInstance.spawnParticles(this.x, this.y, this.color, 15, 5);
        gameInstance.spawnParticles(this.x, this.y, '#ffd700', 8, 3);
      }
      
      if (this.type === 'fireball' && this.life <= 0) {
        const explosionRadius = (this.radius || 15) * 4;
        for (let e of gameInstance.enemies) {
          if (!e.alive) continue;
          if (e.name === 'MISSILE' || e.name === 'BOMB') continue;
          const d = Math.hypot(this.x - e.x, this.y - e.y);
          if (d < explosionRadius) if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage * (1 - d / explosionRadius), this.critChance);
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
          if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage * (1 - d / (this.radius * 2)), this.critChance);
        }
      }
    }
    else if (this.type === 'spirit') {
      // Retargeting with SPD scaling - uses caster's synced SPD
      const effectiveSpd = this.casterSpd ?? this.speed ?? 0;
      const retargetFrames = Math.max(0, Math.round(30 * (1 - Math.pow(effectiveSpd / 1000, 0.5))));
      this.retargetTimer = (this.retargetTimer || 0) + dt;
      if (this.retargetTimer >= retargetFrames) {
        this.retargetTimer = 0;
        let nearest = null;
        let nearDist = Infinity;
        const maxTargetRange = Math.hypot(gameInstance.gameW, gameInstance.gameH) * 20;
        for (let e of gameInstance.enemies) {
          if (!e.alive || this.hitIds.has(e)) continue;
          const d = Math.hypot(e.x - this.x, e.y - this.y);
          if (d < nearDist && d <= maxTargetRange) {
            nearDist = d;
            nearest = e;
          }
        }
        if (nearest) {
          const a = Math.atan2(nearest.y - this.y, nearest.x - this.x);
          this.vx = Math.cos(a) * this.speed;
          this.vy = Math.sin(a) * this.speed;
        }
      }

      // Wobbly movement
      this.wobble = (this.wobble || 0) + 0.25 * dt;
      this.x += (this.vx || 0) * dt + Math.sin(this.wobble) * 0.8 * dt;
      this.y += (this.vy || 0) * dt + Math.cos(this.wobble * 0.8) * 0.8 * dt;

      // Trail
      this.trailTimer = (this.trailTimer || 0) + dt;
      if (this.trailTimer > 1.0) {
        this.trailTimer = 0;
        if (!this.trailPositions) this.trailPositions = [];
        this.trailPositions.push({ x: this.x, y: this.y, life: 80, maxLife: 80 });
        gameInstance.spawnParticles(this.x, this.y, this.color || '#9b4dff', 1, 1.5);
      }
      if (this.trailPositions) {
        for (let i = this.trailPositions.length - 1; i >= 0; i--) { if (this.trailPositions[i].life <= 0) this.trailPositions.splice(i, 1); }
        for (let t of this.trailPositions) t.life -= dt;
      }

      // Collision with enemies
      for (let e of gameInstance.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        if (Math.hypot(this.x - e.x, this.y - e.y) < e.size + (this.radius || 10)) {
          if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage, this.critChance);
          this.hitIds.add(e);
          gameInstance.spawnParticles(this.x, this.y, this.color || '#9b4dff', 6, 3);
        }
      }

      // Lifetime / bounds
      if (this.life <= 0 || this.x < -200 || this.x > gameInstance.gameW + 200 || this.y < -200 || this.y > gameInstance.gameH + 200) {
        gameInstance.spawnParticles(this.x, this.y, this.color || '#9b4dff', 8, 3);
        this.life = 0;
      }
    }
  }

  draw(ctx) {
    const alpha = Math.min(1, this.life / (this.maxLife * 0.3));
    ctx.globalAlpha = alpha;
    
    if (this.type === 'shockwave') {
      const rot = this.angle;
      const charges = this.charges || 0;
      const pLife = 1 - (this.life / this.maxLife); // 0 at spawn, 1 at death
      
      const scale = Math.min(3.0, (this.radius || 30) / 30);
      const rx = (30 + pLife * 30) * scale; 
      const ry = (60 + pLife * 70) * scale; 
      
      const sweepHalf = Math.min(Math.PI, Math.PI * 0.4 + charges * 0.15);
      
      ctx.save(); 
      ctx.translate(this.x, this.y); 
      ctx.rotate(rot);
      
      // Increased transparency (lowered alpha from 0.85 to 0.5)
      ctx.globalAlpha = alpha * 0.5;
      
      ctx.shadowColor = this.color; 
      ctx.shadowBlur = 6;
      
      // Calculate endpoints of the arc for the crescent curve
      const tipXBottom = rx * Math.cos(sweepHalf);
      const tipYBottom = ry * Math.sin(sweepHalf);
      const tipXTop = rx * Math.cos(-sweepHalf);
      const tipYTop = ry * Math.sin(-sweepHalf);
      const cpX = -rx * 0.5; // Inner curve control point
      
      // 1. Draw the beautiful gradient crescent body
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, -sweepHalf, sweepHalf); // Outer curve
      ctx.quadraticCurveTo(cpX, 0, tipXTop, tipYTop);      // Inner curve
      ctx.closePath();
      
      const grad = ctx.createLinearGradient(cpX, 0, rx, 0);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      grad.addColorStop(0.5, this.color);
      grad.addColorStop(1, '#ffffff');
      
      ctx.fillStyle = grad;
      ctx.fill();
      
      // 2. Draw a sharp, bright leading edge
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, -sweepHalf, sweepHalf);
      ctx.strokeStyle = '#ffffff'; 
      ctx.lineWidth = Math.max(1, 4 - pLife * 2 + charges * 0.5);
      ctx.stroke();
      
      ctx.restore();
      
      // 3. Draw smooth trail crescents
      for (let i = 0; i < this.trailPositions.length; i++) {
        const tp = this.trailPositions[i];
        const tprog = tp.life / tp.maxLife;
        // Increased transparency for trails (0.4 -> 0.25)
        ctx.globalAlpha = alpha * tprog * 0.25;
        ctx.save(); 
        ctx.translate(tp.x, tp.y); 
        ctx.rotate(rot);
        
        const trx = rx * (0.7 + tprog * 0.3);
        const try_ = ry * (0.7 + tprog * 0.3);
        const tsweep = sweepHalf * 0.85;
        
        ctx.beginPath();
        ctx.ellipse(0, 0, trx, try_, 0, -tsweep, tsweep);
        ctx.quadraticCurveTo(-trx * 0.4, 0, trx * Math.cos(-tsweep), try_ * Math.sin(-tsweep));
        ctx.fillStyle = this.color;
        ctx.fill();
        
        ctx.restore();
      }
      ctx.globalAlpha = alpha;
    }
    else if (this.type === 'slash') {
      const arcRadius = this.radius || 70;
      const progress = 1 - (this.life / this.maxLife);
      const sweepAngle = progress * Math.PI * 0.7;
      
      // Outer glow arc
      ctx.globalAlpha = alpha * 0.3;
      ctx.strokeStyle = this.color; ctx.lineWidth = 12;
      ctx.shadowColor = this.color; ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, arcRadius, this.angle - sweepAngle*0.5, this.angle + sweepAngle*0.5);
      ctx.stroke();
      
      // Main arc
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.color; ctx.lineWidth = 4;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, arcRadius, this.angle - sweepAngle*0.5, this.angle + sweepAngle*0.5);
      ctx.stroke();
      
      // Inner highlight arc
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.globalAlpha = alpha * 0.7; ctx.shadowBlur = 2;
      ctx.beginPath();
      ctx.arc(this.originX, this.originY, arcRadius-8, this.angle - sweepAngle*0.3, this.angle + sweepAngle*0.3);
      ctx.stroke();
      
      // Stars along the arc
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = 4;
      const starCount = Math.floor(sweepAngle / 0.35);
      for (let i = 0; i < starCount; i++) {
        const a = this.angle - sweepAngle*0.5 + (i / Math.max(1, starCount-1)) * sweepAngle;
        const sx = this.originX + Math.cos(a) * arcRadius;
        const sy = this.originY + Math.sin(a) * arcRadius;
        const starSize = 2 + Math.sin(progress * 10 + i) * 1.5;
        
        ctx.fillStyle = i % 2 === 0 ? '#ffd700' : '#fff';
        ctx.shadowColor = ctx.fillStyle;
        
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(a);
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const sa = s * Math.PI / 4;
          const sr = s % 2 === 0 ? starSize : starSize * 0.3;
          const px = Math.cos(sa - Math.PI / 2) * sr;
          const py = Math.sin(sa - Math.PI / 2) * sr;
          s === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      
      // Endpoint stars
      ctx.fillStyle = '#ffd700'; ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 5;
      const ep1X = this.originX+Math.cos(this.angle-sweepAngle*0.5)*arcRadius;
      const ep1Y = this.originY+Math.sin(this.angle-sweepAngle*0.5)*arcRadius;
      const ep2X = this.originX+Math.cos(this.angle+sweepAngle*0.5)*arcRadius;
      const ep2Y = this.originY+Math.sin(this.angle+sweepAngle*0.5)*arcRadius;
      ctx.beginPath(); ctx.arc(ep1X, ep1Y, 4, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ep2X, ep2Y, 4, 0, Math.PI*2); ctx.fill();
      
      // Inner endpoint glow
      ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 3;
      ctx.beginPath(); ctx.arc(ep1X, ep1Y, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(ep2X, ep2Y, 2, 0, Math.PI*2); ctx.fill();
      
      ctx.shadowBlur = 0;
    }
    else if (this.type === 'psionic_slash') {
      const rot = this.angle;
      const alpha = Math.min(1, this.life / (this.maxLife * 0.3));
      const currentRadius = (this.radius || 40) + (this.traveled || 0) * 0.25;
      
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(rot);
      
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4 + currentRadius * 0.1;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.stroke();
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2 + currentRadius * 0.05;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius * 0.85, -Math.PI * 0.35, Math.PI * 0.35);
      ctx.stroke();
      
      ctx.fillStyle = this.color;
      ctx.globalAlpha = alpha * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, currentRadius, -Math.PI * 0.4, Math.PI * 0.4);
      ctx.lineTo(-currentRadius * 0.6, 0);
      ctx.fill();
      
      ctx.restore();
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
    else if (this.type === 'psionic_slash') {
      if (this.vx !== undefined) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
      this.traveled = (this.traveled || 0) + this.speed * dt;
      this.currentRadius = (this.radius || 40) + this.traveled * 0.25;

      for (let e of gameInstance.enemies) {
        if (!e.alive || this.hitIds.has(e)) continue;
        const hitX = this.x + Math.cos(this.angle) * this.currentRadius * 0.3;
        const hitY = this.y + Math.sin(this.angle) * this.currentRadius * 0.3;
        if (Math.hypot(hitX - e.x, hitY - e.y) < e.size + this.currentRadius * 0.6) {
          if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage(e, this.damage, this.critChance);
          this.hitIds.add(e);
          gameInstance.spawnParticles(e.x, e.y, this.color, 6, 3);
        }
      }
      
      if (this.life <= 0 || this.x < -100 || this.x > gameInstance.gameW + 100 || this.y < -100 || this.y > gameInstance.gameH + 100) this.life = 0;
    }
    else if (this.type === 'bolt') {
      const r = this.radius || 6;
      ctx.fillStyle = this.color; ctx.shadowColor = this.color; ctx.shadowBlur = Math.min(r * 0.5, 6);
      ctx.beginPath(); ctx.arc(this.x, this.y, r, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1, r/6);
      ctx.beginPath(); ctx.moveTo(this.x-r/2, this.y); ctx.lineTo(this.x+r/2, this.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(this.x, this.y-r/2); ctx.lineTo(this.x, this.y+r/2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    else if (this.type === 'arrow') {
      const a = this.angle || Math.atan2(this.vy || 0, this.vx || 1);
      const scale = (this.bodyScale || 1) * (this.radius || 12) / 12;
      ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(a); ctx.scale(scale, scale);
      ctx.fillStyle = '#a07828'; ctx.fillRect(-12, -1.5, 24, 3);
      ctx.fillStyle = '#888'; ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(7, -4); ctx.lineTo(7, 4);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = this.color; ctx.beginPath();
      ctx.moveTo(-12, -1.5); ctx.lineTo(-16, -5);
      ctx.lineTo(-10, -1.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-12, 1.5); ctx.lineTo(-16, 5);
      ctx.lineTo(-10, 1.5); ctx.closePath(); ctx.fill();
      ctx.shadowColor = this.color; ctx.shadowBlur = 3;
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
    else if (this.type === 'spirit') {
      const spiritSize = this.radius || 12;
      const sAlpha = Math.min(1, this.life / (this.maxLife * 0.3));

      // Calculate rotation angle based on velocity. The sprite is drawn facing "up" (-y),
      // so we add PI/2 to atan2 so that -y aligns with the velocity vector.
      const rotAngle = Math.atan2(this.vy || 0, this.vx || 0) + Math.PI / 2;

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = sAlpha;

      // Trail
      if (this.trailPositions && this.trailPositions.length > 0) {
        for (let t of this.trailPositions) {
          const tprog = Math.max(0, t.life / t.maxLife);
          ctx.globalAlpha = sAlpha * tprog * 0.35;
          ctx.fillStyle = this.color || '#9b4dff';
          ctx.beginPath();
          ctx.arc(t.x, t.y, spiritSize * tprog * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Outer glow
      ctx.globalAlpha = sAlpha;
      const glow = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, spiritSize * 2);
      glow.addColorStop(0, 'rgba(255,255,255,0.9)');
      glow.addColorStop(0.25, 'rgba(170,120,255,0.9)');
      glow.addColorStop(1, 'rgba(100,0,255,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(this.x, this.y, spiritSize * 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Skull body (non-additive, drawn normally on top)
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(rotAngle);
      ctx.globalAlpha = sAlpha;
      
      ctx.fillStyle = '#e0dcff';
      ctx.beginPath();
      ctx.arc(0, 0, spiritSize, 0, Math.PI * 2);
      ctx.fill();

      // Eyes
      ctx.fillStyle = '#111';
      ctx.fillRect(-4, -2, 2, 2);
      ctx.fillRect(2, -2, 2, 2);

      // Mouth
      ctx.fillRect(-2, 3, 4, 2);

      // Spirit tail
      ctx.fillStyle = this.color || '#9b4dff';
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(6, 6);
      ctx.lineTo(0, 26); // Doubled length (from 16 to 26)
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
}
