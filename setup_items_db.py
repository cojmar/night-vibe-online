import re

# 1. Patch config.js
with open('app/config.js', 'r') as f:
    config = f.read()

# Add to FALLBACK_DEFAULTS
items_db_json = "[\n    { name: 'Excalibur', icon: '🗡️', gearType: 'Weapon', stats: { atk: 10, spd: 1 }, rarity: 'rare', color: '#f1c40f' },\n    { name: 'Dragon Mail', icon: '🛡️', gearType: 'Armor', stats: { maxHp: 100, atk: 2 }, rarity: 'rare', color: '#f1c40f' }\n  ]"

config = config.replace(
    "SKILL_DESC: {",
    f"ITEMS_DB: {items_db_json},\n  SKILL_DESC: {{"
)

# Add to CONFIG_METADATA
config = config.replace(
    "SKILL_DESC: { label: \"Skills Descriptions & Names\", type: \"json\", category: \"Game Data Entities\" }",
    "SKILL_DESC: { label: \"Skills Descriptions & Names\", type: \"json\", category: \"Game Data Entities\" },\n  ITEMS_DB: { label: \"Custom Gear Templates\", type: \"json\", category: \"Game Data Entities\" }"
)

# Add exports
config = config.replace(
    "export let ENEMY_TYPES = activeConfig.ENEMY_TYPES;",
    "export let ENEMY_TYPES = activeConfig.ENEMY_TYPES;\nexport let ITEMS_DB = activeConfig.ITEMS_DB;"
)

# Add to updateConfig
config = config.replace(
    "ENEMY_TYPES = activeConfig.ENEMY_TYPES;",
    "ENEMY_TYPES = activeConfig.ENEMY_TYPES;\n  ITEMS_DB = activeConfig.ITEMS_DB;"
)

with open('app/config.js', 'w') as f:
    f.write(config)


# 2. Patch ui.js
with open('app/ui.js', 'r') as f:
    ui = f.read()

ui = ui.replace(
    "if (key === 'CLASS_DATA' || key === 'ENEMY_TYPES' || key === 'SKILL_DESC') continue;",
    "if (key === 'CLASS_DATA' || key === 'ENEMY_TYPES' || key === 'SKILL_DESC' || key === 'ITEMS_DB') continue;"
)

visual_item_builder = """
            window.tempItemsDB = JSON.parse(JSON.stringify(ConfigModule.ITEMS_DB || []));

            const renderItems = () => {
                const iContainer = document.getElementById('visual-items-container');
                if (!iContainer) return;
                iContainer.innerHTML = '';
                window.tempItemsDB.forEach((item, idx) => {
                    const card = document.createElement('div');
                    card.style.background = '#2c3e50'; card.style.padding = '10px'; card.style.marginBottom = '10px'; card.style.borderRadius = '5px';
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <input type="text" value="${item.name}" style="background:#34495e; color:#fff; border:none; padding:4px; font-weight:bold; width:150px;" onchange="window.tempItemsDB[${idx}].name = this.value">
                            <button style="background:#e74c3c; color:#fff; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;" onclick="window.tempItemsDB.splice(${idx}, 1); renderItems();">Del</button>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; font-size:0.85em;">
                            <div>Type: <select style="background:#1e272e; color:#fff; border:none;" onchange="window.tempItemsDB[${idx}].gearType = this.value">
                                <option value="Weapon" ${item.gearType==='Weapon'?'selected':''}>Weapon</option>
                                <option value="Armor" ${item.gearType==='Armor'?'selected':''}>Armor</option>
                                <option value="Ring" ${item.gearType==='Ring'?'selected':''}>Ring</option>
                                <option value="Ring 1" ${item.gearType==='Ring 1'?'selected':''}>Ring 1</option>
                                <option value="Ring 2" ${item.gearType==='Ring 2'?'selected':''}>Ring 2</option>
                                <option value="Amulet" ${item.gearType==='Amulet'?'selected':''}>Amulet</option>
                            </select></div>
                            <div>Icon/URL: <input type="text" value="${item.icon || ''}" style="width:100px; background:#1e272e; color:#fff; border:none;" onchange="window.tempItemsDB[${idx}].icon = this.value"></div>
                            <div>Base ATK: <input type="number" value="${item.stats.atk || 0}" style="width:50px;" onchange="window.tempItemsDB[${idx}].stats.atk = parseFloat(this.value)"></div>
                            <div>Base HP: <input type="number" value="${item.stats.maxHp || 0}" style="width:50px;" onchange="window.tempItemsDB[${idx}].stats.maxHp = parseFloat(this.value)"></div>
                            <div>Base SPD: <input type="number" value="${item.stats.spd || 0}" style="width:50px;" step="0.1" onchange="window.tempItemsDB[${idx}].stats.spd = parseFloat(this.value)"></div>
                            <div>Color: <input type="color" value="${item.color}" style="width:50px; height:20px; padding:0; border:none;" onchange="window.tempItemsDB[${idx}].color = this.value"></div>
                            <div>Rarity: <select style="background:#1e272e; color:#fff; border:none;" onchange="window.tempItemsDB[${idx}].rarity = this.value">
                                <option value="normal" ${item.rarity==='normal'?'selected':''}>Normal</option>
                                <option value="magic" ${item.rarity==='magic'?'selected':''}>Magic</option>
                                <option value="rare" ${item.rarity==='rare'?'selected':''}>Rare</option>
                            </select></div>
                        </div>
                    `;
                    iContainer.appendChild(card);
                });
            };
            
            const btnAddItem = document.getElementById('btn-add-item');
            if (btnAddItem) btnAddItem.onclick = () => {
                window.tempItemsDB.push({ name: 'New Item', icon: '❓', gearType: 'Ring', stats: { atk: 1, maxHp: 10, spd: 0 }, rarity: 'normal', color: '#ffffff' });
                renderItems();
            };

            renderItems();
"""

