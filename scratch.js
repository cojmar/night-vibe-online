const fs = require('fs');
let code = fs.readFileSync('app/game.js', 'utf8');

// Replace all instances of `this.projectiles.push(new Projectile(` with `this.spawnProjectile(`
code = code.replace(/this\.projectiles\.push\(new Projectile\(/g, 'this.spawnProjectile(');

// Add the spawnProjectile method
const methodStr = `
  spawnProjectile(props, broadcast = true) {
    if (!props.ownerId && this.net && this.net.me && this.net.me.info) {
      props.ownerId = this.net.me.info.user;
    }
    if (!props.id) {
      props.id = (props.ownerId || 'sys') + '_' + Math.random().toString(36).substr(2, 9);
    }
    this.projectiles.push(new Projectile(props));
    if (broadcast && this.net) {
      // Need to clean trailPositions out of the broadcasted props so we don't send garbage over network
      let cleanProps = { ...props };
      if (cleanProps.trailPositions) cleanProps.trailPositions = [];
      this.net.send_cmd('set_data', { spawnedProjectile: cleanProps });
    }
  }

  spawnDamageParticles(x, y) {`;

code = code.replace('  spawnDamageParticles(x, y) {', methodStr);

// Remove projectiles from broadcastState
code = code.replace(/\n\s*projectiles:\s*this\.projectiles\.map[^\}]+\}\)\)/s, '');

// Remove the comma before projectiles if it got left behind... actually let's just use regex safely
// Or we can just use a simpler replace:
code = code.replace(/,\s*projectiles:\s*this\.projectiles\.map\([^]+?\}\)\)/m, '');

// Remove rendering of otherPlayers projectiles
code = code.replace(/if\s*\(p\.projectiles\)\s*\{\s*for\s*\(let\s+projData\s+of\s+p\.projectiles\)\s*\{\s*Projectile\.prototype\.draw\.call\(projData,\s*ctx\);\s*\}\s*\}/g, '');

fs.writeFileSync('app/game.js', code);
console.log('Modifications applied.');
