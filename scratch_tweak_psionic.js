const fs = require('fs');

// 1. Tweak game.js
let gameCode = fs.readFileSync('app/game.js', 'utf8');
// Tweak the mgScale to be much slower (0.002 instead of 0.005)
gameCode = gameCode.replace(/const mgScale = 1 \+ \(this\.player\.atk - cd\.atk\) \* 0\.005;/, "const mgScale = 1 + (this.player.atk - cd.atk) * 0.002;");

// Tweak the psionic_slash projectile spawn:
// original: speed: 9, life: 30, maxLife: 30, radius: 45 * mgScale
// new: speed: 10, life: 12, maxLife: 12, radius: 45 * mgScale
const oldSpawn = "this.spawnProjectile({ type: 'psionic_slash', x: this.player.x, y: weaponY, vx: Math.cos(aimAngle) * 9, vy: Math.sin(aimAngle) * 9, angle: aimAngle, speed: 9, life: 30, maxLife: 30, color: cd.s1Color || '#e74c3c', radius: 45 * mgScale * lvlScale, damage: this.player.atk * 1.1, critChance: 0.12, ...projProps });";
const newSpawn = "this.spawnProjectile({ type: 'psionic_slash', x: this.player.x, y: weaponY, vx: Math.cos(aimAngle) * 11, vy: Math.sin(aimAngle) * 11, angle: aimAngle, speed: 11, life: 12, maxLife: 12, color: cd.s1Color || '#e74c3c', radius: 45 * mgScale * lvlScale, damage: this.player.atk * 1.1, critChance: 0.12, ...projProps });";
gameCode = gameCode.replace(oldSpawn, newSpawn);
fs.writeFileSync('app/game.js', gameCode);


// 2. Tweak projectile.js
let projCode = fs.readFileSync('app/projectile.js', 'utf8');
// Decrease the radius growth from traveled * 0.5 to traveled * 0.25
projCode = projCode.replace(/this\.currentRadius = \(this\.radius \|\| 40\) \+ this\.traveled \* 0\.5;/g, "this.currentRadius = (this.radius || 40) + this.traveled * 0.25;");
projCode = projCode.replace(/const currentRadius = \(this\.radius \|\| 40\) \+ \(this\.traveled \|\| 0\) \* 0\.5;/g, "const currentRadius = (this.radius || 40) + (this.traveled || 0) * 0.25;");
fs.writeFileSync('app/projectile.js', projCode);

console.log('Tweaked psionic slash');