ui = ui.replace(
    "renderMonsters();\n\"\"\")",  # wait, I injected this raw before. Let's just append before the end of the script chunk.
    "renderMonsters();\n" + visual_item_builder
)

ui = ui.replace(
    "newValues['ENEMY_TYPES'] = window.tempEnemyTypes;",
    "newValues['ENEMY_TYPES'] = window.tempEnemyTypes;\n            newValues['ITEMS_DB'] = window.tempItemsDB;"
)

with open('app/ui.js', 'w') as f:
    f.write(ui)


# 3. Patch game.js
with open('app/game.js', 'r') as f:
    game = f.read()

item_generation_logic = """
             const lvl = e.isBoss ? (e.level || this.wave) * 1.5 : (e.level || this.wave);
             const baseStat = lvl * ConfigModule.GEAR_STAT_MULTIPLIER;
             const variance = ConfigModule.GEAR_STAT_VARIANCE;
             const finalStat = Math.floor(baseStat * (1 - variance + Math.random() * variance * 2));
             
             let stats = {}; let icon = '💎';
             let category = 'Ring'; let itemName = 'Unknown Item';
             
             if (ConfigModule.ITEMS_DB && ConfigModule.ITEMS_DB.length > 0) {
                 const template = ConfigModule.ITEMS_DB[Math.floor(Math.random() * ConfigModule.ITEMS_DB.length)];
                 category = template.gearType;
                 itemName = template.name;
                 icon = template.icon;
                 rarity = template.rarity || rarity;
                 color = template.color || color;
                 // Scale custom base stats by finalStat/10 (so an atk:10 item scales up linearly)
                 let scale = finalStat / 10;
                 if (template.stats.atk) stats.atk = Math.max(1, Math.floor(template.stats.atk * scale));
                 if (template.stats.maxHp) stats.maxHp = Math.max(1, Math.floor(template.stats.maxHp * scale));
                 if (template.stats.spd) stats.spd = Math.max(0.01, template.stats.spd * scale);
             } else {
                 const categories = ['Weapon', 'Armor', 'Ring']; 
                 category = categories[Math.floor(Math.random() * categories.length)];
                 if (category === 'Weapon') { stats.atk = Math.max(1, finalStat); icon = '🗡️'; }
                 else if (category === 'Armor') { stats.maxHp = Math.max(5, finalStat * 10); icon = '🛡️'; }
                 else { stats.spd = Math.max(0.1, finalStat * 0.1); icon = '💍'; }
                 
                 const possibleAffixes = ['atk', 'maxHp', 'spd'];
                 let affixesAdded = 1; let sanity = 0;
                 while (affixesAdded < numAffixes && sanity < 10) {
                     sanity++;
                     let randAffix = possibleAffixes[Math.floor(Math.random() * possibleAffixes.length)];
                     if (!stats[randAffix]) {
                         if (randAffix === 'atk') stats.atk = Math.max(1, Math.floor(finalStat * 0.5));
                         if (randAffix === 'maxHp') stats.maxHp = Math.max(2, Math.floor(finalStat * 5));
                         if (randAffix === 'spd') stats.spd = Math.max(0.05, finalStat * 0.05);
                         affixesAdded++;
                     }
                 }
                 const prefixes = rarity === 'rare' ? ['Epic', 'Legendary', 'Godly'] : (rarity === 'magic' ? ['Glowing', 'Mystic', 'Enchanted'] : ['Rusty', 'Common', 'Basic']);
                 itemName = `${prefixes[Math.floor(Math.random()*prefixes.length)]} ${category}`;
             }
"""

game = re.sub(
    r"const categories = \['Weapon', 'Armor', 'Ring'\];[\s\S]*?const itemName = `\$\{prefixes\[Math\.floor\(Math\.random\(\)\*prefixes\.length\)\]\} \$\{category\}`;",
    item_generation_logic,
    game
)

with open('app/game.js', 'w') as f:
    f.write(game)

