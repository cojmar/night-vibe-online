import * as ConfigModule from './config.js';

export default class ItemManager {
  constructor(game) {
    this.game = game;
    this.pendingPickupIds = new Set();
  }

  handleItemPickup(event) {
    const itemId = typeof event === 'string' ? event : (event.data || event.itemId);
    if (!itemId) return;
    this.pendingPickupIds.delete(itemId);
    const idx = this.game.items.findIndex(i => i.id === itemId);
    if (idx >= 0) this.game.items.splice(idx, 1);
  }

  handleItemDrop(event) {
    if (!this.game.items.find(i => i.id === event.item.id)) {
      this.game.items.push(event.item);
    }
  }

  handleGameEvent(event) {
    if (event.type === 'item_spawn') {
      if (!this.game.items.find(i => i.id === event.id)) {
        this.game.items.push(event.item);
      }
    }
  }

  updateItems(dt) {
    if (!this.game.items) return;

    if (this.game.player && this.game.player.targetedItemId) {
      const exists = this.game.items.some(item => item.id === this.game.player.targetedItemId);
      if (!exists) {
        this.game.player.targetedItemId = null;
      }
    }

    for (let i = 0; i < this.game.items.length; i++) {
      const item = this.game.items[i];
      item.life -= dt * 16.67;
      if (item.life <= 0) {
        if (this.game.player && this.game.player.targetedItemId === item.id) {
          this.game.player.targetedItemId = null;
        }
        this.game.items.splice(i, 1); i--; continue;
      }

      if (item.falling) {
        item.vy += 1.0 * dt;
        item.y += item.vy * dt;
        if (item.y >= item.targetY) {
          item.y = item.targetY;
          item.falling = false;
          item.vy = 0;
        }
      }

      this.checkLocalPickup(item, i);
    }
  }

  checkLocalPickup(item, i) {
    if (!this.game.player || !this.game.player.alive || this.game.player.hp <= 0) return;
    if (Math.hypot(this.game.player.x - item.x, this.game.player.y - item.y) >= 40) return;

    if (item.type === 'gear' && this.game.player.targetedItemId !== item.id) return;

    if (item.type === 'gear') {
      this.game.player.inventory.push(item);
      let statsStr = '';
      if (item.stats) {
        const parts = [];
        if (item.stats.atk) parts.push(`+${item.stats.atk} ATK`);
        if (item.stats.hp) parts.push(`+${item.stats.hp} HP`);
        if (item.stats.spd) parts.push(`+${Number(item.stats.spd).toFixed(1)} SPD`);
        if (parts.length > 0) statsStr = ` (${parts.join(', ')})`;
      }
      this.game.floatingTexts.push({
        x: this.game.player.x, y: this.game.player.y - 50,
        text: `🎒 Looted: ${item.name}${statsStr}!`,
        color: item.color, life: 60, maxLife: 60, isCrit: false
      });
      this.game.ui.addLog(`🎒 You picked up a ${item.name}${statsStr}!`, 'reward');
      if (this.game.ui) this.game.ui.renderInventory();
      this.game.saveLocalProgression();
      if (this.game.player.isLocal) {
        this.game.net.send_cmd("item_pickup", item.id);
        this.pendingPickupIds.add(item.id);
      }
    } else if (item.type === 'red') {
      this.game.player.buffHpTimer = ConfigModule.POTION_BUFF_DURATION;
      this.game.particleManager.spawnParticles(this.game.player.x, this.game.player.y - 20, '#e74c3c', 30, 6);
      this.game.floatingTexts.push({
        x: this.game.player.x, y: this.game.player.y - 50,
        text: `🩸 Vampirism ${Math.round(ConfigModule.POTION_BUFF_DURATION / 1000)}s!`,
        color: '#e74c3c', life: 60, maxLife: 60, isCrit: false
      });
      this.game.ui.addLog(`🩸 Vampirism! Heal on hit for ${Math.round(ConfigModule.POTION_BUFF_DURATION / 1000)}s`, 'reward');
      if (this.game.player.isLocal) {
        this.game.net.send_cmd("item_pickup", item.id);
        this.pendingPickupIds.add(item.id);
      }
    } else if (item.type === 'blue') {
      this.game.player.buffManaTimer = ConfigModule.POTION_BLUE_BUFF_DURATION;
      this.game.particleManager.spawnParticles(this.game.player.x, this.game.player.y - 20, '#3498db', 30, 6);
      this.game.floatingTexts.push({
        x: this.game.player.x, y: this.game.player.y - 50,
        text: `⚡ Mana Buff ${Math.round(ConfigModule.POTION_BLUE_BUFF_DURATION / 1000)}s!`,
        color: '#3498db', life: 60, maxLife: 60, isCrit: false
      });
      this.game.ui.addLog(`⚡ Skill Cooldown Buff for ${Math.round(ConfigModule.POTION_BLUE_BUFF_DURATION / 1000)}s!`, 'reward');
      if (this.game.player.isLocal) {
        this.game.net.send_cmd("item_pickup", item.id);
        this.pendingPickupIds.add(item.id);
      }
    }

    if (this.game.player.targetedItemId === item.id) {
      this.game.player.targetedItemId = null;
    }
    this.game.items.splice(i, 1);
  }

