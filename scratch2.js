const fs = require('fs');
let code = fs.readFileSync('app/projectile.js', 'utf8');

// We want to replace `gameInstance.dealDamage(e, ...)`
// with `if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) { gameInstance.dealDamage(e, ...); }`

// Let's replace `gameInstance.dealDamage(`
code = code.replace(/gameInstance\.dealDamage\(/g, 
  "if (!this.ownerId || (gameInstance.net && gameInstance.net.me && this.ownerId === gameInstance.net.me.info.user)) gameInstance.dealDamage("
);

fs.writeFileSync('app/projectile.js', code);
console.log('Projectile update applied.');
