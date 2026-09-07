const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, screen, session, desktopCapturer, globalShortcut } = require('electron');
const path = require('path');
const windowStateKeeper = require('electron-window-state');

let mainWindow = null;
let tray = null;
let isUnlocked = false;

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) {
                mainWindow.restore();
            }

            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function createWindow() {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workAreaSize;
    const sidebarWidth = 420;
    let mainWindowState = windowStateKeeper({
        defaultWidth: sidebarWidth,
        defaultHeight: height,
    });

    mainWindow = new BrowserWindow({
        x: mainWindowState.x ?? width - sidebarWidth,
        y: mainWindowState.y ?? 0,
        width: mainWindowState.width,
        height: mainWindowState.height,
        resizable: true,
        movable: true,
        frame: false,
        skipTaskbar: true,
        transparent: true,
        opacity: 0.98,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        autoHideMenuBar: true,
        title: "Yamaha RX-V6A Control"
    });

    mainWindowState.manage(mainWindow);
    mainWindow.loadFile('index.html');

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
        return false;
    });
}

function createTray() {
    const iconPath = path.join(__dirname, 'icon.png');
    const icon = nativeImage.createFromPath(iconPath);

    tray = new Tray(icon);
    updateTrayMenu();
    tray.setToolTip('Yamaha RX-V6A Control');

    tray.on('click', () => {
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        } else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
}

function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show / Hide',
            click: () => {
                if (mainWindow.isVisible()) {
                    mainWindow.hide();
                } else {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        { type: 'separator' },
        {
            label: isUnlocked ? '🔒 Lock app' : '🔓 Unlock app',
            click: () => {
                isUnlocked = !isUnlocked;
                mainWindow.setMovable(isUnlocked);
                mainWindow.setResizable(isUnlocked);
                mainWindow.webContents.send('toggle-lock', isUnlocked);
                updateTrayMenu();
            }
        },
        { type: 'separator' },
        {
            label: 'Exit',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);
}

ipcMain.on('window-min', () => mainWindow.minimize());
ipcMain.on('window-max', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window-close', () => mainWindow.hide());

app.whenReady().then(() => {
    createWindow();
    createTray();
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
        desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
            callback({ video: sources[0], audio: 'loopback' });
        });
    }, { useSystemPicker: true });

    globalShortcut.register('CommandOrControl+Up', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('global-volume-adjust', 0.5);
        }
    });

    globalShortcut.register('CommandOrControl+Down', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('global-volume-adjust', -0.5);
        }
    });
});

app.on('will-quit', () => {
    globalShortcut.unregisterAll();
});

app.on('before-quit', () => {
    app.isQuiting = true;
});