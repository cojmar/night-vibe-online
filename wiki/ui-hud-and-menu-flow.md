# UI, HUD & Menu Flow

## Overview

The project splits presentation into two layers:

- `index.html` hosts the DOM structure and CSS.
- `app/ui.js` binds behavior to that structure and updates it during play.

`UI` is not a passive view helper. It is the main controller for menus, modals, logs, HUD updates, class selection, settings, config editing, rebirth prompts, and inventory rendering.

## Main UI Regions

| Region | Purpose |
|---|---|
| `menu-panel` | Main menu shell, class selector, lobby list, menu chat |
| `main-area` | Gameplay container around the canvas |
| `hud` | Player bars, score, buffs, cooldown indicators |
| `compact-log` | Small recent-events log during play |
| `settings-modal` | Graphics/performance controls |
| `config-editor-modal` | Dynamic balance editor |
| `inventory-modal` | Inventory grid and equipment slots |
| `rebirth-modal` | Confirmation flow for prestige reset |
| `death-overlay` | Post-death actions |

## What `UI` Owns

`app/ui.js` binds and updates:

- class carousel and selected class persistence
- stat upgrade buttons and multiplier buttons
- fullscreen toggle
- quit and respawn flows
- rebirth confirmation dialog
- compact log hover/touch behavior
- buffs panel
- settings sliders and auto-graphics toggles
- dynamic config editor generation
- inventory and equipment modal actions

The gameplay rules still live in `Game`; `UI` mostly turns DOM events into method calls on the game instance and reflects state back into the page.

## Menu to Match Transition

The visual transition between menu and match is managed across both `UI` and `Game`.

- `Game.startGame()` hides the menu panel and reveals gameplay surfaces.
- `Game.quitToMenu()` tears those gameplay surfaces back down.
- `UI.updateHUD()` and related helpers keep the in-game DOM synchronized once the session is live.

That means regressions in the menu-to-play flow often touch both files.

## Inventory and Config Editor

Two of the bigger UI systems deserve special mention:

- The config editor is data-driven from `CONFIG_METADATA`, not hand-authored control markup.
- The inventory modal reads/writes both the active player object and `localStorage`, making it part UI and part persistence workflow.

Both systems are implemented in `app/ui.js`, which is why that file has become one of the largest presentation surfaces in the repo.

## See also

- [Config & Balance Editor](config-and-balance-editor.md)
- [Player Progression & Inventory](player-progression-and-inventory.md)
- [Mobile Layout & Input](mobile-layout-and-input.md)