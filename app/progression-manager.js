import { REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, REBIRTH_POINTS_PER_LEVEL, REQ_KILLS_BASE_MULT, REQ_KILLS_EXPONENT, REQ_KILLS_SIN_AMP, CLASS_DATA, PLAYER_INITIAL_RESETS, PLAYER_INITIAL_STAT_POINTS, getGroundY } from './utils.js';
import Player from './player.js';

export default class ProgressionManager {
  constructor(game) {
    this.game = game;
  }

  upgradeStat(statType, amount = 1) {
    if (!this.game.player || !this.game.player.statPoints || this.game.player.statPoints <= 0) return;

    let count = amount === 'all' ? this.game.player.statPoints : parseInt(amount, 10);
    if (isNaN(count) || count <= 0) count = 1;
    count = Math.min(count, this.game.player.statPoints);
    if (count <= 0) return;

    let remaining = count;
    while (remaining > 0) {
      this.game.player.statPoints--;
      remaining--;
    }

    if (statType === 'atk') {
      this.game.player._atk += 1.0 * count;
    } else if (statType === 'spd') {
      this.game.player._spd += 1.0 * count;
    } else if (statType === 'hp') {
      this.game.player._maxHp += 1 * count;
      this.game.player.hp += 1 * count;
    }

    this.game.ui.updateHUD(this.game.player);
    this.game.broadcastState();
    if (this.game.net && this.game.net.me && this.game.net.me.info) {
      this.game.net.send_cmd('set_data', {
        statPoints: this.game.player.statPoints,
        sessionStatPoints: this.game.player.sessionStatPoints
      });
    }
    this.saveLocalProgression();
  }

  async requestRebirth() {
    if (!this.game.player) return;
    const reqLevel = REBIRTH_BASE_LEVEL + (this.game.player.resets || 0) * REBIRTH_LEVEL_STEP;
    if (this.game.player.level < reqLevel) return;

    await this.game.ui.showRebirthConfirm(
      '🔄 Rebirth',
      `Do you want to Rebirth? You will return to the menu and start over.\nYou will gain ${this.game.player.level * REBIRTH_POINTS_PER_LEVEL} unallocated bonus stats on your next play!`,
      () => { this.performRebirth(); }
    );
  }

  performRebirth() {
    if (!this.game.player) return;
    const reqLevel = REBIRTH_BASE_LEVEL + (this.game.player.resets || 0) * REBIRTH_LEVEL_STEP;
    if (this.game.player.level < reqLevel) return;

    const newResets = (this.game.player.resets || 0) + 1;
    const oldBonusStats = parseInt(localStorage.getItem('nightvibe-statpoints'), 10) || 0;
    const extraPoints = this.game.player.level * REBIRTH_POINTS_PER_LEVEL;
    const newBonusStats = oldBonusStats + extraPoints;

    localStorage.setItem('nightvibe-resets', newResets);
    localStorage.setItem('nightvibe-statpoints', newBonusStats);

    const base = CLASS_DATA[this.game.player.classType] || CLASS_DATA.warrior;

    this.game.player.level = 1;
    this.game.player.kills = 0;
    this.game.player.resets = newResets;
    this.game.player.bonusStatPoints = newBonusStats;
    this.game.player.sessionStatPoints = newBonusStats;
    this.game.player.levelUpStatPoints = 0;
    this.game.player.atk = base.atk;
    this.game.player.spd = base.spd;
    this.game.player.maxHp = base.hp;
    this.game.player.hp = base.hp;
    this.game.player.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(1, REQ_KILLS_EXPONENT) + Math.sin(1) * REQ_KILLS_SIN_AMP);

    this.game.net.send_cmd('set_data', {
      resets: newResets,
      bonusStatPoints: newBonusStats,
      statPoints: newBonusStats
    });

