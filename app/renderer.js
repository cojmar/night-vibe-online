import { getGroundY, ENV_CONFIG, ENV_LIST, darkenColor, getCachedImage, PRNG } from './utils.js';
import * as ConfigModule from './config.js';

export default class Renderer {
  constructor(game) {
    this.game = game;
    this._cachedEnv = null;
    this._skyGradient = null;
  }

  initWebGL() {
    const gl = this.game.gl;
    if (!gl) {
      if (this.game.canvas) this.game.canvas.style.opacity = 1;
      if (this.game.webglCanvas) this.game.webglCanvas.style.display = 'none';
      return;
    }

    const vsSource = `
      attribute vec4 aVertexPosition;
      attribute vec2 aTextureCoord;
      varying highp vec2 vTextureCoord;
      void main(void) { gl_Position = aVertexPosition; vTextureCoord = aTextureCoord; }
    `;
    const fsSource = `
      varying highp vec2 vTextureCoord;
      uniform sampler2D uSampler;
      void main(void) { gl_FragColor = texture2D(uSampler, vTextureCoord); }
    `;

    const vertexShader = this.loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = this.loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const shaderProgram = gl.createProgram();
    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);
    gl.useProgram(shaderProgram);

    this.game.programInfo = {
      program: shaderProgram,
      attribLocations: { vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'), textureCoord: gl.getAttribLocation(shaderProgram, 'aTextureCoord') },
      uniformLocations: { uSampler: gl.getUniformLocation(shaderProgram, 'uSampler') }
    };

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const textureCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, textureCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);

    this.game.buffers = { position: positionBuffer, textureCoord: textureCoordBuffer };

