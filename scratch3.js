const fs = require('fs');
let code = fs.readFileSync('app/game.js', 'utf8');

// The original line ended with: `...projProps }));`
// After replacement it became: `...projProps }));` (but the opening was `this.spawnProjectile(`)
// So we just need to replace `}));` with `});` at the end of lines where `this.spawnProjectile` is called.
// Actually, it's safer to just replace `}));` with `});` only if it matches `this.spawnProjectile` on that line.
// But we can just use a regex for `this.spawnProjectile({ ... }));`

code = code.replace(/this\.spawnProjectile\(([\s\S]*?)\}\)\);/g, 'this.spawnProjectile($1});');

fs.writeFileSync('app/game.js', code);
console.log('Fixed syntax error.');
