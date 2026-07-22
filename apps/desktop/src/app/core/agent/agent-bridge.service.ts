import { Injectable, OnDestroy, signal } from '@angular/core';
import { resolveBackendUrl } from './backend-url';

export type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
export type BridgeSource = 'electron' | 'extension' | null;

export interface BridgeMcp {
  name: string;
  port: number;
  /** Optional local sub-path, e.g. "/api/mcp" reaches http://localhost:<port>/api/mcp */
  subPath?: string;
}

interface McpBridgeApi {
  startAgent(token: string): void;
  stopAgent(): void;
  setMcps(mcps: BridgeMcp[]): void;
  onStatus(callback: (status: AgentStatus) => void): () => void;
}

declare global {
  interface Window {
    mcpBridge?: McpBridgeApi;
  }
}

const APP_MESSAGE_SOURCE = 'mcp-bridge-app';
const EXTENSION_MESSAGE_SOURCE = 'mcp-bridge-extension';
const PING_RETRY_MS = 250;
const PING_MAX_ATTEMPTS = 8; // ~2s — covers the content script's injection lag

interface AppMessage {
  source: typeof APP_MESSAGE_SOURCE;
  type: 'ping' | 'connect' | 'disconnect' | 'set-mcps';
  backendUrl?: string;
  token?: string;
  mcps?: BridgeMcp[];
}

interface ExtensionMessage {
  source: typeof EXTENSION_MESSAGE_SOURCE;
  type: 'ready' | 'status';
  status?: AgentStatus;
}

/**
 * Drives whichever tunnel transport is available, transparently to callers
 * (`AuthStore`/`McpsStore` just call `start`/`stop`/`setMcps` — see their
 * `withHooks` — without knowing or caring which transport ends up carrying
 * it):
 *
 * 1. **Electron** (`window.mcpBridge`, from `electron/preload.js`) — the
 *    Electron main process holds the WebSocket tunnel directly. Preferred
 *    whenever running inside the desktop app.
 * 2. **Browser extension** — when running as a plain web page (`nx serve
 *    desktop` or a hosted deployment) with the "MCP Bridge Agent" Chrome
 *    extension (`apps/chrome-extension`) installed, its content script
 *    bridges `window.postMessage` to the extension's background service
 *    worker, which holds the tunnel instead. Detected by pinging the
 *    content script on startup; there's no login step in the extension
 *    itself for this path — the token/MCP list are handed over directly
 *    from this service, same as the Electron path.
 *
 * `start`/`stop` map to a full connect/disconnect (tears down and
 * re-establishes the WebSocket); `setMcps` is a *live* update sent
 * separately, so that just changing the local port map — e.g. after adding
 * an MCP — doesn't yank an already-working connection out from under
 * itself. (It used to: both used to funnel through the same "sync"
 * message, so a `setMcps` call shortly after `start` would immediately
 * reconnect the just-opened socket, and if that kept happening the status
 * could get stuck on "connecting" forever even though the tunnel was
 * otherwise working.)
 *
 * No-ops safely when neither is present — the dashboard still works for
 * configuring MCPs and browsing logs, it just isn't the one tunneling
 * requests.
 */
@Injectable({ providedIn: 'root' })
export class AgentBridgeService implements OnDestroy {
  readonly status = signal<AgentStatus>('disconnected');
  readonly isElectron = !!window.mcpBridge;
  /** True once a tunnel transport (Electron or the extension) is actually available to drive. */
  readonly bridgeAvailable = signal(this.isElectron);
  readonly source = signal<BridgeSource>(this.isElectron ? 'electron' : null);

  private readonly unsubscribeStatus?: () => void;
  private readonly backendUrl = resolveBackendUrl();
  private extensionDetected = false;
  private pingAttempts = 0;
  private pingTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onWindowMessage = (event: MessageEvent) => this.handleWindowMessage(event);

  // Last known desired state — replayed to the extension the moment it's
  // detected, in case `start`/`setMcps` were called before detection finished.
  private pendingToken: string | null = null;
  private pendingMcps: BridgeMcp[] = [];

  constructor() {
    if (this.isElectron) {
      this.unsubscribeStatus = window.mcpBridge?.onStatus((status) => this.status.set(status));
      return;
    }

    window.addEventListener('message', this.onWindowMessage);
    this.pingExtension();
  }

  start(token: string): void {
    this.pendingToken = token;
    if (this.isElectron) {
      window.mcpBridge?.startAgent(token);
    } else if (this.extensionDetected) {
      this.postToExtension({
        source: APP_MESSAGE_SOURCE,
        type: 'connect',
        backendUrl: this.backendUrl,
        token,
        mcps: this.pendingMcps,
      });
    }
  }

  stop(): void {
    this.pendingToken = null;
    if (this.isElectron) {
      window.mcpBridge?.stopAgent();
      this.status.set('disconnected');
    } else if (this.extensionDetected) {
      this.postToExtension({ source: APP_MESSAGE_SOURCE, type: 'disconnect' });
    } else {
      this.status.set('disconnected');
    }
  }

  /** A live update to the local name -> port map — doesn't reconnect the tunnel, just updates what it routes to. */
  setMcps(mcps: BridgeMcp[]): void {
    this.pendingMcps = mcps;
    if (this.isElectron) {
      window.mcpBridge?.setMcps(mcps);
    } else if (this.extensionDetected && this.pendingToken) {
      this.postToExtension({ source: APP_MESSAGE_SOURCE, type: 'set-mcps', mcps });
    }
  }

  private pingExtension(): void {
    if (this.extensionDetected || this.pingAttempts >= PING_MAX_ATTEMPTS) return;
    this.pingAttempts++;
    this.postToExtension({ source: APP_MESSAGE_SOURCE, type: 'ping' });
    this.pingTimer = setTimeout(() => this.pingExtension(), PING_RETRY_MS);
  }

  private handleWindowMessage(event: MessageEvent): void {
    if (event.source !== window) return;
    const data = event.data as ExtensionMessage | undefined;
    if (data?.source !== EXTENSION_MESSAGE_SOURCE) return;

    if (data.type === 'ready') {
      this.onExtensionDetected();
    } else if (data.type === 'status' && data.status) {
      this.status.set(data.status);
    }
  }

  private onExtensionDetected(): void {
    if (this.extensionDetected) return;
    this.extensionDetected = true;
    if (this.pingTimer) {
      clearTimeout(this.pingTimer);
      this.pingTimer = null;
    }
    this.bridgeAvailable.set(true);
    this.source.set('extension');
    // Replay whatever start() call already happened while we were still detecting.
    if (this.pendingToken) {
      this.postToExtension({
        source: APP_MESSAGE_SOURCE,
        type: 'connect',
        backendUrl: this.backendUrl,
        token: this.pendingToken,
        mcps: this.pendingMcps,
      });
    }
  }

  private postToExtension(message: AppMessage): void {
    window.postMessage(message, '*');
  }

  ngOnDestroy(): void {
    this.unsubscribeStatus?.();
    window.removeEventListener('message', this.onWindowMessage);
    if (this.pingTimer) clearTimeout(this.pingTimer);
  }
}
