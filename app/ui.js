import { CLASS_DATA, SKILL_DESC, ENV_DISPLAY, GAME_W, GAME_H } from './utils.js';

export default class UI {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.classes = ['warrior', 'mage', 'archer', 'magicgladiator'];
        this.currentCarouselIndex = 0;
        this.selectedClass = 'warrior';
        this.recentLogs = [];
        this.MAX_LOGS = 12;
        this.logHoldTimer = null;

        this.bindEvents();
        this.updateClassCarousel();
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
          <div style="position:relative; font-size:12px; font-weight:bold; color:#fff; text-align:center; line-height:24px;">❤️ Regen ${Math.ceil(hpTimer / 1000)}s</div>
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
        document.getElementById('btn-start').addEventListener('click', () => this.game.startGame(this.selectedClass));
        document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('btn-quit-game').addEventListener('click', () => this.game.quitToMenu());
        document.getElementById('btn-death-quit').addEventListener('click', () => this.game.quitToMenu());

        const btnSettings = document.getElementById('btn-settings');
        const settingsModal = document.getElementById('settings-modal');
        const btnSettingsClose = document.getElementById('btn-settings-close');
        const partSlider = document.getElementById('particles-slider');
        const partVal = document.getElementById('particles-val');
        const bgSlider = document.getElementById('bg-slider');
        const bgVal = document.getElementById('bg-val');
        const groundSlider = document.getElementById('ground-slider');
        const groundVal = document.getElementById('ground-val');
        const atmosSlider = document.getElementById('atmos-slider');
        const atmosVal = document.getElementById('atmos-val');

        if (btnSettings) btnSettings.addEventListener('click', () => { settingsModal.style.display = 'flex'; });
        if (btnSettingsClose) btnSettingsClose.addEventListener('click', () => { settingsModal.style.display = 'none'; });

        if (partSlider) {
            partSlider.addEventListener('input', (e) => {
                partVal.textContent = `${e.target.value}%`;
                if (this.game) this.game.settings.particles = parseInt(e.target.value) / 100;
            });
        }
        if (bgSlider) {
            bgSlider.addEventListener('input', (e) => {
                bgVal.textContent = `${e.target.value}%`;
                if (this.game) {
                    this.game.settings.bgElements = parseInt(e.target.value) / 100;
                    this.game.generateScenery(this.game.selectedEnv);
                }
            });
        }
        if (groundSlider) {
            groundSlider.addEventListener('input', (e) => {
                groundVal.textContent = `${e.target.value}%`;
                if (this.game) {
                    this.game.settings.groundElements = parseInt(e.target.value) / 100;
                    this.game.generateScenery(this.game.selectedEnv);
                }
            });
        }
        if (atmosSlider) {
            atmosSlider.addEventListener('input', (e) => {
                atmosVal.textContent = `${e.target.value}%`;
                if (this.game) this.game.settings.atmos = parseInt(e.target.value) / 100;
            });
        }

        const autoGraphicsCheck = document.getElementById('auto-graphics-check');
        if (autoGraphicsCheck) {
            autoGraphicsCheck.addEventListener('change', (e) => {
                const isAuto = e.target.checked;
                if (this.game) this.game.settings.autoGraphics = isAuto;
                if (partSlider) partSlider.disabled = isAuto;
                if (bgSlider) bgSlider.disabled = isAuto;
                if (groundSlider) groundSlider.disabled = isAuto;
                if (atmosSlider) atmosSlider.disabled = isAuto;
            });
            // initial state
            if (partSlider) partSlider.disabled = autoGraphicsCheck.checked;
            if (bgSlider) bgSlider.disabled = autoGraphicsCheck.checked;
            if (groundSlider) groundSlider.disabled = autoGraphicsCheck.checked;
            if (atmosSlider) atmosSlider.disabled = autoGraphicsCheck.checked;
        }

        const autoLimitCheck = document.getElementById('auto-limit-check');
        if (autoLimitCheck) {
            autoLimitCheck.addEventListener('change', (e) => {
                if (this.game) this.game.settings.autoLimit = e.target.checked;
            });
        }

        document.getElementById('btn-up-atk').addEventListener('click', () => { if (this.game) this.game.upgradeStat('atk'); });
        document.getElementById('btn-up-spd').addEventListener('click', () => { if (this.game) this.game.upgradeStat('spd'); });
        document.getElementById('btn-up-hp').addEventListener('click', () => { if (this.game) this.game.upgradeStat('hp'); });

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
            if (e) {
                // Prevent the click from propagating to the document listener
                e.stopPropagation();
            }
            const stats = document.getElementById('stats-display');
            const partyList = document.getElementById('party-list');
            stats.style.display = stats.style.display === 'none' ? 'flex' : 'none';

            if (stats.style.display !== 'none') {
                if (partyList) partyList.classList.add('info-open');
                const plus = document.getElementById('level-up-plus');
                if (plus) plus.style.display = 'none';
            } else {
                if (partyList) partyList.classList.remove('info-open');
                // check if we need to show the plus again
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

        // Close extra info when clicking outside
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

        // Handle touch outside to clear any stuck hover states on mobile
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

    nextClass() {
        this.currentCarouselIndex = (this.currentCarouselIndex + 1) % this.classes.length;
        this.updateClassCarousel();
    }

    prevClass() {
        this.currentCarouselIndex = (this.currentCarouselIndex - 1 + this.classes.length) % this.classes.length;
        this.updateClassCarousel();
    }

    updateClassCarousel() {
        this.selectedClass = this.classes[this.currentCarouselIndex];
        const cd = CLASS_DATA[this.selectedClass];
        document.getElementById('current-class-name').textContent = cd.name;
        document.getElementById('class-icon').textContent = cd.icon;
        document.getElementById('class-card-name').textContent = cd.name;
        document.getElementById('stat-hp').innerHTML = `<strong style="color:#e74c3c">HP (Health Points): ${cd.hp}</strong><br><span style="color:#bdc3c7;font-size:0.9em;">Maximum life capacity. If it reaches 0, you die.</span>`;
        document.getElementById('stat-mp').innerHTML = `<strong style="color:#9b59b6">SPD (Speed): ${cd.spd}</strong><br><span style="color:#bdc3c7;font-size:0.9em;">Increases movement speed, S2 AOE size, and reduces S2 cooldown — higher SPD = faster and bigger attacks.</span>`;
        document.getElementById('stat-atk').innerHTML = `<strong style="color:#f39c12">ATK (Attack Damage): ${cd.atk}</strong><br><span style="color:#bdc3c7;font-size:0.9em;">Base value of damage dealt to enemies. Scales with level and stat upgrades.</span>`;

        const sk = SKILL_DESC[this.selectedClass];

        // Calculate derived stats from HP/MP/ATK
        const baseMoveSpeed = { warrior: 2.5, magicgladiator: 2.3, archer: 2.0, mage: 1.7 }[this.selectedClass] || 2.5;
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

        const reqLevel = 4 + (player.resets || 0) * 5;
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
            const newName = `${dispName}${aliveText}`;
            if (nameEl.textContent !== newName) nameEl.textContent = newName;

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