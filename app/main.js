import Network from './network.js';
import Game from './game.js';
import UI from './ui.js';

window.app = new class {
    constructor() {
        // Wait for DOM
        window.addEventListener('DOMContentLoaded', () => {
            this.init();
        });
    }

    init() {
        this.net = new Network();
        this.ui = new UI(null); // Will set game instance later
        this.game = null;
        
        // Setup Nickname
        let nick = localStorage.getItem('night-vibe-online_nick');
        if (!nick) {
            nick = 'Player_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('night-vibe-online_nick', nick);
        }
        const nickInput = document.getElementById('nick-input');
        nickInput.value = nick;
        let nickSendTimer = null;
        nickInput.addEventListener('input', (e) => {
            const newNick = e.target.value.trim() || 'Player_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('night-vibe-online_nick', newNick);
            if (this.game && this.game.player) this.game.player.nick = newNick;
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
                this.game.player.chatTimer = 5000;
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

                const buildCard = (name, statusStr, cls, level, resets, isSelf) => {
                    const icon = getIcon(cls);
                    const borderColor = statusStr.includes('Game') ? '#e74c3c' : '#2ecc71';
                    const bg = isSelf ? 'rgba(243, 156, 18, 0.15)' : 'rgba(0,0,0,0.4)';
                    return `
                    <div style="background:${bg}; border-left:4px solid ${borderColor}; padding:8px 10px; border-radius:4px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:bold; color:${isSelf ? '#f1c40f' : '#ecf0f1'}; font-size:1.05em;">${name}</span>
                            <span style="font-size:0.85em; color:#bdc3c7; margin-top:3px;">${icon} Lv.<span style="color:#fff;">${level}</span> ${resets > 0 ? `<span style="color:#9b59b6;">(🔄${resets})</span>` : ''}</span>
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
                    let uNick = uid.substring(0,8);
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
            this.net.send_cmd('auth', { 'user': '', 'room': 'Night-Vibe-Online-Arena' });
        });
        
        this.net.on('auth.info', (data) => {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('container').style.display = 'flex';
            
            this.net.send_cmd('nick', { nick: nickInput.value });
            
            // Initialize Game engine
            this.game = new Game(this);
            this.ui.game = this.game; // Link UI to Game
            this.game.init();
        });
        
        this.net.connect('wss://ws.emupedia.net/ws/');
    }
}
