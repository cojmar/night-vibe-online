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

  bindEvents() {
    document.getElementById('btn-prev-class').addEventListener('click', () => this.prevClass());
    document.getElementById('btn-next-class').addEventListener('click', () => this.nextClass());
    document.getElementById('btn-start').addEventListener('click', () => this.game.startGame(this.selectedClass));
    document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('btn-quit-game').addEventListener('click', () => this.game.quitToMenu());
    document.getElementById('btn-death-quit').addEventListener('click', () => this.game.quitToMenu());

    const compactLog = document.getElementById('compact-log');
    compactLog.addEventListener('mouseenter', () => this.logHoldTimer = setTimeout(() => this.showTooltip(), 300));
    compactLog.addEventListener('mouseleave', () => { clearTimeout(this.logHoldTimer); this.hideTooltip(); });
    compactLog.addEventListener('touchstart', () => this.logHoldTimer = setTimeout(() => this.showTooltip(), 100));
    compactLog.addEventListener('touchend', () => { clearTimeout(this.logHoldTimer); this.hideTooltip(); });
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
    document.getElementById('stat-hp').textContent = 'HP: ' + cd.hp;
    document.getElementById('stat-atk').textContent = 'ATK: ' + cd.atk;
    document.getElementById('stat-spd').textContent = 'SPD: ' + cd.spd;

    const sk = SKILL_DESC[this.selectedClass];
    document.getElementById('controls-section').innerHTML =
      `<div class="ctrl-line"><span class="ctrl-label">S1:</span> ${sk.s1.ctrl} → <span class="s">${sk.s1.name}</span><br>${sk.s1.desc}</div>` +
      `<div class="ctrl-line"><span class="ctrl-label">S2:</span> ${sk.s2.ctrl} → <span class="s">${sk.s2.name}</span><br>${sk.s2.desc} <span style="color:#f66">(1s CD)</span></div>`;
      
    if (this.game && this.game.state === 'PLAYING' && this.game.player) {
      this.game.player.color = cd.color;
      this.game.player.accent = cd.accent;
    }
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(()=>{});
    } else {
      document.exitFullscreen().catch(()=>{});
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
    if(!player) return;
    const pct = Math.max(0, (player.hp / player.maxHp) * 100);
    document.getElementById('hp-bar').style.width = pct + '%';
    document.getElementById('hp-text').textContent = `HP: ${Math.floor(player.hp)} / ${player.maxHp}`;
    
    document.getElementById('stat-atk-val').textContent = player.atk.toFixed(1);
    document.getElementById('stat-spd-val').textContent = player.spd.toFixed(1);
    
    const baseAtk = CLASS_DATA[player.classType].atk;
    const dmgBoost = (player.atk - baseAtk).toFixed(1);
    const atkScale = 1 + (player.atk - baseAtk) * 0.1;
    const aoeBoost = ((atkScale - 1) * 100).toFixed(0) + '%';
    
    document.getElementById('stat-dmg-boost').textContent = '+' + dmgBoost;
    document.getElementById('stat-aoe-boost').textContent = '+' + aoeBoost;
    
    const baseSpd = CLASS_DATA[player.classType].spd;
    const diff = Math.max(0, player.spd - baseSpd);
    const cdReduction = diff * 0.2; // 200ms per point
    const currentCd = Math.max(1.0, 5.0 - cdReduction);
    
    document.getElementById('stat-cd-val').textContent = currentCd.toFixed(1) + 's';
    document.getElementById('stat-cd-red').textContent = cdReduction.toFixed(1);
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
    
    let html = '';
    for (const key in otherPlayers) {
       const p = otherPlayers[key];
       if (!p.inGame) continue;
       const pct = Math.max(0, (p.hp / p.maxHp) * 100);
       const aliveText = p.hp > 0 ? '' : ' 💀';
       html += `
         <div class="remote-player-hp">
           <div class="remote-player-name">${key.substring(0,8)}${aliveText}</div>
           <div class="remote-player-info"><span class="highlight-level">Lv.${p.level || 1}</span> | Kills: ${p.kills || 0}/${p.reqKills || 5}</div>
           <div class="remote-hp-bg"><div class="remote-hp-fill" style="width:${pct}%"></div></div>
         </div>
       `;
    }
    list.innerHTML = html;
  }
}
