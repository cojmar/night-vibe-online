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
| HP | 120 |
| Speed | 8 |
| Attack | 22 |

| Skill | Type | Description |
|-------|------|-------------|
| **Bash** (S1) | Melee | A wide arc slash with knockback. Deals 100% ATK damage. Left-click an enemy to use. |
| **Sword Slash** (S2) | AoE Projectile | Fires a traveling shockwave dealing 250% ATK damage with knockback. Charge by right-click/long-press to increase damage (+25% per charge) and AOE size (+15% per charge). |

**Playstyle:** Hold the line. Use knockback to control enemy positioning and let your shockwaves clear groups.

---

### &#128126; Mage

> **Ranged spellcaster.** Burst AoE damage from a distance with explosive fireballs.

| Stat | Value |
|------|-------|
| HP | 80 |
| Speed | 14 |
| Attack | 18 |

| Skill | Type | Description |
|-------|------|-------------|
| **Magic Bolt** (S1) | Ranged | A fast single-target bolt dealing 90% ATK damage. |
| **Fireball** (S2) | AoE | An exploding fireball dealing 220% ATK damage in an area burst. Leaves a lingering fire trail. Charge to amplify damage and explosion radius. |

**Playstyle:** Keep your distance. Pick off enemies with Magic Bolts and detonate Fireballs into tight groups.

---

### &#127873; Archer

> **Swift ranged striker.** High attack speed, crit-focused, with devastating arrow barrages.

| Stat | Value |
|------|-------|
| HP | 70 |
| Speed | 18 |
| Attack | 24 |

| Skill | Type | Description |
|-------|------|-------------|
| **Quick Shot** (S1) | Ranged | A fast arrow dealing 95% ATK damage with a 15% crit chance (2x damage). |
| **Arrow Barrage** (S2) | Spread | Fires 3+ arrows in a spread pattern. Each deals 130% ATK damage with 15% crit chance. Arrow count scales with your SPD stat. Charge to increase spread and damage. |

**Playstyle:** Kite enemies and shred them with crit-heavy arrows. Your speed lets you reposition between volleys.

---

### &#9876; Magic Gladiator

> **High-damage duelist.** Dual swords with magical energy. The most aggressive class with massive crit potential and self-healing.

| Stat | Value |
|------|-------|
| HP | 140 |
| Speed | 6 |
| Attack | 26 |

| Skill | Type | Description |
|-------|------|-------------|
| **Psionic Slash** (S1) | Melee | A double wide arc slash dealing 110% ATK damage with 12% crit chance. |
| **Cross Slash** (S2) | AoE Explosion | A massive area explosion dealing 300% ATK damage with 25% crit chance. **Heals you for 50% of damage dealt.** Charge to increase the explosion radius and heal amount. |

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
damageReduction = min(90%, armor * 0.5%)
actualDamage = max(1, incoming * (1 - damageReduction))
```
Building HP not only increases your pool — it passively reduces all incoming damage.

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
| &#127754; Slime | 30 | 5 | 0.4 | Wave 1 |
| &#128136; Goblin | 45 | 8 | 0.7 | Wave 1 |
| &#10146; Skeleton | 55 | 10 | 0.5 | Wave 2 |
| &#128127; Orc | 80 | 14 | 0.35 | Wave 3 |
| &#9813; Ghost | 40 | 12 | 0.9 | Wave 4 |
| &#128293; Demon | 100 | 18 | 0.55 | Wave 5 |
| &#128080; Dragon | 150 | 22 | 0.3 | Wave 6 |
| &#128129; Lich | 120 | 20 | 0.45 | Wave 7 |

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

## Settings & Dynamic Balance Editor

The configuration suite is fully accessible directly from the **Main Menu Lobby** (via the premium "Settings & Balance Editor" panel) and **In-Game Overlay**:

### 1. Performance & Graphics Optimization
An **auto-graphics system** monitors FPS in real-time and dynamically scales visual effects to maintain smooth performance:
- **Particles Multiplier** — Death explosions, hit sparks, trails, buff auras
- **Background Elements** — Sky decorations (trees, walls, mountains, etc.)
- **Ground Elements** — Grass, stones, shells, mud, and foliage
- **Atmospheric Effects** — Rain, clouds, fog, and smoke

The system reduces effects when FPS drops below 40 and restores them when above 55.

### 2. Live Sandbox Balance Editor
A completely dynamic engine configuration editor built directly from the system's parameter metadata. It allows players to edit over 30 variables:
- **Gameplay Dimensions & Depth:** Rescale canvas dimensions and playfield Y-sorting horizons in real-time.
- **Player & Class Dynamics:** Configure starting level, resets, melee/ranged attack ranges, base move speeds, and XP level up formulas.
- **Enemy & Boss Attributes:** Dynamic difficulty scaling, wave size increments, spawn intervals, and elite boss variables.
- **Zero-Delay Saving:** Removing any old "Save & Apply" delays, all adjustments (checkbox ticks, slider drags, text inputs, color pickers) apply **automatically and instantly** to active gameplay elements and broadcast over the network to all clients in real-time.
- **Export & Import JSON:** One-click options to export the entire custom gameplay balance configuration to a local JSON file or import a shared gameplay mode file.

### 3. Local Preferences Saving
- Class selections (Warrior, Mage, Archer, Magic Gladiator) are automatically persisted in local browser storage and fully restored on page refresh.
- Custom game performance and graphics profiles are seamlessly backed up.

### 4. Unified Premium Modal Dialogs
- Replaced traditional native browser alerts with a high-end, unified Yes/No confirmation dialog panel, matching the cyber-fantasy UI theme for rebirth and default-settings restores.

---

## Tech Stack

- **Frontend:** Vanilla JavaScript (ES Modules), Canvas 2D
- **Networking:** BSON WebSocket for real-time multiplayer sync
- **Deployment:** GitHub Pages (static site, no build step)
- **Architecture:** Single-page game with modular file-based structure

---

## To run locally for multiplayer testing:

### Terminal 1 — WS server

```bash
cd E:\dev\spacerust\cojmar\ws-server
npm start
```

### Terminal 2 — static site

```bash
cd E:\dev\spacerust\cojmar\night-vibe-online
npx serve . -l tcp://0.0.0.0:3000
```

## Static Analysis

This repo includes a lightweight ESLint flat config for the gameplay source in `app/`.

- Lint once (no install step required if you use `npx`):

```bash
npx eslint app
```

- Optional auto-fix for safe issues:

```bash
npx eslint app --fix
```

Notes:
- The config is in `eslint.config.mjs`.
- Static assets in `assets/` and generated graph output in `graphify-out/` are excluded.

### Recommended Review Workflow

Run these in order during local review:

```bash
# 1) Code-impact context (code-review-graph)
# (Use your MCP client tools: get_minimal_context -> detect_changes -> get_impact_radius -> get_affected_flows)

# 2) Linting
npx eslint app

# 3) Structural search before edits (find all call sites, usages, patterns)
ast-grep run -p '$PATTERN' app/

# 4) Anti-pattern lint rules
ast-grep scan --config .ast-grep.yml

# 4) Architecture/docs checks (optional when relevant)
graphify update .
```

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
