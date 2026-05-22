# Network & Room Sync

## Overview

`app/network.js` is a small evented client for the BSON WebSocket room server. It is intentionally lightweight: it keeps a mutable local view of `room` and `me`, exposes an `.on()` event API, reconnects on unexpected close, and leaves most game semantics to `app/main.js` and `app/game.js`.

## Connection Model

The client wraps the browser `WebSocket` object and exposes four important behaviors:

- `connect(server)` opens or reopens the socket.
- `disconnect()` closes it intentionally with code `4666`.
- `send_cmd(cmd, data)` sends protocol messages.
- `keep_alive()` sends `ping` every 30 seconds while connected.

Unexpected closes schedule a reconnect after 10 seconds. Intentional closes do not.

## Event Mapping

Incoming messages are normalized through `emit_event()` and `map_room()`.

| Event | Local effect |
|---|---|
| `room.info` | Replaces `this.room` |
| `my.info` / `auth.info` | Replaces `this.me` |
| `room.user_join` | Adds a user into `room.users` |
| `room.user_leave` | Removes a user from `room.users` |
| `room.user_data` | Deep-merges user data into `room.users[user].data` |
| `room.data` | Deep-merges shared room data |
| `room.msg` | Sanitizes message HTML before exposing it |

`do_merge()` is the merge primitive for room data. It now skips `__proto__`, `constructor`, `prototype`, and non-own keys to avoid prototype-pollution style payloads.

## What the Game Uses the Network For

`app/main.js` uses the network layer for auth, nickname syncing, lobby presence, and fallback detection.

`app/game.js` uses it for:

- host election and host flags
- remote player state updates
- wave and environment sync via host data
- gameplay config sync from host to peers
- combat side effects such as enemy kill notifications
- session state changes like `inGame`, `MENU`, and `gameOver`

The network layer itself is intentionally generic. The game-specific meaning of the payloads lives above it.

## Shared Objects and Trust Model

The current client treats room state as mutable shared objects. `room.users[user].data` is the main working surface for synchronization, and most gameplay UI reads are built directly on top of that local merged state.

That makes the system very flexible, but it also means this is not a hard-authoritative simulation server in the traditional MMO sense. The host/client runtime is still the main owner of gameplay decisions.

## Safety Notes

- Lobby nicknames are escaped before being rendered in `app/main.js`.
- `room.msg` is HTML-stripped in `network.js` before being emitted.
- Reconnect behavior is automatic, so startup bugs often come from the boundary between socket events and app boot state rather than from raw socket setup.

## See also

- [Runtime Bootstrap](runtime-bootstrap.md)
- [Game Loop & Host Model](game-loop-and-host-model.md)
- [FAQ](FAQ.md)