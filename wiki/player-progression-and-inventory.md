# Player Progression & Inventory

## Overview

`app/player.js`, `app/game.js`, and `app/ui.js` together implement the player progression model. The local player carries class stats, session progression, rebirth progression, buffs, inventory, and equipment; remote players are mostly snapshot-driven and interpolated toward network targets.

## Player Model

`Player` stores both raw values and derived values. `atk`, `spd`, and `maxHp` are exposed through getters so equipped gear can add bonuses dynamically without rewriting every downstream calculation.

The same object also holds:

- session state such as `level`, `kills`, and `reqKills`
- persistent-like state such as `resets` and bonus stat points
- movement targets for remote interpolation
- chat bubble state
- buff timers
- inventory and equipment payloads

## Leveling and Rebirth

Level progression is config-driven. The required kills curve uses `REQ_KILLS_BASE_MULT`, `REQ_KILLS_EXPONENT`, and `REQ_KILLS_SIN_AMP` from `app/config.js`.

Rebirth is the persistent reset loop:

- the required rebirth level is derived from `REBIRTH_BASE_LEVEL + resets * REBIRTH_LEVEL_STEP`
- rebirth grants `level * REBIRTH_POINTS_PER_LEVEL` bonus points
- those points and reset count are written into `localStorage`
- the active run is then reset back to a fresh character state

If `LIMIT_LEVEL_TO_REBIRTH_REQ` is enabled, leveling is capped at the current rebirth threshold until the rebirth is performed.

## Persistence Model

The code currently uses browser-local persistence for most player progression.

| Key | Purpose |
|---|---|
| `nightvibe-resets` | Persistent reset count |
| `nightvibe-statpoints` | Persistent bonus stat points |
| `nightvibe-inventory` | Serialized local inventory |
| `nightvibe-equipment` | Serialized local equipment |

`restoreWebsocketStats()` merges local browser state with room data when starting a run. The browser remains the important fallback source, especially for inventory/equipment.

## Inventory and Equipment

The inventory UI is rendered in `UI.renderInventory()`. Equipment slots are not hardcoded in the UI; they are driven by the configurable `EQUIPMENT_SLOTS` value from `app/config.js`.

Equipment currently behaves as a local-player feature first:

- items are stored locally
- equipment bonuses are applied through `Player` getters
- UI actions update local persistence immediately
- the game can still broadcast resulting player state to peers for the current session

This makes the system easy to inspect and debug, but it also means it is not a strict server-owned economy or inventory backend.

## Remote Players

Remote players do not run the same local input path. Instead, `Player.updateFromNetwork()` applies incoming snapshots and lerps toward target positions. That separation is important when debugging desyncs: local movement bugs and remote interpolation bugs usually live in different code paths.

## See also

- [Game Loop & Host Model](game-loop-and-host-model.md)
- [Config & Balance Editor](config-and-balance-editor.md)
- [FAQ](FAQ.md)