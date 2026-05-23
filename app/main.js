import Network from './network.js';
import Game from './game.js';
import UI from './ui.js';
import { initPwa } from './pwa.js';
import { CHAT_MESSAGE_DURATION, NETWORK_ROOM_NAME } from './utils.js';

window.app = new class {
    constructor() {
        // Top-level await in module dependencies can delay evaluation until
        // after DOMContentLoaded has already fired.
        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', () => {
                this.init();
            }, { once: true });
        } else {
            this.init();
        }
    }

    init() {
        initPwa();

        this.net = new Network();
        this.ui = new UI(null); // Will set game instance later
        this.game = null;
        this.booted = false;
        this.authTimeout = null;
        
        // Setup Nickname
        let nick = localStorage.getItem('night-vibe-online_nick');
        if (!nick) {
            nick = 'Player_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('night-vibe-online_nick', nick);
        }
        const nickInput = document.getElementById('nick-input');
        nickInput.value = nick;

        const loader = document.getElementById('loader');
        const container = document.getElementById('container');

        const ensureLocalIdentity = () => {
            if (this.net.me && this.net.me.info && this.net.me.info.user) return;

            let localUid = localStorage.getItem('night-vibe-online_local_uid');
            if (!localUid) {
                localUid = `local_${Math.random().toString(36).slice(2, 10)}`;
                localStorage.setItem('night-vibe-online_local_uid', localUid);
            }

            this.net.me = {
                info: { user: localUid, nick: nickInput.value },
                data: { nick: nickInput.value, inGame: false, state: 'MENU' }
            };

            if (!this.net.room) {
                this.net.room = {
                    room: NETWORK_ROOM_NAME,
                    name: NETWORK_ROOM_NAME,
                    me: localUid,
                    users: {},
                    data: {}
                };
            } else {
                this.net.room.room = this.net.room.room || NETWORK_ROOM_NAME;
                this.net.room.name = this.net.room.name || NETWORK_ROOM_NAME;
                this.net.room.me = this.net.room.me || localUid;
                this.net.room.users = this.net.room.users || {};
                this.net.room.data = this.net.room.data || {};
            }
        };

        const bootGame = (mode = 'online') => {
            if (this.booted) return;
            this.booted = true;

            if (this.authTimeout) {
                clearTimeout(this.authTimeout);
                this.authTimeout = null;
            }

            if (loader) loader.style.display = 'none';
            if (container) container.style.display = 'flex';

            this.game = new Game(this);
            this.ui.game = this.game; // Link UI to Game
            this.game.init();

            if (mode === 'online') {
                this.net.send_cmd('nick', { nick: nickInput.value });
            } else {
                this.ui.addLog('📴 Offline mode enabled (multiplayer unavailable).', 'reward');
            }
        };

        const bootOfflineFallback = (reason = 'connection blocked') => {
            if (this.booted) return;

            if (loader) {
                loader.textContent = `Multiplayer unavailable (${reason}). Starting local mode...`;
            }

            if (this.net.connect_timeout) clearTimeout(this.net.connect_timeout);
            this.net.connect = () => this.net;

            ensureLocalIdentity();
            bootGame('offline');
        };

        let nickSendTimer = null;
        nickInput.addEventListener('input', (e) => {
            const newNick = e.target.value.trim() || 'Player_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('night-vibe-online_nick', newNick);
            if (this.game && this.game.player) this.game.player.nick = newNick;
            if (this.net.me && this.net.me.info) {
                this.net.me.info.nick = newNick;
                if (this.net.me.data) this.net.me.data.nick = newNick;
            }
            clearTimeout(nickSendTimer);
            nickSendTimer = setTimeout(() => {
                this.net.send_cmd('nick', { nick: newNick });
            }, 300);
        });



        // In-game chat modal logic
        const gameChatModal = document.getElementById('game-chat-modal');
        const gameChatInput = document.getElementById('game-chat-input');
        const gameChatSendBtn = document.getElementById('game-chat-send');

        const sendGameChat = () => {
            const msg = gameChatInput.value.trim();
            if (msg && this.game && this.game.player) {
                this.game.player.chatMsg = msg;
                this.game.player.chatTimer = CHAT_MESSAGE_DURATION;
                this.game.broadcastState();
                gameChatInput.value = '';
            }
            gameChatModal.style.display = 'none';
        };

        gameChatSendBtn.addEventListener('click', sendGameChat);


        window.addEventListener('keydown', (e) => {
            if (this.game && this.game.state === 'PLAYING' && e.key === 'Enter') {
                if (gameChatModal.style.display === 'flex') {
                    sendGameChat();
                } else {
                    gameChatModal.style.display = 'flex';
                    gameChatInput.focus();
                }
            }
            if (e.key === 'Escape' && gameChatModal.style.display === 'flex') {
                gameChatModal.style.display = 'none';
            }
        });

        let lastLobbyHtml = '';
        setInterval(() => {
            if (!this.net.room || !this.net.room.users) return;
            const list = document.getElementById('menu-player-list');
            if (list) {
                let count = Object.keys(this.net.room.users).length + 1; // including self
                const getIcon = (cls) => {
                    if (cls === 'warrior') return '⚔️';
                    if (cls === 'mage') return '🔮';
                    if (cls === 'archer') return '🏹';
                    if (cls === 'magicgladiator') return '⚡';
                    return '👤';
                };

                const esc = (s) => String(s)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');

                const buildCard = (name, statusStr, cls, level, resets, isSelf) => {
                    const icon = getIcon(cls);
                    const borderColor = statusStr.includes('Game') ? '#e74c3c' : '#2ecc71';
                    const bg = isSelf ? 'rgba(243, 156, 18, 0.15)' : 'rgba(0,0,0,0.4)';
                    const safeLevel = esc(level);
                    const safeResets = esc(resets);
                    return `
                    <div style="background:${bg}; border-left:4px solid ${borderColor}; padding:8px 10px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:bold; color:${isSelf ? '#f1c40f' : '#ecf0f1'}; font-size:1.05em;">${esc(name)}</span>
                            <span style="font-size:0.85em; color:#bdc3c7; margin-top:3px;">${icon} Lv.<span style="color:#fff;">${safeLevel}</span> ${resets > 0 ? `<span style="color:#9b59b6;">(🔄${safeResets})</span>` : ''}</span>
                        </div>
                        <div style="font-size:0.85em; text-align:right;">
                            ${statusStr}
                        </div>
                    </div>`;
                };

                let html = '<div style="color:#ffd700; font-size:1.1em; font-weight:bold; border-bottom:1px solid #34495e; padding-bottom:8px; margin-bottom:8px;">👥 Lobby Players (' + count + ')</div>';

                // Add self
                const selfStatus = (this.game && this.game.state === 'PLAYING') ? '<span style="color:#e74c3c; font-weight:bold;">⚔️ In Game</span>' : '<span style="color:#2ecc71; font-weight:bold;">💤 In Menu</span>';
                const selfLevel = (this.game && this.game.player) ? this.game.player.level : 1;
                const selfResets = (this.game && this.game.player) ? (this.game.player.resets || 0) : 0;
                const selfClass = (this.game && this.game.player) ? this.game.player.classType : 'warrior';

                html += buildCard(nickInput.value + ' (You)', selfStatus, selfClass, selfLevel, selfResets, true);

                const myUid = (this.net.me && this.net.me.info) ? this.net.me.info.user : null;
                for (let uid in this.net.room.users) {
                    if (uid === myUid) continue;
                    const u = this.net.room.users[uid];
                    let uNick = uid.substring(0, 8);
                    if (u.data && u.data.nick) uNick = u.data.nick;
                    else if (u.nick) uNick = u.nick;
                    else if (u.info && u.info.nick) uNick = u.info.nick;

                    const status = (u.data && u.data.inGame) ? '<span style="color:#e74c3c; font-weight:bold;">⚔️ In Game</span>' : '<span style="color:#2ecc71; font-weight:bold;">💤 In Menu</span>';
                    const uLevel = (u.data && u.data.level) ? u.data.level : 1;
                    const uResets = (u.data && u.data.resets) ? u.data.resets : 0;
                    const uClass = (u.data && u.data.classType) ? u.data.classType : 'warrior';

                    html += buildCard(uNick, status, uClass, uLevel, uResets, false);
                }
                if (html !== lastLobbyHtml) {
                    list.innerHTML = html;
                    lastLobbyHtml = html;
                }

                if (myUid && this.net.room.users[myUid] && this.net.room.users[myUid].data) {
                    const myResets = this.net.room.users[myUid].data.resets || 0;
                    const menuResets = document.getElementById('menu-resets-display');
                    if (menuResets) menuResets.textContent = `🔄 Resets: ${myResets}`;
                }
            }
        }, 1000);

        // Wait for connection to BSON WebSockets
        this.net.on('connect', () => {
            this.net.send_cmd('auth', { 'user': '', 'room': NETWORK_ROOM_NAME });
        });

        this.net.on('disconnect', () => {
            if (!this.booted) {
                bootOfflineFallback('network blocked');
            }
        });
        
        this.net.on('auth.info', () => {
            bootGame('online');
        });

        this.authTimeout = setTimeout(() => {
            if (!this.booted) {
                bootOfflineFallback('auth timeout');
            }
        }, 8000);
        
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const wsUrl = isLocal ? 'ws://localhost:3001/ws/' : 'wss://ws.emupedia.net/ws/';
        this.net.connect(wsUrl);
    }
}
