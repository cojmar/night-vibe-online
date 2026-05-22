# Glossary

Quick definitions for project-specific terms used across this wiki.

---

| Term | Definition |
|---|---|
| **Host** | The currently active player responsible for coordinating match-wide state such as wave progression and shared gameplay config. See [Game Loop & Host Model](game-loop-and-host-model.md). |
| **Room** | The multiplayer container exposed by the WebSocket protocol. It carries `room.info`, user membership, shared room data, and per-user data. See [Network & Room Sync](network-and-room-sync.md). |
| **`room.user_data`** | The main synchronization event used to merge remote player state, host state, and gameplay config into other clients. See [Network & Room Sync](network-and-room-sync.md). |
| **Local fallback** | Startup mode used when auth never arrives or the socket disconnects before boot completes. The app creates a local identity and starts the game offline. See [Runtime Bootstrap](runtime-bootstrap.md). |
| **Gameplay config** | The live set of tunable values exported from `app/config.js`, merged from defaults, JSON config, and local custom overrides. See [Config & Balance Editor](config-and-balance-editor.md). |
| **`CONFIG_METADATA`** | The metadata map that describes how each config field should be rendered in the balance editor. See [Config & Balance Editor](config-and-balance-editor.md). |
| **Rebirth** | The prestige/reset mechanic. It resets session-level character progression while increasing persistent bonus stats and reset count. See [Player Progression & Inventory](player-progression-and-inventory.md). |
| **Bonus stat points** | Persistent stat points carried across runs through rebirth and local persistence. |
| **Session stat points** | Allocatable points used during the current session. These are reset when a run ends or is rebuilt from persistent state. |
| **Inventory** | Client-side item storage for the local player. It is persisted in the browser and manipulated through the inventory modal. See [Player Progression & Inventory](player-progression-and-inventory.md). |
| **Equipment slots** | Named gear slots defined by config, for example `Weapon`, `Armor`, and rings. The slot list is itself configurable. See [Config & Balance Editor](config-and-balance-editor.md). |
| **Compact log** | The small in-game event log widget managed by `UI`, separate from the menu chat and chat bubble system. See [UI, HUD & Menu Flow](ui-hud-and-menu-flow.md). |
| **Menu state** | The out-of-match browser state where the menu panel, class selector, lobby list, and editor controls are visible. |
| **Play state** | The in-match state where the canvas, HUD, cooldown ring, and gameplay controls are active. |