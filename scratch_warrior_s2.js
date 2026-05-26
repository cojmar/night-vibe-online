const fs = require('fs');
let code = fs.readFileSync('app/game.js', 'utf8');

const oldWarriorS2 = `    if (skillType === 'Sword Slash' || this.player.classType === 'warrior') {
      const waveCount = 1 + charges;
      const spdDiff = Math.max(0, this.player.spd - cd.spd);
      const waveDistance = Math.min(this.gameW * 0.25, (120 + spdDiff * 6) * areaMulti);
      const waveSpread = 0.12 + (aoeScale - 1) * 0.08;`;

const newWarriorS2 = `    if (skillType === 'Sword Slash' || this.player.classType === 'warrior') {
      const effectiveSpd = Math.min(200, this.player.spd);
      const spdDiff = Math.max(0, effectiveSpd - cd.spd);
      const baseWaveCount = 1 + charges;
      // We limit effective SPD to 200. At 200 SPD, spdDiff is around 150.
      // We want about 30 waves total, so ~28 extra waves from SPD.
      // 150 / 5.3 ~ 28. Let's use spdDiff / 5.
      const waveCount = Math.min(30, baseWaveCount + Math.floor(spdDiff / 5));
      const waveDistance = Math.min(this.gameW * 0.25, (120 + spdDiff * 6) * areaMulti);
      // Ensure the spread doesn't overlap excessively or shoot too densely
      const waveSpread = Math.min(0.25, (Math.PI * 2) / Math.max(1, waveCount));`;

code = code.replace(oldWarriorS2, newWarriorS2);

fs.writeFileSync('app/game.js', code);
console.log('Fixed Warrior S2');
