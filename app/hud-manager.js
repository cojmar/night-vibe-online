import * as ConfigModule from './config.js';

export default class HudManager {
  constructor(game) {
    this.game = game;
  }

  updateTargetPanel() {
    if (!this.game.player) return;
    const cx = this.game.player.mouseX, cy = this.game.player.mouseY;
    let currentTarget = null, isHover = false;
    let hoveredEnemy = this.game.enemies.find(e => e.alive && Math.hypot(cx - e.x, cy - e.y) < e.size + 30);
    let hoveredItem = !hoveredEnemy && this.game.items ? this.game.items.find(item => Math.hypot(cx - item.x, cy - item.y) < 40) : null;
    if (hoveredEnemy) { currentTarget = hoveredEnemy; isHover = true; }
    else if (hoveredItem) { currentTarget = hoveredItem; isHover = true; }
    else if (this.game.player.autoAttackTarget?.alive) currentTarget = this.game.player.autoAttackTarget;
    else if (this.game.player.targetedItemId) currentTarget = this.game.items?.find(i => i.id === this.game.player.targetedItemId);
    this.game.ui.updateTargetPanel(currentTarget, isHover);
  }

  updateGameTimeDisplay(effectiveStartTime) {
    const timeContainer = document.getElementById('game-time-container');
    const timeDisplay = document.getElementById('game-time-display');
    if (!timeContainer || !timeDisplay) return;
    if (effectiveStartTime <= 0) { timeContainer.style.display = 'none'; return; }
    const cycleDur = ConfigModule.DAY_CYCLE_DURATION || 60;
    const totalGameDays = Math.floor(this.game.globalTime / cycleDur);
    const gameYears = Math.floor(totalGameDays / 360);
    const gameMonths = Math.floor((totalGameDays % 360) / 30);
    const gameDays = totalGameDays % 30;
    const currentCycle = (this.game.globalTime % cycleDur) / cycleDur;
    const gameHoursFloat = (currentCycle * 24 + 6) % 24;
    const h = Math.floor(gameHoursFloat);
    const m = Math.floor((gameHoursFloat % 1) * 60);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    let timeStr = '';
    if (gameYears > 0) timeStr += `${gameYears}a `;
    if (gameMonths > 0) timeStr += `${gameMonths}l `;
    if (gameDays > 0) timeStr += `${gameDays}z `;
    timeStr += `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
    if (timeDisplay.textContent !== timeStr) timeDisplay.textContent = timeStr;
    timeContainer.style.display = 'flex';
  }

  updateFpsDisplay() {
    const fpsContainer = document.getElementById('fps-container');
    const fpsDisplay = document.getElementById('fps-display');
    if (!fpsContainer || !fpsDisplay || this.game.state !== 'PLAYING') { if (fpsContainer) fpsContainer.style.display = 'none'; return; }
    const roundedFps = Math.round(this.game.fps);
    if (fpsDisplay.textContent !== roundedFps.toString()) {
      fpsDisplay.textContent = roundedFps;
      fpsDisplay.style.color = roundedFps < 30 ? '#e74c3c' : roundedFps < 50 ? '#f1c40f' : '#2ecc71';
    }
    fpsContainer.style.display = 'flex';
  }
}
