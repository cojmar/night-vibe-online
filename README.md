# NIGHT VIBE ONLINE

[![GitHub Pages](https://img.shields.io/badge/GitHub_Pages-Live-blue?style=flat-square)](https://cojmar.github.io/night-vibe-online/)
![Vanilla JS](https://img.shields.io/badge/Stack-Vanilla%20JS-lightgrey?style=flat-square)
![WebSocket](https://img.shields.io/badge/Networking-BSON%20WebSocket-orange?style=flat-square)
![Mobile First](https://img.shields.io/badge/Platform-Mobile%20%2B%20Desktop-green?style=flat-square)

> **A dark-fantasy arena combat sandbox with multiplayer support. Survive endless waves of enemies, master unique classes, and become the last one standing.**

<div align="center">

### [&#127919; PLAY NOW](https://cojmar.github.io/night-vibe-online/)

</div>

---

## Table of Contents

- [Features](#features)
- [Classes](#classes)
- [Combat Mechanics](#combat-mechanics)
- [Waves & Enemies](#waves--enemies)
- [Progression](#progression)
- [Multiplayer](#multiplayer)
- [Environments](#environments)
- [Controls](#controls)
- [Settings & Optimization](#settings--optimization)

---

## Features

- **4 Unique Classes** — Each with distinct weapons, stats, and two abilities
- **Multiplayer Arena** — Real-time co-op via WebSocket with shared enemy states
- **Endless Wave System** — Progressive difficulty with boss fights every 5 waves
- **Roguelike Progression** — Rebirth system with permanent stat bonuses
- **Inventory & Loot** — Defeat enemies to collect and equip gear with stat bonuses
- **Dynamic Config Editor** — Fully customize classes, monsters, gear, and gameplay presets
- **Dynamic Environments** — 6 hand-crafted biomes with day/night cycles
- **Stat Building** — Allocate points across ATK, SPD, and HP to shape your playstyle
- **Boss Fights** — Elite enemies with unique attacks every 5 waves
- **Mobile-First Design** — Touch controls, responsive layout, auto-optimization

---

## Classes

Choose your fighter wisely. Each class offers a completely different combat experience.

### &#9993; Warrior

> **Tanky melee brawler.** High HP, powerful shockwaves, and knockback that keeps enemies at bay.

| Stat | Value |
|------|-------|
| HP | 170 |
| Speed | 8 |
| Attack | 22 |

| Skill | Type | Description |
|-------|------|-------------|
| **Bash** (S1) | Melee | A wide arc slash with knockback. Deals 100% ATK damage. Left-click an enemy to use. |
| **Sword Slash** (S2) | AoE Projectile | Fires a massive shockwave dealing 50% ATK damage base. Damage and AOE size scale massively with charges and your SPD stat. Charge by right-click/long-press. |

**Playstyle:** Hold the line. Use knockback to control enemy positioning and let your shockwaves clear groups.

---

### &#128126; Mage

> **Ranged spellcaster.** Burst AoE damage from a distance with explosive fireballs.

| Stat | Value |
|------|-------|
| HP | 130 |
| Speed | 14 |
| Attack | 18 |

| Skill | Type | Description |
|-------|------|-------------|
| **Magic Bolt** (S1) | Ranged | A fast single-target bolt dealing 90% ATK damage. |
| **Fireball** (S2) | AoE | An exploding fireball dealing 100% ATK damage base. Leaves a lingering fire trail. Charge to amplify damage and explosion radius. |

**Playstyle:** Keep your distance. Pick off enemies with Magic Bolts and detonate Fireballs into tight groups.

---

### &#127873; Archer

> **Swift ranged striker.** High attack speed, crit-focused, with devastating arrow barrages.

| Stat | Value |
|------|-------|
| HP | 120 |
| Speed | 18 |
| Attack | 24 |

| Skill | Type | Description |
|-------|------|-------------|
| **Quick Shot** (S1) | Ranged | A fast arrow dealing 110% ATK damage with a 10% crit chance. |
| **Arrow Barrage** (S2) | Spread | Fires a barrage of arrows in a spread pattern. Each arrow deals 200% ATK damage with a 15% crit chance. Base 4 arrows, count scales significantly with your SPD stat. Charge to increase damage and AOE scale. |

**Playstyle:** Kite enemies and shred them with crit-heavy arrows. Your speed lets you reposition between volleys.

---

### &#9876; Magic Gladiator

> **High-damage duelist.** Dual swords with magical energy. The most aggressive class with massive crit potential and self-healing.

| Stat | Value |
|------|-------|
| HP | 190 |
| Speed | 6 |
| Attack | 26 |

| Skill | Type | Description |
|-------|------|-------------|
| **Psionic Slash** (S1) | Melee | A double wide arc slash dealing 110% ATK damage with a 12% crit chance. |
| **Evil Spirits** (S2) | Spirit Summon | Fires a staggered barrage of spirits that chase enemies. Each deals ~80% ATK damage with a 25% crit chance. **Heals you for 50% of your ATK on cast.** Spirit count and duration scale significantly with your SPD stat. |

**Playstyle:** Dive into the fray. Your S2 sustains you in combat — the more damage you deal, the harder you stay alive.

---

### Skill Charge System

All S2 skills feature a **charge mechanic**:
- **Hold** (right-click on desktop, long-press on mobile) to build charges up to `3 + resets`
- Each charge increases **damage by 25%** and **AOE size by 15%**
- Automatically releases at maximum charge
- Base cooldown: **5 seconds**, reduced by SPD stat upgrades

---

## Combat Mechanics

### Movement
- **Click/Tap ground** to walk to that location
- **Click/Tap an enemy** to lock onto and auto-attack (chase + auto-cast S1)
- Melee classes (Warrior, Magic Gladiator) cannot target enemies above the middle of the screen

### Damage Formula
```
damage = baseDamage * (crit ? 2.0 : 1.0) * (0.9 + random(0.2))
```
Attacks have a random variance of +/-10%. Critical hits deal exactly 2x damage and display a golden "DIAMOND" indicator.

### Damage Reduction
Your armor reduces incoming damage:
```
armor = floor(maxHP / 10)
armorReduction = armor * 0.5%
sizeReduction = 0% to 50% (scales with character visual size / level progress to cap)
damageReduction = min(90%, armorReduction + sizeReduction)
actualDamage = max(1, incoming * (1 - damageReduction))
```
Building HP increases your pool and passively reduces damage. Additionally, your character gains up to 50% extra damage reduction as they grow in size towards their level cap.

### Buffs
Dropped orbs provide temporary effects:
- **Red Orb** — HP Regen: 10% max HP/sec for 10 seconds
- **Blue Orb** — Cooldown Burn: S2 cooldown 5x faster for 10 seconds

---

## Waves & Enemies

Enemies spawn in waves of increasing difficulty. Kill all enemies to advance. Every 5th wave features a **BOSS**.

### Enemy Bestiary

| Enemy | HP | ATK | Speed | Unlocks |
|-------|----|-----|-------|---------|
| &#127754; Slime | 30 | 4 | 0.4 | Wave 1 |
| &#128136; Goblin | 45 | 7 | 0.7 | Wave 1 |
| &#10146; Skeleton | 55 | 9 | 0.5 | Wave 2 |
| &#128127; Orc | 80 | 13 | 0.35 | Wave 3 |
| &#9813; Ghost | 40 | 11 | 0.9 | Wave 4 |
| &#128293; Demon | 100 | 16 | 0.55 | Wave 5 |
| &#128080; Dragon | 150 | 20 | 0.3 | Wave 6 |
| &#128129; Lich | 120 | 18 | 0.45 | Wave 7 |

### Boss
- Crowned elite enemy with **250x scaled HP** and homing missile projectiles
- Spawns a missile every ~2.5 seconds targeting the nearest player
- Appears every 5th wave with scaling difficulty

### Enemy Scaling
Enemy HP and ATK scale with both wave number and average player level:
```
scale = 1 + (wave - 1) * 0.15 + (avgLevel - 1) * 0.12
```

---

## Progression

### Leveling
- Gain XP by killing enemies
- **Level up** by matching the scaling kill count requirement (configurable base and exponent)
- Each level grants **stat points** (default: 5) to spend on ATK, SPD, or HP

### Rebirth (Prestige)
When you reach the required level (base requirement + resets * scaling step, fully configurable), you can choose to **Rebirth**:
- Resets your level, kills, and stat allocations
- Grants **permanent bonus stat points** equal to `level * points_per_level` (default: 2)
- Increases your S2 charge limit by +1 per rebirth
- **Level Cap Protection:** If level limiting is enabled, character progression is capped at the rebirth level requirement until a rebirth is performed, with an explicit HUD warning display.

> Rebirth is the only way to increase your max S2 charge capacity beyond the base of 3. Plan your resets carefully.

---

## Inventory & Loot

As you defeat enemies, they have a chance to drop unique gear caches.
- **Loot Drops:** Defeated enemies leave behind items in the arena. Walk over them to collect.
- **Inventory Panel:** Accessible directly from the main menu or the in-game HUD (using the 🎒 icon).
- **Equipping Gear:** Select an item in your inventory to view its detailed stats (HP, ATK, SPD, CRIT bonuses) and equip it to your character.
- **Stats Scaling:** Items boost your base stats permanently as long as they are equipped. Unwanted items can be dropped back into the world for other players.
- **Mobile Friendly:** Fully optimized touch interactions and details panels for managing your inventory on mobile devices without relying on hover states.

---

## Multiplayer

- Connect to a shared arena with other players via **BSON WebSocket**
- One player is dynamically elected as **host** — they run the simulation and sync state to all clients
- Synchronized enemy positions, wave state, player HP, projectiles, and chat
- Remote players are interpolated for smooth movement

### Lobby
- See all connected players with their nickname, class, level, and reset count
- Chat with other players using floating speech bubbles

---

## Environments

The arena cycles through 6 dark-fantasy biomes on a global day cycle:

| Environment | Theme | Visuals |
|-------------|-------|---------|
| &#127799; Forest | Green sky, trees, grass | Lush but ominous woodland |
| &#127970; Castle | Gray sky, walls, stones | Medieval ruins |
| &#127757; Volcano | Red sky, mountains, lava cracks | Active volcanic terrain |
| &#127964; Beach | Blue sky, palm trees, shells | Serene coast with dark undertones |
| &#10052; Tundra | Cold blue sky, pines, ice | Frozen wasteland |
| &#127794; Swamp | Dark green sky, dead trees, mud | Decaying marshland |

Each environment features a **day/night cycle** — the sun and moon traverse the sky, and nightfall applies a dark overlay with desaturation to the world.

---

## Controls

### Desktop

| Input | Action |
|-------|--------|
| Left-click ground | Move |
| Left-click enemy | Lock on & auto-attack |
| Right-click / hold | Charge S2 skill |
| Move mouse | Aim direction |
| Enter | Open chat |
| Escape | Close chat |

### Mobile

| Input | Action |
|-------|--------|
| Tap ground | Move |
| Tap enemy | Lock on & auto-attack |
| Long-press (400ms) | Charge S2 |
| Release after long-press | Fire S2 |
| Swipe/drag while charging | Aim direction |

---

## Config Editor & Sandbox Mods

The game features an incredibly powerful **Config Editor** accessible from the main menu, allowing you to completely mod the game without touching code.

### 1. General Settings
- **Gameplay Dimensions & Depth:** Rescale canvas dimensions and playfield Y-sorting horizons.
- **Player & Class Dynamics:** Configure starting level, resets, melee/ranged attack ranges, and XP formulas.
- **Enemy & Boss Attributes:** Dynamic difficulty scaling, wave size increments, and elite boss variables.

### 2. Custom Data (Classes, Gear, Monsters)
- **Visuals & Assets:** Use Base64-encoded strings to seamlessly inject custom images for classes, gear, and enemies.
- **Custom Classes:** Add completely new character classes, defining their base stats (HP, ATK, SPD), skills, and visual icons.
- **Gear System:** Create new equippable items, set their drop rates, stat bonuses, and rarities.
- **Custom Monsters:** Define your own bestiary, adjusting enemy health, damage, speed, scale, and visual assets.

### 3. Presets & Multiplayer Sync
- **Export & Import JSON:** One-click export of your entire custom configuration (including assets) to a local JSON file. Import community presets (like Hardcore, Sandbox, or Fun modes).
- **Host Authoritative Sync:** When hosting a multiplayer lobby, your active preset is automatically broadcast to all clients. Joining players will see a "Loading host config" screen as the custom Base64 assets and balancing rules are synchronized over the network. 

### 4. Local Preferences Saving
- Class selections and game performance profiles are seamlessly backed up in your browser's local storage and restored on page refresh.

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES Modules), Canvas 2D
- **Networking:** BSON WebSocket for real-time multiplayer sync
- **Deployment:** GitHub Pages (static site, no build step)
- **Architecture:** Single-page game with modular file-based structure

```
index.html          → Entry point
app/main.js         → App bootstrap (wires Game / UI / Network)
app/game.js         → Core engine (render loop, physics, entities)
app/player.js       → Player state, movement, abilities, equipment
app/enemy.js        → Enemy AI and behavior
app/projectile.js   → Projectile system
app/ui.js           → HUD, menus, overlays
app/network.js      → BSON WebSocket multiplayer client
app/utils.js        → Helpers and constants
```

---

<div align="center">

### &#127919; Ready to fight?

[**Launch NIGHT VIBE ONLINE**](https://cojmar.github.io/night-vibe-online/)

</div>
