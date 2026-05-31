# AGENTS.md — Night Vibe Online Arena Combat Sandbox

## Repo structure
- **Single-page vanilla JS game** — no build tools, no package manager, no test framework.
- `index.html` — only entry point. All game logic is loaded via `<script type="module">` from `app/`.
- `app/` — game source modules:
  - `main.js` — app bootstrap, wires Game / UI / Network together.
  - `game.js` — core game engine (render loop, physics, collision, entity management).
  - `player.js` — player state, movement, abilities, equipment.
  - `enemy.js` — enemy AI and behavior.
  - `projectile.js` — projectile system.
  - `ui.js` — HUD, menus, canvas overlays.
  - `network.js` — BSON WebSocket multiplayer client.
  - `utils.js` — helpers.
- `assets/` — static resources (images, fonts, etc.).

## Commands
- **No commands.** This is a static site. Edit files → commit → push → GitHub Pages rebuilds.
- **Test locally:** open `index.html` in a browser.

## Deployment
- GitHub Pages, `main` branch, root path (`/`). Live at: https://cojmar.github.io/night-vibe-online/
- Push to `main` triggers a rebuild.

## Notable constraints
- No `package.json`, `node_modules`, or any build step.
- Multiplayer runs over BSON WebSockets via `app/network.js`; the client connects to a separate backend server.
- Mobile-first layout with touch controls (`touch-action: none`, viewport constraints in `<head>`).

## Anchored Summary
### Goal
- Full game sync between host and clients, clock sync, gameW broadcast, movement refactor (custom events), Bash stun + knockback + cooldown, boss laser overlay.

### Key Changes & Decisions
- **Boss state on stun**: both CHANNELING_LASER and FIRING_LASER reset to IDLE when stunned (`enemy.js:158-160`).
- **Laser rendering split**: beam + orb + laser beam moved to `drawLaserOverlay()` called from `game.js` after all entities (projectiles, items, etc.), ensuring laser renders above everything (crown, player, etc.).
- **Reticle (crosshair)**: stays in normal depth-sorted `draw()` — under entities with higher Y.
- **drawLaserOverlay**: separate method in `Enemy` class, uses `Date.now()` for animations, draws targeting beam + crown orb (CHANNELING) and laser beam (FIRING).
- **Stun**: 50% ATK damage, duration `Math.floor(ATK/300 * 60 * 1.15)`s, post-stun cooldown 75% of duration, knockback pure horizontal 8px, full freeze (no ground Y mod), all enemies except MISSILE/BOMB.

### Relevant Files
- `app/enemy.js`: stun freeze block (boss state reset), drawLaserOverlay method, reticle-only draw
- `app/game.js`: drawLaserOverlay call after projectile loop
- `app/combat-manager.js`: spawnProjectile with local projectile + dedup
- `app/projectile.js`: stun/knockback logic
