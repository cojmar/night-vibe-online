# Runtime Bootstrap

## Overview

Startup is coordinated in `app/main.js`. The bootstrap path wires together `Network`, `UI`, and `Game`, waits for either WebSocket auth or a fallback condition, and only then hands control to the main game runtime.

## Bootstrap Flow

```mermaid
flowchart TD
  HTML[index.html loaded] --> Config[app/config.js evaluated]
  Config --> MainCtor[window.app constructor]
  MainCtor --> Ready{DOM ready?}
  Ready -->|loading| DOMEvent[DOMContentLoaded listener]
  Ready -->|already ready| Init[init()]
  DOMEvent --> Init
  Init --> Net[Network created]
  Init --> UI[UI created]
  Init --> Connect[connect WebSocket]
  Connect --> Auth[auth.info]
  Connect --> Timeout[auth timeout]
  Connect --> Drop[disconnect before boot]
  Auth --> BootOnline[bootGame online]
  Timeout --> BootOffline[bootGame offline]
  Drop --> BootOffline
```

## Why the DOM Ready Guard Matters

`app/config.js` uses top-level `await` to load the JSON gameplay config. That means module evaluation can finish after `DOMContentLoaded` has already fired. `app/main.js` therefore checks `document.readyState` and either runs `init()` immediately or attaches a one-shot `DOMContentLoaded` listener.

Without that check, the whole app can remain inert even though the page and modules loaded correctly.

## What `init()` Does

`init()` performs four jobs:

1. Creates the `Network` and `UI` instances.
2. Restores nickname and local identity data from `localStorage`.
3. Sets up loader/container DOM references and chat modal behavior.
4. Starts the WebSocket path and decides whether boot is online or offline.

The method also updates the lobby panel continuously by rendering `this.net.room.users` into HTML cards.

## Online vs. Offline Boot

`bootGame('online')` hides the loader, shows the main container, creates `Game`, binds `UI.game`, initializes the engine, and sends the local nickname to the room.

`bootOfflineFallback()` is the safety path. It creates a local user identity if one does not exist, seeds a minimal room object, disables further reconnect attempts for that boot path, updates the loader text, and then starts the game in offline mode.

## Connection Events

The startup sequence relies on these `Network` events:

- `connect`: send `auth` with the configured room name.
- `auth.info`: boot the game in online mode.
- `disconnect`: boot offline if the app has not started yet.
- auth timeout: boot offline if auth never arrives within 8 seconds.

## DOM Surfaces Touched During Bootstrap

These elements are part of the boot path, not just later gameplay:

- `loader`
- `container`
- `nick-input`
- `menu-player-list`
- `game-chat-modal`
- `game-chat-input`
- `game-chat-send`

If any of those change in `index.html`, startup is a likely regression surface.

## See also

- [Architecture Overview](overview.md)
- [Network & Room Sync](network-and-room-sync.md)
- [UI, HUD & Menu Flow](ui-hud-and-menu-flow.md)