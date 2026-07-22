/**
 * Bridges the desktop app's `AgentBridgeService` (running as a plain web
 * page — see `apps/desktop/src/app/core/agent/agent-bridge.service.ts`) to
 * this extension's background service worker. Runs in the page's isolated
 * content-script world, so it can freely use `chrome.*` APIs while also
 * exchanging `window.postMessage` with the page itself.
 *
 * This is what makes the "no separate extension login" flow work: the
 * desktop app already has the user's session (from its own login) and just
 * hands the token + MCP list over directly, instead of the user logging
 * into the extension's popup separately.
 *
 * `connect`/`disconnect` (full reconnect) are kept deliberately separate
 * from `set-mcps` (a live, no-reconnect update) — see the comment on
 * `AgentBridgeService` for why collapsing them into one message caused the
 * status to get stuck on "connecting".
 */

const APP_MESSAGE_SOURCE = 'mcp-bridge-app';
const EXTENSION_MESSAGE_SOURCE = 'mcp-bridge-extension';

interface AgentMcp {
  name: string;
  port: number;
  subPath?: string;
}

interface AppMessage {
  source: typeof APP_MESSAGE_SOURCE;
  type: 'ping' | 'connect' | 'disconnect' | 'set-mcps';
  backendUrl?: string;
  token?: string;
  mcps?: AgentMcp[];
}

function postToPage(message: Record<string, unknown>): void {
  window.postMessage({ source: EXTENSION_MESSAGE_SOURCE, ...message }, '*');
}

async function handleConnect(message: AppMessage): Promise<void> {
  await chrome.storage.local.set({
    backendUrl: message.backendUrl,
    token: message.token,
    mcps: message.mcps || [],
    desiredConnected: true,
  });
  const response = (await chrome.runtime.sendMessage({ type: 'connect' })) as { status?: string } | undefined;
  if (response?.status) postToPage({ type: 'status', status: response.status });
}

async function handleDisconnect(): Promise<void> {
  await chrome.storage.local.set({ desiredConnected: false });
  const response = (await chrome.runtime.sendMessage({ type: 'disconnect' })) as { status?: string } | undefined;
  if (response?.status) postToPage({ type: 'status', status: response.status });
}

/**
 * Updates the stored MCP list (for persistence + the popup's own table) and
 * tells the background directly to apply it live — no reconnect. Both the
 * direct message and the storage write are sent; see background.ts for why
 * the message is the one actually relied on to reliably reach a possibly
 * just-woken-up service worker.
 */
async function handleSetMcps(mcps: AgentMcp[]): Promise<void> {
  await chrome.storage.local.set({ mcps });
  await chrome.runtime.sendMessage({ type: 'set-mcps', mcps });
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const data = event.data as AppMessage | undefined;
  if (data?.source !== APP_MESSAGE_SOURCE) return;

  switch (data.type) {
    case 'ping':
      postToPage({ type: 'ready' });
      break;
    case 'connect':
      void handleConnect(data);
      break;
    case 'disconnect':
      void handleDisconnect();
      break;
    case 'set-mcps':
      void handleSetMcps(data.mcps || []);
      break;
  }
});

// A long-lived Port to receive the background's status pushes (see
// background.ts) — plain `chrome.runtime.sendMessage()` from a background
// script isn't reliably delivered to a content script's `onMessage`
// listener, so status changes need this instead. Reconnects if the service
// worker restarts (which drops the port) and disconnects/reconnects it.
function connectStatusPort(): void {
  const port = chrome.runtime.connect({ name: 'mcp-bridge-content' });
  port.onMessage.addListener((message: { type?: string; status?: string }) => {
    if (message?.type === 'agent:status' && message.status) {
      postToPage({ type: 'status', status: message.status });
    }
  });
  port.onDisconnect.addListener(() => {
    setTimeout(connectStatusPort, 1000);
  });
}
connectStatusPort();

// Announce presence immediately — covers the common case where the page
// loaded (and is already listening) before or right as this script injects.
postToPage({ type: 'ready' });
