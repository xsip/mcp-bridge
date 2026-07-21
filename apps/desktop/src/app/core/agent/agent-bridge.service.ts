import { Injectable, OnDestroy, signal } from '@angular/core';

export type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

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

/**
 * Thin wrapper around `window.mcpBridge` (exposed by the Electron preload
 * script — see `apps/desktop/electron/preload.js`). The actual WebSocket
 * tunnel to the backend lives entirely in the Electron main process
 * (`apps/desktop/electron/agent.js`); this service only starts/stops it
 * and keeps its local name -> port map in sync.
 *
 * No-ops safely when running as a plain web app (`nx serve desktop`
 * without Electron) — `window.mcpBridge` is simply undefined there, so
 * the dashboard still works for configuring MCPs and browsing logs, it
 * just isn't the one tunneling requests.
 */
@Injectable({ providedIn: 'root' })
export class AgentBridgeService implements OnDestroy {
  readonly status = signal<AgentStatus>('disconnected');
  readonly isElectron = !!window.mcpBridge;

  private readonly unsubscribeStatus?: () => void;

  constructor() {
    this.unsubscribeStatus = window.mcpBridge?.onStatus((status) => this.status.set(status));
  }

  start(token: string): void {
    window.mcpBridge?.startAgent(token);
  }

  stop(): void {
    window.mcpBridge?.stopAgent();
    this.status.set('disconnected');
  }

  setMcps(mcps: BridgeMcp[]): void {
    window.mcpBridge?.setMcps(mcps);
  }

  ngOnDestroy(): void {
    this.unsubscribeStatus?.();
  }
}