    this.game.webglTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.game.webglTexture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  renderWebGL() {
    const gl = this.game.gl;
    if (!gl || !this.game.programInfo || !this.game.webglTexture) return;
    const canvas = this.game.canvas;
    const webglCanvas = this.game.webglCanvas;

    if (webglCanvas.width !== canvas.width || webglCanvas.height !== canvas.height) {
      webglCanvas.width = canvas.width;
      webglCanvas.height = canvas.height;
      gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    }

    gl.bindTexture(gl.TEXTURE_2D, this.game.webglTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.game.buffers.position);
    gl.vertexAttribPointer(this.game.programInfo.attribLocations.vertexPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.game.programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.game.buffers.textureCoord);
    gl.vertexAttribPointer(this.game.programInfo.attribLocations.textureCoord, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(this.game.programInfo.attribLocations.textureCoord);

    gl.useProgram(this.game.programInfo.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.game.webglTexture);
    gl.uniform1i(this.game.programInfo.uniformLocations.uSampler, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  drawMenuBackground() {
    const env = ENV_CONFIG[this.game.ui && this.game.ui.selectedClass ? ENV_LIST[0] : 'forest'];
    const ctx = this.game.ctx;
    ctx.clearRect(0, 0, this.game.canvas.width, this.game.canvas.height);
    ctx.save();
    this.game.applyViewport();

    const skyGrad = ctx.createLinearGradient(0, 0, 0, this.game.gameH);
    skyGrad.addColorStop(0, env.skyTop);
    skyGrad.addColorStop(0.5, env.skyMid);
    skyGrad.addColorStop(1, env.skyBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, this.game.gameW, this.game.gameH);

    const gY = this.game.gameH * env.groundY;
    ctx.fillStyle = env.ground;
    ctx.fillRect(0, gY, this.game.gameW, this.game.gameH - gY);

    ctx.fillStyle = 'rgba(255,215,0,0.2)';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🎮 SELECT CLASS & PRESS START', this.game.gameW / 2, this.game.gameH / 2);

    ctx.restore();
  }

  drawEnvironment() {
    const env = ENV_CONFIG[this.game.selectedEnv];
    const gY = this.game.gameH * env.groundY;
    const ctx = this.game.ctx;

    if (this._cachedEnv !== this.game.selectedEnv) {
      this._cachedEnv = this.game.selectedEnv;
      this._skyGradient = ctx.createLinearGradient(0, 0, 0, gY);
      this._skyGradient.addColorStop(0, env.skyTop);
      this._skyGradient.addColorStop(0.5, env.skyMid);
      this._skyGradient.addColorStop(1, env.skyBot);
    }
    ctx.fillStyle = this._skyGradient;
    ctx.fillRect(-2000, 0, this.game.gameW + 4000, gY);

    const nightAlpha = this.game.nightAlpha || 0;
    const dayAlpha = this.game.dayAlpha || 0;
    const cycle = (this.game.globalTime % ConfigModule.DAY_CYCLE_DURATION) / ConfigModule.DAY_CYCLE_DURATION;
    const dayFraction = 14 / 24;
    let mappedCycle = cycle;
    if (cycle <= dayFraction) {
      mappedCycle = (cycle / dayFraction) * 0.5;
    } else {
      mappedCycle = 0.5 + ((cycle - dayFraction) / (1 - dayFraction)) * 0.5;
    }

    const cx = this.game.gameW / 2, cy = gY;
    const angle = mappedCycle * Math.PI * 2 + Math.PI;
    const sunX = cx - Math.cos(angle) * 350;
    const sunY = cy + Math.sin(angle) * 250;
    if (sunY < gY + 40) {
      ctx.fillStyle = '#f1c40f';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 35, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(241, 196, 15, 0.3)';
      ctx.beginPath();
      ctx.arc(sunX, sunY, 50, 0, Math.PI * 2);
      ctx.fill();
    }
    const moonAngle = angle + Math.PI;
    const moonX = cx - Math.cos(moonAngle) * 350;
    const moonY = cy + Math.sin(moonAngle) * 250;
    if (moonY < gY + 40) {
      const moonGlow = ctx.createRadialGradient(moonX, moonY, 20, moonX, moonY, 250);
      moonGlow.addColorStop(0, `rgba(220, 230, 255, ${nightAlpha * 0.4})`);
      moonGlow.addColorStop(1, `rgba(220, 230, 255, 0)`);
      ctx.fillStyle = moonGlow;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 250, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ecf0f1';
      ctx.beginPath();
      ctx.arc(moonX, moonY, 28, 0, Math.PI * 2);
      ctx.fill();
    }

    if (nightAlpha > 0) {
      ctx.fillStyle = `rgba(5, 5, 20, ${nightAlpha * 0.75})`;
      ctx.fillRect(-2000, 0, this.game.gameW + 4000, gY);
    }

    if (this.game.atmosEffects && this.game.atmosEffects.length > 0) {
      for (let ef of this.game.atmosEffects) {
        if (ef.type === 'cloud') {
          ctx.fillStyle = ef.color;
          ctx.beginPath();
          ctx.arc(ef.x, ef.y, ef.size * 0.6, 0, Math.PI * 2);
          ctx.arc(ef.x + ef.size * 0.5, ef.y - ef.size * 0.2, ef.size * 0.5, 0, Math.PI * 2);
          ctx.arc(ef.x - ef.size * 0.5, ef.y - ef.size * 0.1, ef.size * 0.4, 0, Math.PI * 2);
          ctx.arc(ef.x + ef.size * 0.8, ef.y + ef.size * 0.2, ef.size * 0.35, 0, Math.PI * 2);
          ctx.arc(ef.x - ef.size * 0.8, ef.y + ef.size * 0.2, ef.size * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    if (!this.game.scenery) this.game.generateScenery();
    for (let s of this.game.scenery) {
      if (s.x > this.game.cullMaxX || s.x + s.w < this.game.cullMinX) continue;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.moveTo(s.x, gY);
      ctx.lineTo(s.x + s.w / 2, gY - s.h);
      ctx.lineTo(s.x + s.w, gY);
      ctx.fill();
    }

    if (this.game.horizonFoliage) {
      for (let h of this.game.horizonFoliage) {
        if (h.x > this.game.cullMaxX || h.x + (h.w || 0) < this.game.cullMinX) continue;
        ctx.fillStyle = h.color;
        const sway = Math.sin(this.game.globalTime * h.speed + h.phase) * (h.h * 0.1);
        ctx.beginPath();
        if (h.type === 'trees' || h.type === 'pines' || h.type === 'deadtrees') {
          ctx.moveTo(h.x + sway, gY - h.h);
          ctx.lineTo(h.x - h.w / 2, gY);
          ctx.lineTo(h.x + h.w / 2, gY);
        } else if (h.type === 'walls') {
          ctx.fillRect(h.x - h.w / 2, gY - h.h, h.w, h.h);
        } else {
          ctx.ellipse(h.x + sway, gY - h.h / 2, h.w / 2, h.h / 2, 0, 0, Math.PI * 2);
        }
        ctx.fill();
      }
    }

    ctx.fillStyle = env.ground;
    ctx.fillRect(-2000, gY, this.game.gameW + 4000, this.game.gameH - gY);
  }

  renderParticles() {
    const ctx = this.game.ctx;
    for (let p of this.game.particles) {
      if (!p.isShockwave && !p.isHalo && !p.isRay && !p.isSparkle) {
        p.x += p.vx * 1;
        p.y += p.vy * 1;
        p.vy += 0.05 * 1;
      } else if (p.isHalo || p.isRay || p.isSparkle) {
        p.x += p.vx * 1;
        p.y += p.vy * 1;
      }
      p.life -= 1;
      const progress = Math.max(0, p.life / p.maxLife);
      if (p.x < this.game.cullMinX || p.x > this.game.cullMaxX || p.y < this.game.cullMinY || p.y > this.game.cullMaxY) continue;
      ctx.globalAlpha = progress;

      if (p.isShockwave) {
        const currentSize = p.size * (1 + (1 - progress) * 1.5);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = progress * 0.4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentSize, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.isHalo) {
        const currentSize = p.size * (1 + (1 - progress) * 1.85);
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.85)';
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;
        ctx.lineWidth = 3 * progress;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, currentSize, currentSize * 0.45, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (p.isRay) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size * progress;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        const len = p.length * progress;
        const vdist = Math.hypot(p.vx, p.vy) || 1;
        ctx.lineTo(p.x + (p.vx / vdist) * len, p.y + (p.vy / vdist) * len);
        ctx.stroke();
      } else if (p.isSparkle) {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
        if (Math.random() < 0.20) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size * 2, p.y);
          ctx.lineTo(p.x + p.size * 2, p.y);
          ctx.moveTo(p.x, p.y - p.size * 2);
          ctx.lineTo(p.x, p.y + p.size * 2);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * progress, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    this.game.particles = this.game.particles.filter(p => p.life > 0);
  }

  renderAtmosEffects() {
    const ctx = this.game.ctx;
    if (!this.game.atmosEffects || this.game.atmosEffects.length === 0) return;
    for (let ef of this.game.atmosEffects) {
      if (ef.x < this.game.cullMinX || ef.x > this.game.cullMaxX || ef.y < this.game.cullMinY || ef.y > this.game.cullMaxY) continue;
      ctx.fillStyle = ef.color;
      ctx.beginPath();
      if (ef.type === 'rain') {
        ctx.fillRect(ef.x, ef.y, ef.size, ef.size * 6);
      } else if (ef.type === 'smoke') {
        ctx.arc(ef.x, ef.y, ef.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  renderFloatingTexts() {
    const ctx = this.game.ctx;
    for (let ft of this.game.floatingTexts) {
      ft.y -= 0.8;
      ft.life -= 1;
      if (ft.x < this.game.cullMinX || ft.x > this.game.cullMaxX || ft.y < this.game.cullMinY || ft.y > this.game.cullMaxY) continue;
      const fadeStart = ft.maxLife * 0.4;
      ctx.globalAlpha = ft.life > fadeStart ? 1 : Math.max(0, ft.life / fadeStart);
      ctx.font = `bold ${ft.isCrit ? 18 : 14}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#000';
      ctx.fillText(ft.text, ft.x + 1, ft.y + 1);
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1;
    this.game.floatingTexts = this.game.floatingTexts.filter(ft => ft.life > 0);
  }

  renderDayNightOverlays() {
    const ctx = this.game.ctx;
    const env = ENV_CONFIG[this.game.selectedEnv];
    const gY = this.game.gameH * (env ? env.groundY : 0.5);

    const cycle = (this.game.globalTime % ConfigModule.DAY_CYCLE_DURATION) / ConfigModule.DAY_CYCLE_DURATION;
    const dayFraction = 14 / 24;
    let mappedCycle = cycle;
    if (cycle <= dayFraction) {
      mappedCycle = (cycle / dayFraction) * 0.5;
    } else {
      mappedCycle = 0.5 + ((cycle - dayFraction) / (1 - dayFraction)) * 0.5;
    }

    const celestialArcCenterX = this.game.gameW / 2;
    const celestialArcCenterY = gY;
    const sunAngle = mappedCycle * Math.PI * 2 + Math.PI;
    const sunX = celestialArcCenterX - Math.cos(sunAngle) * 350;
    const sunY = celestialArcCenterY + Math.sin(sunAngle) * 250;
    const moonAngle = sunAngle + Math.PI;
    const moonX = celestialArcCenterX - Math.cos(moonAngle) * 350;
    const moonY = celestialArcCenterY + Math.sin(moonAngle) * 250;

    this.game.lightX = this.game.dayAlpha > this.game.nightAlpha ? sunX : moonX;
    this.game.lightY = this.game.dayAlpha > this.game.nightAlpha ? sunY : moonY;
    this.game.lightIntensity = Math.max(this.game.dayAlpha, this.game.nightAlpha);

    const lightPrng = new PRNG(this.game.sessionSeed || 1);
    const nightR = 5 + Math.floor(lightPrng.nextFloat() * 15);
    const nightG = 10 + Math.floor(lightPrng.nextFloat() * 15);
    const nightB = 25 + Math.floor(lightPrng.nextFloat() * 30);
    const dayR = 255;
    const dayG = 220 + Math.floor(lightPrng.nextFloat() * 35);
    const dayB = 100 + Math.floor(lightPrng.nextFloat() * 100);

    if (this.game.nightAlpha > 0) {
      const nightGrad = ctx.createRadialGradient(moonX, Math.max(0, moonY), this.game.gameH * 0.1, moonX, Math.max(0, moonY), this.game.gameW * 1.2);
      nightGrad.addColorStop(0, `rgba(${nightR + 10}, ${nightG + 10}, ${nightB + 15}, ${this.game.nightAlpha * 0.25})`);
      nightGrad.addColorStop(gY / this.game.gameH, `rgba(${nightR}, ${nightG}, ${nightB}, ${this.game.nightAlpha * 0.45})`);
      nightGrad.addColorStop(1, `rgba(0, 0, 5, ${this.game.nightAlpha * 0.7})`);
      ctx.fillStyle = nightGrad;
      ctx.fillRect(0, 0, this.game.gameW, this.game.gameH);
    }
    if (this.game.dayAlpha > 0) {
      const dayGrad = ctx.createRadialGradient(sunX, Math.max(0, sunY), this.game.gameH * 0.2, sunX, Math.max(0, sunY), this.game.gameW);
      dayGrad.addColorStop(0, `rgba(${dayR}, ${dayG}, ${dayB}, ${this.game.dayAlpha * 0.15})`);
      dayGrad.addColorStop(1, `rgba(${dayR}, ${dayG}, ${dayB}, 0)`);
      ctx.fillStyle = dayGrad;
      ctx.fillRect(0, 0, this.game.gameW, this.game.gameH);
    }
  }

  renderBgParticles() {
    const ctx = this.game.ctx;
    if (!this.game.bgParticles) return;
    for (let bp of this.game.bgParticles) {
      bp.x += bp.vx;
      bp.y += bp.vy;
      if (bp.x < 0) bp.x = this.game.gameW;
      if (bp.x > this.game.gameW) bp.x = 0;
      if (bp.y < 0) bp.y = this.game.gameH;
      if (bp.y > this.game.gameH) bp.y = 0;

      if (bp.x < this.game.cullMinX || bp.x > this.game.cullMaxX || bp.y < this.game.cullMinY || bp.y > this.game.cullMaxY) continue;
      ctx.globalAlpha = bp.alpha;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, bp.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  renderMoveMarker() {
    const ctx = this.game.ctx;
    if (!this.game.moveMarker) return;
    const progress = Math.max(0, this.game.moveMarker.life / this.game.moveMarker.maxLife);
    ctx.globalAlpha = progress;
    ctx.strokeStyle = 'rgba(241, 196, 15, 0.8)';
    ctx.shadowColor = '#f1c40f';
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.game.moveMarker.x, this.game.moveMarker.y, 14 * progress, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.shadowBlur = 0;
    this.game.moveMarker.life -= 1;
    ctx.globalAlpha = 1;
  }

  renderPlayerWalkMarkerRaw(ctx, player) {
    if (!player || !player.isMoving || player.autoAttackTarget) return;
    ctx.save();
    ctx.globalAlpha = 0.6 + Math.sin(Date.now() / 150) * 0.2;
    const isCollecting = !!player.targetedItemId;
    if (isCollecting) {
      ctx.fillStyle = '#2ecc71';
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 10;
      const size = 10;
      ctx.translate(player.moveTargetX, player.moveTargetY);
      ctx.rotate(Date.now() / 200);
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        ctx.rotate(Math.PI / 2);
        ctx.lineTo(size, 0);
        ctx.lineTo(size / 3, size / 3);
      }
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(241, 196, 15, 0.6)';
      ctx.shadowColor = '#f1c40f';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.ellipse(player.moveTargetX, player.moveTargetY, 15, 7.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  renderGroundFoliage() {
    const ctx = this.game.ctx;
    if (!this.game.groundFoliage) return;
    for (let gf of this.game.groundFoliage) {
      if (gf.x < this.game.cullMinX || gf.x > this.game.cullMaxX || gf.y < this.game.cullMinY || gf.y > this.game.cullMaxY) continue;
      ctx.fillStyle = gf.color;
      ctx.beginPath();
      if (gf.type === 'grass') {
        const sway = Math.sin(this.game.globalTime * 2 + gf.phase) * 3;
        ctx.moveTo(gf.x + sway, gf.y - gf.size);
        ctx.lineTo(gf.x - gf.size / 3, gf.y);
        ctx.lineTo(gf.x + gf.size / 3, gf.y);
      } else if (gf.type === 'mud' || gf.type === 'cracks') {
        ctx.ellipse(gf.x, gf.y, gf.size, gf.size * 0.4, 0, 0, Math.PI * 2);
      } else {
        ctx.arc(gf.x, gf.y, gf.size / 2, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  renderEnemyTargetHighlight(e, ctx) {
    if (!this.game.player || this.game.player.autoAttackTarget !== e) return;
    ctx.save();
    ctx.shadowColor = '#e74c3c';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#e74c3c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(e.x, e.y, e.size * 1.2, e.size * 0.6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  renderItem(item, ctx) {
    const player = this.game.player;
    if (player && player.targetedItemId === item.id) {
      ctx.save();
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 15;
      ctx.strokeStyle = '#2ecc71';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(item.x, item.y, 22, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(46, 204, 113, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([5, 5]);
      ctx.lineDashOffset = -this.game.globalTime / 15;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(item.x, item.y);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    const floatOffset = Math.sin(this.game.globalTime / 200) * 5;
    const pulse = Math.abs(Math.sin(this.game.globalTime / 150));
    ctx.translate(item.x, item.y - 10 + floatOffset);
    ctx.globalAlpha = Math.min(1, item.life / 1000);

    if (item.type === 'gear') {
      ctx.beginPath();
      ctx.ellipse(0, 8, (14 + pulse * 6) * 1.3, (14 + pulse * 6) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = item.color || '#ecf0f1';
      ctx.globalAlpha = (0.0125 + pulse * 0.01875) * Math.min(1, item.life / 1000);
      ctx.fill();

      ctx.globalAlpha = Math.min(1, item.life / 1000);
      ctx.shadowColor = item.color || '#ecf0f1';
      ctx.shadowBlur = 10 + pulse * 10;

      let resolvedIcon = item.icon || '💎';
      if (resolvedIcon === '📦') {
        const template = ConfigModule.ITEMS_DB.find(t => t.name === item.name);
        if (template && template.icon) resolvedIcon = template.icon;
      }

      if (resolvedIcon && typeof resolvedIcon === 'string' && (resolvedIcon.startsWith('data:image/') || resolvedIcon.startsWith('http'))) {
        const img = getCachedImage(resolvedIcon);
        if (img) {
          ctx.drawImage(img, -15, -15, 30, 30);
        } else {
          ctx.font = '22px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('📦', 0, 0);
        }
      } else {
        ctx.font = '22px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(resolvedIcon || '💎', 0, 0);
      }

      ctx.shadowBlur = 4;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = item.color || '#ecf0f1';
      ctx.fillText(item.name || 'Gear', 0, -28 - pulse * 2);

      ctx.fillStyle = '#ffffff';
      ctx.font = '9px sans-serif';
      const statStr = item.stats ? Object.entries(item.stats).map(([k, v]) => `+${Math.floor(v)} ${k.toUpperCase()}`).join('  ') : '';
      ctx.fillText(statStr, 0, -16 - pulse * 2);
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 8, (10 + pulse * 6) * 1.3, (10 + pulse * 6) * 0.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = item.type === 'red' ? `rgba(231, 76, 60, ${0.3 + pulse * 0.3})` : `rgba(52, 152, 219, ${0.3 + pulse * 0.3})`;
      ctx.fill();

      ctx.fillStyle = item.type === 'red' ? '#e74c3c' : '#3498db';
      ctx.shadowColor = item.type === 'red' ? '#ff7979' : '#7ed6df';
      ctx.shadowBlur = 10 + pulse * 15;
      ctx.beginPath();
      ctx.arc(0, 0, 7 + pulse * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'white';
      ctx.shadowBlur = 0;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.type === 'red' ? '❤️' : '⚡', 0, -18 - pulse * 2);
    }

    if (this.game.player && this.game.player.targetedItemId === item.id) {
      ctx.save();
      ctx.fillStyle = '#2ecc71';
      ctx.shadowColor = '#2ecc71';
      ctx.shadowBlur = 8;
      const arrowY = -36 + Math.sin(this.game.globalTime / 100) * 3;
      ctx.beginPath();
      ctx.moveTo(0, arrowY);
      ctx.lineTo(-5, arrowY - 8);
      ctx.lineTo(5, arrowY - 8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  renderBuffParticles() {
    const player = this.game.player;
    if (!player || !player.alive || this.game.state !== 'PLAYING') return;
    if (player.buffHpTimer > 0 && Math.random() < 0.1) {
      this.game.particleManager.spawnParticles(player.x + (Math.random() - 0.5) * 30, player.y - Math.random() * 50, '#e74c3c', 1, 3);
    }
    if (player.buffManaTimer > 0 && Math.random() < 0.1) {
      this.game.particleManager.spawnParticles(player.x + (Math.random() - 0.5) * 30, player.y - Math.random() * 50, '#3498db', 1, 3);
    }
  }
}
