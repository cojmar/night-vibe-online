const INSTALL_BUTTON_IDS = ['btn-install-app', 'btn-install-app-game'];

let deferredInstallPrompt = null;

const isStandalone = () => {
    const standaloneMedia = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
    const iosStandalone = window.navigator.standalone === true;
    return standaloneMedia || iosStandalone;
};

const getInstallButtons = () => INSTALL_BUTTON_IDS
    .map((id) => document.getElementById(id))
    .filter(Boolean);

const setInstallButtonsVisible = (visible) => {
    getInstallButtons().forEach((button) => {
        button.hidden = !visible;
        button.disabled = !visible;
        button.classList.toggle('install-app-btn-visible', visible);
    });
};

const installApp = async () => {
    if (!deferredInstallPrompt) {
        setInstallButtonsVisible(false);
        return;
    }

    deferredInstallPrompt.prompt();

    try {
        await deferredInstallPrompt.userChoice;
    } finally {
        deferredInstallPrompt = null;
        setInstallButtonsVisible(false);
    }
};

const bindInstallButtons = () => {
    getInstallButtons().forEach((button) => {
        button.addEventListener('click', installApp);
    });
};

const registerServiceWorker = () => {
    const canRegister = 'serviceWorker' in navigator && window.isSecureContext;
    if (!canRegister) return;

    navigator.serviceWorker.register('./sw.js', { scope: './' }).then((registration) => {
        scheduleAppShellCaching(registration);
    }).catch((error) => {
        console.warn('PWA service worker registration failed:', error);
    });
};

const isPlaying = () => window.app && window.app.game && window.app.game.state === 'PLAYING';

const cacheAppShell = (registration) => {
    const worker = registration.active || registration.waiting || registration.installing;
    if (worker) {
        worker.postMessage({ type: 'CACHE_APP_SHELL' });
    }
};

const scheduleAppShellCaching = (registration) => {
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 10000));
    schedule(() => {
        if (isPlaying()) {
            window.setTimeout(() => scheduleAppShellCaching(registration), 15000);
            return;
        }

        cacheAppShell(registration);
    }, { timeout: 30000 });
};

export function initPwa() {
    registerServiceWorker();
    bindInstallButtons();

    if (isStandalone()) {
        setInstallButtonsVisible(false);
        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        setInstallButtonsVisible(true);
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        setInstallButtonsVisible(false);
    });
}
