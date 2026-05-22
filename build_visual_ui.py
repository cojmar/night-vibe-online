import re

with open('app/ui.js', 'r') as f:
    ui_code = f.read()

visual_builder_logic = """
        // Skip JSON objects in General tab
        if (key === 'CLASS_DATA' || key === 'ENEMY_TYPES' || key === 'SKILL_DESC') return;
"""

ui_code = ui_code.replace(
    "const cat = meta.category || 'General';",
    "if (key === 'CLASS_DATA' || key === 'ENEMY_TYPES' || key === 'SKILL_DESC') continue;\n                const cat = meta.category || 'General';"
)

visual_render_logic = """
            // --- VISUAL BUILDERS ---
            window.tempClassData = JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA));
            window.tempSkillDesc = JSON.parse(JSON.stringify(ConfigModule.SKILL_DESC));
            window.tempEnemyTypes = JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES));

            const renderClasses = () => {
                const cContainer = document.getElementById('visual-classes-container');
                if (!cContainer) return;
                cContainer.innerHTML = '';
                for (const classKey in window.tempClassData) {
                    const c = window.tempClassData[classKey];
                    const s = window.tempSkillDesc[classKey] || { s1:{name:'',desc:'',ctrl:''}, s2:{name:'',desc:'',ctrl:''} };
                    const card = document.createElement('div');
                    card.style.background = '#2c3e50'; card.style.padding = '10px'; card.style.marginBottom = '10px'; card.style.borderRadius = '5px';
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <input type="text" value="${c.name}" style="background:#34495e; color:#fff; border:none; padding:4px; font-weight:bold; width:150px;" onchange="window.tempClassData['${classKey}'].name = this.value">
                            <button style="background:#e74c3c; color:#fff; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;" onclick="delete window.tempClassData['${classKey}']; delete window.tempSkillDesc['${classKey}']; renderClasses();">Del</button>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; font-size:0.85em;">
                            <div>Key (ID): <input type="text" value="${classKey}" disabled style="width:80px; background:#1e272e; color:#bdc3c7; border:none;"></div>
                            <div>Icon/URL: <input type="text" value="${c.icon || ''}" style="width:100px; background:#1e272e; color:#fff; border:none;" onchange="window.tempClassData['${classKey}'].icon = this.value"></div>
                            <div>HP: <input type="number" value="${c.hp}" style="width:60px;" onchange="window.tempClassData['${classKey}'].hp = parseFloat(this.value)"></div>
                            <div>ATK: <input type="number" value="${c.atk}" style="width:60px;" onchange="window.tempClassData['${classKey}'].atk = parseFloat(this.value)"></div>
                            <div>SPD: <input type="number" value="${c.spd}" style="width:60px;" onchange="window.tempClassData['${classKey}'].spd = parseFloat(this.value)"></div>
                            <div>Color: <input type="color" value="${c.color}" style="width:50px; height:20px; padding:0; border:none;" onchange="window.tempClassData['${classKey}'].color = this.value"></div>
                        </div>
                        <div style="margin-top:8px; border-top:1px solid #7f8c8d; padding-top:5px; font-size:0.85em;">
                            <b>Skill 1:</b> <input type="text" value="${s.s1.name}" placeholder="Name" onchange="window.tempSkillDesc['${classKey}'].s1.name = this.value"><br>
                            Desc: <input type="text" value="${s.s1.desc}" style="width:90%;" onchange="window.tempSkillDesc['${classKey}'].s1.desc = this.value">
                        </div>
                        <div style="margin-top:5px; font-size:0.85em;">
                            <b>Skill 2:</b> <input type="text" value="${s.s2.name}" placeholder="Name" onchange="window.tempSkillDesc['${classKey}'].s2.name = this.value"><br>
                            Desc: <input type="text" value="${s.s2.desc}" style="width:90%;" onchange="window.tempSkillDesc['${classKey}'].s2.desc = this.value">
                        </div>
                    `;
                    cContainer.appendChild(card);
                }
            };
            
            const btnAddClass = document.getElementById('btn-add-class');
            if (btnAddClass) btnAddClass.onclick = () => {
                const newKey = 'class_' + Math.floor(Math.random()*10000);
                window.tempClassData[newKey] = { name: 'New Class', icon: '❓', hp: 100, mp: 50, atk: 10, spd: 5, color: '#ffffff', accent: '#cccccc' };
                window.tempSkillDesc[newKey] = { s1: {name:'Basic', desc:'Attack', ctrl:'L-Click'}, s2: {name:'Special', desc:'Attack', ctrl:'R-Click'} };
                renderClasses();
            };

            const renderMonsters = () => {
                const mContainer = document.getElementById('visual-monsters-container');
                if (!mContainer) return;
                mContainer.innerHTML = '';
                window.tempEnemyTypes.forEach((m, idx) => {
                    const card = document.createElement('div');
                    card.style.background = '#2c3e50'; card.style.padding = '10px'; card.style.marginBottom = '10px'; card.style.borderRadius = '5px';
                    card.innerHTML = `
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <input type="text" value="${m.name}" style="background:#34495e; color:#fff; border:none; padding:4px; font-weight:bold; width:150px;" onchange="window.tempEnemyTypes[${idx}].name = this.value">
                            <button style="background:#e74c3c; color:#fff; border:none; padding:4px 8px; border-radius:3px; cursor:pointer;" onclick="window.tempEnemyTypes.splice(${idx}, 1); renderMonsters();">Del</button>
                        </div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:5px; font-size:0.85em;">
                            <div>Icon/URL: <input type="text" value="${m.icon || ''}" style="width:100px; background:#1e272e; color:#fff; border:none;" onchange="window.tempEnemyTypes[${idx}].icon = this.value"></div>
                            <div>HP: <input type="number" value="${m.hp}" style="width:60px;" onchange="window.tempEnemyTypes[${idx}].hp = parseFloat(this.value)"></div>
                            <div>ATK: <input type="number" value="${m.atk}" style="width:60px;" onchange="window.tempEnemyTypes[${idx}].atk = parseFloat(this.value)"></div>
                            <div>SPD: <input type="number" value="${m.speed}" style="width:60px;" step="0.1" onchange="window.tempEnemyTypes[${idx}].speed = parseFloat(this.value)"></div>
                            <div>Size: <input type="number" value="${m.size}" style="width:60px;" onchange="window.tempEnemyTypes[${idx}].size = parseFloat(this.value)"></div>
                            <div>Color: <input type="color" value="${m.color}" style="width:50px; height:20px; padding:0; border:none;" onchange="window.tempEnemyTypes[${idx}].color = this.value"></div>
                        </div>
                    `;
                    mContainer.appendChild(card);
                });
            };
            
            const btnAddMonster = document.getElementById('btn-add-monster');
            if (btnAddMonster) btnAddMonster.onclick = () => {
                window.tempEnemyTypes.push({ name: 'New Monster', icon: '❓', hp: 50, atk: 5, color: '#ffffff', speed: 0.5, size: 20 });
                renderMonsters();
            };

            renderClasses();
            renderMonsters();
"""

ui_code = ui_code.replace(
    "container.appendChild(catEl);\n            });",
    "container.appendChild(catEl);\n            });\n" + visual_render_logic
)

save_logic_inject = """
            newValues['CLASS_DATA'] = window.tempClassData;
            newValues['SKILL_DESC'] = window.tempSkillDesc;
            newValues['ENEMY_TYPES'] = window.tempEnemyTypes;
"""

ui_code = ui_code.replace(
    "updateConfig(newValues);",
    save_logic_inject + "\n            updateConfig(newValues);"
)

with open('app/ui.js', 'w') as f:
    f.write(ui_code)

