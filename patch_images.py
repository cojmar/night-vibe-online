import re

# 1. Patch enemy.js
with open('app/enemy.js', 'r') as f:
    enemy_code = f.read()

enemy_draw_logic = """
    if (this.icon && (this.icon.startsWith('http') || this.icon.startsWith('data:'))) {
        if (!this.img) {
            this.img = new Image();
            this.img.src = this.icon;
        }
        if (this.img.complete) {
            ctx.drawImage(this.img, this.x - this.size, drawY - this.size, this.size * 2, this.size * 2);
        }
    } else {
        ctx.font = `${this.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.icon, this.x, drawY);
        ctx.textBaseline = 'alphabetic';
    }
"""

# Replace the existing text fill logic
enemy_code = re.sub(
    r"ctx\.font = `\$\{this\.size\}px serif`;\s*ctx\.textAlign = 'center';\s*ctx\.textBaseline = 'middle';\s*ctx\.fillText\(this\.icon, this\.x, drawY\);[\s\S]*?ctx\.textBaseline = 'alphabetic';",
    enemy_draw_logic + "\n    if (this.name === 'BOSS') {\n        const originalFont = ctx.font;\n        ctx.font = `${Math.floor(this.size * 0.7)}px sans-serif`;\n        ctx.fillText('👑', this.x, drawY - this.size * 0.75);\n        ctx.font = originalFont;\n    }",
    enemy_code
)

with open('app/enemy.js', 'w') as f:
    f.write(enemy_code)

# 2. Patch ui.js (for Player rendering in UI, wait, player is drawn in game.js?)
# Let's check game.js for player rendering.
with open('app/game.js', 'r') as f:
    game_code = f.read()

player_draw_logic = """
    if (icon && (icon.startsWith('http') || icon.startsWith('data:'))) {
        if (!p.img || p.img.src !== icon) {
            p.img = new Image();
            p.img.src = icon;
        }
        if (p.img.complete) {
            ctx.drawImage(p.img, p.x - drawSize, drawY - drawSize, drawSize * 2, drawSize * 2);
        }
    } else {
        ctx.font = `${drawSize}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(icon, p.x, drawY);
        ctx.textBaseline = 'alphabetic';
    }
"""

game_code = re.sub(
    r"ctx\.font = `\$\{drawSize\}px serif`;\s*ctx\.textAlign = 'center';\s*ctx\.textBaseline = 'middle';\s*ctx\.fillText\(icon, p\.x, drawY\);\s*ctx\.textBaseline = 'alphabetic';",
    player_draw_logic,
    game_code
)

with open('app/game.js', 'w') as f:
    f.write(game_code)