  dropItemsOnEnemyDeath(e) {
    if (!this.game.isHost || e.alive || e.deadProcessed) return;
    e.deadProcessed = true;

    const groundY = this.game.getGroundY();

    if (e.name !== 'MISSILE' && e.name !== 'BOMB') {
      if (this.game.dropPrng.nextFloat() < ConfigModule.POTION_RED_DROP_CHANCE) {
        const lifeTime = 15000 + this.game.wave * 2000;
        const dropY = groundY + 20 + this.game.dropPrng.nextFloat() * Math.min(250, this.game.gameH - groundY - 40);
        this.game.items.push({
          id: this.game.dropPrng.nextFloat().toString(36).substr(2, 9),
          type: 'red', x: e.x, y: e.y, life: lifeTime,
          vy: 0, falling: true, targetY: dropY
        });
      }

      if (this.game.dropPrng.nextFloat() < ConfigModule.POTION_BLUE_DROP_CHANCE) {
        const lifeTime = 15000 + this.game.wave * 2000;
        const dropY = groundY + 20 + this.game.dropPrng.nextFloat() * Math.min(250, this.game.gameH - groundY - 40);
        this.game.items.push({
          id: this.game.dropPrng.nextFloat().toString(36).substr(2, 9),
          type: 'blue', x: e.x, y: e.y, life: lifeTime,
          vy: 0, falling: true, targetY: dropY
        });
      }
    }

    if (e.name === 'MISSILE' || e.name === 'BOMB') return;

    if (ConfigModule.GEAR_DROP_ONLY_BOSS && e.name !== 'BOSS') return;

    if (this.game.dropPrng.nextFloat() >= ConfigModule.GEAR_DROP_RATE) return;

    let rarity = 'normal';
    let color = '#ecf0f1';
    let numAffixes = 1;
    const randRarity = this.game.dropPrng.nextFloat();
    const totalWeight = ConfigModule.GEAR_RARITY_NORMAL + ConfigModule.GEAR_RARITY_MAGIC + ConfigModule.GEAR_RARITY_RARE;
    const rareThreshold = ConfigModule.GEAR_RARITY_RARE / totalWeight;
    const magicThreshold = rareThreshold + (ConfigModule.GEAR_RARITY_MAGIC / totalWeight);

    if (randRarity < rareThreshold) {
      rarity = 'rare'; color = '#f1c40f'; numAffixes = 3;
    } else if (randRarity < magicThreshold) {
      rarity = 'magic'; color = '#3498db'; numAffixes = 2;
    }

    const lvl = e.isBoss ? (e.level || this.game.wave) * 1.5 : (e.level || this.game.wave);
    const baseStat = lvl * ConfigModule.GEAR_STAT_MULTIPLIER;
    const variance = ConfigModule.GEAR_STAT_VARIANCE;
    const finalStat = Math.floor(baseStat * (1 - variance + this.game.dropPrng.nextFloat() * variance * 2));

    let stats = {};
    let icon = '💎';
    let category = 'Ring';
    let itemName = 'Unknown Item';

    const useCustom = (ConfigModule.ITEMS_DB && ConfigModule.ITEMS_DB.length > 0);
    if (useCustom) {
      const matchingItems = ConfigModule.ITEMS_DB.filter(item => (item.rarity || 'normal') === rarity);
      const templateList = matchingItems.length > 0 ? matchingItems : ConfigModule.ITEMS_DB;
      const template = templateList[Math.floor(this.game.dropPrng.nextFloat() * templateList.length)];
      category = template.gearType;
      itemName = template.name;
      icon = template.icon;
      rarity = template.rarity || rarity;
      color = template.color || color;
      const scale = finalStat / 10;
      if (template.stats) {
        if (template.stats.atk) stats.atk = Math.max(1, Math.floor(template.stats.atk * scale));
        if (template.stats.hp) stats.hp = Math.max(1, Math.floor(template.stats.hp * scale));
        if (template.stats.spd) stats.spd = Math.max(1, Math.ceil(template.stats.spd * scale));
      }
      if (Object.keys(stats).length === 0) {
        if (category === 'Weapon') { stats.atk = Math.max(1, finalStat); }
        else if (category === 'Armor') { stats.hp = Math.max(5, finalStat * 10); }
        else { stats.spd = Math.max(1, Math.ceil(finalStat * 0.1)); }
      }
    } else {
      const categories = ['Weapon', 'Armor', 'Ring'];
      category = categories[Math.floor(this.game.dropPrng.nextFloat() * categories.length)];
      if (category === 'Weapon') { stats.atk = Math.max(1, finalStat); icon = '🗡️'; }
      else if (category === 'Armor') { stats.hp = Math.max(5, finalStat * 10); icon = '🛡️'; }
      else { stats.spd = Math.max(1, Math.ceil(finalStat * 0.1)); icon = '💍'; }

      const possibleAffixes = ['atk', 'hp', 'spd'];
      let affixesAdded = 1;
      let sanity = 0;
      while (affixesAdded < numAffixes && sanity < 10) {
        sanity++;
        const randAffix = possibleAffixes[Math.floor(this.game.dropPrng.nextFloat() * possibleAffixes.length)];
        if (!stats[randAffix]) {
          if (randAffix === 'atk') stats.atk = Math.max(1, Math.floor(finalStat * 0.5));
          if (randAffix === 'hp') stats.hp = Math.max(2, Math.floor(finalStat * 5));
          if (randAffix === 'spd') stats.spd = Math.max(1, Math.ceil(finalStat * 0.05));
          affixesAdded++;
        }
      }
      const prefixes = rarity === 'rare'
        ? ['Epic', 'Legendary', 'Godly']
        : (rarity === 'magic' ? ['Glowing', 'Mystic', 'Enchanted'] : ['Rusty', 'Common', 'Basic']);
      itemName = `${prefixes[Math.floor(this.game.dropPrng.nextFloat() * prefixes.length)]} ${category}`;
    }

    const dropY = groundY + 20 + this.game.dropPrng.nextFloat() * Math.min(250, this.game.gameH - groundY - 40);
    this.game.items.push({
      id: this.game.dropPrng.nextFloat().toString(36).substr(2, 9),
      type: 'gear', gearType: category, rarity, color,
      name: itemName, stats, icon,
      x: e.x, y: e.y, life: 30000, vy: 0, falling: true, targetY: dropY
    });
  }
}
