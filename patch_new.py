import re

with open('app/ui.js', 'r') as f:
    content = f.read()

# Fix btnNewPreset
new_preset_regex = re.compile(r"(const btnNewPreset = document\.getElementById\('btn-preset-new'\);\s*if \(btnNewPreset\) \{\s*btnNewPreset\.addEventListener\('click', async \(\) => \{\s*const name = await this\.showPrompt\(\"➕ New Preset\", \"Enter a name for the new custom preset:\", \"My New Preset\"\);\s*if \(!name \|\| !name\.trim\(\)\) return;\s*)(const customPresets = ConfigModule\.getCustomPresets\(\);\s*const newId = 'preset_' \+ Date\.now\(\);\s*const valuesCopy = \{ \.\.\.ConfigModule\.DEFAULTS \};.*?items: \[.*?\]\s*\};\s*ConfigModule\.saveCustomPresets\(customPresets\);\s*ConfigModule\.setActivePresetId\(`custom:\$\{newId\}`\);\s*this\.populateConfigSelector\(\);\s*this\.selectPreset\(`custom:\$\{newId\}`\);\s*buildConfigFields\(\);\s*this\.addLog\(`➕ Created new preset \"\$\{name\.trim\(\)\}\"`\);)", re.MULTILINE | re.DOTALL)

new_preset_logic = r"""const nameTrimmed = name.trim();
                const customPresets = ConfigModule.getCustomPresets();
                
                let targetId = 'preset_' + Date.now();
                let isOverwrite = false;
                
                for (const k in customPresets) {
                    if (customPresets[k].name.toLowerCase() === nameTrimmed.toLowerCase()) {
                        targetId = customPresets[k].id;
                        isOverwrite = true;
                        break;
                    }
                }
                
                if (isOverwrite) {
                    const confirmOverwrite = await this.showConfirm("⚠️ Overwrite Preset", `A custom preset named "${nameTrimmed}" already exists. Do you want to overwrite it?`);
                    if (!confirmOverwrite) return;
                }
                
                const valuesCopy = { ...ConfigModule.DEFAULTS };
                const defaultClasses = {
                  warrior: { name: 'Warrior', icon: '⚔️', hp: 120, mp: 40, atk: 22, spd: 8, color: '#c0392b', accent: '#e74c3c', s1Name: 'Bash', s1Color: '#d4af37', s2Name: 'Sword Slash', s2Color: '#ffd700', bodyType: 'warrior' },
                  mage: { name: 'Mage', icon: '🔮', hp: 80, mp: 120, atk: 18, spd: 14, color: '#2980b9', accent: '#3498db', s1Name: 'Magic Bolt', s1Color: '#3498db', s2Name: 'Fireball', s2Color: '#e67e22', bodyType: 'mage' },
                  archer: { name: 'Archer', icon: '🏹', hp: 70, mp: 60, atk: 24, spd: 18, color: '#27ae60', accent: '#2ecc71', s1Name: 'Quick Shot', s1Color: '#f1c40f', s2Name: 'Arrow Barrage', s2Color: '#e74c3c', bodyType: 'archer' },
                  magicgladiator: { name: 'Magic Gladiator', icon: '✨', hp: 140, mp: 80, atk: 26, spd: 6, color: '#8e44ad', accent: '#9b59b6', s1Name: 'Psionic Slash', s1Color: '#e74c3c', s2Name: 'Cross Slash', s2Color: '#ffd700', bodyType: 'magicgladiator' }
                };
                const defaultMonsters = [
                  { name: 'Slime', icon: '🟢', hp: 30, atk: 5, color: '#2ecc71', speed: 0.4, size: 20 },
                  { name: 'Goblin', icon: '👺', hp: 45, atk: 8, color: '#27ae60', speed: 0.7, size: 22 },
                  { name: 'Skeleton', icon: '💀', hp: 55, atk: 10, color: '#dfe6e9', speed: 0.5, size: 24 },
                  { name: 'Orc', icon: '👹', hp: 80, atk: 14, color: '#6b8e23', speed: 0.35, size: 28 },
                  { name: 'Ghost', icon: '👻', hp: 40, atk: 12, color: '#dfe6e9', speed: 0.9, size: 22 },
                  { name: 'Demon', icon: '🔥', hp: 100, atk: 18, color: '#e74c3c', speed: 0.55, size: 26 },
                  { name: 'Dragon', icon: '🐉', hp: 150, atk: 22, color: '#e67e22', speed: 0.3, size: 32 },
                  { name: 'Lich', icon: '🧙', hp: 120, atk: 20, color: '#8e44ad', speed: 0.45, size: 26 }
                ];
                
                customPresets[targetId] = {
                    id: targetId,
                    name: nameTrimmed,
                    values: valuesCopy,
                    classes: defaultClasses,
                    monsters: defaultMonsters,
                    items: [
                      { name: 'Broadsword', icon: '🗡️', gearType: 'Weapon', rarity: 'normal', color: '#ecf0f1', stats: { atk: 10, maxHp: 0, spd: 0 } },
                      { name: 'Plate Armor', icon: '🛡️', gearType: 'Armor', rarity: 'magic', color: '#3498db', stats: { atk: 0, maxHp: 80, spd: 0 } },
                      { name: 'Wind Ring', icon: '💍', gearType: 'Ring', rarity: 'rare', color: '#f1c40f', stats: { atk: 2, maxHp: 10, spd: 2 } }
                    ]
                };
                
                ConfigModule.saveCustomPresets(customPresets);
                ConfigModule.setActivePresetId(`custom:${targetId}`);
                
                this.populateConfigSelector();
                this.selectPreset(`custom:${targetId}`);
                buildConfigFields();
                
                this.addLog(`➕ Created new preset "${nameTrimmed}"`);"""

content = new_preset_regex.sub(r"\1" + new_preset_logic, content)

with open('app/ui.js', 'w') as f:
    f.write(content)

print("Patch complete")
