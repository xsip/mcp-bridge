const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only surface the renderer (Angular app, contextIsolation: true) has
 * into the main process. Exposed as `window.mcpLoop` — see
 * `apps/desktop/src/app/core/agent/agent-bridge.service.ts`.
 */
contextBridge.exposeInMainWorld('mcpLoop', {
  startAgent: (token) => ipcRenderer.send('agent:start', token),
  stopAgent: () => ipcRenderer.send('agent:stop'),
  setMcps: (mcps) => ipcRenderer.send('agent:set-mcps', mcps),
  onStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('agent:status', listener);
    return () => ipcRenderer.removeListener('agent:status', listener);
  },
});

/**
 * Custom-titlebar window controls — the window is created with `frame: false`
 * (see main.js), so minimize/maximize/close have to be driven from here.
 * Exposed as `window.mcpLoopWindow` — see `window-controls.service.ts`.
 */
contextBridge.exposeInMainWorld('mcpLoopWindow', {
  minimize: () => ipcRenderer.send('window:minimize'),
  maximizeToggle: () => ipcRenderer.send('window:maximize-toggle'),
  close: () => ipcRenderer.send('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  onMaximizedChange: (callback) => {
    const listener = (_event, isMaximized) => callback(isMaximized);
    ipcRenderer.on('window:maximized-change', listener);
    return () => ipcRenderer.removeListener('window:maximized-change', listener);
  },
});

/**
 * Marketplace download directory setting + download-and-install (fetch the
 * zip, unzip, delete the zip, record it) — all real filesystem work, so it
 * has to happen in the main process. Exposed as `window.mcpLoopFs` — see
 * `apps/desktop/src/app/core/marketplace/marketplace-fs.service.ts`. Only
 * present in the real Electron app, never in a plain browser tab.
 */
contextBridge.exposeInMainWorld('mcpLoopFs', {
  getSettings: () => ipcRenderer.invoke('marketplace:get-settings'),
  pickDownloadDirectory: () => ipcRenderer.invoke('marketplace:pick-download-directory'),
  listDownloadedMcps: () => ipcRenderer.invoke('marketplace:list-downloaded'),
  downloadAndInstall: (args) => ipcRenderer.invoke('marketplace:download-and-install', args),
  uninstall: (itemId) => ipcRenderer.invoke('marketplace:uninstall', itemId),
  onDownloadProgress: (callback) => {
    const listener = (_event, progress) => callback(progress);
    ipcRenderer.on('marketplace:progress', listener);
    return () => ipcRenderer.removeListener('marketplace:progress', listener);
  },
});
