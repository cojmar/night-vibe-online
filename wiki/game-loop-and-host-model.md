# Game Loop & Host Model

## Overview

`app/game.js` is the runtime heart of the project. It owns the current session state, player objects, enemies, projectiles, particles, item drops, host election, rendering layout, and match lifecycle.

## Match Start

`startGame(selectedClass)` does more than spawn the local player. It also:

- switches the state to `PLAYING`
- resets wave/session counters
- chooses boss-wave or normal-wave setup
- restores local progression and inventory
- checks for an existing host in the room
- optionally inherits host gameplay config and host session state
- shows the gameplay UI and canvas
- broadcasts the local player state to the room

## Host Responsibilities

The host is the main coordinator for match-wide state.

| Responsibility | Notes |
|---|---|
| Wave progression | Host decides wave counts, spawn counts, and transitions |
| Boss state | Host determines when boss waves are active and resolved |
| Shared gameplay config | Host can publish the active balance config for the run |
| Shared match snapshot | Host data is used by peers to inherit wave/env/session state |

`checkHost()` recalculates host ownership from active players only, not just everyone in the room. Local `MENU` / `GAME_OVER` users and stale remote players do not remain valid host candidates.

## Per-Client Responsibilities

Every client still owns significant local behavior:

- rendering the world and HUD
- simulating local player intent
- tracking local inventory and equipment
- applying remote player snapshots
- syncing to host data when not the host

This is a host-coordinated client runtime, not a thin client.

## Session Lifecycle

The main session transitions are:

1. `MENU` -> `PLAYING` through `startGame()`
2. `PLAYING` -> rebirth confirmation -> `performRebirth()`
3. `PLAYING` -> `MENU` through `quitToMenu()`
4. death overlay -> `respawnPlayer()` or `quitToMenu()`

`quitToMenu()` hides gameplay UI, clears volatile entities, resets in-session progression data, restores the user's personal config from `localStorage`, and updates the network room state so other clients see the player back in menu.

## Progression During a Match

`Game` does not store progression in one place only. It coordinates:

- `Player` level, kills, resets, and stat points
- config-driven leveling formulas
- wave progression and enemy scaling
- temporary buffs and cooldown state
- save/restore of browser-local progression and inventory

That makes `app/game.js` the file where feature boundaries blur most quickly. It is both the match coordinator and the place where new systems tend to get integrated first.

## Risk Surfaces

If a change affects any of these, review `app/game.js` first:

- starting or ending a run
- host selection or host migration
- mobile/canvas layout during gameplay
- rebirth and persistent stat handling
- item persistence or equipment application
- multiplayer sync of hostData or gameplay config

## See also

- [Player Progression & Inventory](player-progression-and-inventory.md)
- [Config & Balance Editor](config-and-balance-editor.md)
- [UI, HUD & Menu Flow](ui-hud-and-menu-flow.md)