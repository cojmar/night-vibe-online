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
        let nick = localStorage.getItem('nrpg_nick');
        if (!nick) {
            nick = 'Player_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('nrpg_nick', nick);
        }
        const nickInput = document.getElementById('nick-input');
        nickInput.value = nick;
        let nickSendTimer = null;
        nickInput.addEventListener('input', (e) => {
            const newNick = e.target.value.trim() || 'Player_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('nrpg_nick', newNick);
            if (this.game && this.game.player) this.game.player.nick = newNick;
            clearTimeout(nickSendTimer);
            nickSendTimer = setTimeout(() => {
                this.net.send_cmd('nick', { nick: newNick });
            }, 300);
        });

        // Chat
        const chatInput = document.getElementById('chat-input');
        const btnChat = document.getElementById('btn-chat-send');
        const sendChat = () => {
            const msg = chatInput.value.trim();
            if (msg) {
                const myUser = (this.net.me && this.net.me.info) ? this.net.me.info.user : '';
                this.net.send_cmd('msg', { msg: msg, nick: nickInput.value, user: myUser });
                chatInput.value = '';
            }
        };
        btnChat.addEventListener('click', sendChat);
        chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

        this.net.on('room.msg', (data) => {
            const chatBox = document.getElementById('chat-messages');
            let sender = 'Unknown';
            
            if (data.nick) {
                sender = data.nick;
            } else if (data.user) {
                if (this.net.room && this.net.room.users && this.net.room.users[data.user] && this.net.room.users[data.user].data && this.net.room.users[data.user].data.nick) {
                    sender = this.net.room.users[data.user].data.nick;
                } else if (this.net.me && this.net.me.info && data.user === this.net.me.info.user) {
                    sender = nickInput.value;
                } else {
                    sender = data.user.substring(0,8);
                }
            }
            
            const msgEl = document.createElement('div');
            msgEl.innerHTML = `<span style="color:#f39c12;font-weight:bold;">${sender}:</span> <span style="color:#eee;">${data.msg}</span>`;
            chatBox.appendChild(msgEl);
            chatBox.scrollTop = chatBox.scrollHeight;
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
                let html = '<div style="color:#bdc3c7; font-size:0.8em; border-bottom:1px solid #34495e; margin-bottom:5px;">Lobby Players (' + count + ')</div>';
                
                // Add self
                const selfStatus = (this.game && this.game.state === 'PLAYING') ? '<span style="color:#e74c3c">[In Game]</span>' : '<span style="color:#2ecc71">[In Menu]</span>';
                html += `<div style="font-size:0.9em; padding:2px 0;">${nickInput.value} (You) ${selfStatus}</div>`;
                
                const myUid = (this.net.me && this.net.me.info) ? this.net.me.info.user : null;
                for (let uid in this.net.room.users) {
                    if (uid === myUid) continue;
                    const u = this.net.room.users[uid];
                    let uNick = uid.substring(0,8);
                    if (u.data && u.data.nick) uNick = u.data.nick;
                    else if (u.nick) uNick = u.nick;
                    else if (u.info && u.info.nick) uNick = u.info.nick;
                    
                    const status = (u.data && u.data.inGame) ? '<span style="color:#e74c3c">[In Game]</span>' : '<span style="color:#2ecc71">[In Menu]</span>';
                    html += `<div style="font-size:0.9em; padding:2px 0;">${uNick} ${status}</div>`;
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
            this.net.send_cmd('auth', { 'user': '', 'room': 'N-RPG-Arena' });
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
