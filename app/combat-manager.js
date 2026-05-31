import { REBIRTH_BASE_LEVEL, REBIRTH_LEVEL_STEP, CLASS_DATA, POTION_LIFESTEAL_PERCENT, getGroundY } from './utils.js';
import * as ConfigModule from './config.js';
import Projectile from './projectile.js';

export default class CombatManager {
  constructor(game) {
    this.game = game;
  }

  handleLeftClick(cx, cy) {
    if (!this.game.player || !this.game.player.alive) return;
    this.game.autoRestartS2 = false;
    this.game.player.lastInputTime = Date.now();
    const groundY = getGroundY(this.game.selectedEnv);
    const onGround = cy >= groundY - ConfigModule.GROUND_TOLERANCE;
    let clickedEnemy = null;
    let clickedItem = null;

    if (this.game.items) {
      for (let item of this.game.items) {
        const dist = Math.hypot(cx - item.x, cy - item.y);
        if (dist < 40) {
          clickedItem = item;
          break;
        }
      }
    }

    if (clickedItem) {
      this.game.player.autoAttackTarget = null;
      this.game.player.targetedItemId = clickedItem.id;
      this.game.player.isMoving = true;
      this.game.player.moveTargetX = clickedItem.x;
      this.game.player.moveTargetY = clickedItem.y;
      this.game.player.action = 'walk';
      this.game.moveMarker = { x: clickedItem.x, y: clickedItem.y, life: 30, maxLife: 30, color: 'green' };
      const typeStr = clickedItem.type === 'red' ? '❤️ Potion' : '⚡ Potion';
      document.getElementById('walk-indicator').innerHTML = `🧪 Collecting ${typeStr}...`;
      document.getElementById('walk-indicator').classList.add('visible');
      this.game.networkSync.broadcastState();
      return;
    }

    this.game.player.targetedItemId = null;

    for (let e of this.game.enemies) {
      if (!e.alive) continue;
      if ((this.game.player.classType === 'warrior' || this.game.player.classType === 'magicgladiator') && e.y < this.game.gameH / 2) {
        continue;
      }
      const dist = Math.hypot(cx - e.x, cy - e.y);
      if (dist < e.size + 30) {
        clickedEnemy = e; break;
      }
    }

    if (!onGround || clickedEnemy) {
      if (clickedEnemy) {
        this.game.player.autoAttackTarget = clickedEnemy;
        document.getElementById('walk-indicator').innerHTML = '⚔️ Attacking...';
        document.getElementById('walk-indicator').classList.add('visible');
        return;
      }
      this.game.player.autoAttackTarget = null;
      this.game.doSkill1(cx, cy);
    } else {
      this.game.player.autoAttackTarget = null;
      this.game.player.isMoving = true;
      this.game.player.moveTargetX = Math.max(20, Math.min(this.game.gameW - 20, cx));
      this.game.player.moveTargetY = Math.max(groundY - 50, Math.min(this.game.gameH - 45, cy));
      this.game.player.action = 'walk';
      document.getElementById('walk-indicator').innerHTML = '🚶 Walking...';
      document.getElementById('walk-indicator').classList.add('visible');
    }

    this.game.moveMarker = { x: cx, y: cy, life: 30, maxLife: 30, color: 'yellow' };
    this.game.networkSync.broadcastState();
  }

