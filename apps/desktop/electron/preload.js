const { contextBridge, ipcRenderer } = require('electron');

/**
 * The only surface the renderer (Angular app, contextIsolation: true) has
 * into the main process. Exposed as `window.mcpBridge` — see
 * `apps/desktop/src/app/core/agent/agent-bridge.service.ts`.
 */
contextBridge.exposeInMainWorld('mcpBridge', {
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
 * Exposed as `window.mcpBridgeWindow` — see `window-controls.service.ts`.
 */
contextBridge.exposeInMainWorld('mcpBridgeWindow', {
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
