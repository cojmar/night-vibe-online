export default class SettingsManager {
  constructor(game) {
    this.game = game;
  }

  initSettings() {
    const saved = JSON.parse(localStorage.getItem('nightvibe-settings') || '{}');
    this.game.settings = {
      particles: saved.particles !== undefined ? saved.particles : 2.0,
      bgElements: saved.bgElements !== undefined ? saved.bgElements : 2.0,
      groundElements: saved.groundElements !== undefined ? saved.groundElements : 2.0,
      atmos: saved.atmos !== undefined ? saved.atmos : 2.0,
      autoGraphics: saved.autoGraphics !== undefined ? saved.autoGraphics : true,
      autoLimit: saved.autoLimit !== undefined ? saved.autoLimit : true
    };
  }

  adjustAutoQuality() {
    if (!this.game.settings || !this.game.settings.autoGraphics || document.hidden || !document.hasFocus()) return;
    if (!this.game.fps) return;

    let changed = false;
    const minLim = this.game.settings.autoLimit ? 0.5 : 0.0;

    if (this.game.settings.particles < minLim) { this.game.settings.particles = minLim; changed = true; }
    if (this.game.settings.bgElements < minLim) { this.game.settings.bgElements = minLim; changed = true; }
    if (this.game.settings.groundElements < minLim) { this.game.settings.groundElements = minLim; changed = true; }
    if (this.game.settings.atmos < minLim) { this.game.settings.atmos = minLim; changed = true; }

    if (this.game.fps < 40) {
      this.game.settings.particles = Math.max(minLim, this.game.settings.particles - 0.10);
      this.game.settings.bgElements = Math.max(minLim, this.game.settings.bgElements - 0.10);
      this.game.settings.groundElements = Math.max(minLim, this.game.settings.groundElements - 0.10);
      this.game.settings.atmos = Math.max(minLim, this.game.settings.atmos - 0.10);
      changed = true;
    } else if (this.game.fps >= 55 && (this.game.settings.particles < 2.0 || this.game.settings.bgElements < 2.0 || this.game.settings.groundElements < 2.0 || this.game.settings.atmos < 2.0)) {
      this.game.settings.particles = Math.min(2.0, this.game.settings.particles + 0.05);
      this.game.settings.bgElements = Math.min(2.0, this.game.settings.bgElements + 0.05);
      this.game.settings.groundElements = Math.min(2.0, this.game.settings.groundElements + 0.05);
      this.game.settings.atmos = Math.min(2.0, this.game.settings.atmos + 0.05);
      changed = true;
    }

    if (changed) {
      document.getElementById('particles-slider').value = Math.round(this.game.settings.particles * 100);
      document.getElementById('particles-val').textContent = `${Math.round(this.game.settings.particles * 100)}%`;
      document.getElementById('bg-slider').value = Math.round(this.game.settings.bgElements * 100);
      document.getElementById('bg-val').textContent = `${Math.round(this.game.settings.bgElements * 100)}%`;
      document.getElementById('ground-slider').value = Math.round(this.game.settings.groundElements * 100);
      document.getElementById('ground-val').textContent = `${Math.round(this.game.settings.groundElements * 100)}%`;
      document.getElementById('atmos-slider').value = Math.round(this.game.settings.atmos * 100);
      document.getElementById('atmos-val').textContent = `${Math.round(this.game.settings.atmos * 100)}%`;
      localStorage.setItem('nightvibe-settings', JSON.stringify(this.game.settings));
      this.game.generateScenery();
    }
  }
}