  doSkill1(tx, ty) {
    if (!this.game.player || !this.game.player.alive) return;
    this.game.player.stopWalking(this.game);
    const cd = CLASS_DATA[this.game.player.classType] || CLASS_DATA.warrior;
    const reqLevel = 4 + (this.game.player.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.game.player.level - 1) / Math.max(1, reqLevel - 1));
    const weaponY = this.game.player.y - 40 * lvlScale;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.game.player.x);
    this.game.player.animTimer = 15;
    this.game.player.action = 'attack';
    this.game.player.lastSkill = 1;
    this.game.player.facing = tx > this.game.player.x ? 1 : -1;
    const s1Scale = Math.min(3.0, 1 + (this.game.player.atk - cd.atk) * 0.02);

    let projProps = { tx, ty, angle: aimAngle, facing: this.game.player.facing, damage: this.game.player.atk, critChance: 0.1 };

    const skillType = cd.s1Name;
    if (skillType === 'Bash' || this.game.player.classType === 'warrior') {
      const wScale = 1 + (this.game.player.atk - cd.atk) * 0.005;
      this.game.spawnProjectile({ type: 'slash', originX: this.game.player.x, originY: weaponY, life: 15, maxLife: 15, color: cd.s1Color || '#d4af37', radius: 60 * wScale * lvlScale, hitInner: 0, hitOuter: 90 * wScale * lvlScale, knockback: 65, knockbackDir: aimAngle, isKnockback: true, damage: this.game.player.atk * 1.0, ...projProps });
      this.game.spawnParticles(this.game.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, cd.s1Color || '#d4af37', 8, 4);
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        this.game.spawnParticles(this.game.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, Math.random() > 0.5 ? '#ffd700' : '#fff', 1, 2 + Math.random() * 3, 2);
      }
    } else if (skillType === 'Magic Bolt' || this.game.player.classType === 'mage') {
      const mageBaseAtk = cd.atk;
      const mageRangeMult = Math.pow(this.game.player.atk / mageBaseAtk, ConfigModule.E1_RANGE_ATK_EXPONENT);
      const mageLife = Math.round(60 * mageRangeMult);
      this.game.spawnProjectile({ type: 'bolt', x: this.game.player.x, y: weaponY, tx: tx, ty: ty, speed: 8, life: mageLife, maxLife: mageLife, color: cd.s1Color || '#3498db', damage: this.game.player.atk * 0.9, radius: 6 * s1Scale * lvlScale, ...projProps });
      this.game.spawnParticles(this.game.player.x, weaponY, cd.s1Color || '#3498db', 3, 2);
    } else if (skillType === 'Quick Shot' || this.game.player.classType === 'archer') {
      const archerBaseAtk = cd.atk;
      const archerRangeMult = Math.pow(this.game.player.atk / archerBaseAtk, ConfigModule.E1_RANGE_ATK_EXPONENT);
      const archerLife = Math.round(50 * archerRangeMult);
      const speed = 10;
      const archerS1Scale = Math.min(5, 1 + (this.game.player.atk - archerBaseAtk) * 0.0227);
      const arrowRadius = 12 * archerS1Scale * lvlScale;
      this.game.spawnProjectile({ type: 'arrow', x: this.game.player.x, y: weaponY, vx: Math.cos(aimAngle) * speed, vy: Math.sin(aimAngle) * speed, speed, life: archerLife, maxLife: archerLife, color: cd.s1Color || '#e74c3c', damage: this.game.player.atk * 1.1, radius: arrowRadius, ...projProps });
      const extraArrows = Math.max(0, Math.floor((this.game.player.atk - 100) / 100));
      if (extraArrows > 0) {
        let nearest = null, nearDist = Infinity;
        for (let e of this.game.enemies) {
          if (!e.alive) continue;
          const d = Math.hypot(e.x - this.game.player.x, e.y - weaponY);
          if (d < nearDist) { nearDist = d; nearest = e; }
        }
        if (nearest) {
          const targetAngle = Math.atan2(nearest.y - weaponY, nearest.x - this.game.player.x);
          const spread = 0.12;
          for (let i = 0; i < extraArrows; i++) {
            const offset = (i - (extraArrows - 1) / 2) * spread;
            const a = targetAngle + offset;
            this.game.spawnProjectile({ type: 'arrow', x: this.game.player.x, y: weaponY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed, life: archerLife, maxLife: archerLife, color: cd.s1Color || '#e74c3c', damage: this.game.player.atk * 1.1, radius: arrowRadius, tx: nearest.x, ty: nearest.y, angle: a, facing: this.game.player.facing, critChance: 0.1 });
          }
        }
      }
      this.game.spawnParticles(this.game.player.x, weaponY, cd.s1Color || '#e74c3c', 4, 3);
    } else if (skillType === 'Psionic Slash' || this.game.player.classType === 'magicgladiator') {
      const mgScale = 1 + (this.game.player.atk - cd.atk) * 0.002;
      this.game.spawnProjectile({ type: 'psionic_slash', x: this.game.player.x, y: weaponY, vx: Math.cos(aimAngle) * 8, vy: Math.sin(aimAngle) * 8, angle: aimAngle, speed: 8, life: 8, maxLife: 8, color: cd.s1Color || '#e74c3c', radius: 45 * mgScale * lvlScale, damage: this.game.player.atk * 1.1, critChance: 0.12, ...projProps });
      this.game.spawnParticles(this.game.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, cd.s1Color || '#e74c3c', 7, 4);
    } else {
      // Default fallback is Warrior Bash style
      const wScale = 1 + (this.game.player.atk - cd.atk) * 0.005;
      this.game.spawnProjectile({ type: 'slash', originX: this.game.player.x, originY: weaponY, life: 15, maxLife: 15, color: cd.s1Color || '#d4af37', radius: 60 * wScale * lvlScale, hitInner: 0, hitOuter: 90 * wScale * lvlScale, knockback: 65, knockbackDir: aimAngle, isKnockback: true, damage: this.game.player.atk * 1.0, ...projProps });
      this.game.spawnParticles(this.game.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, cd.s1Color || '#d4af37', 8, 4);
      for (let i = 0; i < 6; i++) {
        const a = Math.random() * Math.PI * 2;
        this.game.spawnParticles(this.game.player.x + Math.cos(aimAngle) * 40, weaponY + Math.sin(aimAngle) * 40, Math.random() > 0.5 ? '#ffd700' : '#fff', 1, 2 + Math.random() * 3, 2);
      }
    }
    this.game.networkSync.broadcastState();
  }

  startChargingSkill2() {
    if (!this.game.player || !this.game.player.alive || this.game.s2Cooldown > 0 || this.game.player.isChargingS2) return;
    this.game.player.lastInputTime = Date.now();
    this.game.player.autoAttackTarget = null;
    this.game.player.targetedItemId = null;
    this.game.player.stopWalking(this.game);
    if (!this.game.player || !this.game.player.alive || this.game.s2Cooldown > 0) return;
    this.game.player.isChargingS2 = true;
    this.game.player.s2ChargeTime = 0;
    this.game.player.s2ChargeCount = 0;
    this.game.player.action = 'attack';
    this.game.player.animTimer = 9999;
    this.game.player.lastSkill = 2;
    this.game.networkSync.broadcastState();
  }

  releaseSkill2() {
    if (!this.game.player || !this.game.player.isChargingS2) return;
    this.game.queuedFireball = null;
    this.game.player.lastInputTime = Date.now();
    this.game.player.isChargingS2 = false;
    this.game.autoRestartS2 = this.game.mouseDown;

    const cd = CLASS_DATA[this.game.player.classType] || CLASS_DATA.warrior;
    const baseSpd = cd.spd;
    const diff = Math.max(0, this.game.player.spd - baseSpd);
    this.game.s2MaxCooldown = Math.max(1000, 5000 - diff * 200);
    this.game.s2Cooldown = this.game.s2MaxCooldown;
    const aoeScale = 1 + (this.game.player.spd - baseSpd) * 0.02;
    const reqLevel = 4 + (this.game.player.resets || 0) * 5;
    const lvlScale = 0.5 + 0.5 * ((this.game.player.level - 1) / Math.max(1, reqLevel - 1));
    const charges = this.game.player.s2ChargeCount || 0;
    const dmgMulti = 1 + (charges * 0.15);
    const areaMulti = 1 + (charges * 0.08);

    const tx = this.game.player.mouseX, ty = this.game.player.mouseY;
    const weaponY = this.game.player.y - 30 * lvlScale;
    const aimAngle = Math.atan2(ty - weaponY, tx - this.game.player.x);
    this.game.player.facing = tx > this.game.player.x ? 1 : -1;
    this.game.player.animTimer = 25;
    this.game.player.action = 'attack';
    this.game.player.lastSkill = 2;

    let projProps = { tx, ty, angle: aimAngle, facing: this.game.player.facing };

    const skillType = cd.s2Name;
    if (skillType === 'Sword Slash' || this.game.player.classType === 'warrior') {
      const effectiveSpd = Math.min(200, this.game.player.spd);
      const spdDiff = Math.max(0, effectiveSpd - cd.spd);
      const powerMulti = 1 + (charges * 0.5) + Math.floor(spdDiff / 100) * 0.5;
      const waveDistance = Math.min(this.game.gameW * 0.4, (150 + spdDiff * 8) * areaMulti);
      const areaMultiRadius = Math.min(3.0, areaMulti * (1 + powerMulti * 0.2));
      const singleDamage = this.game.player.atk * 0.5 * dmgMulti * powerMulti;
      const singleRadius = 25 * aoeScale * areaMultiRadius * lvlScale;
      this.game.spawnProjectile({ type: 'shockwave', originX: this.game.player.x, originY: weaponY, x: this.game.player.x, y: weaponY, speed: 6.5, life: 50, maxLife: 50, color: cd.s2Color || '#ffd700', damage: singleDamage, critChance: 0.2, maxDistance: waveDistance, radius: singleRadius, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps, angle: aimAngle, charges: charges });
    } else if (skillType === 'Fireball' || this.game.player.classType === 'mage') {
      const fbRadius = Math.min(60, 15 + charges * 5);
      const newFireballRadius = fbRadius * aoeScale * lvlScale;
      const spawnX = this.game.player.x;
      const spawnY = weaponY;
      const spdDiff = Math.max(0, this.game.player.spd - 200);
      const fbLifeMult = 1 + Math.floor(spdDiff / 50) * 0.2;
      const fbLife = Math.round(80 * fbLifeMult);
      let canSpawn = true;
      for (let p of this.game.projectiles) {
        if (p.type === 'fireball' && p.life > 0) {
          const existingRadius = p.radius || newFireballRadius;
          const dist = Math.hypot(p.x - spawnX, p.y - spawnY);
          if (dist < newFireballRadius + existingRadius + 10) {
            canSpawn = false;
            break;
          }
        }
      }
      if (canSpawn) {
        this.game.spawnProjectile({ type: 'fireball', x: spawnX, y: spawnY, speed: 5, life: fbLife, maxLife: fbLife, color: cd.s2Color || '#e67e22', damage: this.game.player.atk * 1.0 * dmgMulti, critChance: 0.2, radius: newFireballRadius, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps });
        this.game.spawnParticles(spawnX, spawnY, cd.s2Color || '#e67e22', 20 * aoeScale + charges * 5, 5);
      } else if (!this.game.queuedFireball) {
        this.game.queuedFireball = { spawnX, spawnY, speed: 5, radius: newFireballRadius, color: cd.s2Color || '#e67e22', damage: this.game.player.atk * 1.0 * dmgMulti, ...projProps, fbLife };
      }
    } else if (skillType === 'Arrow Barrage' || this.game.player.classType === 'archer') {
      const maxArrowCount = 24;
      const minArrowCount = 4;
      const arrowRadius = 12 + charges * 0.9;
      const arrowBodyScale = 1 + charges * 0.075;
      const maxSpreadSpd = baseSpd + 100;
      const baseArrowCount = Math.min(maxArrowCount, Math.max(minArrowCount, 4 + Math.floor((this.game.player.spd - baseSpd) * 20 / (maxSpreadSpd - baseSpd))));
      const extraArrows = Math.max(0, Math.floor((this.game.player.spd - maxSpreadSpd) / 50));
      const totalArrowCount = baseArrowCount + extraArrows;
      const spreadRatio = totalArrowCount >= maxArrowCount ? 1 : (totalArrowCount - minArrowCount) / (maxArrowCount - minArrowCount);
      const spreadAngle = 0.15 + spreadRatio * (2 * Math.PI - 0.15);
      const facingAngle = aimAngle;
      for (let i = 0; i < totalArrowCount; i++) {
        const a = totalArrowCount === 1 ? facingAngle : facingAngle + (i / (totalArrowCount - 1) * 2 - 1) * spreadAngle / 2;
        const speed = 11;
        this.game.spawnProjectile({ type: 'arrow', x: this.game.player.x, y: weaponY, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, speed, life: 50, maxLife: 50, color: cd.s2Color || '#e74c3c', damage: this.game.player.atk * 2.0 * dmgMulti, critChance: 0.15, angle: a, radius: arrowRadius, bodyScale: arrowBodyScale });
      }
      this.game.spawnParticles(this.game.player.x, weaponY, cd.s2Color || '#e74c3c', 10 + charges * 5, 4);
    } else if (skillType === 'Evil Spirits' || this.game.player.classType === 'magicgladiator') {
      const existingSpirits = this.game.projectiles.filter(p => p.type === 'spirit').length;
      const totalSpd = this.game.player.spd;
      const spdRatioCount = Math.min(1, Math.max(0, (totalSpd - baseSpd) / Math.max(1, 200 - baseSpd)));
      const targetCount = 1 + Math.floor(3 * spdRatioCount) + charges * (1 + Math.floor(1.5 * spdRatioCount));
      const spiritCount = Math.min(targetCount, 25 - existingSpirits);
      const spiritDamage = this.game.player.atk * 0.8 * dmgMulti;
      const spiritRadius = Math.min(20, 10 + charges * 1.5);
      const lifeScaleBase = 30 + Math.max(0, totalSpd - baseSpd) * (60 / Math.max(1, 200 - baseSpd));
      const spiritLife = Math.round(lifeScaleBase + charges * 15);
      const spiritColor = cd.s2Color || '#ffd700';

      for (let i = 0; i < spiritCount; i++) {
        setTimeout(() => {
          if (this.game.state !== 'PLAYING' || !this.game.player || !this.game.player.alive) return;
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 6;
          const sizeMult = 0.7 + Math.random() * 0.6;
          const currentWeaponY = this.game.player.y - 40;
          this.game.spawnProjectile({
            type: 'spirit',
            x: this.game.player.x + Math.cos(angle) * 15,
            y: currentWeaponY + Math.sin(angle) * 15,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            speed: speed,
            casterSpd: this.game.player.spd,
            life: spiritLife,
            maxLife: spiritLife,
            color: spiritColor,
            damage: spiritDamage * sizeMult,
            critChance: 0.25,
            radius: spiritRadius * sizeMult,
            wobble: Math.random() * 100,
            trailTimer: 0,
            trailPositions: [],
            tx: this.game.player.mouseX,
            ty: this.game.player.mouseY,
            angle: angle,
            facing: 1
          });
        }, i * 150);
      }
      this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + this.game.player.atk * 0.5 * dmgMulti);
      this.game.ui.updateHUD(this.game.player);
    } else {
      // Default fallback: Warrior Shockwave style
      const effectiveSpd = Math.min(200, this.game.player.spd);
      const spdDiff = Math.max(0, effectiveSpd - cd.spd);
      const powerMulti = 1 + (charges * 0.5) + Math.floor(spdDiff / 100) * 0.5;
      const waveDistance = Math.min(this.game.gameW * 0.4, (150 + spdDiff * 8) * areaMulti);
      const areaMultiRadius = Math.min(3.0, areaMulti * (1 + powerMulti * 0.2));
      const singleDamage = this.game.player.atk * 0.5 * dmgMulti * powerMulti;
      const singleRadius = 25 * aoeScale * areaMultiRadius * lvlScale;
      this.game.spawnProjectile({ type: 'shockwave', originX: this.game.player.x, originY: weaponY, x: this.game.player.x, y: weaponY, speed: 6.5, life: 50, maxLife: 50, color: cd.s2Color || '#ffd700', damage: singleDamage, critChance: 0.2, maxDistance: waveDistance, radius: singleRadius, traveled: 0, trailTimer: 0, trailPositions: [], ...projProps, angle: aimAngle, charges: charges });
    }
    this.game.networkSync.broadcastState();
  }

  dealDamageToPlayer(damage) {
    if (!this.game.player || !this.game.player.alive) return;
    const reqLevel = REBIRTH_BASE_LEVEL + (this.game.player.resets || 0) * REBIRTH_LEVEL_STEP;
    const rawLvlScale = 0.5 + 0.5 * ((this.game.player.level - 1) / Math.max(1, reqLevel - 1));
    const lvlScale = Math.min(1.0, Math.max(0.5, rawLvlScale));
    const sizeReduction = lvlScale - 0.5;
    const armor = Math.floor(this.game.player.maxHp / 10);
    const armorReduction = armor * 0.005;
    const totalReduction = Math.min(0.9, armorReduction + sizeReduction);
    const actualDamage = Math.max(1, Math.round(damage * (1 - totalReduction)));
    this.game.player.hp -= actualDamage;
    this.game.player.hitFlash = 15;
    this.game.screenShake = 15;
    this.game.spawnDamageParticles(this.game.player.x, this.game.player.y);
    this.game.ui.updateHUD(this.game.player);
    this.game.ui.addLog(`💔 Took -${actualDamage} damage!`, 'enemy');
    this.game.floatingTexts.push({ x: this.game.player.x + (Math.random() - 0.5) * 20, y: this.game.player.y - 60, text: '-' + actualDamage, color: '#e74c3c', life: 35, maxLife: 35 });
    if (this.game.player.hp <= 0) {
      this.game.player.hp = 0;
      this.game.player.alive = false;
      this.game.networkSync.broadcastState();
      this.game.ui.showDeathScreen(`${this.game.waveEnemiesKilled}/${this.game.waveTotalEnemies}`, this.game.wave);
    } else {
      this.game.networkSync.broadcastState();
    }
  }

  emitEnemyHit(enemy, baseDamage, critChance) {
    if (!enemy.alive) return;
    if (!this.game.net || !this.game.net.me) return;
    const prng = this.game.prng;
    const isCrit = prng ? prng.nextFloat() < critChance : Math.random() < critChance;
    const dmgRoll = prng ? prng.nextFloat() : Math.random();
    const damage = Math.round(baseDamage * (isCrit ? 2.0 : 1.0) * (0.9 + dmgRoll * 0.2));
    this.game.networkSync.emitEvent('enemy_hit', {
      enemyId: enemy.id,
      damage: damage,
      isCrit: isCrit,
      sourceUserId: this.game.net.me.info.user
    });
  }

  applyEnemyHit(event) {
    const enemy = this.game.enemies.find(e => e.id === event.enemyId);
    if (!enemy || !enemy.alive) return;
    enemy.hp -= event.damage;
    enemy.hitFlash = 8;
    this.game.floatingTexts.push({
      x: enemy.x + (Math.random() - 0.5) * 20,
      y: enemy.y - 30,
      text: (event.isCrit ? '💥 ' : '') + event.damage,
      color: event.isCrit ? '#ffd700' : '#fff',
      life: 40, maxLife: 40, isCrit: event.isCrit
    });
    if (this.game.player && this.game.player.buffHpTimer > 0 && this.game.player.hp > 0) {
      const healAmount = Math.floor(event.damage * POTION_LIFESTEAL_PERCENT);
      this.game.player.hp = Math.min(this.game.player.maxHp, this.game.player.hp + healAmount);
      if (healAmount > 0) {
        this.game.floatingTexts.push({ x: this.game.player.x, y: this.game.player.y - 60, text: '+' + healAmount, color: '#2ecc71', life: 40, maxLife: 40, isCrit: false });
      }
      this.game.ui.updateHUD(this.game.player);
    }
    if (enemy.hp <= 0) {
      enemy.alive = false; enemy.deathTime = Date.now(); enemy.hp = 0;
      this.game.spawnEnemyDeathExplosion(enemy);
      this.game.networkSync.emitEvent('enemy_killed', { enemyId: enemy.id, playerId: event.sourceUserId });
    }
  }

  applyKnockback(enemy, dirAngle, distance) {
    if (!enemy.alive) return;
    enemy.x += Math.cos(dirAngle) * distance;
    enemy.y += Math.sin(dirAngle) * distance * 0.4;
    const groundY = getGroundY(this.game.selectedEnv);
    enemy.x = Math.max(enemy.size, Math.min(this.game.gameW - enemy.size, enemy.x));
    enemy.y = Math.max(enemy.size, Math.min(groundY - enemy.size, enemy.y));
    if (enemy.attackTimer !== undefined) enemy.attackTimer = Math.max(enemy.attackTimer, 30);
  }

  updateS2Charge(dt) {
    const player = this.game.player;
    if (!player) return;
    let chargeSpeed = (player.buffManaTimer > 0 ? ConfigModule.POTION_BLUE_CD_MULTIPLIER : 1);
    const cd = CLASS_DATA[player.classType] || CLASS_DATA.warrior;
    chargeSpeed *= (1 + Math.max(0, player.spd - cd.spd) * 0.05);
    if (player.classType === 'archer') chargeSpeed *= 1.35;
    player.s2ChargeTime = (player.s2ChargeTime || 0) + dt * 16.67 * chargeSpeed;
    const maxCharges = 3 + (player.resets || 0);
    const newCount = Math.min(maxCharges, Math.floor(player.s2ChargeTime / 1000));
    if (newCount > (player.s2ChargeCount || 0)) {
      player.s2ChargeCount = newCount;
      if (player.classType !== 'warrior') this.game.particleManager.spawnParticles(player.x, player.y - 40, '#ffd700', 15, 4);
      this.game.networkSync.broadcastState();
    }
    if (player.classType === 'magicgladiator' && Math.random() < 0.15 * dt) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 25;
      this.game.particles.push({ x: player.x + Math.cos(angle) * dist, y: player.y - 40 + Math.sin(angle) * dist, vx: Math.cos(angle) * 0.3, vy: -0.5 - Math.random() * 0.5, life: 15 + Math.floor(Math.random() * 15), maxLife: 30, color: cd.s2Color || '#9b4dff', size: 1.5 + Math.random() * 2, isSparkle: true });
    }
    if (player.s2ChargeCount >= maxCharges && player.s2ChargeTime >= maxCharges * 1000 + 150) this.releaseSkill2();
  }

  spawnProjectile(props, broadcast = true) {
    if (!broadcast) return;
    if (!this.game.net || !this.game.net.me) return;
    const ownerId = props.ownerId || this.game.net.me.info.user;
    const id = props.id || 'P_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const cleanProps = { ...props, id, ownerId };
    delete cleanProps.image;
    delete cleanProps.flippedImage;
    this.game.networkSync.emitEvent('projectile_spawn', { projectile: cleanProps });
  }
}
