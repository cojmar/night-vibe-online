# Config & Balance Editor

## Overview

The balance system is centered on `app/config.js`. It exposes gameplay values as live exports and drives the in-game editor through metadata rather than hardcoded form markup.

## Sources of Truth

Config is layered in this order:

1. `FALLBACK_DEFAULTS` in `app/config.js`
2. `app/nightvibe-gameplay-config.json`
3. browser-local custom overrides from `nightvibe-custom-config`

The merged result becomes the active config surface used by the rest of the runtime.

## Metadata-Driven Editor

`CONFIG_METADATA` describes how each setting should be rendered.

| Metadata field | Role |
|---|---|
| `label` | Human-readable name in the editor |
| `type` | Control type such as number, boolean, string, or color |
| `min` / `max` / `step` | Numeric constraints |
| `category` | Section grouping inside the modal |

`app/ui.js` groups metadata by category and generates the modal fields at runtime. That means adding a config value usually requires both the exported value and a matching metadata entry.

## Main Categories Exposed Today

- Player Movement
- Combat & Ranges
- Player Progression
- Potions & Elixirs
- Viewport & Display
- Enemy Dynamics
- Boss Battles
- Projectiles & Hitboxes
- Social & Chat
- Inventory & Gear
- Gear Drops & Stats

## Session Rules

The editor is not just a personal settings panel. It also participates in multiplayer session state.

- Outside an active run, a player can edit and persist their local config.
- At match start, a host can publish `gameplayConfig` to the room.
- Other clients inherit that host config for the active session.
- During active play, the editor is treated as a read-heavy view of the current run config rather than a free-for-all authoring surface.

## Import / Export / Reset

The UI supports:

- export current config as JSON
- import a JSON config file
- reset back to defaults

Those flows are implemented in `app/ui.js` on top of the config module's live update path.

## Important Implementation Detail

`app/config.js` uses top-level `await` to fetch the JSON defaults. That is a useful cleanup over synchronous XHR, but it also means module load is asynchronous. Startup code must be resilient to delayed evaluation, which is why `app/main.js` has an explicit DOM-ready guard.

## See also

- [Runtime Bootstrap](runtime-bootstrap.md)
- [Game Loop & Host Model](game-loop-and-host-model.md)
- [UI, HUD & Menu Flow](ui-hud-and-menu-flow.md)