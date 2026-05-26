const fs = require('fs');

let gameCode = fs.readFileSync('app/game.js', 'utf8');

// In room.user_data, add requestSync handler for host
const reqSyncCode = `
        if (this.isHost && data.data.requestSync) {
          this.net.send_cmd('set_data', {
            syncProjectiles: this.projectiles.map(p => ({
              type: p.type, x: p.x, y: p.y, vx: p.vx, vy: p.vy, tx: p.tx, ty: p.ty,
              angle: p.angle, life: p.life, maxLife: p.maxLife, radius: p.radius, color: p.color,
              originX: p.originX, originY: p.originY, traveled: p.traveled, damage: p.damage,
              ownerId: p.ownerId, id: p.id, bodyScale: p.bodyScale, charges: p.charges,
              critChance: p.critChance, explodeRadius: p.explodeRadius, explodeDamage: p.explodeDamage
            }))
          });
        }
        
        if (data.data.spawnedProjectile) {`;

gameCode = gameCode.replace(/if \(data\.data\.spawnedProjectile\) \{/, reqSyncCode);

// In startGame, if hostFound is true, send requestSync
const startGameCode = `
    if (!hostFound) {
      this.isHost = true;
      this.ui.addLog('👑 You are the Host', 'reward');
      this.generateScenery();
      // Need to spawn enemies since we are starting fresh
      if (this.bossActive) {
        this.spawnBoss();
      } else {
        this.enemies = [];
        for (let i = 0; i < this.waveEnemiesToSpawn; i++) {
          this.spawnEnemy();
        }
      }
    } else {
      // If we joined an existing host, ask them to send us the current active projectiles
      if (this.net) {
        this.net.send_cmd('set_data', { requestSync: true });
      }
    }
`;

gameCode = gameCode.replace(/if \(\!hostFound\) \{\s*this\.isHost = true;\s*this\.ui\.addLog\('👑 You are the Host', 'reward'\);\s*this\.generateScenery\(\);\s*\/\/\s*Need to spawn enemies since we are starting fresh\s*if \(this\.bossActive\) \{\s*this\.spawnBoss\(\);\s*\} else \{\s*this\.enemies = \[\];\s*for \(let i = 0; i < this\.waveEnemiesToSpawn; i\+\+\) \{\s*this\.spawnEnemy\(\);\s*\}\s*\}\s*\}/, startGameCode);

fs.writeFileSync('app/game.js', gameCode);
console.log('Added requestSync');
