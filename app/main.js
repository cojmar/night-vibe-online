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
        nickInput.addEventListener('change', (e) => {
            const newNick = e.target.value.trim() || 'Player_' + Math.floor(Math.random() * 9000 + 1000);
            localStorage.setItem('nrpg_nick', newNick);
            this.net.send_cmd('nick', { nick: newNick });
            if (this.game && this.game.player) this.game.player.nick = newNick;
        });

        // Chat
        const chatInput = document.getElementById('chat-input');
        const btnChat = document.getElementById('btn-chat-send');
        const sendChat = () => {
            const msg = chatInput.value.trim();
            if (msg) {
                this.net.send_cmd('room.msg', { msg: msg });
                chatInput.value = '';
            }
        };
        btnChat.addEventListener('click', sendChat);
        chatInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendChat(); });

        this.net.on('room.msg', (data) => {
            const chatBox = document.getElementById('chat-messages');
            // 'data' usually contains 'user', we can map it to nick if it exists in users
            let sender = data.user || 'Unknown';
            if (this.net.room && this.net.room.users && this.net.room.users[data.user] && this.net.room.users[data.user].data && this.net.room.users[data.user].data.nick) {
                sender = this.net.room.users[data.user].data.nick;
            } else if (data.user === this.net.me.user) {
                sender = nickInput.value;
            }
            const msgEl = document.createElement('div');
            msgEl.innerHTML = `<span style="color:#f39c12;font-weight:bold;">${sender}:</span> <span style="color:#eee;">${data.msg}</span>`;
            chatBox.appendChild(msgEl);
            chatBox.scrollTop = chatBox.scrollHeight;
        });
        
        setInterval(() => {
            if (!this.net.room || !this.net.room.users) return;
            const list = document.getElementById('menu-player-list');
            if (list) {
                let count = Object.keys(this.net.room.users).length + 1; // including self
                let html = '<div style="color:#bdc3c7; font-size:0.8em; border-bottom:1px solid #34495e; margin-bottom:5px;">Lobby Players (' + count + ')</div>';
                
                // Add self
                const selfStatus = (this.game && this.game.state === 'PLAYING') ? '<span style="color:#e74c3c">[In Game]</span>' : '<span style="color:#2ecc71">[In Menu]</span>';
                html += `<div style="font-size:0.9em; padding:2px 0;">${nickInput.value} (You) ${selfStatus}</div>`;
                
                for (let uid in this.net.room.users) {
                    const u = this.net.room.users[uid];
                    const uNick = u.data && u.data.nick ? u.data.nick : uid.substring(0,8);
                    const status = (u.data && u.data.inGame) ? '<span style="color:#e74c3c">[In Game]</span>' : '<span style="color:#2ecc71">[In Menu]</span>';
                    html += `<div style="font-size:0.9em; padding:2px 0;">${uNick} ${status}</div>`;
                }
                list.innerHTML = html;
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
