import { CLASS_DATA, SKILL_DESC, ENV_DISPLAY, GAME_W, GAME_H, CONFIG_METADATA, updateConfig, resetConfig } from './utils.js';
import * as ConfigModule from './config.js';

export default class UI {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.classes = Object.keys(ConfigModule.CLASS_DATA);
        const savedClass = localStorage.getItem('night-vibe-online_selected-class');
        const savedIdx = savedClass ? this.classes.indexOf(savedClass) : -1;
        this.currentCarouselIndex = savedIdx !== -1 ? savedIdx : 0;
        this.selectedClass = this.classes[this.currentCarouselIndex];
        this.recentLogs = [];
        this.MAX_LOGS = 12;
        this.logHoldTimer = null;
        this.statMultiplier = 1; // Default allocation multiplier
        this.configSearchQuery = ''; // Persisted search filter

        this.builtInConfigs = {};
        this.loadBuiltInConfigs();
        this.bindEvents();
        this.updateClassCarousel();
        
        this.customDialogResolver = null;
        this.bindCustomDialogEvents();

        ConfigModule.registerConfigListener(() => {
            if (this.validateGearSlots()) {
                const modal = document.getElementById('inventory-modal');
                if (modal && modal.style.display !== 'none') {
                    this.renderInventory();
                }
                if (this.game && this.game.player) {
                    this.updateHUD(this.game.player);
                }
            }
        });

    }

    bindCustomDialogEvents() {
        const btnConfirm = document.getElementById('btn-custom-dialog-confirm');
        const btnCancel = document.getElementById('btn-custom-dialog-cancel');
        const inputEl = document.getElementById('custom-dialog-input');
        const modal = document.getElementById('custom-dialog-modal');
        
        if (btnConfirm) {
            btnConfirm.addEventListener('click', () => {
                if (this.customDialogResolver) {
                    const inputContainer = document.getElementById('custom-dialog-input-container');
                    const val = inputContainer.style.display === 'block' ? inputEl.value : true;
                    if (modal) modal.style.display = 'none';
                    const res = this.customDialogResolver;
                    this.customDialogResolver = null;
                    res(val);
                }
            });
        }
        
        if (btnCancel) {
            btnCancel.addEventListener('click', () => {
                if (this.customDialogResolver) {
                    if (modal) modal.style.display = 'none';
                    const res = this.customDialogResolver;
                    this.customDialogResolver = null;
                    res(null);
                }
            });
        }

        document.addEventListener('keydown', (e) => {
            if (this.customDialogResolver) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (btnConfirm) btnConfirm.click();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    if (btnCancel && btnCancel.style.display !== 'none') btnCancel.click();
                }
            }
        });
    }

    showPrompt(title, text, defaultValue = '') {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-dialog-modal');
            const titleEl = document.getElementById('custom-dialog-title');
            const textEl = document.getElementById('custom-dialog-text');
            const inputContainer = document.getElementById('custom-dialog-input-container');
            const inputEl = document.getElementById('custom-dialog-input');
            const btnCancel = document.getElementById('btn-custom-dialog-cancel');
            
            if (!modal) {
                resolve(prompt(text, defaultValue));
                return;
            }
            
            titleEl.textContent = title;
            textEl.textContent = text;
            inputContainer.style.display = 'block';
            inputEl.value = defaultValue;
            btnCancel.style.display = 'block';
            
            this.customDialogResolver = resolve;
            
            modal.style.display = 'flex';
            inputEl.focus();
            inputEl.select();
        });
    }

    showConfirm(title, text) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-dialog-modal');
            const titleEl = document.getElementById('custom-dialog-title');
            const textEl = document.getElementById('custom-dialog-text');
            const inputContainer = document.getElementById('custom-dialog-input-container');
            const btnCancel = document.getElementById('btn-custom-dialog-cancel');
            
            if (!modal) {
                resolve(confirm(text));
                return;
            }
            
            titleEl.textContent = title;
            textEl.textContent = text;
            inputContainer.style.display = 'none';
            btnCancel.style.display = 'block';
            
            this.customDialogResolver = (val) => {
                resolve(val === true);
            };
            
            modal.style.display = 'flex';
        });
    }

    showAlert(title, text) {
        return new Promise((resolve) => {
            const modal = document.getElementById('custom-dialog-modal');
            const titleEl = document.getElementById('custom-dialog-title');
            const textEl = document.getElementById('custom-dialog-text');
            const inputContainer = document.getElementById('custom-dialog-input-container');
            const btnCancel = document.getElementById('btn-custom-dialog-cancel');
            
            if (!modal) {
                alert(text);
                resolve();
                return;
            }
            
            titleEl.textContent = title;
            textEl.textContent = text;
            inputContainer.style.display = 'none';
            btnCancel.style.display = 'none';
            
            this.customDialogResolver = () => {
                resolve();
            };
            
            modal.style.display = 'flex';
        });
    }

    updateBuffs(hpTimer, manaTimer) {
        const container = document.getElementById('buffs-container');
        if (!container) return;

        let html = '';
        if (hpTimer > 0) {
            const pct = Math.min(100, (hpTimer / 10000) * 100);
            html += `
        <div style="flex:1; background:rgba(0,0,0,0.5); border:1px solid #c0392b; border-radius:3px; position:relative; overflow:hidden;">
          <div style="position:absolute; left:0; top:0; height:100%; width:${pct}%; background:rgba(231, 76, 60, 0.4);"></div>
          <div style="position:relative; font-size:12px; font-weight:bold; color:#fff; text-align:center; line-height:24px;">🩸 Vampirism ${Math.ceil(hpTimer / 1000)}s</div>
        </div>
      `;
        }
        if (manaTimer > 0) {
            const pct = Math.min(100, (manaTimer / 10000) * 100);
            html += `
        <div style="flex:1; background:rgba(0,0,0,0.5); border:1px solid #2980b9; border-radius:3px; position:relative; overflow:hidden;">
          <div style="position:absolute; left:0; top:0; height:100%; width:${pct}%; background:rgba(52, 152, 219, 0.4);"></div>
          <div style="position:relative; font-size:12px; font-weight:bold; color:#fff; text-align:center; line-height:24px;">⚡ CD Buff ${Math.ceil(manaTimer / 1000)}s</div>
        </div>
      `;
        }
        container.innerHTML = html;
    }

    bindEvents() {
        document.getElementById('btn-prev-class').addEventListener('click', () => this.prevClass());
        document.getElementById('btn-next-class').addEventListener('click', () => this.nextClass());
        document.getElementById('btn-start').addEventListener('click', () => {
            this.saveLastGameConfig();
            this.game.startGame(this.selectedClass);
        });
        document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('btn-quit-game').addEventListener('click', () => {
            this.saveLastGameConfig();
            this.game.quitToMenu();
        });
        document.getElementById('btn-death-quit').addEventListener('click', () => {
            this.saveLastGameConfig();
            this.game.quitToMenu();
        });

        document.getElementById('btn-up-atk').addEventListener('click', () => { if (this.game) this.game.upgradeStat('atk', this.statMultiplier); });
        document.getElementById('btn-up-spd').addEventListener('click', () => { if (this.game) this.game.upgradeStat('spd', this.statMultiplier); });
        document.getElementById('btn-up-hp').addEventListener('click', () => { if (this.game) this.game.upgradeStat('hp', this.statMultiplier); });

        // Bind stat multiplier selector buttons
        const multButtons = document.querySelectorAll('.stat-mult-btn');
        multButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const val = e.currentTarget.getAttribute('data-val');
                this.statMultiplier = val === 'all' ? 'all' : parseInt(val, 10) || 1;
                
                // Update active visual styles on buttons
                multButtons.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#2c3e50';
                    b.style.borderColor = '#34495e';
                    b.style.color = '#bdc3c7';
                });
                e.currentTarget.classList.add('active');
                e.currentTarget.style.background = '#3498db';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.color = 'white';
            });
        });

        const btnRebirth = document.getElementById('btn-rebirth');
        if (btnRebirth) btnRebirth.addEventListener('click', () => { if (this.game) this.game.requestRebirth(); });

        const btnRebirthConfirm = document.getElementById('btn-rebirth-confirm');
        const btnRebirthCancel = document.getElementById('btn-rebirth-cancel');
        const rebirthModal = document.getElementById('rebirth-modal');

        if (btnRebirthConfirm) btnRebirthConfirm.addEventListener('click', () => {
            if (rebirthModal) rebirthModal.style.display = 'none';
            if (this.game) this.game.performRebirth();
        });

        if (btnRebirthCancel) btnRebirthCancel.addEventListener('click', () => {
            if (rebirthModal) rebirthModal.style.display = 'none';
        });

        const compactLog = document.getElementById('compact-log');
        compactLog.addEventListener('mouseenter', () => this.logHoldTimer = setTimeout(() => this.showTooltip(), 300));
        compactLog.addEventListener('mouseleave', () => { clearTimeout(this.logHoldTimer); this.hideTooltip(); });
        compactLog.addEventListener('touchstart', () => this.logHoldTimer = setTimeout(() => this.showTooltip(), 100));
        compactLog.addEventListener('touchend', () => { clearTimeout(this.logHoldTimer); this.hideTooltip(); });

        const toggleStats = (e) => {
            if (e) { e.stopPropagation(); }
            const stats = document.getElementById('stats-display');
            const partyList = document.getElementById('party-list');
            stats.style.display = stats.style.display === 'none' ? 'flex' : 'none';

            if (stats.style.display !== 'none') {
                if (partyList) partyList.classList.add('info-open');
                const plus = document.getElementById('level-up-plus');
                if (plus) plus.style.display = 'none';
            } else {
                if (partyList) partyList.classList.remove('info-open');
                if (this.game && this.game.player && this.game.player.statPoints > 0) {
                    const plus = document.getElementById('level-up-plus');
                    if (plus) plus.style.display = 'inline-block';
                }
            }
        };
        const hpCont = document.getElementById('player-hp-container');
        if (hpCont) hpCont.addEventListener('click', toggleStats);
        const scoreCont = document.getElementById('player-score-container');
        if (scoreCont) scoreCont.addEventListener('click', toggleStats);

        document.addEventListener('click', (e) => {
            const partyList = document.getElementById('party-list');
            const stats = document.getElementById('stats-display');

            if (stats && stats.style.display !== 'none') {
                if (partyList && !partyList.contains(e.target)) {
                    stats.style.display = 'none';
                    partyList.classList.remove('info-open');

                    if (this.game && this.game.player && this.game.player.statPoints > 0) {
                        const plus = document.getElementById('level-up-plus');
                        if (plus) plus.style.display = 'inline-block';
                    }
                }
            }
        });

        document.addEventListener('touchstart', (e) => {
            const partyList = document.getElementById('party-list');
            const stats = document.getElementById('stats-display');

            if (stats && stats.style.display !== 'none') {
                if (partyList && !partyList.contains(e.target)) {
                    stats.style.display = 'none';
                    partyList.classList.remove('info-open');

                    if (this.game && this.game.player && this.game.player.statPoints > 0) {
                        const plus = document.getElementById('level-up-plus');
                        if (plus) plus.style.display = 'inline-block';
                    }
                }
            }
        });
    }

    async loadBuiltInConfigs() {
        this.builtInConfigs = {
            'default': { name: 'Default Mode', values: { ...ConfigModule.DEFAULTS } }
        };
        
        let manifest = ['default.json', 'hardcore.json', 'rapidfire.json', 'sandbox.json'];
        try {
            const response = await fetch('configs/manifest.json');
            if (response.ok) {
                manifest = await response.json();
            }
        } catch (e) {
            console.warn("Could not load configs/manifest.json, using fallback list", e);
        }

        for (const file of manifest) {
            const key = file.replace('.json', '');
            if (key === 'default') continue;
            try {
                const res = await fetch(`configs/${file}`);
                if (res.ok) {
                    const cfg = await res.json();
                    let name = key.charAt(0).toUpperCase() + key.slice(1) + ' Mode';
                    if (key === 'bossrush') name = 'Boss Rush Mode';
                    this.builtInConfigs[key] = {
                        name: name,
                        values: cfg
                    };
                }
            } catch (err) {
                console.error(`Failed to load built-in config ${file}:`, err);
            }
        }
        
        this.populateConfigSelector();
        this.applySavedPreset();
    }

    saveLastGameConfig() {
        const customPresets = ConfigModule.getCustomPresets();
        customPresets['last_game_config'] = {
            id: 'last_game_config',
            name: 'Last Game Config',
            values: JSON.parse(JSON.stringify(ConfigModule.activeConfig)),
            classes: JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA)),
            monsters: JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES)),
            items: JSON.parse(JSON.stringify(ConfigModule.ITEMS_DB))
        };
        ConfigModule.saveCustomPresets(customPresets);
        
        ConfigModule.setActivePresetId('custom:last_game_config');
        ConfigModule.setActivePresetName('Last Game Config');
        
        this.populateConfigSelector();
        this.selectPreset('custom:last_game_config');
    }

    populateConfigSelector() {
        const ids = ['config-preset-selector', 'config-editor-preset-selector'];
        
        for (const targetId of ids) {
            const selector = document.getElementById(targetId);
            if (!selector) continue;
            
            selector.innerHTML = '';
            
            // 1. Last Game Config optgroup
            const customPresets = ConfigModule.getCustomPresets();
            if (customPresets['last_game_config']) {
                const groupLast = document.createElement('optgroup');
                groupLast.label = 'Last Game Config';
                
                const opt = document.createElement('option');
                opt.value = 'custom:last_game_config';
                opt.textContent = `🕒 Last Game Config`;
                groupLast.appendChild(opt);
                selector.appendChild(groupLast);
            }
            
            // 2. Default optgroup
            const groupDefault = document.createElement('optgroup');
            groupDefault.label = 'Default';
            const optDefault = document.createElement('option');
            optDefault.value = 'built-in:default';
            optDefault.textContent = '🎮 Default Rules';
            groupDefault.appendChild(optDefault);
            selector.appendChild(groupDefault);
            
            // 3. Built-in Game Modes optgroup
            const groupBuiltin = document.createElement('optgroup');
            groupBuiltin.label = 'Built-in Game Modes';
            for (const key in this.builtInConfigs) {
                if (key === 'default') continue;
                const opt = document.createElement('option');
                opt.value = `built-in:${key}`;
                let emoji = '⚙️';
                if (key === 'hardcore') emoji = '👹';
                else if (key === 'rapidfire') emoji = '⚡';
                else if (key === 'sandbox') emoji = '🌿';
                else if (key === 'bossrush') emoji = '👑';
                opt.textContent = `${emoji} ${this.builtInConfigs[key].name}`;
                groupBuiltin.appendChild(opt);
            }
            selector.appendChild(groupBuiltin);
            
            // 4. Custom User Presets optgroup
            const groupCustom = document.createElement('optgroup');
            groupCustom.label = 'My Custom Presets';
            let hasCustom = false;
            for (const id in customPresets) {
                if (id === 'last_game_config') continue;
                const opt = document.createElement('option');
                opt.value = `custom:${id}`;
                opt.textContent = `✏️ ${customPresets[id].name}`;
                groupCustom.appendChild(opt);
                hasCustom = true;
            }
            if (!hasCustom) {
                const optNone = document.createElement('option');
                optNone.disabled = true;
                optNone.textContent = '(No custom presets saved)';
                groupCustom.appendChild(optNone);
            }
            selector.appendChild(groupCustom);
            
            // Set selected option
            selector.value = ConfigModule.activePresetId;
            if (!selector.value) {
                selector.value = 'built-in:default';
                ConfigModule.setActivePresetId('built-in:default');
            }
        }
    }

    applySavedPreset() {
        const selector = document.getElementById('config-preset-selector');
        if (!selector) return;
        
        const presetId = selector.value || ConfigModule.activePresetId;
        this.selectPreset(presetId);
    }

    selectPreset(presetId) {
        if (!presetId) return;
        
        ConfigModule.setActivePresetId(presetId);
        
        let valuesToApply = null;
        let classesToApply = null;
        let monstersToApply = null;
        let itemsToApply = null;
        let isCustom = false;
        let presetName = 'Default';
        
        if (presetId.startsWith('built-in:')) {
            const key = presetId.split('built-in:')[1];
            if (this.builtInConfigs && this.builtInConfigs[key]) {
                valuesToApply = this.builtInConfigs[key].values;
                presetName = this.builtInConfigs[key].name;
            }
        } else if (presetId.startsWith('custom:')) {
            const key = presetId.split('custom:')[1];
            const presets = ConfigModule.getCustomPresets();
            if (presets[key]) {
                valuesToApply = presets[key].values;
                classesToApply = presets[key].classes;
                monstersToApply = presets[key].monsters;
                itemsToApply = presets[key].items;
                presetName = presets[key].name;
                isCustom = true;
            }
        }
        
        ConfigModule.setActivePresetName(presetName);
        
        if (valuesToApply) {
            ConfigModule.updateConfig(valuesToApply);
            
            // Revert or apply custom classes
            const defaultClasses = {
              warrior: { name: 'Warrior', icon: '⚔️', hp: 120, mp: 40, atk: 22, spd: 8, color: '#c0392b', accent: '#e74c3c', s1Name: 'Bash', s1Color: '#d4af37', s2Name: 'Sword Slash', s2Color: '#ffd700', bodyType: 'warrior' },
              mage: { name: 'Mage', icon: '🔮', hp: 80, mp: 120, atk: 18, spd: 14, color: '#2980b9', accent: '#3498db', s1Name: 'Magic Bolt', s1Color: '#3498db', s2Name: 'Fireball', s2Color: '#e67e22', bodyType: 'mage' },
              archer: { name: 'Archer', icon: '🏹', hp: 70, mp: 60, atk: 24, spd: 18, color: '#27ae60', accent: '#2ecc71', s1Name: 'Quick Shot', s1Color: '#f1c40f', s2Name: 'Arrow Barrage', s2Color: '#e74c3c', bodyType: 'archer' },
              magicgladiator: { name: 'Magic Gladiator', icon: '✨', hp: 140, mp: 80, atk: 26, spd: 6, color: '#8e44ad', accent: '#9b59b6', s1Name: 'Psionic Slash', s1Color: '#e74c3c', s2Name: 'Cross Slash', s2Color: '#ffd700', bodyType: 'magicgladiator' }
            };
            
            const targetClasses = classesToApply || defaultClasses;
            for (const k in ConfigModule.CLASS_DATA) delete ConfigModule.CLASS_DATA[k];
            Object.assign(ConfigModule.CLASS_DATA, targetClasses);
            localStorage.setItem('nightvibe-custom-classes', JSON.stringify(ConfigModule.CLASS_DATA));
            
            // Revert or apply custom monsters
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
            
            const targetMonsters = monstersToApply || defaultMonsters;
            ConfigModule.ENEMY_TYPES.length = 0;
            ConfigModule.ENEMY_TYPES.push(...targetMonsters);
            localStorage.setItem('nightvibe-custom-monsters', JSON.stringify(ConfigModule.ENEMY_TYPES));
            
            // Revert or apply custom items
            const defaultItems = [
              { name: 'Broadsword', icon: '🗡️', gearType: 'Weapon', rarity: 'normal', color: '#ecf0f1', stats: { atk: 10, maxHp: 0, spd: 0 } },
              { name: 'Plate Armor', icon: '🛡️', gearType: 'Armor', rarity: 'magic', color: '#3498db', stats: { atk: 0, maxHp: 80, spd: 0 } },
              { name: 'Wind Ring', icon: '💍', gearType: 'Ring', rarity: 'rare', color: '#f1c40f', stats: { atk: 2, maxHp: 10, spd: 2 } }
            ];
            
            const targetItems = itemsToApply || defaultItems;
            ConfigModule.ITEMS_DB.length = 0;
            ConfigModule.ITEMS_DB.push(...targetItems);
            localStorage.setItem('nightvibe-custom-items', JSON.stringify(ConfigModule.ITEMS_DB));
            
            // Re-render editor tabs and lists
            this.buildClassesTab();
            this.buildMonstersTab();
            this.buildItemsTab();
            
            if (this.game) {
                if (this.game.updateLayout) this.game.updateLayout();
                if (this.game.player) {
                    this.game.player.moveSpeed = ConfigModule.PLAYER_MOVE_SPEEDS[this.game.player.classType] || ConfigModule.PLAYER_MOVE_SPEEDS.default;
                    if (this.game.player.classType === 'warrior') {
                        this.game.player.atkRange = ConfigModule.WARRIOR_MELEE_RANGE;
                    } else if (this.game.player.classType === 'magicgladiator') {
                        this.game.player.atkRange = ConfigModule.MAGICGLADIATOR_MELEE_RANGE;
                    } else {
                        this.game.player.atkRange = ConfigModule.RANGED_MAX_RANGE;
                    }
                    this.updateHUD(this.game.player);
                }
                if (this.game.generateScenery) this.game.generateScenery(this.game.selectedEnv);
                if (this.game.broadcastState) this.game.broadcastState();
            }
            
            this.updateLobbyRulesText();
            this.updateClassCarousel();
            
            // If we are currently the host, broadcast the new config to the room so late-joiners get the right data
            if (this.game && this.game.net && this.game.isHost) {
                this.game.net.send_cmd('set_data', {
                    gameplayConfig: ConfigModule.activeConfig,
                    gameplayConfigName: ConfigModule.activePresetName || 'Default',
                    classData: ConfigModule.CLASS_DATA,
                    enemyTypes: ConfigModule.ENEMY_TYPES,
                    itemsDb: ConfigModule.ITEMS_DB
                });
            }
        }
        
        const badgeEl = document.getElementById('active-preset-badge');
        const btnDelete = document.getElementById('btn-preset-delete');
        
        if (badgeEl) {
            badgeEl.textContent = isCustom ? 'Custom' : 'Built-in';
            badgeEl.style.background = '#ffd700';
            badgeEl.style.color = '#000';
        }
        if (btnDelete) {
            btnDelete.style.display = (isCustom && presetId !== 'custom:last_game_config') ? 'inline-block' : 'none';
        }
        
        const sel = document.getElementById('config-preset-selector');
        if (sel && sel.value !== presetId) {
            sel.value = presetId;
        }
        
        const selEditor = document.getElementById('config-editor-preset-selector');
        if (selEditor && selEditor.value !== presetId) {
            selEditor.value = presetId;
        }
    }

    initSettings() {
        if (!this.game || !this.game.settings) return;
        const s = this.game.settings;
        const partSlider = document.getElementById('particles-slider');
        const partVal = document.getElementById('particles-val');
        const bgSlider = document.getElementById('bg-slider');
        const bgVal = document.getElementById('bg-val');
        const groundSlider = document.getElementById('ground-slider');
        const groundVal = document.getElementById('ground-val');
        const atmosSlider = document.getElementById('atmos-slider');
        const atmosVal = document.getElementById('atmos-val');
        const btnSettings = document.getElementById('btn-settings');
        const settingsModal = document.getElementById('settings-modal');
        const btnSettingsClose = document.getElementById('btn-settings-close');

        if (partSlider) { partSlider.value = Math.round(s.particles * 100); partVal.textContent = `${Math.round(s.particles * 100)}%`; }
        if (bgSlider) { bgSlider.value = Math.round(s.bgElements * 100); bgVal.textContent = `${Math.round(s.bgElements * 100)}%`; }
        if (groundSlider) { groundSlider.value = Math.round(s.groundElements * 100); groundVal.textContent = `${Math.round(s.groundElements * 100)}%`; }
        if (atmosSlider) { atmosSlider.value = Math.round(s.atmos * 100); atmosVal.textContent = `${Math.round(s.atmos * 100)}%`; }
        const autoGraphicsCheck = document.getElementById('auto-graphics-check');
        const autoLimitCheck = document.getElementById('auto-limit-check');
        if (autoGraphicsCheck) autoGraphicsCheck.checked = s.autoGraphics;
        if (autoLimitCheck) autoLimitCheck.checked = s.autoLimit;
        if (partSlider) partSlider.disabled = s.autoGraphics;
        if (bgSlider) bgSlider.disabled = s.autoGraphics;
        if (groundSlider) groundSlider.disabled = s.autoGraphics;
        if (atmosSlider) atmosSlider.disabled = s.autoGraphics;

        if (btnSettings) btnSettings.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
        const btnMenuSettings = document.getElementById('btn-menu-settings');
        if (btnMenuSettings) btnMenuSettings.addEventListener('click', () => { document.getElementById('config-editor-modal').style.display = 'flex'; buildConfigFields(); });
        if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => { settingsModal.style.display = 'none'; });

        if (partSlider) {
            partSlider.addEventListener('input', (e) => {
                partVal.textContent = `${e.target.value}%`;
                this.game.settings.particles = parseInt(e.target.value) / 100;
                localStorage.setItem('nightvibe-settings', JSON.stringify(this.game.settings));
            });
        }
        if (bgSlider) {
            bgSlider.addEventListener('input', (e) => {
                bgVal.textContent = `${e.target.value}%`;
                this.game.settings.bgElements = parseInt(e.target.value) / 100;
                localStorage.setItem('nightvibe-settings', JSON.stringify(this.game.settings));
                this.game.generateScenery(this.game.selectedEnv);
            });
        }
        if (groundSlider) {
            groundSlider.addEventListener('input', (e) => {
                groundVal.textContent = `${e.target.value}%`;
                this.game.settings.groundElements = parseInt(e.target.value) / 100;
                localStorage.setItem('nightvibe-settings', JSON.stringify(this.game.settings));
                this.game.generateScenery(this.game.selectedEnv);
            });
        }
        if (atmosSlider) {
            atmosSlider.addEventListener('input', (e) => {
                atmosVal.textContent = `${e.target.value}%`;
                this.game.settings.atmos = parseInt(e.target.value) / 100;
                localStorage.setItem('nightvibe-settings', JSON.stringify(this.game.settings));
            });
        }

        if (autoGraphicsCheck) {
            autoGraphicsCheck.addEventListener('change', (e) => {
                const isAuto = e.target.checked;
                this.game.settings.autoGraphics = isAuto;
                localStorage.setItem('nightvibe-settings', JSON.stringify(this.game.settings));
                if (partSlider) partSlider.disabled = isAuto;
                if (bgSlider) bgSlider.disabled = isAuto;
                if (groundSlider) groundSlider.disabled = isAuto;
                if (atmosSlider) atmosSlider.disabled = isAuto;
            });
        }

        if (autoLimitCheck) {
            autoLimitCheck.addEventListener('change', (e) => {
                this.game.settings.autoLimit = e.target.checked;
                localStorage.setItem('nightvibe-settings', JSON.stringify(this.game.settings));
            });
        }

        // ==========================================
        // DYNAMIC GAMEPLAY CONFIG BALANCE EDITOR UI
        // ==========================================
        const btnOpenConfigEditor = document.getElementById('btn-open-config-editor');
        const configEditorModal = document.getElementById('config-editor-modal');
        const btnConfigEditorCloseIcon = document.getElementById('btn-config-editor-close-icon');
        const btnConfigSave = document.getElementById('btn-config-save');
        
        if (btnConfigSave) {
            btnConfigSave.addEventListener('click', async () => {
                const presetId = ConfigModule.activePresetId;
                if (presetId && presetId.startsWith('built-in:')) {
                    await this.showAlert("⚠️ Built-in Preset", "This is a built-in read-only preset. Click 'Save As...' to save your modifications as a custom preset!");
                    const btnSaveAs = document.getElementById('btn-preset-save-as');
                    if (btnSaveAs) btnSaveAs.click();
                    return;
                }
                
                saveConfigFromUI();
                const originalText = btnConfigSave.innerText;
                btnConfigSave.innerText = '✔️ SAVED!';
                btnConfigSave.style.background = '#ffd700';
                btnConfigSave.style.color = '#000';
                setTimeout(() => {
                    btnConfigSave.innerText = originalText;
                    btnConfigSave.style.background = '#ffd700';
                    btnConfigSave.style.color = '#000';
                }, 1000);
            });
        }

        // Config preset dropdown selector
        const selector = document.getElementById('config-preset-selector');
        if (selector) {
            selector.addEventListener('change', (e) => {
                this.selectPreset(e.target.value);
                buildConfigFields();
            });
        }

        const editorSelector = document.getElementById('config-editor-preset-selector');
        if (editorSelector) {
            editorSelector.addEventListener('change', (e) => {
                this.selectPreset(e.target.value);
                buildConfigFields();
            });
        }

        const btnEditSelected = document.getElementById('btn-edit-selected-config');
        if (btnEditSelected) {
            btnEditSelected.addEventListener('click', () => {
                settingsModal.style.display = 'none';
                configEditorModal.style.display = 'flex';
                buildConfigFields();
            });
        }

        // Preset Manager Bar Action Buttons
        const btnSaveAs = document.getElementById('btn-preset-save-as');
        if (btnSaveAs) {
            btnSaveAs.addEventListener('click', async () => {
                const name = await this.showPrompt("💾 Save Preset As", "Enter a name for the new custom preset:", "My Custom Preset");
                if (!name || !name.trim()) return;
                
                const nameTrimmed = name.trim();
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
                
                this.addLog(`💾 Saved preset as "${nameTrimmed}"`);
            });
        }

        const btnDuplicate = document.getElementById('btn-preset-duplicate');
        if (btnDuplicate) {
            btnDuplicate.addEventListener('click', async () => {
                let currentName = 'Preset';
                const presetId = ConfigModule.activePresetId;
                if (presetId.startsWith('built-in:')) {
                    const key = presetId.split('built-in:')[1];
                    if (this.builtInConfigs && this.builtInConfigs[key]) currentName = this.builtInConfigs[key].name;
                } else if (presetId.startsWith('custom:')) {
                    const key = presetId.split('custom:')[1];
                    const presets = ConfigModule.getCustomPresets();
                    if (presets[key]) currentName = presets[key].name;
                }
                
                const name = await this.showPrompt("📋 Duplicate Preset", "Enter name for duplicated preset:", currentName + " (Copy)");
                if (!name || !name.trim()) return;
                
                const customPresets = ConfigModule.getCustomPresets();
                const newId = 'preset_' + Date.now();
                const valuesCopy = { ...ConfigModule.activeConfig };
                
                customPresets[newId] = {
                    id: newId,
                    name: name.trim(),
                    values: valuesCopy,
                    classes: JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA)),
                    monsters: JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES))
                };
                
                ConfigModule.saveCustomPresets(customPresets);
                ConfigModule.setActivePresetId(`custom:${newId}`);
                
                this.populateConfigSelector();
                this.selectPreset(`custom:${newId}`);
                buildConfigFields();
                
                this.addLog(`📋 Duplicated preset to "${name.trim()}"`);
            });
        }

        const btnDeletePreset = document.getElementById('btn-preset-delete');
        if (btnDeletePreset) {
            btnDeletePreset.addEventListener('click', async () => {
                const presetId = ConfigModule.activePresetId;
                if (!presetId.startsWith('custom:')) return;
                const key = presetId.split('custom:')[1];
                
                const customPresets = ConfigModule.getCustomPresets();
                if (customPresets[key]) {
                    const name = customPresets[key].name;
                    if (await this.showConfirm("🗑️ Delete Preset", `Are you sure you want to delete the preset "${name}"?`)) {
                        delete customPresets[key];
                        ConfigModule.saveCustomPresets(customPresets);
                        
                        ConfigModule.setActivePresetId('built-in:default');
                        this.populateConfigSelector();
                        this.selectPreset('built-in:default');
                        buildConfigFields();
                        
                        this.addLog(`🗑️ Deleted preset "${name}"`);
                    }
                }
            });
        }

        const btnNewPreset = document.getElementById('btn-preset-new');
        if (btnNewPreset) {
            btnNewPreset.addEventListener('click', async () => {
                const name = await this.showPrompt("➕ New Preset", "Enter a name for the new custom preset:", "My New Preset");
                if (!name || !name.trim()) return;
                
                const customPresets = ConfigModule.getCustomPresets();
                const newId = 'preset_' + Date.now();
                
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
                
                customPresets[newId] = {
                    id: newId,
                    name: name.trim(),
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
                ConfigModule.setActivePresetId(`custom:${newId}`);
                
                this.populateConfigSelector();
                this.selectPreset(`custom:${newId}`);
                buildConfigFields();
                
                this.addLog(`➕ Created custom preset "${name.trim()}"`);
            });
        }

        const btnImportGameSession = document.getElementById('btn-preset-import-game');
        if (btnImportGameSession) {
            btnImportGameSession.addEventListener('click', async () => {
                const name = await this.showPrompt("📥 Import Session", "Enter a name for the imported preset:", ConfigModule.activePresetName || "Imported Preset");
                if (!name || !name.trim()) return;
                
                const customPresets = ConfigModule.getCustomPresets();
                const newId = 'preset_' + Date.now();
                const valuesCopy = { ...ConfigModule.activeConfig };
                
                customPresets[newId] = {
                    id: newId,
                    name: name.trim(),
                    values: valuesCopy,
                    classes: JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA)),
                    monsters: JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES)),
                    items: JSON.parse(JSON.stringify(ConfigModule.ITEMS_DB))
                };
                
                ConfigModule.saveCustomPresets(customPresets);
                ConfigModule.setActivePresetId(`custom:${newId}`);
                
                this.populateConfigSelector();
                this.selectPreset(`custom:${newId}`);
                buildConfigFields();
                
                this.addLog(`📥 Imported session preset as "${name.trim()}"`);
            });
        }

        const btnConfigReset = document.getElementById('btn-config-reset');
        const btnConfigExport = document.getElementById('btn-config-export');
        const btnConfigImport = document.getElementById('btn-config-import');
        const importFileInput = document.getElementById('config-import-file');

        const buildConfigFields = () => {
            const container = document.getElementById('config-fields-container');
            if (!container) return;
            container.innerHTML = '';

            const isPlaying = this.game && this.game.state === 'PLAYING';

            const btnReset = document.getElementById('btn-config-reset');
            const btnImport = document.getElementById('btn-config-import');
            const btnExport = document.getElementById('btn-config-export');
            if (btnReset) {
                btnReset.disabled = isPlaying;
                btnReset.style.opacity = isPlaying ? '0.4' : '1';
                btnReset.style.pointerEvents = isPlaying ? 'none' : 'auto';
            }
            if (btnImport) {
                btnImport.disabled = isPlaying;
                btnImport.style.opacity = isPlaying ? '0.4' : '1';
                btnImport.style.pointerEvents = isPlaying ? 'none' : 'auto';
            }
            if (btnExport) {
                btnExport.disabled = isPlaying;
                btnExport.style.opacity = isPlaying ? '0.4' : '1';
                btnExport.style.pointerEvents = isPlaying ? 'none' : 'auto';
            }

            if (isPlaying) {
                const warnBanner = document.createElement('div');
                warnBanner.style.background = 'rgba(231, 76, 60, 0.15)';
                warnBanner.style.border = '1px solid #e74c3c';
                warnBanner.style.padding = '10px 15px';
                warnBanner.style.borderRadius = '6px';
                warnBanner.style.marginBottom = '15px';
                warnBanner.style.color = '#ff6b6b';
                warnBanner.style.fontWeight = 'bold';
                warnBanner.style.textAlign = 'center';
                warnBanner.style.fontSize = '0.9em';
                warnBanner.innerHTML = '⚠️ Active Session: Settings are read-only and locked to the Host\'s gameplay configuration.';
                container.appendChild(warnBanner);
            }

            // Group metadata by category dynamically, preserving config.js order
            const categoriesList = [];
            const categoriesMap = new Map();
            for (const key in CONFIG_METADATA) {
                const meta = CONFIG_METADATA[key];
                const cat = meta.category || 'General';
                if (!categoriesMap.has(cat)) {
                    const catObj = { name: cat, fields: [] };
                    categoriesMap.set(cat, catObj);
                    categoriesList.push(catObj);
                }
                categoriesMap.get(cat).fields.push({ key, ...meta });
            }

            // Create input controls for each category
            categoriesList.forEach(catObj => {
                const catEl = document.createElement('div');
                catEl.style.marginBottom = '20px';
                catEl.style.background = 'rgba(0,0,0,0.3)';
                catEl.style.padding = '15px';
                catEl.style.borderRadius = '8px';
                catEl.style.borderLeft = '4px solid #2ecc71';

                const catHeader = document.createElement('h3');
                catHeader.style.margin = '0 0 12px 0';
                catHeader.style.color = '#2ecc71';
                catHeader.style.fontSize = '1.15em';
                catHeader.textContent = catObj.name;
                catEl.appendChild(catHeader);

                catObj.fields.forEach(meta => {
                    const fieldDiv = document.createElement('div');
                    fieldDiv.style.marginBottom = '12px';
                    const currentValue = ConfigModule[meta.key];

                    if (meta.type === 'boolean') {
                        fieldDiv.innerHTML = `
                            <label style="display:flex; align-items:center; cursor:${isPlaying ? 'not-allowed' : 'pointer'};">
                                <input type="checkbox" id="cfg-${meta.key}" ${currentValue ? 'checked' : ''} ${isPlaying ? 'disabled' : ''} style="margin-right:10px; transform:scale(1.2);">
                                <span style="font-size:0.95em; opacity:${isPlaying ? '0.7' : '1'};">${meta.label}</span>
                            </label>
                        `;
                    } else if (meta.type === 'color') {
                        fieldDiv.innerHTML = `
                            <label style="display:block; font-size:0.9em; color:#bdc3c7; margin-bottom:4px; opacity:${isPlaying ? '0.7' : '1'};">${meta.label}</label>
                            <div style="display:flex; gap:10px; align-items:center;">
                                <input type="color" id="cfg-${meta.key}" value="${currentValue}" ${isPlaying ? 'disabled' : ''} style="border:none; background:none; cursor:${isPlaying ? 'not-allowed' : 'pointer'}; width:50px; height:30px; padding:0; outline:none; opacity:${isPlaying ? '0.5' : '1'};">
                                <span style="font-family:monospace; color:#2ecc71; font-size:0.9em; opacity:${isPlaying ? '0.7' : '1'};">${currentValue}</span>
                            </div>
                        `;
                    } else if (meta.type === 'string') {
                        if (meta.key === 'EQUIPMENT_SLOTS') {
                            const slots = (currentValue || '').split(',').map(s => s.trim()).filter(s => s);
                            let badgesHtml = slots.map((s, idx) => `
                                <div style="display:inline-flex; align-items:center; background:#3498db; color:#fff; padding:4px 8px; border-radius:4px; margin-right:5px; margin-bottom:5px; font-size:0.9em;">
                                    ${s}
                                    <button class="btn-del-equip-slot" data-idx="${idx}" ${isPlaying ? 'disabled' : ''} style="background:none; border:none; color:#ffb8b8; cursor:${isPlaying ? 'not-allowed' : 'pointer'}; margin-left:5px; padding:0 2px; font-weight:bold;">×</button>
                                </div>
                            `).join('');
                            
                            const availableTypes = ['Weapon', 'Armor', 'Ring', 'Amulet', 'Helmet', 'Boots', 'Shield'];
                            let addOptions = availableTypes.map(t => `<option value="${t}">+ ${t}</option>`).join('');
                            
                            fieldDiv.innerHTML = `
                                <label style="display:block; font-size:0.9em; color:#bdc3c7; margin-bottom:4px; opacity:${isPlaying ? '0.7' : '1'};">${meta.label.replace(' (comma separated)', '')}</label>
                                <div style="margin-bottom:8px; display:flex; flex-wrap:wrap;">
                                    ${badgesHtml || '<span style="color:#7f8c8d; font-size:0.85em; font-style:italic;">No slots defined</span>'}
                                </div>
                                <div style="display:flex; gap:10px; align-items:center;">
                                    <select class="equip-slot-add-select" ${isPlaying ? 'disabled' : ''} style="flex:1; padding:6px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:4px; outline:none;">
                                        ${addOptions}
                                    </select>
                                    <button class="btn-add-equip-slot" ${isPlaying ? 'disabled' : ''} style="padding:6px 12px; background:#2ecc71; border:none; color:#fff; border-radius:4px; cursor:${isPlaying ? 'not-allowed' : 'pointer'}; font-weight:bold;">Add Slot</button>
                                </div>
                                <input type="hidden" id="cfg-${meta.key}" value="${currentValue}">
                            `;
                            
                            if (!isPlaying) {
                                const addBtn = fieldDiv.querySelector('.btn-add-equip-slot');
                                const sel = fieldDiv.querySelector('.equip-slot-add-select');
                                const hiddenInput = fieldDiv.querySelector(`#cfg-${meta.key}`);
                                
                                addBtn.addEventListener('click', () => {
                                    const newType = sel.value;
                                    let currentArr = hiddenInput.value.split(',').map(s=>s.trim()).filter(s=>s);
                                    currentArr.push(newType);
                                    hiddenInput.value = currentArr.join(',');
                                    hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    buildConfigFields();
                                });
                                
                                const delBtns = fieldDiv.querySelectorAll('.btn-del-equip-slot');
                                delBtns.forEach(btn => {
                                    btn.addEventListener('click', (e) => {
                                        const idx = parseInt(e.currentTarget.getAttribute('data-idx'));
                                        let currentArr = hiddenInput.value.split(',').map(s=>s.trim()).filter(s=>s);
                                        currentArr.splice(idx, 1);
                                        hiddenInput.value = currentArr.join(',');
                                        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        buildConfigFields();
                                    });
                                });
                            }
                        } else {
                            fieldDiv.innerHTML = `
                                <label style="display:block; font-size:0.9em; color:#bdc3c7; margin-bottom:4px; opacity:${isPlaying ? '0.7' : '1'};">${meta.label}</label>
                                <input type="text" id="cfg-${meta.key}" value="${currentValue}" ${isPlaying ? 'disabled' : ''} style="width:100%; box-sizing:border-box; padding:8px 12px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; outline:none; font-size:14.5px; opacity:${isPlaying ? '0.6' : '1'}; cursor:${isPlaying ? 'not-allowed' : 'text'};">
                            `;
                        }
                    } else {
                        fieldDiv.innerHTML = `
                            <label style="display:block; font-size:0.9em; color:#bdc3c7; margin-bottom:4px; opacity:${isPlaying ? '0.7' : '1'};">${meta.label}</label>
                            <div style="display:flex; gap:15px; align-items:center;">
                                <input type="range" id="cfg-range-${meta.key}" value="${currentValue}" min="${meta.min}" max="${meta.max}" step="${meta.step}" ${isPlaying ? 'disabled' : ''} style="flex:1; cursor:${isPlaying ? 'not-allowed' : 'pointer'}; accent-color:#2ecc71; opacity:${isPlaying ? '0.5' : '1'};">
                                <input type="number" id="cfg-${meta.key}" value="${currentValue}" min="${meta.min}" max="${meta.max}" step="${meta.step}" ${isPlaying ? 'disabled' : ''} style="width:90px; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; outline:none; font-size:14px; text-align:center; font-family:monospace; opacity:${isPlaying ? '0.6' : '1'}; cursor:${isPlaying ? 'not-allowed' : 'text'};">
                            </div>
                        `;
                    }
                    catEl.appendChild(fieldDiv);
                });

                container.appendChild(catEl);
            });

            // Bind bidirectional synchronization for range sliders and input boxes
            for (const key in CONFIG_METADATA) {
                const meta = CONFIG_METADATA[key];
                if (meta.type === 'number') {
                    const rangeEl = document.getElementById(`cfg-range-${key}`);
                    const numEl = document.getElementById(`cfg-${key}`);
                    if (rangeEl && numEl) {
                        rangeEl.addEventListener('input', (e) => {
                            numEl.value = e.target.value;
                        });
                        numEl.addEventListener('input', (e) => {
                            let val = parseFloat(e.target.value);
                            if (isNaN(val)) return;
                            // Clamp value typed manually to prevent out of bounds
                            if (val < meta.min) val = meta.min;
                            if (val > meta.max) val = meta.max;
                            rangeEl.value = val;
                        });
                    }
                }
            }

            // Bind instant saving upon any interaction with the inputs (only if not playing)
            if (!isPlaying) {
                for (const key in CONFIG_METADATA) {
                    const meta = CONFIG_METADATA[key];
                    const inputEl = document.getElementById(`cfg-${key}`);
                    const rangeEl = document.getElementById(`cfg-range-${key}`);

                    if (inputEl) {
                        const eventType = (meta.type === 'boolean' || meta.type === 'color') ? 'change' : 'input';
                        inputEl.addEventListener(eventType, () => {
                            saveConfigFromUI();
                        });
                    }
                    if (rangeEl) {
                        rangeEl.addEventListener('input', () => {
                            saveConfigFromUI();
                        });
                    }
                }
            }

            // Bind search filtering
            const searchInput = document.getElementById('config-search-input');
            if (searchInput) {
                searchInput.value = this.configSearchQuery || '';
                
                const applyFilter = () => {
                    const query = searchInput.value.toLowerCase().trim();
                    this.configSearchQuery = searchInput.value; // Persist search query in UI class instance
                    const container = document.getElementById('config-fields-container');
                    if (!container) return;
                    
                    const queryTokens = query.split(/\s+/).filter(token => token.length > 0);
                    
                    const categories = container.children;
                    for (let i = 0; i < categories.length; i++) {
                        const cat = categories[i];
                        if (cat.tagName !== 'DIV' || !cat.style.borderLeft) continue; // Skip warn banner
                        
                        const catHeader = cat.children[0];
                        const catName = catHeader ? catHeader.textContent.toLowerCase() : '';
                        
                        let hasVisibleChild = false;
                        const fields = cat.children;
                        for (let j = 1; j < fields.length; j++) { // Skip header at index 0
                            const field = fields[j];
                            const label = field.textContent.toLowerCase();
                            const combinedLabel = `${catName} ${label}`;
                            
                            // A field matches if query is empty, or combined text contains ALL search tokens
                            const fieldMatches = queryTokens.length === 0 || queryTokens.every(token => combinedLabel.includes(token));
                            
                            if (fieldMatches) {
                                field.style.display = '';
                                hasVisibleChild = true;
                            } else {
                                field.style.display = 'none';
                            }
                        }
                        
                        cat.style.display = (queryTokens.length === 0 || hasVisibleChild) ? 'block' : 'none';
                    }
                };

                searchInput.oninput = applyFilter;
                
                // If there's an existing query, apply the filter immediately upon rebuilding fields!
                if (this.configSearchQuery) {
                    applyFilter();
                }
            }
        };

        const saveConfigFromUI = () => {
            const newValues = { ...ConfigModule.activeConfig };
            for (const key in CONFIG_METADATA) {
                const input = document.getElementById(`cfg-${key}`);
                if (!input) continue;

                const meta = CONFIG_METADATA[key];
                if (meta.type === 'boolean') {
                    newValues[key] = input.checked;
                } else if (meta.type === 'color') {
                    newValues[key] = input.value;
                } else if (meta.type === 'string') {
                    newValues[key] = input.value;
                } else {
                    newValues[key] = parseFloat(input.value);
                }
            }

            // Save to localStorage & dynamic live-binding exports
            updateConfig(newValues);
            
            // Broadcast the tweaked config to the network if we are host
            if (this.game && this.game.net && this.game.isHost) {
                this.game.net.send_cmd('set_data', {
                    gameplayConfig: ConfigModule.activeConfig,
                    gameplayConfigName: ConfigModule.activePresetName || 'Default',
                    classData: ConfigModule.CLASS_DATA,
                    enemyTypes: ConfigModule.ENEMY_TYPES,
                    itemsDb: ConfigModule.ITEMS_DB
                });
            }

            // Re-apply configurations onto active game components
            if (this.game) {
                if (this.game.updateLayout) {
                    this.game.updateLayout();
                }

                if (this.game.player) {
                    this.game.player.moveSpeed = ConfigModule.PLAYER_MOVE_SPEEDS[this.game.player.classType] || ConfigModule.PLAYER_MOVE_SPEEDS.default;
                    if (this.game.player.classType === 'warrior') {
                        this.game.player.atkRange = ConfigModule.WARRIOR_MELEE_RANGE;
                    } else if (this.game.player.classType === 'magicgladiator') {
                        this.game.player.atkRange = ConfigModule.MAGICGLADIATOR_MELEE_RANGE;
                    } else {
                        this.game.player.atkRange = ConfigModule.RANGED_MAX_RANGE;
                    }
                    this.updateHUD(this.game.player);
                }

                // Scenery depth ratio refresh
                if (this.game.generateScenery) {
                    this.game.generateScenery(this.game.selectedEnv);
                }
                if (this.game.broadcastState) {
                    this.game.broadcastState();
                }
            }

            if (this.game && this.game.isHost && this.game.net) {
                this.game.net.send_cmd('set_data', { 
                    gameplayConfig: ConfigModule.activeConfig,
                    gameplayConfigName: ConfigModule.activePresetName || 'Default'
                });
            }

            this.updateLobbyRulesText();
            this.updateClassCarousel();
        };

        if (btnOpenConfigEditor) {
            btnOpenConfigEditor.addEventListener('click', () => {
                settingsModal.style.display = 'none';
                configEditorModal.style.display = 'flex';
                buildConfigFields();
            });
        }

        if (btnConfigEditorCloseIcon) {
            btnConfigEditorCloseIcon.addEventListener('click', () => {
                configEditorModal.style.display = 'none';
            });
        }

        const btnConfigEditorCloseBtn = document.getElementById('btn-config-editor-close-btn');
        if (btnConfigEditorCloseBtn) {
            btnConfigEditorCloseBtn.addEventListener('click', () => {
                configEditorModal.style.display = 'none';
            });
        }

        if (btnConfigReset) {
            btnConfigReset.addEventListener('click', () => {
                resetConfig();
                buildConfigFields();
                saveConfigFromUI();
                
                // Also reset classes config to defaults!
                localStorage.removeItem('nightvibe-custom-classes');
                const defaults = {
                  warrior: { name: 'Warrior', icon: '⚔️', hp: 120, mp: 40, atk: 22, spd: 8, color: '#c0392b', accent: '#e74c3c', s1Name: 'Bash', s1Color: '#d4af37', s2Name: 'Sword Slash', s2Color: '#ffd700', bodyType: 'warrior' },
                  mage: { name: 'Mage', icon: '🔮', hp: 80, mp: 120, atk: 18, spd: 14, color: '#2980b9', accent: '#3498db', s1Name: 'Magic Bolt', s1Color: '#3498db', s2Name: 'Fireball', s2Color: '#e67e22', bodyType: 'mage' },
                  archer: { name: 'Archer', icon: '🏹', hp: 70, mp: 60, atk: 24, spd: 18, color: '#27ae60', accent: '#2ecc71', s1Name: 'Quick Shot', s1Color: '#f1c40f', s2Name: 'Arrow Barrage', s2Color: '#e74c3c', bodyType: 'archer' },
                  magicgladiator: { name: 'Magic Gladiator', icon: '✨', hp: 140, mp: 80, atk: 26, spd: 6, color: '#8e44ad', accent: '#9b59b6', s1Name: 'Psionic Slash', s1Color: '#e74c3c', s2Name: 'Cross Slash', s2Color: '#ffd700', bodyType: 'magicgladiator' }
                };
                for (const key in ConfigModule.CLASS_DATA) {
                    delete ConfigModule.CLASS_DATA[key];
                }
                Object.assign(ConfigModule.CLASS_DATA, defaults);
                
                this.saveClassesToStorage();
                this.buildClassesTab();

                // Also reset monsters config to defaults!
                localStorage.removeItem('nightvibe-custom-monsters');
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
                ConfigModule.ENEMY_TYPES.length = 0;
                ConfigModule.ENEMY_TYPES.push(...defaultMonsters);
                
                this.saveMonstersToStorage();
                this.buildMonstersTab();
                
                // Also reset items config to defaults!
                localStorage.removeItem('nightvibe-custom-items');
                const defaultItems = [
                  { name: 'Broadsword', icon: '🗡️', gearType: 'Weapon', rarity: 'normal', color: '#ecf0f1', stats: { atk: 10, maxHp: 0, spd: 0 } },
                  { name: 'Plate Armor', icon: '🛡️', gearType: 'Armor', rarity: 'magic', color: '#3498db', stats: { atk: 0, maxHp: 80, spd: 0 } },
                  { name: 'Wind Ring', icon: '💍', gearType: 'Ring', rarity: 'rare', color: '#f1c40f', stats: { atk: 2, maxHp: 10, spd: 2 } }
                ];
                ConfigModule.ITEMS_DB.length = 0;
                ConfigModule.ITEMS_DB.push(...defaultItems);
                
                this.saveItemsToStorage();
                this.buildItemsTab();
                
                this.addLog("🛠️ Custom configurations, classes, monsters and gear reset to defaults.");
            });
        }

        if (btnConfigExport) {
            btnConfigExport.addEventListener('click', () => {
                const activeConfigValues = {};
                for (const key in CONFIG_METADATA) {
                    activeConfigValues[key] = ConfigModule.activeConfig[key];
                }
                const exportData = {
                    values: activeConfigValues,
                    classes: JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA)),
                    monsters: JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES)),
                    items: JSON.parse(JSON.stringify(ConfigModule.ITEMS_DB))
                };
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
                
                let filename = 'nightvibe-gameplay-config.json';
                const presetId = ConfigModule.activePresetId;
                if (presetId.startsWith('built-in:')) {
                    filename = `nightvibe-config-${presetId.split('built-in:')[1]}.json`;
                } else if (presetId.startsWith('custom:')) {
                    const key = presetId.split('custom:')[1];
                    const presets = ConfigModule.getCustomPresets();
                    if (presets[key]) {
                        filename = `nightvibe-config-${presets[key].name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
                    }
                }
                
                const downloadAnchor = document.createElement('a');
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", filename);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();
                this.addLog(`📥 Exported preset as "${filename}"`);
            });
        }

        if (btnConfigImport && importFileInput) {
            btnConfigImport.addEventListener('click', () => {
                importFileInput.click();
            });
            importFileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        let defaultName = file.name.replace('.json', '').replace('nightvibe-config-', '');
                        defaultName = defaultName.charAt(0).toUpperCase() + defaultName.slice(1);
                        const name = await this.showPrompt("📥 Import Preset File", "Enter a name for the imported preset:", defaultName);
                        if (!name || !name.trim()) return;
                        
                        const customPresets = ConfigModule.getCustomPresets();
                        const newId = 'preset_' + Date.now();
                        
                        const mergedValues = Object.assign({}, ConfigModule.DEFAULTS, imported.values || imported);
                        const importedClasses = imported.classes || null;
                        const importedMonsters = imported.monsters || null;
                        const importedItems = imported.items || null;
                        
                        customPresets[newId] = {
                            id: newId,
                            name: name.trim(),
                            values: mergedValues,
                            classes: importedClasses,
                            monsters: importedMonsters,
                            items: importedItems
                        };
                        
                        ConfigModule.saveCustomPresets(customPresets);
                        ConfigModule.setActivePresetId(`custom:${newId}`);
                        
                        this.populateConfigSelector();
                        this.selectPreset(`custom:${newId}`);
                        buildConfigFields();
                        
                        this.addLog(`📤 Imported configuration preset "${name.trim()}" successfully!`);
                    } catch (err) {
                        await this.showAlert("❌ Import Failed", "Failed to parse configuration JSON: " + err.message);
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            });
        }
        // Bind Config Tabs
        const tabBtns = document.querySelectorAll('.config-tab-btn');
        const tabContents = document.querySelectorAll('.config-tab-content');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                tabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.style.background = '#2c3e50';
                    b.style.color = '#bdc3c7';
                });
                e.currentTarget.classList.add('active');
                e.currentTarget.style.background = '#3498db';
                e.currentTarget.style.color = '#fff';
                
                const targetId = e.currentTarget.getAttribute('data-tab');
                tabContents.forEach(tc => {
                    tc.style.display = tc.id === targetId ? 'flex' : 'none';
                });
                
                if (targetId === 'tab-char-classes') {
                    this.buildClassesTab();
                } else if (targetId === 'tab-monsters') {
                    this.buildMonstersTab();
                } else if (targetId === 'tab-items') {
                    this.buildItemsTab();
                }
            });
        });

        // Add new class button binding
        const btnAddClass = document.getElementById('btn-add-class');
        if (btnAddClass) {
            btnAddClass.addEventListener('click', async () => {
                const isPlaying = this.game && this.game.state === 'PLAYING';
                if (isPlaying) {
                    await this.showAlert("⚠️ Active Session", "Cannot add classes while a game session is active.");
                    return;
                }
                const newId = 'custom_' + Date.now();
                ConfigModule.CLASS_DATA[newId] = {
                    name: 'New Class', icon: '👤', hp: 100, mp: 50, atk: 20, spd: 10,
                    color: '#95a5a6', accent: '#7f8c8d', s1Name: 'Bash', s1Color: '#bdc3c7', s2Name: 'Sword Slash', s2Color: '#ecf0f1',
                    bodyType: 'warrior'
                };
                this.saveClassesToStorage();
                this.buildClassesTab();
            });
        }

        // Add new monster button binding
        const btnAddMonster = document.getElementById('btn-add-monster');
        if (btnAddMonster) {
            btnAddMonster.addEventListener('click', async () => {
                const isPlaying = this.game && this.game.state === 'PLAYING';
                if (isPlaying) {
                    await this.showAlert("⚠️ Active Session", "Cannot add monsters while a game session is active.");
                    return;
                }
                ConfigModule.ENEMY_TYPES.push({
                    name: 'New Monster', icon: '👾', hp: 50, atk: 10,
                    color: '#95a5a6', speed: 0.5, size: 22
                });
                this.saveMonstersToStorage();
                this.buildMonstersTab();
            });
        }

        // Add new gear button binding
        const btnAddItem = document.getElementById('btn-add-item');
        if (btnAddItem) {
            btnAddItem.addEventListener('click', async () => {
                const isPlaying = this.game && this.game.state === 'PLAYING';
                if (isPlaying) {
                    await this.showAlert("⚠️ Active Session", "Cannot add gear while a game session is active.");
                    return;
                }
                ConfigModule.ITEMS_DB.push({
                    name: 'New Gear', icon: '💎', gearType: 'Ring', rarity: 'normal',
                    color: '#e67e22', stats: { atk: 5, maxHp: 20, spd: 1 }
                });
                this.saveItemsToStorage();
                this.buildItemsTab();
            });
        }

        this.updateLobbyRulesText();
        this.initInventory();
    }

    saveClassesToStorage() {
        localStorage.setItem('nightvibe-custom-classes', JSON.stringify(ConfigModule.CLASS_DATA));
        this.updateClassCarousel(); // Refresh main menu UI classes
        
        // Also update inside the active custom preset
        const presetId = ConfigModule.activePresetId;
        if (presetId && presetId.startsWith('custom:')) {
            const key = presetId.split('custom:')[1];
            const presets = ConfigModule.getCustomPresets();
            if (presets[key]) {
                presets[key].classes = JSON.parse(JSON.stringify(ConfigModule.CLASS_DATA));
                ConfigModule.saveCustomPresets(presets);
            }
        }
        
        if (this.game && this.game.isHost && this.game.net) {
            this.game.net.send_cmd('set_data', { classData: ConfigModule.CLASS_DATA });
        }
    }

    buildClassesTab() {
        const container = document.getElementById('visual-char-classes-container');
        if (!container) return;
        container.innerHTML = '';
        
        const isPlaying = this.game && this.game.state === 'PLAYING';

        if (isPlaying) {
            const warnBanner = document.createElement('div');
            warnBanner.style.background = 'rgba(231, 76, 60, 0.15)';
            warnBanner.style.border = '1px solid #e74c3c';
            warnBanner.style.padding = '10px 15px';
            warnBanner.style.borderRadius = '6px';
            warnBanner.style.marginBottom = '15px';
            warnBanner.style.color = '#ff6b6b';
            warnBanner.style.fontWeight = 'bold';
            warnBanner.style.textAlign = 'center';
            warnBanner.style.fontSize = '0.9em';
            warnBanner.innerHTML = '⚠️ Active Session: Settings are read-only and locked to the Host\'s gameplay configuration.';
            container.appendChild(warnBanner);
        }

        for (const [classId, classData] of Object.entries(ConfigModule.CLASS_DATA)) {
            const classCard = document.createElement('div');
            classCard.style.background = 'rgba(0,0,0,0.3)';
            classCard.style.border = `2px solid ${classData.color || '#3498db'}`;
            classCard.style.borderRadius = '8px';
            classCard.style.padding = '15px';
            classCard.style.marginBottom = '15px';
            classCard.style.display = 'flex';
            classCard.style.flexDirection = 'column';
            classCard.style.gap = '10px';
            
            const headerRow = document.createElement('div');
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.borderBottom = '1px solid #34495e';
            headerRow.style.paddingBottom = '8px';
            
            const iconHtml = (classData.icon.startsWith('data:image/') || classData.icon.startsWith('http')) ? 
                `<img src="${classData.icon}" style="width:1.8em; height:1.8em; object-fit:contain; border-radius:4px;" />` : 
                `<span style="font-size:1.8em;">${classData.icon}</span>`;
            const titleHtml = `<div style="display:flex; align-items:center; gap:10px;">
                <div class="class-icon-preview">${iconHtml}</div>
                <h3 style="margin:0; color:${classData.color}; font-size:1.3em;">${classData.name} <span style="font-size:0.6em; color:#95a5a6; font-family:monospace;">(${classId})</span></h3>
            </div>`;
            
            headerRow.innerHTML = titleHtml;
            classCard.appendChild(headerRow);
            
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gap = '10px';
            
            const addField = (label, key, type, step = 1, options = null) => {
                const wrapper = document.createElement('div');
                const disabledAttr = isPlaying ? 'disabled' : '';
                const opacityStyle = isPlaying ? 'opacity: 0.6; cursor: not-allowed;' : '';
                
                let inputHtml = '';
                if (type === 'color') {
                    inputHtml = `<div style="display:flex; gap:10px; align-items:center;">
                        <input type="color" data-key="${key}" value="${classData[key] || '#ffffff'}" ${disabledAttr} style="border:none; background:none; width:40px; height:30px; padding:0; ${opacityStyle}">
                    </div>`;
                } else if (type === 'number') {
                    inputHtml = `<input type="number" data-key="${key}" value="${classData[key] || 0}" step="${step}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-family:monospace; ${opacityStyle}">`;
                } else if (type === 'select' && options) {
                    let optionsHtml = '';
                    let currentValue = classData[key];
                    if (!currentValue && key === 'bodyType') {
                        currentValue = classData.bodyType || (['warrior', 'mage', 'archer', 'magicgladiator'].includes(classId) ? classId : 'warrior');
                    }
                    options.forEach(opt => {
                        const selectedAttr = currentValue === opt ? 'selected' : '';
                        optionsHtml += `<option value="${opt}" ${selectedAttr}>${opt}</option>`;
                    });
                    inputHtml = `<select data-key="${key}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; ${opacityStyle}">${optionsHtml}</select>`;
                } else if (type === 'custom-icon') {
                    const currentIcon = classData[key] || '👤';
                    const displayEmoji = (currentIcon.startsWith('data:image/') || currentIcon.startsWith('http')) ? '👤' : currentIcon;
                    
                    inputHtml = `<div class="custom-icon-picker-container" style="position:relative; display:flex; flex-direction:column; gap:6px; ${opacityStyle}">
                        <div style="display:flex; gap:6px; align-items:center;">
                            <!-- Styled Custom Emoji Toggle Button -->
                            <button type="button" class="custom-emoji-btn" ${disabledAttr} style="width:60px; height:34px; padding:0; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; cursor:pointer; font-size:1.4em; display:flex; align-items:center; justify-content:center; transition: all 0.2s ease;">
                                ${displayEmoji}
                            </button>
                            
                            <span style="color:#bdc3c7; font-size:0.9em;">or</span>
                            
                            <label style="flex:1; text-align:center; padding:7px 10px; background:#16a085; border:1px solid #1abc9c; color:#fff; border-radius:5px; cursor:pointer; font-weight:bold; font-size:0.85em; display:inline-block; user-select:none; transition: all 0.2s ease; ${disabledAttr ? 'pointer-events:none; opacity:0.6;' : ''}">
                                📤 Photo
                                <input type="file" accept="image/*" class="photo-upload" ${disabledAttr} style="display:none;">
                            </label>
                        </div>
                        
                        <!-- Floating Custom Popover Emoji Picker -->
                        <div class="custom-emoji-picker-popover" style="display:none; position:absolute; z-index:1000; top:40px; left:0; width:260px; background:rgba(30, 39, 46, 0.98); border:1px solid #34495e; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.5); padding:10px; backdrop-filter:blur(10px); flex-direction:column; gap:8px;">
                            <!-- Search Header -->
                            <div style="position:relative; display:flex; align-items:center;">
                                <input type="text" class="emoji-search-input" placeholder="🔍 Search emojis..." style="width:100%; box-sizing:border-box; padding:6px 10px; padding-left:28px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-size:0.85em;">
                                <span style="position:absolute; left:8px; color:#95a5a6; font-size:0.9em; pointer-events:none;">🔍</span>
                            </div>
                            
                            <!-- Emojis Grid Scrollable -->
                            <div class="emoji-grid-scroll" style="max-height:160px; overflow-y:auto; display:grid; grid-template-columns: repeat(6, 1fr); gap:6px; padding-right:4px;">
                                <!-- populated dynamically -->
                            </div>
                        </div>

                        <!-- Raw Text Input (hidden) -->
                        <input type="text" data-key="${key}" value="${classData[key] || ''}" ${disabledAttr} placeholder="Emoji or Image Base64 string" style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-size:0.85em; font-family:monospace; display:none;">
                    </div>`;
                } else {
                    inputHtml = `<input type="text" data-key="${key}" value="${classData[key] || ''}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; ${opacityStyle}">`;
                }
                
                wrapper.innerHTML = `<label style="display:block; font-size:0.85em; color:#bdc3c7; margin-bottom:4px;">${label}</label>${inputHtml}`;
                grid.appendChild(wrapper);

                if (type === 'custom-icon') {
                    const emojiBtn = wrapper.querySelector('.custom-emoji-btn');
                    const popover = wrapper.querySelector('.custom-emoji-picker-popover');
                    const searchInput = wrapper.querySelector('.emoji-search-input');
                    const emojiGrid = wrapper.querySelector('.emoji-grid-scroll');
                    const fileInput = wrapper.querySelector('.photo-upload');
                    const textInput = wrapper.querySelector('input[data-key="icon"]');

                    const EMOJI_LIST = [
                        { char: "⚔️", tags: "sword warrior fight weapon attack clash" },
                        { char: "🛡️", tags: "shield defense guard armor tank protection" },
                        { char: "🏹", tags: "bow archer arrow shoot range hunter" },
                        { char: "🔮", tags: "orb crystal ball mage magic wizard sorcerer" },
                        { char: "✨", tags: "sparkles gladiator magic star shine light" },
                        { char: "🔥", tags: "fire flame hot burn red element" },
                        { char: "❄️", tags: "ice frost snow cold freeze element blue" },
                        { char: "⚡", tags: "lightning thunder shock electric yellow element" },
                        { char: "🌀", tags: "vortex swirl wind tempest hurricane element" },
                        { char: "💀", tags: "skull death dead bones poison necromancer" },
                        { char: "👑", tags: "king queen crown gold royalty royal" },
                        { char: "🎒", tags: "backpack bag inventory items gear" },
                        { char: "🧪", tags: "potion flask chemistry science lab alchemist magic" },
                        { char: "🏺", tags: "potion urn jar base vase loot" },
                        { char: "🗝️", tags: "key lock secret dungeon loot chest" },
                        { char: "💎", tags: "gem crystal diamond jewel sapphire ruby emerald" },
                        { char: "👤", tags: "player character person avatar shadow human" },
                        { char: "🥷", tags: "ninja assassin stealth shadow dagger thief" },
                        { char: "🧙", tags: "wizard mage sorcerer warlock magic old spell" },
                        { char: "🧚", tags: "fairy elf pixie magic wings green" },
                        { char: "🧛", tags: "vampire blood fangs dark bite count vampire" },
                        { char: "🧟", tags: "zombie undead monster dead brain bite walker" },
                        { char: "🧜", tags: "mermaid siren water sea trident ocean aquaman" },
                        { char: "🧝", tags: "elf ranger ear legolas archer nature green" },
                        { char: "👾", tags: "alien space invader retro gamer pixel game" },
                        { char: "🤖", tags: "robot android cyborg tech metal future machine" },
                        { char: "🦊", tags: "fox animal red tails clever beast" },
                        { char: "🦁", tags: "lion cat wild king claws beast gold" },
                        { char: "🐯", tags: "tiger cat wild stripes claws beast" },
                        { char: "🐻", tags: "bear grizzly claws beast wild forest" },
                        { char: "🐼", tags: "panda bear cute bamboo black white beast" },
                        { char: "🐺", tags: "wolf beast wild dog moon howl forest gray" },
                        { char: "🍀", tags: "clover leaf lucky luck green nature" },
                        { char: "🌱", tags: "sprout plant grow nature life leaf wood" },
                        { char: "🌹", tags: "rose flower red love romantic nature beauty" },
                        { char: "🍁", tags: "maple leaf autumn fall orange nature wood" },
                        { char: "🍄", tags: "mushroom fungus poison toadstool nature forest" },
                        { char: "⭐", tags: "star yellow shine sky space celestial glow" },
                        { char: "🌙", tags: "moon crescent night sky space dark celestial" },
                        { char: "☀️", tags: "sun hot day light bright celestial yellow" },
                        { char: "☁️", tags: "cloud sky white weather sky element" },
                        { char: "🌊", tags: "wave water sea ocean blue splash element" },
                        { char: "🌋", tags: "volcano magma lava fire element mountain" },
                        { char: "☄️", tags: "comet meteor space celestial fire fall star" },
                        { char: "🪐", tags: "saturn planet space celestial orbit rings" },
                        { char: "🌍", tags: "earth world planet space map globe green blue" },
                        { char: "🐾", tags: "paw print track animal steps footprints walk" },
                        { char: "👁️", tags: "eye vision sight see look watch observe pupil" },
                        { char: "❤️", tags: "heart red love life hp health blood" },
                        { char: "🖤", tags: "black heart dark shadow evil death gothic" },
                        { char: "💚", tags: "green heart nature life health poison recovery" },
                        { char: "💙", tags: "blue heart mana water magic ice cool" },
                        { char: "💛", tags: "yellow heart light gold thunder spark joy" },
                        { char: "💜", tags: "purple heart poison shadow curse mystical amethyst" },
                        { char: "💥", tags: "explosion boom blast hit collision spark attack" },
                        { char: "💨", tags: "dash wind speed smoke escape quick move" },
                        { char: "💤", tags: "sleep tired status slow stun dream rest" },
                        { char: "💢", tags: "anger mad attack crit critical damage hit rage" },
                        { char: "☣️", tags: "biohazard toxic poison plague sickness health" },
                        { char: "☢️", tags: "radiation atomic toxic hazard blast energy green" },
                        { char: "📢", tags: "megaphone speaker announce chat volume notify talk" },
                        { char: "⚠️", tags: "warning alert danger caution sign border yellow" },
                        { char: "🎯", tags: "target aim range center archery hit bullseye focus" },
                        { char: "🎲", tags: "dice roll gamble luck chance board boardgame" }
                    ];

                    const renderGrid = (query = '') => {
                        emojiGrid.innerHTML = '';
                        const filtered = EMOJI_LIST.filter(item => {
                            return item.char.includes(query) || item.tags.toLowerCase().includes(query.toLowerCase());
                        });

                        if (filtered.length === 0) {
                            emojiGrid.innerHTML = `<div style="grid-column: span 6; text-align:center; padding: 15px; color:#7f8c8d; font-size: 0.85em;">No emojis found</div>`;
                            return;
                        }

                        filtered.forEach(item => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.innerText = item.char;
                            btn.style.width = '32px';
                            btn.style.height = '32px';
                            btn.style.padding = '0';
                            btn.style.background = '#2c3e50';
                            btn.style.border = '1px solid #34495e';
                            btn.style.color = '#fff';
                            btn.style.borderRadius = '4px';
                            btn.style.cursor = 'pointer';
                            btn.style.fontSize = '1.3em';
                            btn.style.display = 'flex';
                            btn.style.alignItems = 'center';
                            btn.style.justifyContent = 'center';
                            btn.style.transition = 'all 0.15s ease';
                            
                            btn.onmouseover = () => {
                                btn.style.background = '#34495e';
                                btn.style.borderColor = '#1abc9c';
                            };
                            btn.onmouseout = () => {
                                btn.style.background = '#2c3e50';
                                btn.style.borderColor = '#34495e';
                            };
                            
                            btn.onclick = () => {
                                textInput.value = item.char;
                                emojiBtn.innerText = item.char;
                                textInput.dispatchEvent(new Event('input', { bubbles: true }));
                                popover.style.display = 'none';
                            };
                            emojiGrid.appendChild(btn);
                        });
                    };

                    // Initial render
                    renderGrid();

                    // Toggle Popover
                    if (emojiBtn) {
                        emojiBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const isVisible = popover.style.display === 'flex';
                            
                            // Close any other open popovers first
                            document.querySelectorAll('.custom-emoji-picker-popover').forEach(p => {
                                p.style.display = 'none';
                            });

                            if (!isVisible) {
                                popover.style.display = 'flex';
                                searchInput.value = '';
                                renderGrid();
                                searchInput.focus();
                            }
                        });
                    }

                    // Filter search
                    if (searchInput) {
                        searchInput.addEventListener('input', (e) => {
                            renderGrid(e.target.value.trim());
                        });
                        searchInput.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });
                    }

                    // Close popover when clicking outside
                    document.addEventListener('click', () => {
                        if (popover) popover.style.display = 'none';
                    });

                    // Avoid popover closure when clicking inside popover container
                    popover.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });

                    // Photo upload
                    if (fileInput) {
                        fileInput.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const img = new Image();
                                    img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        const MAX_SIZE = 128;
                                        let w = img.width;
                                        let h = img.height;
                                        if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
                                        else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
                                        canvas.width = w; canvas.height = h;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, w, h);
                                        const dataUrl = canvas.toDataURL('image/png', 0.8);
                                        
                                        textInput.value = dataUrl;
                                        emojiBtn.innerText = '👤'; // fallback smiley for images
                                        textInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        popover.style.display = 'none';
                                    };
                                    img.src = event.target.result;
                                };
                                reader.readAsDataURL(file);
                            }
                        });
                    }
                }
            };

            addField('Class Name', 'name', 'text');
            addField('Icon / Emoji', 'icon', 'custom-icon');
            addField('Base HP', 'hp', 'number', 10);
            addField('Base MP', 'mp', 'number', 10);
            addField('Base Attack', 'atk', 'number', 2);
            addField('Base Speed', 'spd', 'number', 1);
            addField('Primary Color', 'color', 'color');
            addField('Accent Color', 'accent', 'color');
            addField('Body Type', 'bodyType', 'select', 1, ['warrior', 'mage', 'archer', 'magicgladiator']);
            addField('Skill 1 Name', 's1Name', 'select', 1, ['Bash', 'Magic Bolt', 'Quick Shot', 'Psionic Slash']);
            addField('Skill 1 Color', 's1Color', 'color');
            addField('Skill 2 Name', 's2Name', 'select', 1, ['Sword Slash', 'Fireball', 'Arrow Barrage', 'Cross Slash']);
            addField('Skill 2 Color', 's2Color', 'color');

            classCard.appendChild(grid);
            
            if (!isPlaying) {
                // Event listener to save dynamically
                const inputs = classCard.querySelectorAll('input, select');
                inputs.forEach(input => {
                    const eventType = input.type === 'color' || input.type === 'number' || input.tagName === 'SELECT' ? 'change' : 'input';
                    input.addEventListener(eventType, (e) => {
                        const key = e.target.getAttribute('data-key');
                        let val = e.target.value;
                        if (e.target.type === 'number') val = parseFloat(val) || 0;
                        ConfigModule.CLASS_DATA[classId][key] = val;
                        classCard.style.borderColor = ConfigModule.CLASS_DATA[classId].color || '#3498db';
                        headerRow.querySelector('h3').style.color = ConfigModule.CLASS_DATA[classId].color || '#3498db';
                        headerRow.querySelector('h3').innerHTML = `${ConfigModule.CLASS_DATA[classId].name} <span style="font-size:0.6em; color:#95a5a6; font-family:monospace;">(${classId})</span>`;
                        const iconPreview = headerRow.querySelector('.class-icon-preview');
                        if (iconPreview) {
                            const newIcon = ConfigModule.CLASS_DATA[classId].icon;
                            iconPreview.innerHTML = (newIcon.startsWith('data:image/') || newIcon.startsWith('http')) ? 
                                `<img src="${newIcon}" style="width:1.8em; height:1.8em; object-fit:contain; border-radius:4px;" />` : 
                                `<span style="font-size:1.8em;">${newIcon}</span>`;
                        }
                        this.saveClassesToStorage();
                    });
                });
                
                const btnDelete = document.createElement('button');
                btnDelete.innerText = '🗑️ Delete Class';
                btnDelete.style.background = '#e74c3c';
                btnDelete.style.color = '#fff';
                btnDelete.style.border = 'none';
                btnDelete.style.padding = '8px';
                btnDelete.style.borderRadius = '5px';
                btnDelete.style.marginTop = '10px';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontWeight = 'bold';
                btnDelete.onclick = () => {
                    delete ConfigModule.CLASS_DATA[classId];
                    this.saveClassesToStorage();
                    this.buildClassesTab();
                };
                classCard.appendChild(btnDelete);
            }
            
            container.appendChild(classCard);
        }
    }

    saveMonstersToStorage() {
        localStorage.setItem('nightvibe-custom-monsters', JSON.stringify(ConfigModule.ENEMY_TYPES));
        
        // Also update inside the active custom preset
        const presetId = ConfigModule.activePresetId;
        if (presetId && presetId.startsWith('custom:')) {
            const key = presetId.split('custom:')[1];
            const presets = ConfigModule.getCustomPresets();
            if (presets[key]) {
                presets[key].monsters = JSON.parse(JSON.stringify(ConfigModule.ENEMY_TYPES));
                ConfigModule.saveCustomPresets(presets);
            }
        }
        
        if (this.game && this.game.isHost && this.game.net) {
            this.game.net.send_cmd('set_data', { enemyTypes: ConfigModule.ENEMY_TYPES });
        }
        if (this.game && this.game.broadcastState) {
            this.game.broadcastState();
        }
    }

    buildMonstersTab() {
        const container = document.getElementById('visual-monsters-container');
        if (!container) return;
        container.innerHTML = '';
        
        const isPlaying = this.game && this.game.state === 'PLAYING';

        if (isPlaying) {
            const warnBanner = document.createElement('div');
            warnBanner.style.background = 'rgba(231, 76, 60, 0.15)';
            warnBanner.style.border = '1px solid #e74c3c';
            warnBanner.style.padding = '10px 15px';
            warnBanner.style.borderRadius = '6px';
            warnBanner.style.marginBottom = '15px';
            warnBanner.style.color = '#ff6b6b';
            warnBanner.style.fontWeight = 'bold';
            warnBanner.style.textAlign = 'center';
            warnBanner.style.fontSize = '0.9em';
            warnBanner.innerHTML = '⚠️ Active Session: Settings are read-only and locked to the Host\'s gameplay configuration.';
            container.appendChild(warnBanner);
        }

        ConfigModule.ENEMY_TYPES.forEach((monster, index) => {
            const monsterCard = document.createElement('div');
            monsterCard.style.background = 'rgba(0,0,0,0.3)';
            monsterCard.style.border = `2px solid ${monster.color || '#2ecc71'}`;
            monsterCard.style.borderRadius = '8px';
            monsterCard.style.padding = '15px';
            monsterCard.style.marginBottom = '15px';
            monsterCard.style.display = 'flex';
            monsterCard.style.flexDirection = 'column';
            monsterCard.style.gap = '10px';
            
            const headerRow = document.createElement('div');
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.borderBottom = '1px solid #34495e';
            headerRow.style.paddingBottom = '8px';
            
            const iconHtml = (monster.icon.startsWith('data:image/') || monster.icon.startsWith('http')) ? 
                `<img src="${monster.icon}" style="width:1.8em; height:1.8em; object-fit:contain; border-radius:4px;" />` : 
                `<span style="font-size:1.8em;">${monster.icon}</span>`;
            const titleHtml = `<div style="display:flex; align-items:center; gap:10px;">
                <div class="monster-icon-preview">${iconHtml}</div>
                <h3 style="margin:0; color:${monster.color}; font-size:1.3em;">${monster.name} <span style="font-size:0.6em; color:#95a5a6; font-family:monospace;">(index: ${index})</span></h3>
            </div>`;
            
            headerRow.innerHTML = titleHtml;
            monsterCard.appendChild(headerRow);
            
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gap = '10px';
            
            const addField = (label, key, type, step = 1, options = null) => {
                const wrapper = document.createElement('div');
                const disabledAttr = isPlaying ? 'disabled' : '';
                const opacityStyle = isPlaying ? 'opacity: 0.6; cursor: not-allowed;' : '';
                
                let inputHtml = '';
                if (type === 'color') {
                    inputHtml = `<div style="display:flex; gap:10px; align-items:center;">
                        <input type="color" data-key="${key}" value="${monster[key] || '#ffffff'}" ${disabledAttr} style="border:none; background:none; width:40px; height:30px; padding:0; ${opacityStyle}">
                    </div>`;
                } else if (type === 'number') {
                    inputHtml = `<input type="number" data-key="${key}" value="${monster[key] || 0}" step="${step}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-family:monospace; ${opacityStyle}">`;
                } else if (type === 'custom-icon') {
                    const currentIcon = monster[key] || '👾';
                    const displayEmoji = (currentIcon.startsWith('data:image/') || currentIcon.startsWith('http')) ? '👾' : currentIcon;
                    
                    inputHtml = `<div class="custom-icon-picker-container" style="position:relative; display:flex; flex-direction:column; gap:6px; ${opacityStyle}">
                        <div style="display:flex; gap:6px; align-items:center;">
                            <!-- Styled Custom Emoji Toggle Button -->
                            <button type="button" class="custom-emoji-btn" ${disabledAttr} style="width:60px; height:34px; padding:0; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; cursor:pointer; font-size:1.4em; display:flex; align-items:center; justify-content:center; transition: all 0.2s ease;">
                                ${displayEmoji}
                            </button>
                            
                            <span style="color:#bdc3c7; font-size:0.9em;">or</span>
                            
                            <label style="flex:1; text-align:center; padding:7px 10px; background:#16a085; border:1px solid #1abc9c; color:#fff; border-radius:5px; cursor:pointer; font-weight:bold; font-size:0.85em; display:inline-block; user-select:none; transition: all 0.2s ease; ${disabledAttr ? 'pointer-events:none; opacity:0.6;' : ''}">
                                📤 Photo
                                <input type="file" accept="image/*" class="photo-upload" ${disabledAttr} style="display:none;">
                            </label>
                        </div>
                        
                        <!-- Floating Custom Popover Emoji Picker -->
                        <div class="custom-emoji-picker-popover" style="display:none; position:absolute; z-index:1000; top:40px; left:0; width:260px; background:rgba(30, 39, 46, 0.98); border:1px solid #34495e; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.5); padding:10px; backdrop-filter:blur(10px); flex-direction:column; gap:8px;">
                            <!-- Search Header -->
                            <div style="position:relative; display:flex; align-items:center;">
                                <input type="text" class="emoji-search-input" placeholder="🔍 Search emojis..." style="width:100%; box-sizing:border-box; padding:6px 10px; padding-left:28px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-size:0.85em;">
                                <span style="position:absolute; left:8px; color:#95a5a6; font-size:0.9em; pointer-events:none;">🔍</span>
                            </div>
                            
                            <!-- Emojis Grid Scrollable -->
                            <div class="emoji-grid-scroll" style="max-height:160px; overflow-y:auto; display:grid; grid-template-columns: repeat(6, 1fr); gap:6px; padding-right:4px;">
                                <!-- populated dynamically -->
                            </div>
                        </div>

                        <!-- Raw Text Input (hidden) -->
                        <input type="text" data-key="${key}" value="${monster[key] || ''}" ${disabledAttr} placeholder="Emoji or Image Base64 string" style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-size:0.85em; font-family:monospace; display:none;">
                    </div>`;
                } else {
                    inputHtml = `<input type="text" data-key="${key}" value="${monster[key] || ''}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; ${opacityStyle}">`;
                }
                
                wrapper.innerHTML = `<label style="display:block; font-size:0.85em; color:#bdc3c7; margin-bottom:4px;">${label}</label>${inputHtml}`;
                grid.appendChild(wrapper);

                if (type === 'custom-icon') {
                    const emojiBtn = wrapper.querySelector('.custom-emoji-btn');
                    const popover = wrapper.querySelector('.custom-emoji-picker-popover');
                    const searchInput = wrapper.querySelector('.emoji-search-input');
                    const emojiGrid = wrapper.querySelector('.emoji-grid-scroll');
                    const fileInput = wrapper.querySelector('.photo-upload');
                    const textInput = wrapper.querySelector('input[data-key="icon"]');

                    const EMOJI_LIST = [
                        { char: "🟢", tags: "green slime ball drop monster" },
                        { char: "👺", tags: "goblin red mask japanese nose mask monster" },
                        { char: "💀", tags: "skeleton skull death bones poison undead" },
                        { char: "👹", tags: "orc ogre red demon face teeth horns monster" },
                        { char: "👻", tags: "ghost phantom spirit floating white monster" },
                        { char: "🔥", tags: "demon fire flame red lava monster" },
                        { char: "🐉", tags: "dragon reptile beast orange wings giant lizard monster" },
                        { char: "🧙", tags: "lich wizard dark mage warlock magic old skull death" },
                        { char: "👾", tags: "slime alien space retro game monster" },
                        { char: "🧟", tags: "zombie undead rot bite green monster" },
                        { char: "🕷️", tags: "spider bug insect venom legs web monster" },
                        { char: "🦂", tags: "scorpion venom claws tail sting desert monster" },
                        { char: "🦇", tags: "bat wing flying dark vampire beast monster" },
                        { char: "🐺", tags: "wolf dog gray moon wild beast monster" },
                        { char: "🐍", tags: "snake poison venom slither green reptile monster" },
                        { char: "👁️", tags: "eye beholder watcher evil optical look monster" },
                        { char: "🦎", tags: "lizard green reptile tail beast monster" },
                        { char: "🦖", tags: "t-rex dinosaur t-rex giant reptile teeth monster" },
                        { char: "🦈", tags: "shark teeth fish water sea blue monster" },
                        { char: "🐙", tags: "octopus kraken sea water red monster" },
                        { char: "🦀", tags: "crab water sea orange shell claws monster" },
                        { char: "🐝", tags: "wasp bee yellow sting bug wings monster" },
                        { char: "🦟", tags: "mosquito sting fly bug vampire blood monster" },
                        { char: "🍄", tags: "mushroom spore poison cap fungus red monster" }
                    ];

                    const renderGrid = (query = '') => {
                        emojiGrid.innerHTML = '';
                        const filtered = EMOJI_LIST.filter(item => {
                            return item.char.includes(query) || item.tags.toLowerCase().includes(query.toLowerCase());
                        });

                        if (filtered.length === 0) {
                            emojiGrid.innerHTML = `<div style="grid-column: span 6; text-align:center; padding: 15px; color:#7f8c8d; font-size: 0.85em;">No emojis found</div>`;
                            return;
                        }

                        filtered.forEach(item => {
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.innerText = item.char;
                            btn.style.width = '32px';
                            btn.style.height = '32px';
                            btn.style.padding = '0';
                            btn.style.background = '#2c3e50';
                            btn.style.border = '1px solid #34495e';
                            btn.style.color = '#fff';
                            btn.style.borderRadius = '4px';
                            btn.style.cursor = 'pointer';
                            btn.style.fontSize = '1.3em';
                            btn.style.display = 'flex';
                            btn.style.alignItems = 'center';
                            btn.style.justifyContent = 'center';
                            btn.style.transition = 'all 0.15s ease';
                            
                            btn.onmouseover = () => {
                                btn.style.background = '#34495e';
                                btn.style.borderColor = '#1abc9c';
                            };
                            btn.onmouseout = () => {
                                btn.style.background = '#2c3e50';
                                btn.style.borderColor = '#34495e';
                            };
                            
                            btn.onclick = () => {
                                textInput.value = item.char;
                                emojiBtn.innerText = item.char;
                                textInput.dispatchEvent(new Event('input', { bubbles: true }));
                                popover.style.display = 'none';
                            };
                            emojiGrid.appendChild(btn);
                        });
                    };

                    renderGrid();

                    if (emojiBtn) {
                        emojiBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            const isVisible = popover.style.display === 'flex';
                            
                            document.querySelectorAll('.custom-emoji-picker-popover').forEach(p => {
                                p.style.display = 'none';
                            });

                            if (!isVisible) {
                                popover.style.display = 'flex';
                                searchInput.value = '';
                                renderGrid();
                                searchInput.focus();
                            }
                        });
                    }

                    if (searchInput) {
                        searchInput.addEventListener('input', (e) => {
                            renderGrid(e.target.value.trim());
                        });
                        searchInput.addEventListener('click', (e) => {
                            e.stopPropagation();
                        });
                    }

                    document.addEventListener('click', () => {
                        if (popover) popover.style.display = 'none';
                    });

                    popover.addEventListener('click', (e) => {
                        e.stopPropagation();
                    });

                    if (fileInput) {
                        fileInput.addEventListener('change', (e) => {
                            const file = e.target.files[0];
                            if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                    const img = new Image();
                                    img.onload = () => {
                                        const canvas = document.createElement('canvas');
                                        const MAX_SIZE = 128;
                                        let w = img.width;
                                        let h = img.height;
                                        if (w > h) { if (w > MAX_SIZE) { h *= MAX_SIZE / w; w = MAX_SIZE; } } 
                                        else { if (h > MAX_SIZE) { w *= MAX_SIZE / h; h = MAX_SIZE; } }
                                        canvas.width = w; canvas.height = h;
                                        const ctx = canvas.getContext('2d');
                                        ctx.drawImage(img, 0, 0, w, h);
                                        const dataUrl = canvas.toDataURL('image/png', 0.8);
                                        
                                        textInput.value = dataUrl;
                                        emojiBtn.innerText = '👾'; // fallback smiley for images
                                        textInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        popover.style.display = 'none';
                                    };
                                    img.src = event.target.result;
                                };
                                reader.readAsDataURL(file);
                            }
                        });
                    }
                }
            };

            addField('Monster Name', 'name', 'text');
            addField('Icon / Emoji', 'icon', 'custom-icon');
            addField('Base HP', 'hp', 'number', 5);
            addField('Base Attack', 'atk', 'number', 1);
            addField('Accent Color', 'color', 'color');
            addField('Base Speed', 'speed', 'number', 0.05);
            addField('Physical Size', 'size', 'number', 1);

            monsterCard.appendChild(grid);
            
            if (!isPlaying) {
                const inputs = monsterCard.querySelectorAll('input');
                inputs.forEach(input => {
                    const eventType = input.type === 'color' || input.type === 'number' ? 'change' : 'input';
                    input.addEventListener(eventType, (e) => {
                        const key = e.target.getAttribute('data-key');
                        let val = e.target.value;
                        if (e.target.type === 'number') val = parseFloat(val) || 0;
                        ConfigModule.ENEMY_TYPES[index][key] = val;
                        monsterCard.style.borderColor = ConfigModule.ENEMY_TYPES[index].color || '#2ecc71';
                        headerRow.querySelector('h3').style.color = ConfigModule.ENEMY_TYPES[index].color || '#2ecc71';
                        headerRow.querySelector('h3').innerHTML = `${ConfigModule.ENEMY_TYPES[index].name} <span style="font-size:0.6em; color:#95a5a6; font-family:monospace;">(index: ${index})</span>`;
                        const iconPreview = headerRow.querySelector('.monster-icon-preview');
                        if (iconPreview) {
                            const newIcon = ConfigModule.ENEMY_TYPES[index].icon;
                            iconPreview.innerHTML = (newIcon.startsWith('data:image/') || newIcon.startsWith('http')) ? 
                                `<img src="${newIcon}" style="width:1.8em; height:1.8em; object-fit:contain; border-radius:4px;" />` : 
                                `<span style="font-size:1.8em;">${newIcon}</span>`;
                        }
                        this.saveMonstersToStorage();
                    });
                });
                
                const btnDelete = document.createElement('button');
                btnDelete.innerText = '🗑️ Delete Monster';
                btnDelete.style.background = '#e74c3c';
                btnDelete.style.color = '#fff';
                btnDelete.style.border = 'none';
                btnDelete.style.padding = '8px';
                btnDelete.style.borderRadius = '5px';
                btnDelete.style.marginTop = '10px';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontWeight = 'bold';
                btnDelete.onclick = () => {
                    ConfigModule.ENEMY_TYPES.splice(index, 1);
                    this.saveMonstersToStorage();
                    this.buildMonstersTab();
                };
                monsterCard.appendChild(btnDelete);
            }
            
            container.appendChild(monsterCard);
        });
    }

    saveItemsToStorage() {
        localStorage.setItem('nightvibe-custom-items', JSON.stringify(ConfigModule.ITEMS_DB));
        
        const presetId = ConfigModule.activePresetId;
        if (presetId && presetId.startsWith('custom:')) {
            const key = presetId.split('custom:')[1];
            const presets = ConfigModule.getCustomPresets();
            if (presets[key]) {
                presets[key].items = JSON.parse(JSON.stringify(ConfigModule.ITEMS_DB));
                ConfigModule.saveCustomPresets(presets);
            }
        }
        
        if (this.game && this.game.isHost && this.game.net) {
            this.game.net.send_cmd('set_data', { itemsDb: ConfigModule.ITEMS_DB });
        }
        if (this.game && this.game.broadcastState) {
            this.game.broadcastState();
        }
    }

    buildItemsTab() {
        const container = document.getElementById('visual-items-container');
        if (!container) return;
        container.innerHTML = '';
        
        const isPlaying = this.game && this.game.state === 'PLAYING';

        if (isPlaying) {
            const warnBanner = document.createElement('div');
            warnBanner.style.background = 'rgba(231, 76, 60, 0.15)';
            warnBanner.style.border = '1px solid #e74c3c';
            warnBanner.style.padding = '10px 15px';
            warnBanner.style.borderRadius = '6px';
            warnBanner.style.marginBottom = '15px';
            warnBanner.style.color = '#ff6b6b';
            warnBanner.style.fontWeight = 'bold';
            warnBanner.style.textAlign = 'center';
            warnBanner.style.fontSize = '0.9em';
            warnBanner.innerHTML = '⚠️ Active Session: Settings are read-only and locked to the Host\'s gameplay configuration.';
            container.appendChild(warnBanner);
        }

        ConfigModule.ITEMS_DB.forEach((item, index) => {
            const itemCard = document.createElement('div');
            itemCard.style.background = 'rgba(0,0,0,0.3)';
            itemCard.style.border = `2px solid ${item.color || '#e67e22'}`;
            itemCard.style.borderRadius = '8px';
            itemCard.style.padding = '15px';
            itemCard.style.marginBottom = '15px';
            itemCard.style.display = 'flex';
            itemCard.style.flexDirection = 'column';
            itemCard.style.gap = '10px';
            
            const headerRow = document.createElement('div');
            headerRow.style.display = 'flex';
            headerRow.style.justifyContent = 'space-between';
            headerRow.style.alignItems = 'center';
            headerRow.style.borderBottom = '1px solid #34495e';
            headerRow.style.paddingBottom = '8px';
            
            const iconHtml = (item.icon.startsWith('data:image/') || item.icon.startsWith('http')) ? 
                `<img src="${item.icon}" style="width:1.8em; height:1.8em; object-fit:contain; border-radius:4px;" />` : 
                `<span style="font-size:1.8em;">${item.icon}</span>`;
            const titleHtml = `<div style="display:flex; align-items:center; gap:10px;">
                <div class="item-icon-preview">${iconHtml}</div>
                <h3 style="margin:0; color:${item.color}; font-size:1.3em;">${item.name} <span style="font-size:0.6em; color:#95a5a6; font-family:monospace;">(index: ${index})</span></h3>
            </div>`;
            
            headerRow.innerHTML = titleHtml;
            itemCard.appendChild(headerRow);
            
            const grid = document.createElement('div');
            grid.style.display = 'grid';
            grid.style.gridTemplateColumns = '1fr 1fr';
            grid.style.gap = '10px';
            
            const addField = (label, key, type, step = 1, options = null) => {
                const wrapper = document.createElement('div');
                const disabledAttr = isPlaying ? 'disabled' : '';
                const opacityStyle = isPlaying ? 'opacity: 0.6; cursor: not-allowed;' : '';
                
                let inputHtml = '';
                if (type === 'color') {
                    inputHtml = `<div style="display:flex; gap:10px; align-items:center;">
                        <input type="color" data-key="${key}" value="${item[key] || '#ffffff'}" ${disabledAttr} style="border:none; background:none; width:40px; height:30px; padding:0; ${opacityStyle}">
                    </div>`;
                } else if (type === 'number') {
                    const isStat = key.startsWith('stats.');
                    const statKey = isStat ? key.split('.')[1] : null;
                    const val = isStat ? (item.stats[statKey] || 0) : (item[key] || 0);
                    inputHtml = `<input type="number" data-key="${key}" value="${val}" step="${step}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-family:monospace; ${opacityStyle}">`;
                } else if (type === 'select') {
                    const val = item[key] || '';
                    let optHtml = '';
                    options.forEach(opt => {
                        const sel = opt.value === val ? 'selected' : '';
                        optHtml += `<option value="${opt.value}" ${sel}>${opt.label}</option>`;
                    });
                    inputHtml = `<select data-key="${key}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; ${opacityStyle}">${optHtml}</select>`;
                } else if (type === 'custom-icon') {
                    const currentIcon = item[key] || '💎';
                    const displayEmoji = (currentIcon.startsWith('data:image/') || currentIcon.startsWith('http')) ? '💎' : currentIcon;
                    
                    inputHtml = `<div class="custom-icon-picker-container" style="position:relative; display:flex; flex-direction:column; gap:6px; ${opacityStyle}">
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button type="button" class="custom-emoji-btn" ${disabledAttr} style="width:60px; height:34px; padding:0; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; cursor:pointer; font-size:1.4em; display:flex; align-items:center; justify-content:center; transition: all 0.2s ease;">
                                ${displayEmoji}
                            </button>
                            <span style="color:#bdc3c7; font-size:0.9em;">or</span>
                            <label style="flex:1; text-align:center; padding:7px 10px; background:#16a085; border:1px solid #1abc9c; color:#fff; border-radius:5px; cursor:pointer; font-weight:bold; font-size:0.85em; display:inline-block; user-select:none; transition: all 0.2s ease; ${disabledAttr ? 'pointer-events:none; opacity:0.6;' : ''}">
                                📤 Photo
                                <input type="file" accept="image/*" class="photo-upload" ${disabledAttr} style="display:none;">
                            </label>
                        </div>
                        <div class="custom-emoji-picker-popover" style="display:none; position:absolute; z-index:1000; top:40px; left:0; width:260px; background:rgba(30, 39, 46, 0.98); border:1px solid #34495e; border-radius:8px; box-shadow:0 8px 30px rgba(0,0,0,0.5); padding:10px; backdrop-filter:blur(10px); flex-direction:column; gap:8px;">
                            <div style="position:relative; display:flex; align-items:center;">
                                <input type="text" class="emoji-search-input" placeholder="🔍 Search emojis..." style="width:100%; box-sizing:border-box; padding:6px 10px; padding-left:28px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; font-size:0.85em;">
                                <span style="position:absolute; left:8px; color:#95a5a6; font-size:0.9em; pointer-events:none;">🔍</span>
                            </div>
                            <div class="emoji-grid-scroll" style="max-height:160px; overflow-y:auto; display:grid; grid-template-columns: repeat(6, 1fr); gap:6px; padding-right:4px;">
                            </div>
                        </div>
                        <input type="text" data-key="${key}" value="${item[key] || ''}" ${disabledAttr} style="display:none;">
                    </div>`;
                } else {
                    inputHtml = `<input type="text" data-key="${key}" value="${item[key] || ''}" ${disabledAttr} style="width:100%; box-sizing:border-box; padding:6px 10px; background:#2c3e50; border:1px solid #34495e; color:#fff; border-radius:5px; ${opacityStyle}">`;
                }
                
                wrapper.innerHTML = `<label style="display:block; font-size:0.85em; color:#bdc3c7; margin-bottom:4px;">${label}</label>${inputHtml}`;
                grid.appendChild(wrapper);

                if (type === 'custom-icon') {
                    const emojiBtn = wrapper.querySelector('.custom-emoji-btn');
                    const popover = wrapper.querySelector('.custom-emoji-picker-popover');
                    const searchInput = wrapper.querySelector('.emoji-search-input');
                    const emojiGrid = wrapper.querySelector('.emoji-grid-scroll');
                    const fileInput = wrapper.querySelector('.photo-upload');
                    const textInput = wrapper.querySelector('input[data-key="icon"]');

                    const EMOJI_LIST = [
                        { char: "🗡️", tags: "weapon sword dagger blade slice gear" },
                        { char: "⚔️", tags: "weapon swords dual fight combat gear" },
                        { char: "🛡️", tags: "shield defense guard armor tank protection gear" },
                        { char: "💍", tags: "ring jewelry finger stats gold magic gear" },
                        { char: "📿", tags: "amulet necklace beads jewelry magic stats gear" },
                        { char: "🏹", tags: "weapon bow arrow range hunter gear" },
                        { char: "🪓", tags: "weapon axe hatchet lumber chop gear" },
                        { char: "🧙", tags: "staff wizard warlock magic lich gear" },
                        { char: "💎", tags: "gem crystal diamond blue treasure rich gear" },
                        { char: "👑", tags: "crown king queen gold royalty head gear" },
                        { char: "🏺", tags: "urn vase pot jar magic gear" },
                        { char: "🗝️", tags: "key lock secret room dungeon gear" }
                    ];

                    const renderEmojis = (filter = '') => {
                        emojiGrid.innerHTML = '';
                        const cleanFilter = filter.toLowerCase().trim();
                        EMOJI_LIST.forEach(em => {
                            if (cleanFilter && !em.tags.includes(cleanFilter) && !em.char.includes(cleanFilter)) {
                                return;
                            }
                            const btn = document.createElement('button');
                            btn.type = 'button';
                            btn.innerText = em.char;
                            btn.style.width = '32px';
                            btn.style.height = '32px';
                            btn.style.padding = '0';
                            btn.style.background = '#2c3e50';
                            btn.style.border = '1px solid #34495e';
                            btn.style.color = '#fff';
                            btn.style.borderRadius = '4px';
                            btn.style.cursor = 'pointer';
                            btn.style.fontSize = '1.3em';
                            btn.style.display = 'flex';
                            btn.style.alignItems = 'center';
                            btn.style.justifyContent = 'center';
                            btn.style.transition = 'all 0.15s ease';
                            
                            btn.onmouseover = () => {
                                btn.style.background = '#34495e';
                                btn.style.borderColor = '#1abc9c';
                            };
                            btn.onmouseout = () => {
                                btn.style.background = '#2c3e50';
                                btn.style.borderColor = '#34495e';
                            };
                            
                            btn.onclick = () => {
                                textInput.value = em.char;
                                textInput.dispatchEvent(new Event('input', { bubbles: true }));
                                popover.style.display = 'none';
                            };
                            emojiGrid.appendChild(btn);
                        });
                    };

                    if (!isPlaying) {
                        emojiBtn.onclick = (e) => {
                            e.stopPropagation();
                            const isShown = popover.style.display === 'flex';
                            document.querySelectorAll('.custom-emoji-picker-popover').forEach(p => p.style.display = 'none');
                            popover.style.display = isShown ? 'none' : 'flex';
                            if (!isShown) {
                                renderEmojis();
                                searchInput.value = '';
                                setTimeout(() => searchInput.focus(), 50);
                            }
                        };

                        searchInput.oninput = (e) => {
                            renderEmojis(e.target.value);
                        };

                        fileInput.onchange = (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (event) => {
                                const img = new Image();
                                img.onload = () => {
                                    const canvas = document.createElement('canvas');
                                    const MAX_SIZE = 128;
                                    let w = img.width, h = img.height;
                                    if (w > h && w > MAX_SIZE) { h = h * (MAX_SIZE / w); w = MAX_SIZE; }
                                    else if (h > MAX_SIZE) { w = w * (MAX_SIZE / h); h = MAX_SIZE; }
                                    canvas.width = w;
                                    canvas.height = h;
                                    const ctx = canvas.getContext('2d');
                                    ctx.drawImage(img, 0, 0, w, h);
                                    const base64 = canvas.toDataURL('image/webp', 0.8);
                                    textInput.value = base64;
                                    textInput.dispatchEvent(new Event('input', { bubbles: true }));
                                };
                                img.src = event.target.result;
                            };
                            reader.readAsDataURL(file);
                        };

                        popover.onclick = (e) => e.stopPropagation();
                    }
                }
            };

            addField('Gear Name', 'name', 'text');
            addField('Icon / Emoji', 'icon', 'custom-icon');
            addField('Accent Color', 'color', 'color');
            addField('Gear Type', 'gearType', 'select', 1, [
                { value: 'Weapon', label: '⚔️ Weapon' },
                { value: 'Armor', label: '🛡️ Armor' },
                { value: 'Ring', label: '💍 Ring' },
                { value: 'Amulet', label: '📿 Amulet' }
            ]);
            addField('Rarity', 'rarity', 'select', 1, [
                { value: 'normal', label: '⚪ Normal' },
                { value: 'magic', label: '🔵 Magic' },
                { value: 'rare', label: '🟡 Rare' }
            ]);
            addField('ATK Scaling Multiplier', 'stats.atk', 'number', 1);
            addField('HP Scaling Multiplier', 'stats.maxHp', 'number', 5);
            addField('SPD Scaling Multiplier', 'stats.spd', 'number', 0.5);

            itemCard.appendChild(grid);
            
            if (!isPlaying) {
                const inputs = itemCard.querySelectorAll('input, select');
                inputs.forEach(input => {
                    const eventType = input.tagName === 'SELECT' || input.type === 'color' || input.type === 'number' ? 'change' : 'input';
                    input.addEventListener(eventType, (e) => {
                        const key = e.target.getAttribute('data-key');
                        if (!key) return;
                        
                        let val = e.target.value;
                        if (e.target.type === 'number') val = parseFloat(val) || 0;
                        
                        if (key.startsWith('stats.')) {
                            const statKey = key.split('.')[1];
                            ConfigModule.ITEMS_DB[index].stats[statKey] = val;
                        } else {
                            ConfigModule.ITEMS_DB[index][key] = val;
                        }
                        
                        itemCard.style.borderColor = ConfigModule.ITEMS_DB[index].color || '#e67e22';
                        headerRow.querySelector('h3').style.color = ConfigModule.ITEMS_DB[index].color || '#e67e22';
                        headerRow.querySelector('h3').innerHTML = `${ConfigModule.ITEMS_DB[index].name} <span style="font-size:0.6em; color:#95a5a6; font-family:monospace;">(index: ${index})</span>`;
                        const iconPreview = headerRow.querySelector('.item-icon-preview');
                        if (iconPreview) {
                            const newIcon = ConfigModule.ITEMS_DB[index].icon;
                            iconPreview.innerHTML = (newIcon.startsWith('data:image/') || newIcon.startsWith('http')) ? 
                                `<img src="${newIcon}" style="width:1.8em; height:1.8em; object-fit:contain; border-radius:4px;" />` : 
                                `<span style="font-size:1.8em;">${newIcon}</span>`;
                        }
                        this.saveItemsToStorage();
                    });
                });
                
                const btnDelete = document.createElement('button');
                btnDelete.innerText = '🗑️ Delete Gear';
                btnDelete.style.background = '#e74c3c';
                btnDelete.style.color = '#fff';
                btnDelete.style.border = 'none';
                btnDelete.style.padding = '8px';
                btnDelete.style.borderRadius = '5px';
                btnDelete.style.marginTop = '10px';
                btnDelete.style.cursor = 'pointer';
                btnDelete.style.fontWeight = 'bold';
                btnDelete.onclick = () => {
                    ConfigModule.ITEMS_DB.splice(index, 1);
                    this.saveItemsToStorage();
                    this.buildItemsTab();
                };
                itemCard.appendChild(btnDelete);
            }
            
            container.appendChild(itemCard);
        });
    }

    initInventory() {
        const btnInventory = document.getElementById('btn-inventory');
        const btnMenuInventory = document.getElementById('btn-menu-inventory');
        const inventoryModal = document.getElementById('inventory-modal');
        const btnInventoryClose = document.getElementById('btn-inventory-close');
        const btnInventoryCloseIcon = document.getElementById('btn-inventory-close-icon');

        const toggleInventory = () => {
            if (inventoryModal.style.display === 'flex') {
                inventoryModal.style.display = 'none';
            } else {
                inventoryModal.style.display = 'flex';
                this.renderInventory();
            }
        };

        if (btnInventory) btnInventory.addEventListener('click', toggleInventory);
        if (btnMenuInventory) btnMenuInventory.addEventListener('click', toggleInventory);
        
        const closeModal = () => { if (inventoryModal) inventoryModal.style.display = 'none'; };
        if (btnInventoryClose) btnInventoryClose.addEventListener('click', closeModal);
        if (btnInventoryCloseIcon) btnInventoryCloseIcon.addEventListener('click', closeModal);
    }


    validateGearSlots() {
        let p = null;
        if (this.game && this.game.player) {
            p = this.game.player;
        } else {
            try {
                const savedInv = JSON.parse(localStorage.getItem('nightvibe-inventory') || '[]');
                const savedEq = JSON.parse(localStorage.getItem('nightvibe-equipment') || '{}');
                p = { inventory: savedInv, equipment: savedEq };
            } catch (e) {
                p = { inventory: [], equipment: {} };
            }
        }

        const fallbackSlots = "Weapon,Armor,Ring 1,Ring 2,Amulet";
        const rawSlots = ConfigModule.EQUIPMENT_SLOTS || fallbackSlots;
        const validSlotNames = String(rawSlots).split(',').map(s => s.trim());
        let changed = false;

        for (const slot in p.equipment) {
            const item = p.equipment[slot];
            if (!item) continue;
            
            let valid = validSlotNames.includes(slot);
            
            if (valid && ConfigModule.ENFORCE_GEAR_SLOTS) {
                const itemType = (item.gearType || item.type || '').toLowerCase();
                if (!slot.toLowerCase().includes(itemType)) {
                    valid = false;
                }
            }
            
            if (!valid) {
                p.inventory.push(item);
                delete p.equipment[slot];
                changed = true;
            }
        }

        if (changed) {
            if (this.game && this.game.player) {
                this.game.saveLocalProgression();
                this.game.broadcastState();
            } else {
                localStorage.setItem('nightvibe-inventory', JSON.stringify(p.inventory));
                localStorage.setItem('nightvibe-equipment', JSON.stringify(p.equipment));
            }
            if (this.addLog) {
                 this.addLog(`⚠️ Invalid gear unequipped due to config changes.`);
            }
        }
        return changed;
    }

    renderInventory() {
        let p = null;
        if (this.game && this.game.player) {
            p = this.game.player;
        } else {
            // Player not spawned yet (Main Menu), pull directly from local storage
            try {
                const savedInv = JSON.parse(localStorage.getItem('nightvibe-inventory') || '[]');
                const savedEq = JSON.parse(localStorage.getItem('nightvibe-equipment') || '{}');
                p = { inventory: savedInv, equipment: savedEq };
            } catch (e) {
                p = { inventory: [], equipment: {} };
            }
        }
        
        const detailsPanel = document.getElementById('inventory-details-panel');
        if (detailsPanel) detailsPanel.style.display = 'none'; // reset panel on re-render
        
        const showDetails = (item, isEquipped, slotNameOrIndex, element) => {
            document.querySelectorAll('.inv-active-highlight').forEach(el => {
                el.classList.remove('inv-active-highlight');
                el.style.transform = 'scale(1)';
                if (el.dataset.isEquipped === 'true') {
                    el.style.borderColor = el.dataset.itemColor;
                    el.style.boxShadow = `0 0 10px ${el.dataset.itemColor}66`;
                } else {
                    el.style.borderColor = el.dataset.itemColor;
                    el.style.boxShadow = 'none';
                }
            });
            if (element) {
                element.classList.add('inv-active-highlight');
                element.style.setProperty('--highlight-color', item.color || '#f1c40f');
            }
            if (!detailsPanel) return;
            detailsPanel.style.display = 'flex';
            
            const dIcon = document.getElementById('inv-details-icon');
            const dName = document.getElementById('inv-details-name');
            const dType = document.getElementById('inv-details-type');
            const dStats = document.getElementById('inv-details-stats');
            const btnPrimary = document.getElementById('btn-inv-action-primary');
            const btnDrop = document.getElementById('btn-inv-action-drop');
            
            let resolvedIcon = item.icon || '💎';
            if (resolvedIcon === '📦') {
                const template = ConfigModule.ITEMS_DB.find(t => t.name === item.name);
                if (template && template.icon) resolvedIcon = template.icon;
            }
            if (resolvedIcon && typeof resolvedIcon === 'string' && (resolvedIcon.startsWith('data:image/') || resolvedIcon.startsWith('http'))) {
                dIcon.innerHTML = `<img src="${resolvedIcon}" style="width:100%; height:100%; object-fit:contain; border-radius:4px;" />`;
            } else {
                dIcon.innerText = resolvedIcon;
            }
            
            dName.textContent = item.name || 'Item';
            dName.style.color = item.color || '#fff';
            dType.textContent = item.gearType || item.type || 'Consumable';
            
            dStats.innerHTML = item.stats ? Object.entries(item.stats).map(([k, v]) => `<div><strong style="color:#fff;">${k.toUpperCase()}:</strong> +${v.toFixed(1)}</div>`).join('') : 'No stats';
            
            btnPrimary.textContent = isEquipped ? 'Unequip' : 'Equip';
            
            let canEquip = true;
            let targetSlotForValidation = null;
            if (!isEquipped) {
                const fallbackSlots = "Weapon,Armor,Ring 1,Ring 2,Amulet";
                const rawSlots = ConfigModule.EQUIPMENT_SLOTS || fallbackSlots;
                const slotNames = String(rawSlots).split(',').map(s => s.trim());
                const itemType = (item.gearType || item.type || '').toLowerCase();
                if (ConfigModule.ENFORCE_GEAR_SLOTS) {
                    targetSlotForValidation = slotNames.find(s => s.toLowerCase().includes(itemType) && !p.equipment[s]) || slotNames.find(s => s.toLowerCase().includes(itemType));
                } else {
                    targetSlotForValidation = slotNames.find(s => s.toLowerCase().includes(itemType)) || slotNames.find(s => !p.equipment[s]) || slotNames[0];
                }
                if (!targetSlotForValidation) canEquip = false;
            }
            
            if (canEquip) {
                btnPrimary.disabled = false;
                btnPrimary.style.opacity = '1';
                btnPrimary.style.cursor = 'pointer';
            } else {
                btnPrimary.disabled = true;
                btnPrimary.style.opacity = '0.5';
                btnPrimary.style.cursor = 'not-allowed';
            }
            
            btnPrimary.onclick = () => {
                if (!canEquip) return;
                
                if (isEquipped) {
                    p.inventory.push(item);
                    delete p.equipment[slotNameOrIndex];
                } else {
                    if (targetSlotForValidation) {
                        if (p.equipment[targetSlotForValidation]) {
                            p.inventory.push(p.equipment[targetSlotForValidation]);
                        }
                        p.equipment[targetSlotForValidation] = item;
                        p.inventory.splice(slotNameOrIndex, 1);
                    }
                }
                
                if (this.game && this.game.player) {
                    this.game.saveLocalProgression();
                    this.game.broadcastState();
                    this.updateHUD(p);
                } else {
                    localStorage.setItem('nightvibe-inventory', JSON.stringify(p.inventory));
                    localStorage.setItem('nightvibe-equipment', JSON.stringify(p.equipment));
                }
                this.renderInventory();
            };
            
            btnDrop.onclick = () => {
                if (isEquipped) {
                    delete p.equipment[slotNameOrIndex];
                } else {
                    p.inventory.splice(slotNameOrIndex, 1);
                }
                item.x = (this.game && this.game.player) ? p.x + (Math.random() * 60 - 30) : ConfigModule.GAME_W / 2 + (Math.random() * 60 - 30);
                item.y = (this.game && this.game.player) ? p.y + (Math.random() * 60 - 30) + 20 : ConfigModule.GAME_H / 2 + (Math.random() * 60 - 30) + 20;
                item.life = 60000;
                if (this.game && this.game.player) {
                    if (this.game.isHost) {
                        this.game.items.push(item);
                    } else {
                        const netItem = { ...item, icon: (item.icon && typeof item.icon === 'string' && item.icon.startsWith('data:image/')) ? '📦' : item.icon };
                        this.game.net.send_cmd('set_data', { spawnItem: netItem });
                    }
                    this.game.saveLocalProgression();
                    this.game.broadcastState();
                    this.updateHUD(p);
                } else {
                    localStorage.setItem('nightvibe-inventory', JSON.stringify(p.inventory));
                    localStorage.setItem('nightvibe-equipment', JSON.stringify(p.equipment));
                }
                this.renderInventory();
            };
        };
        
        // Render Equipment Slots
        const eqContainer = document.getElementById('equipment-slots-container');
        if (eqContainer) {
            eqContainer.innerHTML = '';
            const fallbackSlots = "Weapon,Armor,Ring 1,Ring 2,Amulet";
            const rawSlots = ConfigModule.EQUIPMENT_SLOTS || fallbackSlots;
            const slotNames = String(rawSlots).split(',').map(s => s.trim());
            slotNames.forEach(slotName => {
                const slotDiv = document.createElement('div');
                slotDiv.style.width = '70px';
                slotDiv.style.height = '70px';
                slotDiv.style.border = '2px dashed #7f8c8d';
                slotDiv.style.borderRadius = '8px';
                slotDiv.style.display = 'flex';
                slotDiv.style.flexDirection = 'column';
                slotDiv.style.alignItems = 'center';
                slotDiv.style.justifyContent = 'center';
                slotDiv.style.background = '#2c3e50';
                slotDiv.style.cursor = 'pointer';
                slotDiv.style.transition = '0.2s';
                slotDiv.onmouseover = () => { slotDiv.style.transform = 'scale(1.05)'; };
                slotDiv.onmouseout = () => { if (!slotDiv.classList.contains('inv-active-highlight')) slotDiv.style.transform = 'scale(1)'; };
                
                const label = document.createElement('div');
                label.innerText = slotName;
                label.style.fontSize = '0.65em';
                label.style.color = '#bdc3c7';
                label.style.marginBottom = '2px';
                label.style.textTransform = 'uppercase';
                label.style.fontWeight = 'bold';
                slotDiv.appendChild(label);

                const itemData = p.equipment[slotName];
                if (itemData) {
                    const itemVisual = document.createElement('div');
                    itemVisual.style.width = '100%';
                    itemVisual.style.height = '100%';
                    itemVisual.style.display = 'flex';
                    itemVisual.style.alignItems = 'center';
                    itemVisual.style.justifyContent = 'center';
                    
                    let resolvedIcon = itemData.icon || '💎';
                    if (resolvedIcon === '📦') {
                      const template = ConfigModule.ITEMS_DB.find(t => t.name === itemData.name);
                      if (template && template.icon) resolvedIcon = template.icon;
                    }

                    if (resolvedIcon && typeof resolvedIcon === 'string' && (resolvedIcon.startsWith('data:image/') || resolvedIcon.startsWith('http'))) {
                        itemVisual.innerHTML = `<img src="${resolvedIcon}" style="width:40px; height:40px; object-fit:contain; border-radius:4px;" />`;
                    } else {
                        itemVisual.innerText = resolvedIcon || '💎';
                        itemVisual.style.fontSize = '2.5em';
                    }
                    
                    let statText = itemData.stats ? Object.entries(itemData.stats).map(([k, v]) => `${k.toUpperCase()}: +${v.toFixed(1)}`).join(', ') : '';
                    itemVisual.title = `${itemData.name || 'Equipped Item'}\n${statText}`;
                    slotDiv.appendChild(itemVisual);
                    slotDiv.style.border = `2px solid ${itemData.color || '#2ecc71'}`;
                    slotDiv.style.background = 'rgba(46, 204, 113, 0.15)';
                    slotDiv.dataset.isEquipped = 'true';
                    slotDiv.dataset.itemColor = itemData.color || '#2ecc71';
                    slotDiv.style.boxShadow = `0 0 10px ${itemData.color || '#2ecc71'}66`;
                    
                    slotDiv.addEventListener('click', () => {
                        if (itemData) showDetails(itemData, true, slotName, slotDiv);
                    });
                    slotDiv.addEventListener('dblclick', () => {
                        const btn = document.getElementById('btn-inv-action-primary');
                        if (btn && !btn.disabled) btn.click();
                    });
                    slotDiv.addEventListener('contextmenu', (e) => {
                        e.preventDefault();
                        if (itemData) {
                            showDetails(itemData, true, slotName, slotDiv);
                            const btnDrop = document.getElementById('btn-inv-action-drop');
                            if (btnDrop) btnDrop.click();
                        }
                    });
                } else {
                    const emptyVisual = document.createElement('div');
                    emptyVisual.innerText = '🔒';
                    emptyVisual.style.opacity = '0.2';
                    emptyVisual.style.fontSize = '1.5em';
                    slotDiv.appendChild(emptyVisual);
                }
                eqContainer.appendChild(slotDiv);
            });
        }

        // Render Inventory Grid
        const invContainer = document.getElementById('inventory-grid');
        if (invContainer) {
            invContainer.innerHTML = '';
            
            p.inventory.forEach((item, index) => {
                const cell = document.createElement('div');
                cell.style.width = '100%';
                cell.style.aspectRatio = '1 / 1';
                cell.style.border = `2px solid ${item.color || '#95a5a6'}`;
                cell.style.borderRadius = '8px';
                cell.style.background = '#34495e';
                cell.style.display = 'flex';
                cell.style.alignItems = 'center';
                cell.style.justifyContent = 'center';
                cell.style.fontSize = '2em';
                cell.style.cursor = 'pointer';
                
                let statText = item.stats ? Object.entries(item.stats).map(([k, v]) => `${k.toUpperCase()}: +${v.toFixed(1)}`).join('\n') : '';
                cell.title = `${item.name || 'Item'}\n${statText}`;
                cell.dataset.isEquipped = 'false';
                cell.dataset.itemColor = item.color || '#95a5a6';
                let resolvedIcon = item.icon || '💎';
                if (resolvedIcon === '📦') {
                    const template = ConfigModule.ITEMS_DB.find(t => t.name === item.name);
                    if (template && template.icon) resolvedIcon = template.icon;
                }
                
                if (resolvedIcon && typeof resolvedIcon === 'string' && (resolvedIcon.startsWith('data:image/') || resolvedIcon.startsWith('http'))) {
                    cell.innerHTML = `<img src="${resolvedIcon}" style="width:40px; height:40px; object-fit:contain; border-radius:4px;" />`;
                } else {
                    cell.innerText = resolvedIcon || '💎';
                }
                cell.style.transition = '0.2s';
                cell.onmouseover = () => { cell.style.transform = 'scale(1.1)'; cell.style.borderColor = '#f1c40f'; cell.style.boxShadow = `0 0 10px ${item.color || '#f1c40f'}99`; };
                cell.onmouseout = () => { if (!cell.classList.contains('inv-active-highlight')) { cell.style.transform = 'scale(1)'; cell.style.borderColor = item.color || '#95a5a6'; cell.style.boxShadow = 'none'; } };
                
                cell.addEventListener('click', () => {
                    showDetails(item, false, index, cell);
                });
                cell.addEventListener('dblclick', () => {
                    const btn = document.getElementById('btn-inv-action-primary');
                    if (btn && !btn.disabled) btn.click();
                });
                cell.addEventListener('contextmenu', (e) => {
                    e.preventDefault();
                    showDetails(item, false, index, cell);
                    const btnDrop = document.getElementById('btn-inv-action-drop');
                    if (btnDrop) btnDrop.click();
                });
                invContainer.appendChild(cell);
            });

            // Fill empty cells
            const minCells = 24;
            for (let i = p.inventory.length; i < minCells; i++) {
                const cell = document.createElement('div');
                cell.style.width = '100%';
                cell.style.aspectRatio = '1 / 1';
                cell.style.border = '2px dashed #7f8c8d';
                cell.style.borderRadius = '8px';
                cell.style.background = 'rgba(52, 73, 94, 0.3)';
                invContainer.appendChild(cell);
            }
        }
    }

    showRebirthConfirm(title, message, onYes, onNo) {
        const modal = document.getElementById('rebirth-modal');
        const titleEl = modal ? modal.querySelector('h2') : null;
        const textEl = document.getElementById('rebirth-modal-text');

        if (!modal || !textEl) return;

        if (titleEl) titleEl.innerText = title;
        textEl.innerText = message;
        modal.style.display = 'flex';

        const confirmBtn = document.getElementById('btn-rebirth-confirm');
        const cancelBtn = document.getElementById('btn-rebirth-cancel');

        const newConfirmBtn = confirmBtn.cloneNode(true);
        const newCancelBtn = cancelBtn.cloneNode(true);

        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);

        newConfirmBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            if (onYes) onYes();
        });

        newCancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            if (onNo) onNo();
        });
    }

    nextClass() {
        this.currentCarouselIndex = (this.currentCarouselIndex + 1) % this.classes.length;
        this.updateClassCarousel();
    }

    prevClass() {
        this.currentCarouselIndex = (this.currentCarouselIndex - 1 + this.classes.length) % this.classes.length;
        this.updateClassCarousel();
    }

    updateClassCarousel() {
        this.classes = Object.keys(ConfigModule.CLASS_DATA);
        if (this.currentCarouselIndex >= this.classes.length) this.currentCarouselIndex = 0;
        
        this.selectedClass = this.classes[this.currentCarouselIndex];
        localStorage.setItem('night-vibe-online_selected-class', this.selectedClass);
        const cd = ConfigModule.CLASS_DATA[this.selectedClass];
        document.getElementById('current-class-name').textContent = cd.name;
        const classIconEl = document.getElementById('class-icon');
        if (classIconEl) {
            if (cd.icon.startsWith('data:image/') || cd.icon.startsWith('http')) {
                classIconEl.innerHTML = `<img src="${cd.icon}" style="width:1.2em; height:1.2em; object-fit:contain; border-radius:8px; vertical-align:middle; display:inline-block;" />`;
            } else {
                classIconEl.textContent = cd.icon;
            }
        }
        document.getElementById('stat-hp').innerHTML = `<strong style="color:#e74c3c">HP (Health Points): ${cd.hp}</strong><br><span style="color:#bdc3c7;font-size:0.9em;">Maximum life capacity. If it reaches 0, you die.</span>`;
        document.getElementById('stat-mp').innerHTML = `<strong style="color:#9b59b6">SPD (Speed): ${cd.spd}</strong><br><span style="color:#bdc3c7;font-size:0.9em;">Increases movement speed, S2 AOE size, and reduces S2 cooldown — higher SPD = faster and bigger attacks.</span>`;
        document.getElementById('stat-atk').innerHTML = `<strong style="color:#f39c12">ATK (Attack Damage): ${cd.atk}</strong><br><span style="color:#bdc3c7;font-size:0.9em;">Base value of damage dealt to enemies. Scales with level and stat upgrades.</span>`;

        const sk = ConfigModule.SKILL_DESC[this.selectedClass] || {
            s1: { name: cd.s1Name || 'Basic Attack', desc: 'Standard attack', ctrl: 'Left-click enemy' },
            s2: { name: cd.s2Name || 'Special Attack', desc: 'Special ability', ctrl: 'Right-click / long-press' }
        };

        // Calculate derived stats from HP/MP/ATK
        const baseMoveSpeed = ConfigModule.PLAYER_MOVE_SPEEDS[this.selectedClass] || 2.5;
        const baseS2Cooldown = 5000;
        const s1Scale = 1.0;
        const aoeScale = 1.0;
        const armor = Math.floor(cd.hp / 10);
        const dmgReduction = (armor * 0.5).toFixed(1);

        document.getElementById('controls-section').innerHTML =
            `<div class="ctrl-line"><span class="ctrl-label">S1:</span> ${sk.s1.ctrl} → <span class="s">${sk.s1.name}</span><br>${sk.s1.desc}</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">S2:</span> ${sk.s2.ctrl} → <span class="s">${sk.s2.name}</span><br>${sk.s2.desc} <span style="color:#f66">(${(baseS2Cooldown / 1000).toFixed(0)}s CD)</span></div>` +
            `<div style="margin-top:8px; border-top:1px solid #4a4a6a; padding-top:6px;">` +
            `<div class="ctrl-line"><span class="ctrl-label">MOVE:</span> ${baseMoveSpeed} base — increased by SPD stat upgrades</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">S1 Scale:</span> ${((s1Scale - 1) * 100).toFixed(0)}% — scales with ATK upgrades</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">S2 AOE:</span> ${((aoeScale - 1) * 100).toFixed(0)}% — scales with SPD stat</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">S2 CD:</span> ${baseS2Cooldown}ms base — reduced by SPD stat</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">Armor:</span> ${armor} (reduces incoming damage by ${dmgReduction}%) — based on HP</div>` +
            `</div>` +
            `<div style="margin-top:6px; border-top:1px solid #4a4a6a; padding-top:6px;">` +
            `<div class="ctrl-line"><span class="ctrl-label">Combat:</span> Left-click enemies to attack, left-click ground to move</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">Targeting:</span> Click enemy icon to auto-track and chase within range</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">Melee:</span> Warrior/MagicGladiator — short range, close combat</div>` +
            `<div class="ctrl-line"><span class="ctrl-label">Ranged:</span> Archer/Mage — can attack from distance, must close in for melee</div>` +
            `</div>`;

        if (this.game && this.game.state === 'PLAYING' && this.game.player) {
            this.game.player.color = cd.color;
            this.game.player.accent = cd.accent;
        }
    }

    updateLobbyRulesText() {
        const rulesList = document.querySelector('.menu-panel ul');
        if (!rulesList) return;

        const baseLvl = ConfigModule.REBIRTH_BASE_LEVEL;
        const stepLvl = ConfigModule.REBIRTH_LEVEL_STEP;
        const limitActive = ConfigModule.LIMIT_LEVEL_TO_REBIRTH_REQ;
        const ptsPerLvl = ConfigModule.REBIRTH_POINTS_PER_LEVEL || 5;

        rulesList.innerHTML = `
            <li><strong style="color:#f1c40f;">Controls:</strong> Click/Tap to move. Click enemies to auto-attack.</li>            
            <li><strong style="color:#e67e22;">Overcharge:</strong> Hold down Skill <b>2</b> to charge it! Auto-releases at max charge. <b>+1 Max Charge per Reset!</b></li>
            <li><strong style="color:#9b59b6;">Rebirth:</strong> At <b style="color:#fff;">Level ${baseLvl}</b> you can Reset! Gain permanent stat points (+${ptsPerLvl} per Level upgraded). Every reset increases the level requirement by +${stepLvl}.</li>
            <li><strong style="color:#f39c12;">Level Limit:</strong> Level gains are ${limitActive ? '<b style="color:#e74c3c;">CAPPED</b> at the active Rebirth level requirement' : '<b style="color:#2ecc71;">UNCAPPED</b> (no restriction on level ups)'}.</li>
            <li><strong style="color:#2ecc71;">Chat:</strong> Press <b>Enter</b> during gameplay to talk to everyone!</li>
        `;
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    }

    showTooltip() {
        const tooltip = document.getElementById('log-tooltip');
        tooltip.innerHTML = this.recentLogs.map(l => `<div class="log-entry ${l.type}">${l.text}</div>`).join('');
        tooltip.classList.add('show');
    }

    hideTooltip() {
        document.getElementById('log-tooltip').classList.remove('show');
    }

    addLog(text, type = 'player') {
        const now = new Date();
        const timeStr = `[${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}]`;
        const fullText = `${timeStr} ${text}`;

        this.recentLogs.unshift({ text: fullText, type, time: Date.now() });
        if (this.recentLogs.length > this.MAX_LOGS) this.recentLogs.pop();
        this.updateCompactLog();
    }

    updateCompactLog() {
        const d = document.getElementById('log-display');
        if (this.recentLogs.length === 0) {
            d.textContent = 'Waiting for action...';
            d.className = 'log-content';
        } else {
            const l = this.recentLogs[0];
            d.textContent = l.text;
            d.className = `log-content ${l.type}`;
        }
    }

    updateHUD(player) {
        if (!player) return;

        const nameEl = document.getElementById('player-name-display');
        const classEl = document.getElementById('player-class-display');
        if (nameEl) nameEl.textContent = player.nick || 'Player';
        if (classEl) {
            const cd = CLASS_DATA[player.classType];
            if (cd) {
                let iconHtml = '';
                if (cd.icon && typeof cd.icon === 'string' && (cd.icon.startsWith('data:image/') || cd.icon.startsWith('http'))) {
                    iconHtml = `<img src="${cd.icon}" style="width:1.6em; height:1.6em; object-fit:contain; border-radius:4px; vertical-align:middle; margin-right:4px;" />`;
                } else {
                    iconHtml = `<span style="vertical-align:middle; margin-right:4px;">${cd.icon || ''}</span>`;
                }
                classEl.innerHTML = `${iconHtml}<span style="vertical-align:middle;">${cd.name}</span>`;
            }
        }

        const pct = Math.max(0, (player.hp / player.maxHp) * 100);
        document.getElementById('hp-bar').style.width = pct + '%';
        document.getElementById('hp-text').textContent = `HP: ${Math.floor(player.hp)} / ${player.maxHp}`;

        document.getElementById('stat-hp-val').textContent = player.maxHp;
        document.getElementById('stat-atk-val').textContent = player.atk.toFixed(1);
        document.getElementById('stat-spd-val').textContent = player.spd.toFixed(1);

        const baseAtk = CLASS_DATA[player.classType].atk;
        const baseSpd = CLASS_DATA[player.classType].spd;

        // ATK -> S1 Scale
        const s1Scale = 1 + (player.atk - baseAtk) * 0.02;
        const s1Boost = ((s1Scale - 1) * 100).toFixed(0);
        document.getElementById('stat-s1-val').textContent = (100 + parseInt(s1Boost)) + '%';
        document.getElementById('stat-s1-boost').textContent = s1Boost;

        // SPD -> S2 AOE
        const aoeScale = 1 + (player.spd - baseSpd) * 0.02;
        const aoeBoost = ((aoeScale - 1) * 100).toFixed(0);
        document.getElementById('stat-aoe-val').textContent = (100 + parseInt(aoeBoost)) + '%';
        document.getElementById('stat-aoe-boost').textContent = aoeBoost;

        // SPD -> S2 CD
        const diffSpd = Math.max(0, player.spd - baseSpd);
        const cdMs = Math.max(1000, 5000 - diffSpd * 200);
        const red = (5000 - cdMs) / 1000;

        document.getElementById('stat-cd-val').textContent = (cdMs / 1000).toFixed(1) + 's';
        document.getElementById('stat-cd-red').textContent = red.toFixed(1);

        // Armor
        const armor = Math.floor(player.maxHp / 10);
        const dmgRed = (armor * 0.5).toFixed(1);
        document.getElementById('stat-armor-val').textContent = armor;
        document.getElementById('stat-armor-red').textContent = dmgRed;

        const pts = player.statPoints || 0;
        const row = document.getElementById('stat-pts-row');
        row.style.display = pts > 0 ? 'block' : 'none';
        document.getElementById('stat-pts-val').textContent = pts;

        const multRow = document.getElementById('stat-mult-row');
        if (multRow) {
            multRow.style.display = pts > 0 ? 'flex' : 'none';
        }

        const d = pts > 0 ? 'inline-block' : 'none';
        document.getElementById('btn-up-atk').style.display = d;
        document.getElementById('btn-up-spd').style.display = d;
        document.getElementById('btn-up-hp').style.display = d;

        const plus = document.getElementById('level-up-plus');
        if (plus) {
            if (pts > 0 && document.getElementById('stats-display').style.display === 'none') {
                plus.style.display = 'inline-block';
            } else {
                plus.style.display = 'none';
            }
        }

        const resetsVal = document.getElementById('stat-resets-val');
        if (resetsVal) resetsVal.textContent = player.resets || 0;

        const reqLevel = ConfigModule.REBIRTH_BASE_LEVEL + (player.resets || 0) * ConfigModule.REBIRTH_LEVEL_STEP;

        const capWarning = document.getElementById('stat-level-cap-warning');
        if (capWarning) {
            if (ConfigModule.LIMIT_LEVEL_TO_REBIRTH_REQ && player.level >= reqLevel) {
                capWarning.style.display = 'block';
            } else {
                capWarning.style.display = 'none';
            }
        }

        const btnRebirth = document.getElementById('btn-rebirth');
        if (btnRebirth) {
            if (player.level >= reqLevel) {
                btnRebirth.style.display = 'block';
            } else {
                btnRebirth.style.display = 'none';
            }
        }
    }

    updateScore(player, wave, waveKilled = 0, waveTotal = 0) {
        if (player) {
            document.getElementById('kill-count').textContent = player.kills;
            document.getElementById('req-kill-count').textContent = player.reqKills;
            document.getElementById('player-level').textContent = player.level;

            const xpPct = player.reqKills > 0 ? Math.max(0, Math.min(100, (player.kills / player.reqKills) * 100)) : 100;
            document.getElementById('xp-bar').style.width = xpPct + '%';
        }
        const progress = waveTotal > 1 ? ` [${waveKilled}/${waveTotal}]` : '';
        document.getElementById('wave-count').textContent = wave + progress;
    }

    updateEnvironment(selectedEnv) {
        document.getElementById('env-name').textContent = ENV_DISPLAY[selectedEnv] || selectedEnv;
        this.showEnvBanner(ENV_DISPLAY[selectedEnv]);
    }

    showEnvBanner(name) {
        document.querySelectorAll('.env-banner').forEach(e => e.remove());
        const banner = document.createElement('div');
        banner.className = 'env-banner';
        banner.textContent = `🌍 ${name}`;
        document.getElementById('main-area').appendChild(banner);
        setTimeout(() => banner.remove(), 1600);
    }

    showBossWarning() {
        document.querySelectorAll('.boss-warning').forEach(e => e.remove());
        const warn = document.createElement('div');
        warn.className = 'boss-warning';
        warn.textContent = '⚠️ BOSS INCOMING! ⚠️';
        document.getElementById('main-area').appendChild(warn);
        setTimeout(() => warn.remove(), 1500);
    }

    showKillPopup(x, y, gameViewScale, gameViewOX, gameViewOY) {
        const p = document.createElement('div');
        p.className = 'kill-popup';
        p.textContent = '💀 +1';

        // Position using relative game coords
        p.style.left = ((x * gameViewScale + gameViewOX) / window.innerWidth * 100) + '%';
        p.style.top = ((y * gameViewScale + gameViewOY) / window.innerHeight * 100) + '%';

        document.querySelector('.main-area').appendChild(p);
        setTimeout(() => p.remove(), 1000);
    }

    updateCooldownRing(s2Cooldown, s2MaxCooldown) {
        const c = document.getElementById('cd-circle');
        const t = document.getElementById('cd-text');
        const circ = 2 * Math.PI * 26;
        if (s2Cooldown > 0) {
            const p = s2Cooldown / s2MaxCooldown;
            c.style.strokeDasharray = circ;
            c.style.strokeDashoffset = circ * p;
            t.textContent = (s2Cooldown / 1000).toFixed(1);
        } else {
            c.style.strokeDashoffset = 0;
            t.textContent = '✓';
        }
    }

    showDeathScreen(kills, wave) {
        document.getElementById('death-kills').textContent = kills;
        document.getElementById('death-wave').textContent = wave;
        document.getElementById('wait-msg').textContent = 'Waiting for next wave...';
        document.getElementById('death-overlay').classList.add('show');
        this.addLog('💀 You died!', 'death');
    }

    updatePartyList(otherPlayers) {
        const list = document.getElementById('remote-players-list');
        if (!list) return;

        const currentKeys = new Set();

        for (const key in otherPlayers) {
            const p = otherPlayers[key];
            if (!p.inGame) continue;
            currentKeys.add(key);

            let el = document.getElementById(`remote-${key}`);
            if (!el) {
                el = document.createElement('div');
                el.id = `remote-${key}`;
                el.className = 'remote-player-hp';
                el.innerHTML = `
             <div class="remote-player-name"></div>
             <div class="remote-player-info"></div>
             <div class="remote-hp-bg"><div class="remote-hp-fill"></div></div>
           `;
                list.appendChild(el);
            }

            const pct = Math.max(0, (p.hp / p.maxHp) * 100);
            const aliveText = p.hp > 0 ? '' : ' 💀';

            const nameEl = el.querySelector('.remote-player-name');
            const infoEl = el.querySelector('.remote-player-info');
            const fillEl = el.querySelector('.remote-hp-fill');

            const dispName = (p.nick && p.nick.trim() !== '') ? p.nick : key.substring(0, 8);
            const classIcon = (p.classType && CLASS_DATA[p.classType]) ? CLASS_DATA[p.classType].icon : '';
            let iconHtml = '';
            if (classIcon) {
                if (classIcon.startsWith('data:image/') || classIcon.startsWith('http')) {
                    iconHtml = `<img src="${classIcon}" style="width:1.2em; height:1.2em; object-fit:contain; border-radius:4px; vertical-align:middle; margin-right:4px;" />`;
                } else {
                    iconHtml = `<span style="vertical-align:middle; margin-right:4px;">${classIcon}</span>`;
                }
            }
            const className = (p.classType && CLASS_DATA[p.classType]) ? CLASS_DATA[p.classType].name : '';
            const newHtml = `<span style="vertical-align:middle;">${iconHtml}<span style="vertical-align:middle;">${dispName}${aliveText}</span> <span style="vertical-align:middle; color:#7f8c8d; font-size:0.85em;">${className}</span></span>`;
            if (nameEl.innerHTML !== newHtml) nameEl.innerHTML = newHtml;

            const newInfoText = `Lv.${p.level || 1} | Kills: ${p.kills || 0}/${p.reqKills || 5}`;
            if (infoEl.getAttribute('data-text') !== newInfoText) {
                infoEl.innerHTML = `<span class="highlight-level">Lv.${p.level || 1}</span> | Kills: ${p.kills || 0}/${p.reqKills || 5}`;
                infoEl.setAttribute('data-text', newInfoText);
            }

            const newWidth = `${pct}%`;
            if (fillEl.style.width !== newWidth) fillEl.style.width = newWidth;
        }

        Array.from(list.children).forEach(child => {
            const key = child.id.replace('remote-', '');
            if (!currentKeys.has(key)) {
                list.removeChild(child);
            }
        });
    }
}