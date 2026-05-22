# Frequently Asked Questions

Common questions about how this repo works in practice. For deeper context, see the [Architecture Overview](overview.md), [Network & Room Sync](network-and-room-sync.md), and [Game Loop & Host Model](game-loop-and-host-model.md).

---

## Runtime & Hosting

**Q: Does this project have a build step?**

**A:** No. This is a static browser app. You serve the repo root and load `index.html`; there is no bundler, transpiler, or package-driven build pipeline in the gameplay client itself.

---

**Q: Do I need the WebSocket server to open the game locally?**

**A:** No. The app can start without a working multiplayer connection. `app/main.js` includes an auth timeout and disconnect fallback that boots the game into local mode instead of leaving the loader up forever.

---

**Q: Why does localhost use a different WebSocket URL than the live site?**

**A:** `app/main.js` switches endpoints based on hostname. Local browser sessions use `ws://localhost:3001/ws/`; non-local hosts use `wss://ws.emupedia.net/ws/`.

---

## Authority & Synchronization

**Q: Is there a fully authoritative game server here?**

**A:** Not in the MMO-server sense. The current implementation is client-heavy: gameplay state is simulated in the browser, and players synchronize through room events and host-selected shared state. The host is the main coordinator for wave and session state.

---

**Q: Who decides the active gameplay config during a match?**

**A:** The host does. When a session starts, the host can broadcast a `gameplayConfig`, and other clients inherit it for that active run. Outside a run, each browser still keeps its own local custom config.

---

**Q: What happens when the host leaves or stops being active?**

**A:** `Game.checkHost()` recalculates host ownership from the currently active players. The check is based on play state and recent data freshness, not just room membership.

---

## Persistence

**Q: Where is progression saved?**

**A:** Mostly in `localStorage`. Resets, bonus stat points, inventory, equipment, nickname, selected class, graphics settings, and custom config all have browser-local persistence paths.

---

**Q: Is inventory server-persistent?**

**A:** No. The current inventory/equipment path is local-browser persistence first. Some of that state is broadcast to other players for the current session view, but the durable source is the local browser storage.

---

## Frontend & Mobile

**Q: Where do most mobile layout bugs come from?**

**A:** Usually `index.html` and the `Game.updateLayout()` path, not the enemy or combat logic. The app mixes canvas scaling, HUD overlays, modals, and responsive flex layout in a single page shell, so small CSS changes can shift gameplay presentation quickly.

---

**Q: Where should I change balance values?**

**A:** Start with `app/config.js` and `app/nightvibe-gameplay-config.json`. If the change also needs editor support, confirm the setting is represented in `CONFIG_METADATA` so the UI can expose it.

---

## See also

- [Glossary](glossary.md)
- [Config & Balance Editor](config-and-balance-editor.md)
- [Mobile Layout & Input](mobile-layout-and-input.md)