const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { AgentTunnel } = require('./agent');

let mainWindow;
const args = process.argv.slice(1);
const serve = args.some((val) => val === '--serve');

// The actual WS tunnel to the backend — see agent.js. Started/stopped and
// kept in sync with the user's configured MCPs entirely via IPC from the
// Angular renderer (AgentBridgeService), never driven from here directly.
const agent = new AgentTunnel((status) => {
  mainWindow?.webContents.send('agent:status', status);
});

async function createWindow() {
  mainWindow = new BrowserWindow({
    transparent: false,
    frame: false,
    width: 1280,
    darkTheme: false,
    minWidth: 1280,
    minHeight: 720,
    height: 720,
    icon: path.join(__dirname, '../public/favicon.png'),
    webPreferences: {
      nodeIntegration: false, // tightened
      contextIsolation: true, // required for contextBridge
      webSecurity: true, // tightened
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.webContents.openDevTools();

  // Keeps the renderer's maximize/restore icon in sync with the actual
  // window state (also changes via OS shortcuts / double-clicking the
  // custom titlebar, not just the button — see Titlebar component).
  mainWindow.on('maximize', () => mainWindow?.webContents.send('window:maximized-change', true));
  mainWindow.on('unmaximize', () => mainWindow?.webContents.send('window:maximized-change', false));

  if (serve) {
    await mainWindow.loadURL('http://localhost:4300');
  } else {
    let pathIndex = './index.html';
    if (fs.existsSync(path.join(__dirname, '../../../dist/apps/desktop/browser/index.html'))) {
      pathIndex = '../../../dist/apps/desktop/browser/index.html';
    }
    const url = new URL(path.join('file:', __dirname, pathIndex).replace('.\\', ''));
    await mainWindow.loadURL(url.href);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

ipcMain.on('agent:start', (_event, token) => agent.start(token));
ipcMain.on('agent:stop', () => agent.stop());
ipcMain.on('agent:set-mcps', (_event, mcps) => agent.setMcps(mcps));

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize-toggle', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});
ipcMain.on('window:close', () => mainWindow?.close());
ipcMain.handle('window:is-maximized', () => mainWindow?.isMaximized() ?? false);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  agent.stop();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', async () => {
  if (mainWindow === null) await createWindow();
});