    this.game.quitToMenu();
  }

  restoreWebsocketStats(target, myData, selectedClass) {
    const hasSavedResets = localStorage.getItem('nightvibe-resets') !== null;
    const hasSavedStatPoints = localStorage.getItem('nightvibe-statpoints') !== null;

    const savedResets = hasSavedResets ? parseInt(localStorage.getItem('nightvibe-resets'), 10) : PLAYER_INITIAL_RESETS;
    const savedStatPoints = hasSavedStatPoints ? parseInt(localStorage.getItem('nightvibe-statpoints'), 10) : PLAYER_INITIAL_STAT_POINTS;

    target.resets = savedResets;
    target.sessionStatPoints = savedStatPoints;
    target.levelUpStatPoints = 0;

    if (!myData) return;

    const isLocalStorageCleared = !hasSavedResets && !hasSavedStatPoints;

    if (!isLocalStorageCleared) {
      if (myData.resets !== undefined && myData.resets > 0) {
        target.resets = myData.resets;
      }
      const socketBonusStats = myData.bonusStatPoints !== undefined ? myData.bonusStatPoints : (myData.statPoints !== undefined ? myData.statPoints : undefined);
      if (socketBonusStats !== undefined) {
        target.sessionStatPoints = socketBonusStats;
      }
    }

    const isReconnecting = myData.inGame === true && (myData.state === 'PLAYING' || myData.state === 'GAME_OVER');

    if (myData.classType === selectedClass && isReconnecting) {
      if (myData.level !== undefined) target.level = myData.level;
      if (myData.atk !== undefined) target.atk = myData.atk;
      if (myData.spd !== undefined) target.spd = myData.spd;
      if (myData.maxHp !== undefined) {
        target.maxHp = myData.maxHp;
        target.hp = myData.maxHp;
      }
      if (myData.kills !== undefined) target.kills = myData.kills;
      target.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(target.level, REQ_KILLS_EXPONENT) + Math.sin(target.level) * REQ_KILLS_SIN_AMP);
    }
  }

  saveLocalProgression() {
    if (!this.game.player) return;
    localStorage.setItem('nightvibe-resets', this.game.player.resets || 0);
    localStorage.setItem('nightvibe-inventory', JSON.stringify(this.game.player.inventory || []));
    localStorage.setItem('nightvibe-equipment', JSON.stringify(this.game.player.equipment || {}));
  }

  _resetSessionData() {
    const base = CLASS_DATA.warrior;
    const savedResets = parseInt(localStorage.getItem('nightvibe-resets'), 10) || 0;
    const savedStatPoints = parseInt(localStorage.getItem('nightvibe-statpoints'), 10) || 0;

    this.game.enemies = [];
    this.game.projectiles = [];
    this.game.particles = [];
    this.game.items = [];
    this.game.floatingTexts = [];

    if (this.game.net && this.game.net.room && this.game.net.me && this.game.net.me.info && this.game.net.room.users[this.game.net.me.info.user]) {
      const myData = this.game.net.room.users[this.game.net.me.info.user].data;
      myData.resets = savedResets;
      myData.bonusStatPoints = savedStatPoints;
      myData.statPoints = savedStatPoints;
      myData.level = 1;
      myData.kills = 0;
      myData.reqKills = Math.floor(REQ_KILLS_BASE_MULT * Math.pow(1, REQ_KILLS_EXPONENT) + Math.sin(1) * REQ_KILLS_SIN_AMP);
      myData.atk = base.atk;
      myData.spd = base.spd;
      myData.maxHp = base.hp;
      myData.hp = base.hp;
    }
  }

  respawnPlayer() {
    document.getElementById('death-overlay').classList.remove('show');
    if (this.game.player) {
      this.game.player.moveTargetX = this.game.player.x;
      this.game.player.moveTargetY = this.game.player.y;
      this.game.player.hasTarget = false;
      this.game.player.hp = this.game.player.maxHp;
      this.game.player.alive = true;
    } else {
      this.game.player = new Player(this.game.net.me.info.user, true, this.game.ui.selectedClass, this.game.gameW / 2, (getGroundY(this.game.selectedEnv) + this.game.gameH) / 2);
    }
    this.game.ui.updateHUD(this.game.player);
    this.game.ui.addLog('✨ Respawned!', 'reward');
    this.game.broadcastState();
  }
}
