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
- **No build commands.** This is a static site. Edit files → commit → push → GitHub Pages rebuilds.
- **Test locally:** serve the repo root over HTTP (recommended) or open `index.html` directly.

## Analysis workflow
- Use `code-review-graph` first for code-impact tasks.
- Use `graphify` for architecture/cross-doc reasoning.
- Use `ast-grep` for fast pattern checks and codemods.

### Daily review order
1. `code-review-graph get_minimal_context`
2. `code-review-graph detect_changes`
3. `code-review-graph get_impact_radius`
4. `code-review-graph get_affected_flows`
5. `npx eslint app`
6. `ast-grep scan --config .ast-grep.yml`

### Graphify usage
- Read `graphify-out/GRAPH_REPORT.md` first when it exists.
- After code-only edits, refresh with `graphify update .`.
- After docs/architecture edits, run full graphify refresh workflow before trusting doc-related answers.

### ast-grep scope
- **Primary use: structural search before edits.** Before touching code, use
  `ast-grep run --pattern '...'` to find every site matching a pattern — e.g.
  all callers of a method, all accesses to a property, all `new ClassName(...)`.
  This is faster and more precise than grep for code patterns.
- **Secondary use: lint rules.** `ast-grep scan --config .ast-grep.yml` enforces
  project-specific anti-patterns (see `ast-grep/rules/`).
- Keep rules focused on gameplay/client source under `app/`.
- Prefer warning-level checks first; promote to stricter enforcement after cleanup.

#### Quick search examples
```bash
# Find all direct net.me.info.user accesses (no null guard)
ast-grep run -p 'this.net.me.info.user' app/

# Find all send_cmd calls
ast-grep run -p '$NET.send_cmd($CMD, $DATA)' app/

# Find all new Class(...) instantiations
ast-grep run -p 'new Player($$$)' app/
```

## Deployment
- GitHub Pages, `main` branch, root path (`/`). Live at: https://cojmar.github.io/night-vibe-online/
- Push to `main` triggers a rebuild.

## Notable constraints
- No `package.json`, `node_modules`, or any build step.
- Multiplayer runs over BSON WebSockets via `app/network.js`; the client connects to a separate backend server.
- Mobile-first layout with touch controls (`touch-action: none`, viewport constraints in `<head>`).
