const fs = require('fs');
let code = fs.readFileSync('app/projectile.js', 'utf8');

// 1. Update constructor
code = code.replace(/this\.type === 'bolt' \|\| this\.type === 'fireball' \|\| this\.type === 'arrow'/g, "this.type === 'bolt' || this.type === 'fireball' || this.type === 'arrow' || this.type === 'psionic_slash'");

// 2. Add update logic
const updateCode = `
    else if (this.type === 'psionic_slash') {
      if (this.vx !== undefined) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
      }
      this.traveled = (this.traveled || 0) + this.speed * dt;
      this.currentRadius = (this.radius || 40) + this.traveled * 0.5;

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
    else if (this.type === 'bolt'`;

code = code.replace(/else if \(this\.type === 'bolt'/g, updateCode.trim());

// 3. Add draw logic
const drawCode = `
    else if (this.type === 'psionic_slash') {
      const rot = this.angle;
      const alpha = Math.min(1, this.life / (this.maxLife * 0.3));
      const currentRadius = (this.radius || 40) + (this.traveled || 0) * 0.5;
      
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(rot);
      
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 4 + currentRadius * 0.1;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 15;
      
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
    else if (this.type === 'fireball') {`;

code = code.replace(/else if \(this\.type === 'fireball'\) \{/g, drawCode.trim());

fs.writeFileSync('app/projectile.js', code);
console.log('Done projectile.js');
