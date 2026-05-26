const fs = require('fs');
let code = fs.readFileSync('app/game.js', 'utf8');

// Replace the Psionic Slash projectile creation in `game.js`
const oldLine = "this.spawnProjectile({ type: 'slash', originX: this.player.x, originY: weaponY, life: 20, maxLife: 20, color: cd.s1Color || '#e74c3c', radius: 60 * mgScale * lvlScale, hitInner: 0, hitOuter: 80 * mgScale * lvlScale, damage: this.player.atk * 1.1, critChance: 0.12, ...projProps });";
const newLine = "this.spawnProjectile({ type: 'psionic_slash', x: this.player.x, y: weaponY, vx: Math.cos(aimAngle) * 9, vy: Math.sin(aimAngle) * 9, angle: aimAngle, speed: 9, life: 30, maxLife: 30, color: cd.s1Color || '#e74c3c', radius: 45 * mgScale * lvlScale, damage: this.player.atk * 1.1, critChance: 0.12, ...projProps });";

code = code.replace(oldLine, newLine);
fs.writeFileSync('app/game.js', code);
console.log('Done game.js');
