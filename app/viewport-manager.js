export default class ViewportManager {
  constructor(game) {
    this.game = game;
  }

  scheduleLayoutUpdate() {
    this.game.updateLayout();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (this.game.state === 'PLAYING' || this.game.state === 'MENU') this.game.updateLayout();
    }));
    if (this.game.layoutRefreshTimer) clearTimeout(this.game.layoutRefreshTimer);
    this.game.layoutRefreshTimer = setTimeout(() => {
      if (this.game.state === 'PLAYING' || this.game.state === 'MENU') this.game.updateLayout();
    }, 120);
    if (this.game.layoutSettledTimer) clearTimeout(this.game.layoutSettledTimer);
    this.game.layoutSettledTimer = setTimeout(() => {
      if (this.game.state === 'PLAYING' || this.game.state === 'MENU') this.game.updateLayout();
    }, 500);
  }

  updateLayout() {
    const canvas = this.game.canvas;
    const ctx = this.game.ctx;
    const rect = canvas.getBoundingClientRect();
    const cw = Math.round(rect.width);
    const ch = Math.round(rect.height);
    if (cw <= 0 || ch <= 0) return;

    const rawDpr = Math.min(window.devicePixelRatio || 1, 2);
    const isTouchDisplay = navigator.maxTouchPoints > 0;
    const maxMobilePixels = 900000;
    const pixelBudgetDpr = Math.sqrt(maxMobilePixels / (cw * ch));
    const dpr = isTouchDisplay ? Math.max(1, Math.min(rawDpr, pixelBudgetDpr)) : rawDpr;
    this.game.pixelRatio = dpr;
    canvas.width = cw * dpr;
    canvas.height = ch * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.game.viewScale = ch / this.game.gameH;

    const requiredGameW = Math.ceil(cw / this.game.viewScale);
    const targetW = Math.max(this.game.gameW, requiredGameW);

    if (targetW !== this.game.gameW && !this.game._gameWFromHost) {
      this.game.gameW = targetW;
      if (this.game.player && this.game.player.isLocal) {
        this.game.player.x = Math.max(20, Math.min(targetW - 20, this.game.player.x));
      }
      this.game.generateScenery();
      this.game.initBgParticles();
    }

    const scaledW = this.game.gameW * this.game.viewScale;

    if (cw < scaledW) {
      this.game.viewOX = 0;
    } else {
      this.game.viewOX = (cw - scaledW) / 2;
    }
    this.game.viewOY = 0;

    this.game.cachedCanvasRect = canvas.getBoundingClientRect();

    if (this.game.state === 'MENU') this.game.renderer.drawMenuBackground();
  }

  applyViewport(dt = 0) {
    const ctx = this.game.ctx;
    if (this.game.player && !this.game.player.alive) {
      if (!this.game.savedZoomTarget) {
        this.game.savedZoomTarget = this.game.zoomTarget;
      }
      const cw = this.game.canvas.width / (this.game.pixelRatio || 1);
      const ch = this.game.canvas.height / (this.game.pixelRatio || 1);
      const zoomOutMinWidth = (cw / this.game.gameW) / this.game.viewScale;
      const zoomOutMinHeight = (ch / this.game.gameH) / this.game.viewScale;
      this.game.zoomTarget = Math.max(zoomOutMinWidth, zoomOutMinHeight);
    } else {
      if (this.game.savedZoomTarget) {
        this.game.zoomTarget = this.game.savedZoomTarget;
        this.game.savedZoomTarget = null;
      }
    }

    if (Math.abs(this.game.zoomScale - this.game.zoomTarget) > 0.001) {
      this.game.zoomScale += (this.game.zoomTarget - this.game.zoomScale) * Math.min(0.2, 0.15 * dt);
    } else {
      this.game.zoomScale = this.game.zoomTarget;
    }

    let shakeX = 0, shakeY = 0;
    if (this.game.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.game.screenShake;
      shakeY = (Math.random() - 0.5) * this.game.screenShake;
      this.game.screenShake -= dt;
      if (this.game.screenShake < 0) this.game.screenShake = 0;
    }

    const effectiveScale = this.game.viewScale * this.game.zoomScale;
    const cw = this.game.canvas.width / (this.game.pixelRatio || 1);
    const ch = this.game.canvas.height / (this.game.pixelRatio || 1);

    if (this.game.player && this.game.canvas) {
      const halfViewportX = (cw / 2) / effectiveScale;
      const halfViewportY = (ch / 2) / effectiveScale;

      if (halfViewportX >= this.game.gameW / 2) {
        this.game.cameraX = this.game.gameW / 2;
      } else {
        this.game.cameraX = Math.max(halfViewportX, Math.min(this.game.gameW - halfViewportX, this.game.player.x));
      }
      this.game.cameraY = Math.max(halfViewportY, Math.min(this.game.gameH - halfViewportY, this.game.player.y));
    } else {
      this.game.cameraX = this.game.gameW / 2;
      this.game.cameraY = this.game.gameH / 2;
    }

    const camX = this.game.cameraX;
    const camY = this.game.cameraY;
    const viewOX = this.game.viewOX || 0;

    const cullMargin = 150;
    const cwHalf = (cw / 2) / effectiveScale;
    const chHalf = (ch / 2) / effectiveScale;
    this.game.cullMinX = camX - cwHalf - cullMargin;
    this.game.cullMaxX = camX + cwHalf + cullMargin;
    this.game.cullMinY = camY - chHalf - cullMargin;
    this.game.cullMaxY = camY + chHalf + cullMargin;

    ctx.translate(cw / 2 + viewOX + shakeX, ch / 2 + shakeY);
    ctx.scale(effectiveScale, effectiveScale);
    ctx.translate(-camX, -camY);
  }

  toGameCoords(clientX, clientY) {
    const rect = this.game.cachedCanvasRect || this.game.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;
    const effectiveScale = this.game.viewScale * this.game.zoomScale;
    const cw = this.game.canvas.width / (this.game.pixelRatio || 1);
    const ch = this.game.canvas.height / (this.game.pixelRatio || 1);
    const camX = this.game.cameraX || 0;
    const camY = this.game.cameraY ?? (this.game.player ? this.game.player.y : this.game.gameH / 2);
    const viewOX = this.game.viewOX || 0;
    const gameX = (canvasX - cw / 2 - viewOX) / effectiveScale + camX;
    const gameY = (canvasY - ch / 2) / effectiveScale + camY;
    return { x: gameX, y: gameY };
  }
}
