/**
 * # Network Module — Night Vibe Online
 *
 * Thin WebSocket client that communicates with the Pinokio multiplayer server.
 *
 * ── How it works ──────────────────────────────────────────────────────────
 *
 * 1. The client sends a command via `send_cmd(cmd, data)`.
 *    Wire format: `{ cmd: "some_cmd", data: { ... } }`
 *
 * 2. The server receives the command, processes it, and may broadcast
 *    an event to the room. The event payload always follows the shape:
 *    `{ room: "room_id", user: "sender_user_id", data: <original data> }`
 *
 * 3. Other clients receive the broadcast via the WebSocket `onmessage`
 *    handler, which calls `emit_event(cmd, payload)`.
 *
 * 4. `emit_event` first calls `map_room(cmd, payload)` to update local copies
 *    of room metadata (`this.room`, `this.me`), then dispatches registered
 *    callbacks for `"cmd"` (wildcard) and for the specific `cmd` string.
 *
 * ── set_data: deep-merge protocol ─────────────────────────────────────────
 *
 * `send_cmd('set_data', partialState)` is the **primary state-sync mechanism**.
 *
 * The SERVER stores a per-user data blob and applies received data via DEEP MERGE:
 *
 *   serverStoredData = deepMerge(serverStoredData, partialState)
 *
 * **Deep merge rules** (implemented in `do_merge`):
 *   - Primitives (string, number, bool, null) → overwrite
 *   - Objects → recurse into each key; if key exists in target, merge; else assign
 *   - Arrays → treated as objects (merged by array index, NOT by element identity)
 *   - Missing keys → NOT deleted; the merge only ADDS/UPDATES keys present in source
 *
 * Because the merge is additive, the sender MUST NOT rely on sending a partial
 * object to implicitly delete keys. To delete, send the key with a null/empty value
 * (the server must handle this, which the current server does NOT — so deletions
 * are avoided).
 *
 * **Client receives the MERGED result** via `room.user_data` event.
 * The payload `data.data` contains the full merged user state.
 *
 * **Key consequence for hostData.enemies / hostData.items:**
 * Because arrays are merged by INDEX (not by element id), incremental enemy/item
 * updates must NOT use `do_merge` on the array directly. Instead:
 *   - The HOST sends an EMPTY `hostData.enemies` array when there are no changes
 *   - The HOST sends only dirty enemies when there ARE changes
 *   - The client's `syncHostData()` in `network-sync.js` handles ID-based merging
 *     (it does NOT rely on server-side deep merge for the enemies array)
 *
 * ── Custom game events ────────────────────────────────────────────────────
 *
 * For events that need custom routing (not state sync), use:
 *
 *   send_cmd('room.msg', { cmd: 'game.event', data: { type: 'my_type', ... } })
 *
 * Registered via:
 *   network.on('room.msg', (payload) => { ... })
 *     payload = { room: "...", user: "...", data: { cmd: 'game.event', data: { type, source, ... } } }
 *
 * Custom game event types:
 *
 *   'game.event' with data.type:
 *     'start_game'     → payload.data = { type:'start_game', source: userId }
 *     'player_death'   → payload.data = { type:'player_death', source: userId }
 *     'skill1'         → payload.data = { type:'skill1', classType, x, y, targetX, targetY, ... }
 *     'respawn'        → payload.data = { type:'respawn', source: userId }
 *
 * ── Events emitted by the network module ──────────────────────────────────
 *
 * `connect`       → { server: "ws://..." }
 * `disconnect`    → CloseEvent (native WebSocket event)
 * `room.info`     → room object { name, me, users, ... }
 * `my.info`       → user info object { user, token, ... }
 * `room.user_join` → { user: "id", data: { ... }, room: "name" }
 * `room.user_leave` → { user: "id", room: "name" }
 * `room.user_data` → { user: "id", room: "name", data: { ... } }
 *                   data = the merged user-state blob (contains set_data results)
 * `room.msg`      → { user: "id", room: "name", data: { cmd, data } }
 *                   data.data = custom payload (see Custom game events above)
 *
 * ── Wire format ───────────────────────────────────────────────────────────
 *
 * BSON (binary) if the BSON library is loaded, otherwise JSON.
 * Auto-detected: if `typeof BSON !== 'undefined'`, binaryType = 'arraybuffer'.
 */
