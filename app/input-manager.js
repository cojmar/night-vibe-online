export default class InputManager {
  constructor(game) {
    this.game = game;
  }

  bindEvents() {
    const mainArea = document.getElementById('main-area');

    mainArea.addEventListener('mousemove', (e) => {
      if (this.game.state !== 'PLAYING') return;
      const pos = this.game.toGameCoords(e.clientX, e.clientY);
      if (this.game.player) {
        this.game.player.mouseX = pos.x;
        this.game.player.mouseY = pos.y;

        const reqLevel = 4 + (this.game.player.resets || 0) * 5;
        const lvlScale = 0.5 + 0.5 * ((this.game.player.level - 1) / Math.max(1, reqLevel - 1));
        const py = this.game.player.y;
        const weaponY = py - 40 * lvlScale;
        const computedAimAngle = parseFloat(Math.atan2(this.game.player.mouseY - weaponY, this.game.player.mouseX - this.game.player.x).toFixed(1));

        const oldFacing = this.game.player.facing;
        this.game.player.facing = this.game.player.mouseX > this.game.player.x ? 1 : -1;
        const oldAimAngle = this.game.player.aimAngle;
        this.game.player.aimAngle = computedAimAngle;

        if (this.game.player.facing !== oldFacing || this.game.player.aimAngle !== oldAimAngle) {
          this.game.broadcastState();
        }
      }
    });

    this.game.canvas.addEventListener('mousedown', (e) => {
      if (this.game.state !== 'PLAYING' || !this.game.player) return;
      if (e.button === 0) {
        e.preventDefault();
        clearInterval(this.game.leftClickInterval);
        const p = this.game.toGameCoords(e.clientX, e.clientY);
        this.game.player.mouseX = p.x;
        this.game.player.mouseY = p.y;
        this.game.handleLeftClick(p.x, p.y);
        this.game.leftClickInterval = setInterval(() => {
          if (this.game.state === 'PLAYING' && this.game.player) {
            this.game.handleLeftClick(this.game.player.mouseX, this.game.player.mouseY);
          }
        }, 100);
      }
      if (e.button === 2) {
        e.preventDefault();
        this.game.mouseDown = true;
        const p = this.game.toGameCoords(e.clientX, e.clientY);
        this.game.player.mouseX = p.x;
        this.game.player.mouseY = p.y;
        if (this.game.s2HoldTimer) clearTimeout(this.game.s2HoldTimer);
        this.game.s2HoldTimer = setTimeout(() => {
          if (this.game.state === 'PLAYING' && this.game.mouseDown && this.game.player && this.game.s2Cooldown <= 0) {
            this.game.player.s2HoldStartTime = Date.now();
            this.game.startChargingSkill2();
          }
          this.game.s2HoldTimer = null;
        }, 300);
      }
    });

    this.game.canvas.addEventListener('mouseup', (e) => {
      if (this.game.state !== 'PLAYING' || !this.game.player) return;
      if (e.button === 0) {
        e.preventDefault();
        clearInterval(this.game.leftClickInterval);
      }
      if (e.button === 2) {
        e.preventDefault();
        this.game.mouseDown = false;
        clearInterval(this.game.leftClickInterval);
        if (this.game.s2HoldTimer) {
          clearTimeout(this.game.s2HoldTimer);
          this.game.s2HoldTimer = null;
        }
        if (!this.game.player.isChargingS2) {
          const p = this.game.toGameCoords(e.clientX, e.clientY);
          this.game.player.mouseX = p.x;
          this.game.player.mouseY = p.y;
          this.game.startChargingSkill2();
          this.game.releaseSkill2();
        } else {
          const p = this.game.toGameCoords(e.clientX, e.clientY);
          this.game.player.mouseX = p.x;
          this.game.player.mouseY = p.y;
          this.game.releaseSkill2();
        }
      }
    });

    this.game.canvas.addEventListener('mouseleave', () => {
      clearInterval(this.game.leftClickInterval);
      this.game.mouseDown = false;
      if (this.game.s2HoldTimer) {
        clearTimeout(this.game.s2HoldTimer);
        this.game.s2HoldTimer = null;
      }
      if (this.game.player && this.game.player.isChargingS2) {
        this.game.releaseSkill2();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.game.state !== 'PLAYING') return;
      clearInterval(this.game.leftClickInterval);
      this.game.mouseDown = false;
      if (this.game.s2HoldTimer) {
        clearTimeout(this.game.s2HoldTimer);
        this.game.s2HoldTimer = null;
      }
      if (this.game.player && this.game.player.isChargingS2) {
        this.game.releaseSkill2();
      }
    });

    document.addEventListener('contextmenu', (e) => {
      if (this.game.state === 'PLAYING') {
        e.preventDefault();
      }
    });

    this.game.canvas.addEventListener('wheel', (e) => {
      if (this.game.state !== 'PLAYING' || !this.game.player || !this.game.player.alive) return;
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      this.game.zoomTarget *= zoomFactor;

      const cw = this.game.canvas.width / (this.game.pixelRatio || 1);
      const ch = this.game.canvas.height / (this.game.pixelRatio || 1);

      const zoomOutMinWidth = (cw / this.game.gameW) / this.game.viewScale;
      const zoomOutMinHeight = (ch / this.game.gameH) / this.game.viewScale;
      const zoomOutMin = Math.max(zoomOutMinWidth, zoomOutMinHeight);
      const zoomInMax = Math.max(5, (ch / 30) / this.game.viewScale);

      this.game.zoomTarget = Math.max(zoomOutMin, Math.min(zoomInMax, this.game.zoomTarget));
    }, { passive: false });

    let touchActive = false;
    let touchLongPressTimer = null;
    let touchLeftClickTimer = null;
    let pinchStartDist = 0;
    let pinchStartZoom = 0;

    this.game.canvas.addEventListener('touchstart', (e) => {
      if (this.game.state !== 'PLAYING' || !this.game.player) return;
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        pinchStartDist = Math.hypot(dx, dy);
        pinchStartZoom = this.game.zoomTarget;
        return;
      }
      const t = e.touches[0];
      const pos = this.game.toGameCoords(t.clientX, t.clientY);
      touchActive = true;
      this.game.player.mouseX = pos.x;
      this.game.player.mouseY = pos.y;

      clearTimeout(touchLongPressTimer);
      clearTimeout(touchLeftClickTimer);
      touchLongPressTimer = setTimeout(() => {
        if (!touchActive) return;
        clearTimeout(touchLeftClickTimer);
        this.game.startChargingSkill2();
      }, 400);

      this.game.handleLeftClick(pos.x, pos.y);
      clearInterval(this.game.touchLeftClickInterval);
      touchLeftClickTimer = setTimeout(() => {
        if (!touchActive) return;
        clearInterval(this.game.touchLeftClickInterval);
        const interval = setInterval(() => {
          if (!touchActive || this.game.player.isChargingS2) {
            clearInterval(interval);
            return;
          }
          this.game.handleLeftClick(this.game.player.mouseX, this.game.player.mouseY);
        }, 100);
        this.game.touchLeftClickInterval = interval;
      }, 150);
    }, { passive: false });

    this.game.canvas.addEventListener('touchmove', (e) => {
      if (this.game.state !== 'PLAYING' || !this.game.player) return;
      e.preventDefault();
      if (e.touches.length === 2) {
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const currentDist = Math.hypot(dx, dy);
        const scale = currentDist / pinchStartDist;
        this.game.zoomTarget = pinchStartZoom * scale;

        const cw = this.game.canvas.width / (this.game.pixelRatio || 1);
        const ch = this.game.canvas.height / (this.game.pixelRatio || 1);
        const zoomOutMinWidth = (cw / this.game.gameW) / this.game.viewScale;
        const zoomOutMinHeight = (ch / this.game.gameH) / this.game.viewScale;
        const zoomOutMin = Math.max(zoomOutMinWidth, zoomOutMinHeight);
        const zoomInMax = Math.max(5, (ch / 30) / this.game.viewScale);
        this.game.zoomTarget = Math.max(zoomOutMin, Math.min(zoomInMax, this.game.zoomTarget));
        return;
      }
      const t = e.touches[0];
      const pos = this.game.toGameCoords(t.clientX, t.clientY);
      this.game.player.mouseX = pos.x;
      this.game.player.mouseY = pos.y;
    }, { passive: false });

    this.game.canvas.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) {
        pinchStartDist = 0;
        pinchStartZoom = 0;
      }
      touchActive = false;
      clearTimeout(touchLongPressTimer);
      clearTimeout(touchLeftClickTimer);
      clearInterval(this.game.touchLeftClickInterval);
      if (this.game.player && this.game.player.isChargingS2) {
        this.game.mouseDown = false;
        this.game.releaseSkill2();
      }
    });
    this.game.canvas.addEventListener('touchcancel', () => {
      pinchStartDist = 0;
      pinchStartZoom = 0;
      touchActive = false;
      clearTimeout(touchLongPressTimer);
      clearTimeout(touchLeftClickTimer);
      clearInterval(this.game.touchLeftClickInterval);
      if (this.game.player && this.game.player.isChargingS2) {
        this.game.mouseDown = false;
        this.game.releaseSkill2();
      }
    });

    const cdRingBtn = document.getElementById('cd-ring');
    const startUltBtn = (e) => {
      if (this.game.state !== 'PLAYING' || !this.game.player) return;
      e.preventDefault(); e.stopPropagation();
      this.game.mouseDown = true;
      this.game.startChargingSkill2();
    };
    const endUltBtn = (e) => {
      if (this.game.state !== 'PLAYING' || !this.game.player) return;
      e.preventDefault(); e.stopPropagation();
      if (this.game.player.isChargingS2) {
        this.game.mouseDown = false;
        this.game.releaseSkill2();
      } else {
        this.game.mouseDown = false;
      }
    };
    cdRingBtn.addEventListener('mousedown', startUltBtn);
    cdRingBtn.addEventListener('touchstart', startUltBtn, { passive: false });
    cdRingBtn.addEventListener('mouseup', endUltBtn);
    cdRingBtn.addEventListener('mouseleave', endUltBtn);
    cdRingBtn.addEventListener('touchend', endUltBtn);
    cdRingBtn.addEventListener('touchcancel', endUltBtn);
  }
}
