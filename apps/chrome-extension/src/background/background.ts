import { AgentMcp, AgentStatus, AgentTunnel } from './agent-tunnel';

interface StoredSettings {
  backendUrl?: string;
  token?: string | null;
  mcps?: AgentMcp[];
  /** Set by the popup's connect/disconnect toggle — distinguishes "never connected" from "user asked to disconnect", so the keepalive alarm doesn't fight the user's choice. */
  desiredConnected?: boolean;
}

let currentStatus: AgentStatus = 'disconnected';

// Content scripts open a long-lived Port (see content-script.ts) specifically
// to receive these pushes. `chrome.runtime.sendMessage()` from a background
// script is NOT reliably delivered to content-script `onMessage` listeners —
// that direction is only really guaranteed content-script/popup -> background
// — which is why status updates never reached the page even though the
// tunnel itself connected fine.
const statusPorts = new Set<chrome.runtime.Port>();

const tunnel = new AgentTunnel((status) => {
  currentStatus = status;
  for (const port of statusPorts) {
    try {
      port.postMessage({ type: 'agent:status', status });
    } catch {
      statusPorts.delete(port);
    }
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'mcp-loop-content') return;
  statusPorts.add(port);
  port.postMessage({ type: 'agent:status', status: currentStatus });
  port.onDisconnect.addListener(() => statusPorts.delete(port));
});

function toWsUrl(backendUrl: string): string {
  const url = new URL(backendUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/agents';
  url.search = '';
  return url.toString();
}

async function getSettings(): Promise<StoredSettings> {
  return chrome.storage.local.get(['backendUrl', 'token', 'mcps', 'desiredConnected']);
}

async function startTunnel(): Promise<void> {
  const { backendUrl, token, mcps } = await getSettings();
  if (!backendUrl || !token) return;
  tunnel.setMcps(mcps || []);
  tunnel.start(toWsUrl(backendUrl), token);
}

function stopTunnel(): void {
  tunnel.stop();
}

chrome.runtime.onMessage.addListener((message: { type?: string; mcps?: AgentMcp[] }, _sender, sendResponse) => {
  void (async () => {
    switch (message?.type) {
      case 'connect':
        await startTunnel();
        sendResponse({ status: currentStatus });
        break;
      case 'disconnect':
        stopTunnel();
        sendResponse({ status: currentStatus });
        break;
      case 'get-status':
        sendResponse({ status: currentStatus });
        break;
      case 'set-mcps':
        // Applied directly here rather than relying solely on the
        // chrome.storage.onChanged listener below — that one only fires if
        // the storage write actually manages to wake an already-terminated
        // service worker, which has proven flaky in practice. A message the
        // content script sends directly is a documented, guaranteed wake
        // trigger for this listener.
        tunnel.setMcps(message.mcps || []);
        sendResponse({ status: currentStatus });
        break;
      default:
        sendResponse(undefined);
    }
  })();
  return true; // keep the message channel open for the async sendResponse above
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  // Belt-and-suspenders: normally redundant with the 'set-mcps' message
  // above, but keeps the tunnel's map correct if storage was ever changed
  // through some other path.
  if (changes['mcps']) {
    tunnel.setMcps((changes['mcps'].newValue as AgentMcp[] | undefined) || []);
  }
  // backendUrl/token changes only take effect on the next explicit "connect"
  // from the popup — never yank a live connection out from under it.
});

// Manifest V3 service workers are terminated after ~30s idle, unlike the
// Electron main process this mirrors, which just runs forever. A repeating
// alarm is the standard workaround: it wakes the worker back up, which both
// resets the idle timer and lets us notice/repair a connection that should
// be up but was dropped when the worker was killed mid-connection.
const KEEPALIVE_ALARM = 'mcp-loop-keepalive';
chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: 0.4 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== KEEPALIVE_ALARM) return;
  void (async () => {
    const { desiredConnected } = await getSettings();
    if (desiredConnected && currentStatus === 'disconnected') {
      await startTunnel();
    }
  })();
});

// Reconnect automatically on browser start / extension install-or-reload,
// but only if the user had actually asked to be connected before.
async function reconnectIfDesired(): Promise<void> {
  const { desiredConnected } = await getSettings();
  if (desiredConnected) await startTunnel();
}
chrome.runtime.onStartup.addListener(() => void reconnectIfDesired());
chrome.runtime.onInstalled.addListener(() => void reconnectIfDesired());
