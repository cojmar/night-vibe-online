const fs = require('fs');
let playerCode = fs.readFileSync('app/player.js', 'utf8');

const oldUpdateNet = `      if (this.input_data.s2ChargeCount !== undefined) this.s2ChargeCount = this.input_data.s2ChargeCount;`;
const newUpdateNet = `      if (this.input_data.s2ChargeCount !== undefined) {
        // Spawn charge particles locally when we receive a charge count increase from a remote player
        if (this.input_data.s2ChargeCount > (this.s2ChargeCount || 0) && typeof window !== 'undefined' && window.gameInstance) {
          window.gameInstance.spawnParticles(this.x, this.y - 40, '#ffd700', 15, 4);
        }
        this.s2ChargeCount = this.input_data.s2ChargeCount;
      }`;
playerCode = playerCode.replace(oldUpdateNet, newUpdateNet);

// Move Magic Gladiator charge particles to Player.updateMovement so both local and remote players get them
const newMovementLogic = `
    if (this.isChargingS2 && this.classType === 'magicgladiator' && Math.random() < 0.15 * dt) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 25;
      if (typeof window !== 'undefined' && window.gameInstance) {
        window.gameInstance.particles.push({
          x: this.x + Math.cos(angle) * dist,
          y: this.y - 40 + Math.sin(angle) * dist,
          vx: Math.cos(angle) * 0.3,
          vy: Math.sin(angle) * 0.3 - 0.5,
          life: 40, maxLife: 40, color: '#9b4dff', size: 3
        });
      }
    }
`;

// Insert it at the start of updateMovement
playerCode = playerCode.replace(/updateMovement\(dt, gameInstance\) \{/, "updateMovement(dt, gameInstance) {" + newMovementLogic);
fs.writeFileSync('app/player.js', playerCode);

let gameCode = fs.readFileSync('app/game.js', 'utf8');
// Remove magic gladiator particles from game.js
const oldMgParticles = `          // Magic Gladiator charge: spawn floating purple spirit particles
          if (this.player.classType === 'magicgladiator' && Math.random() < 0.15 * dt) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 20 + Math.random() * 25;
            this.particles.push({
              x: this.player.x + Math.cos(angle) * dist,
              y: this.player.y - 40 + Math.sin(angle) * dist,
              vx: Math.cos(angle) * 0.3,
              vy: Math.sin(angle) * 0.3 - 0.5,
              life: 40, maxLife: 40,
              color: cd.s2Color || '#9b4dff',
              size: 3
            });
          }`;
gameCode = gameCode.replace(oldMgParticles, "");
fs.writeFileSync('app/game.js', gameCode);

console.log('Fixed particle syncing');
