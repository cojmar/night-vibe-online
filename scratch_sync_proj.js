const fs = require('fs');
let code = fs.readFileSync('app/game.js', 'utf8');

const oldBroadcastProj = `      if (this.projectiles && this.projectiles.length > 0) {
        data.syncProjectiles = this.projectiles.map(p => ({
          id: p.id, type: p.type, x: p.x, y: p.y, speed: p.speed, life: p.life, maxLife: p.maxLife, color: p.color, damage: p.damage, critChance: p.critChance, maxDistance: p.maxDistance, radius: p.radius, traveled: p.traveled, angle: p.angle, charges: p.charges, originX: p.originX, originY: p.originY
        }));
      }`;

const newBroadcastProj = `      // Always send the projectiles array so other clients know when to clear them
      data.syncProjectiles = (this.projectiles || []).map(p => ({
        id: p.id, type: p.type, x: p.x, y: p.y, speed: p.speed, life: p.life, maxLife: p.maxLife, color: p.color, damage: p.damage, critChance: p.critChance, maxDistance: p.maxDistance, radius: p.radius, traveled: p.traveled, angle: p.angle, charges: p.charges, originX: p.originX, originY: p.originY
      }));`;

code = code.replace(oldBroadcastProj, newBroadcastProj);
fs.writeFileSync('app/game.js', code);
console.log('Fixed projectile syncing empty array');
