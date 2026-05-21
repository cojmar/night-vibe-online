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
        
        // Wait for connection to BSON WebSockets
        this.net.on('connect', () => {
            this.net.send_cmd('auth', { 'user': '', 'room': 'N-RPG-Arena' });
        });
        
        this.net.on('auth.info', (data) => {
            document.getElementById('loader').style.display = 'none';
            document.getElementById('container').style.display = 'flex';
            
            // Initialize Game engine
            this.game = new Game(this);
            this.ui.game = this.game; // Link UI to Game
            this.game.init();
        });
        
        this.net.connect('wss://ws.emupedia.net/ws/');
    }
}
