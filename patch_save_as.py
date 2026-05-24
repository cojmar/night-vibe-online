import re

with open('app/ui.js', 'r') as f:
    content = f.read()

# Fix btnSaveAs
save_as_regex = re.compile(r"(const btnSaveAs = document\.getElementById\('btn-preset-save-as'\);\s*if \(btnSaveAs\) \{\s*btnSaveAs\.addEventListener\('click', async \(\) => \{\s*const name = await this\.showPrompt\(\"💾 Save Preset As\", \"Enter a name for the new custom preset:\", \"My Custom Preset\"\);\s*if \(!name \|\| !name\.trim\(\)\) return;\s*)(const customPresets = ConfigModule\.getCustomPresets\(\);\s*const newId = 'preset_' \+ Date\.now\(\);\s*const valuesCopy = \{ \.\.\.ConfigModule\.activeConfig \};\s*customPresets\[newId\] = \{[^\}]+\};\s*ConfigModule\.saveCustomPresets\(customPresets\);\s*ConfigModule\.setActivePresetId\(`custom:\$\{newId\}`\);\s*this\.populateConfigSelector\(\);\s*this\.selectPreset\(`custom:\$\{newId\}`\);\s*buildConfigFields\(\);\s*this\.addLog\(`💾 Saved preset as \"\$\{name\.trim\(\)\}\"`\);)", re.MULTILINE | re.DOTALL)

new_save_as_logic = r"""const nameTrimmed = name.trim();
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
                
                const valuesCopy = { ...ConfigModule.activeConfig };
                
                customPresets[targetId] = {
                    id: targetId,
                    name: nameTrimmed,
                    values: valuesCopy,
                    classes: JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA)),
                    monsters: JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES)),
                    items: JSON.parse(JSON.stringify(ConfigModule.ITEMS_DB))
                };
                
                ConfigModule.saveCustomPresets(customPresets);
                ConfigModule.setActivePresetId(`custom:${targetId}`);
                
                this.populateConfigSelector();
                this.selectPreset(`custom:${targetId}`);
                buildConfigFields();
                
                this.addLog(`💾 Saved preset as "${nameTrimmed}"`);"""

content = save_as_regex.sub(r"\1" + new_save_as_logic, content)

# Fix btnDuplicate
duplicate_regex = re.compile(r"(const btnDuplicate = document\.getElementById\('btn-preset-duplicate'\);\s*if \(btnDuplicate\) \{\s*btnDuplicate\.addEventListener\('click', async \(\) => \{[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n\s*const name = await this\.showPrompt\(\"📋 Duplicate Preset\", \"Enter name for duplicated preset:\", currentName \+ \" \(Copy\)\"\);\s*if \(!name \|\| !name\.trim\(\)\) return;\s*)(const customPresets = ConfigModule\.getCustomPresets\(\);\s*const newId = 'preset_' \+ Date\.now\(\);.*?this\.addLog\(`📋 Duplicated preset as \"\$\{name\.trim\(\)\}\"`\);)", re.MULTILINE | re.DOTALL)

new_duplicate_logic = r"""const nameTrimmed = name.trim();
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
                
                const valuesCopy = { ...ConfigModule.activeConfig };
                
                customPresets[targetId] = {
                    id: targetId,
                    name: nameTrimmed,
                    values: valuesCopy,
                    classes: JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA)),
                    monsters: JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES)),
                    items: JSON.parse(JSON.stringify(ConfigModule.ITEMS_DB))
                };
                
                ConfigModule.saveCustomPresets(customPresets);
                ConfigModule.setActivePresetId(`custom:${targetId}`);
                
                this.populateConfigSelector();
                this.selectPreset(`custom:${targetId}`);
                buildConfigFields();
                
                this.addLog(`📋 Duplicated preset as "${nameTrimmed}"`);"""

content = duplicate_regex.sub(r"\1" + new_duplicate_logic, content)


with open('app/ui.js', 'w') as f:
    f.write(content)

with open('index.html', 'r') as f:
    html = f.read()

html = html.replace('z-index:20000;', 'z-index:999999;')
with open('index.html', 'w') as f:
    f.write(html)

print("Patch complete")
