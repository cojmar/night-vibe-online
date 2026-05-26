const fs = require('fs');
let code = fs.readFileSync('app/game.js', 'utf8');

const oldSetData = `        if (data.data.hitFlash !== undefined && data.data.hitFlash > oldHitFlash) {
          this.spawnDamageParticles(this.otherPlayers[data.user].x, this.otherPlayers[data.user].y);
        }`;

const newSetData = `        if (data.data.hitFlash !== undefined && data.data.hitFlash > oldHitFlash) {
          this.spawnDamageParticles(this.otherPlayers[data.user].x, this.otherPlayers[data.user].y);
        }

        // If the other player transitions to MENU or GAME_OVER, explicitly clear their local game state data
        // so they don't leave frozen projectiles/ghosts on our screen!
        if (data.data.state === 'MENU' || data.data.inGame === false) {
          this.otherPlayers[data.user].projectiles = [];
          this.otherPlayers[data.user].hp = 0; // Consider them inactive
        }
`;

code = code.replace(oldSetData, newSetData);
fs.writeFileSync('app/game.js', code);
console.log('Fixed sticky otherPlayers data');