export default class {
	constructor() {
		this.use_shared_objects = true;
		this.use_workers = false;
		this.socket = {
			on: () => { this.on(arguments) },
			send: (data) => { if (this.ws) this.ws.send(data) },
			send_cmd: () => { this.send_cmd(arguments) },
			close: () => { if (this.ws) this.ws.close() }
		}
		this.events = {};
		this.server = `ws://${this.getBaseUrl()}:3000`;
		this.connected = false;
		this.last_on_set = Math.floor(Date.now() / 1000);
		this.keep_alive();
	}
	/**
	 * Deep merge `data2` into `data1` (mutates `data1`).
	 *
	 * Rules:
	 * - Primitives → overwrite
	 * - Objects → recurse per-key
	 * - Arrays → treated as plain objects (merged by index)
	 * - Returns `true` if any change was made
	 *
	 * Used server-side to merge `set_data` deltas into stored user data.
	 * On the client, used to merge room metadata (`room.users[x].data`, `me.data`).
	 */
	do_merge(data1, data2) {
		var ret = false;
		if (typeof data1 !== 'object' || typeof data2 !== 'object') {
			data1 = data2;
			return true;
		}
		for (var n in data2) {
			if (!data1[n]) {
				data1[n] = data2[n];
				if (!ret) ret = true;
			} else {
				if (typeof data1[n] === 'object' && typeof data2[n] === 'object') {
					var ret2 = this.do_merge(data1[n], data2[n]);
					if (!ret) ret = ret2;
				} else {
					data1[n] = data2[n];
					if (!ret) ret = true;
				}
			}
		}
		return ret;
	}
	keep_alive() {
		if (this.keep_alive_interval) clearInterval(this.keep_alive_interval);
		this.keep_alive_interval = setInterval(() => {
			this.send('ping');
		}, 30000);
		return this;
	}
	getBaseUrl() {
		if (typeof run_mode !== 'undefined') {
			if (!run_mode.main) return false;
		}
		if (typeof window === 'undefined') return 'localhost';
		return window.location.href.split('://')[1].split('/')[0];
	}
	/**
	 * Map incoming server events to internal state.
	 * Called by `emit_event` before dispatching to registered callbacks.
	 *
	 * Handles:
	 * - room.info        → stores room object
	 * - my.info          → stores user identity
	 * - room.user_join   → adds user to room.users
	 * - room.user_leave  → removes user from room.users
	 * - room.user_data   → deep-merges data into room.users[user].data
	 * - room.data        → deep-merges data into room.data
	 */
	map_room(ev, data) {
		switch (ev) {
			case 'room.info':
				this.room = data
				break
			case 'my.info':
			case 'auth.info':
				this.me = data;
				break
			case 'room.user_join':
				if (data.user && this.room && data.room && this.room.room === data.room) {
					if (data.user === this.room.me) return false;
					this.room.users[data.user] = data.data;
				}
				break
			case 'room.user_leave':
				if (data.user && this.room && data.room && this.room.room === data.room) {
					if (this.room.users[data.user]) delete this.room.users[data.user];
				}
				break
			case 'room.user_data':
				if (data.user && this.room && this.room.users[data.user]) {
					if (!this.room.users[data.user].data) this.room.users[data.user].data = {};
					this.do_merge(this.room.users[data.user].data, data.data);
					if (data.user === this.room.me && this.me) {
						if (!this.me.data) this.me.data = {};
						this.do_merge(this.me.data, data.data);
					}
				}
				break
			case 'room.data':
				if (this.room && this.room.name === data.room) {
					this.do_merge(this.room.data, data.data);
				}
				break
		}
		return true;
	}
	strip_html(str) {
		return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/(<([^>]+)>)/gi, '');
	}
	/**
	 * Emit an event to all registered callbacks.
	 *
	 * 1. Sanitise (strip HTML from room.msg)
	 * 2. Update room state via map_room()
	 * 3. Dispatch to wildcard listeners registered with `on('cmd', cb)`
	 * 4. Dispatch to specific event listeners registered with `on(eventName, cb)`
	 */
	emit_event(ev, data) {
		if (!ev) return false;
		if (ev === 'room.msg' && data.msg) {
			data.msg = this.strip_html(data.msg);
			if (data.msg.trim() === '') return false
		}
		if (!this.map_room(ev, data)) return false;
		if (typeof this.events['cmd'] === 'object') this.events['cmd'].forEach(cb => {
			cb({ cmd: ev, data: data });
		});
		if (typeof this.events[ev] === 'object') this.events[ev].forEach(cb => {
			cb(data);
		});

	}
	connect() {
		let server = arguments[0] || false;
		if (server) this.server = server;
		if (this.socket.close) this.socket.close(4666);
		if (this.connect_timeout) clearTimeout(this.connect_timeout);
		let last_on = Math.floor(Date.now() / 1000) - this.last_on_set;
		if (last_on < 2) {
			this.connect_timeout = setTimeout(() => {
				this.connect();
			});
			return this;
		}
		this.connect_socket();
		return this;
	}
	disconnect() {
		if (this.connected) this.socket.close(4666);
		return this;
	}
	/**
	 * Register a callback for a network event.
	 *
	 * @param {string}   cmd       - Event name. Also accepts "cmd" as wildcard.
	 * @param {function} call_back - Callback receives event_data.
	 *
	 * **Wildcard listener** (`on('cmd', cb)`) — receives every event:
	 *   cb({ cmd: "event_name", data: event_payload })
	 *
	 * **Specific listener** (`on('event_name', cb)`) — receives only that event:
	 *   cb(event_payload)
	 *
	 * For room.user_data the payload shape is:
	 *   {
	 *     room: "the channel",
	 *     user: "user id of the sender",
	 *     data: { x, y, hp, hostData, ... }   // the merged user-state blob
	 *   }
	 *
	 * For room.msg the payload shape is:
	 *   {
	 *     room: "the channel",
	 *     user: "user id of the sender",
	 *     data: { cmd: "game.event", data: { type, source, ... } }
	 *   }
	 */
	on(cmd, call_back) {
		this.last_on_set = Math.floor(Date.now() / 1000);
		if (!cmd) return this;
		if (typeof call_back !== 'function') return this;
		if (!this.events[cmd]) {
			this.events[cmd] = [];
		}
		this.events[cmd].push(call_back);
		return this;
	}
	connect_socket(no_ws = false) {
		this.ws = new WebSocket(this.server);
		if (typeof BSON !== 'undefined') this.ws.binaryType = "arraybuffer"
		this.ws.onopen = () => {
			this.connected = true;
			this.emit_event('connect', { server: this.server });
		};
		this.ws.onclose = (close_event) => {
			this.connected = false;
			if (close_event.code !== 4666) {
				if (this.connect_timeout) clearTimeout(this.connect_timeout);
				this.connect_timeout = setTimeout(() => {
					this.connect();
				}, 10000);
			}
			this.emit_event('disconnect', close_event);
		};
		this.ws.onmessage = (message) => {
			let data;

			try {
				data = (this.ws.binaryType && this.ws.binaryType === 'arraybuffer') ? BSON.deserialize(message.data) : JSON.parse(message.data);
			} catch (error) {
				data = message.data
			}
			this.emit_event(data.cmd, data.data)
		};
		return this;
	}
	send(data) {
		if (data.cmd === 'connect') return this.connect(data.data);
		if (data.cmd === 'disconnect') return this.disconnect();
		if (!this.connected) return this;
		this.socket.send((this.ws.binaryType && this.ws.binaryType === 'arraybuffer') ? BSON.serialize(data) : JSON.stringify(data));
		return this;
	}
	/**
	 * Send a command to the server.
	 *
	 * Wire format: { cmd: <cmd>, data: <data> }
	 *
	 * For state sync, use `send_cmd('set_data', partialState)`.
	 * The server deep-merges `partialState` into the sender's user-data blob,
	 * then broadcasts the MERGED blob to other room members via `room.user_data`.
	 *
	 * Because `do_merge` treats arrays as plain objects (merged by index),
	 * **array fields like `hostData.enemies` are NOT safely mergeable by the server**.
	 * The client (`network-sync.js`) handles enemy-array updates manually via
	 * `syncHostData()`, which merges by enemy ID.
	 *
	 * @param {string} cmd  - Command name (e.g. "set_data", "room.msg")
	 * @param {*}      data - Payload (object, string, etc.)
	 */
	send_cmd(cmd, data) {
		return this.send({
			cmd: cmd,
			data: data
		});
	}
}
