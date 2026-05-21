# AGENTS.md — N-RPG Arena Combat Sandbox

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
