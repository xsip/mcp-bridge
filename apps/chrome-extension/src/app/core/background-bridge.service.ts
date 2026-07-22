import { Injectable, signal } from '@angular/core';

export type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Talks to the background service worker (`background.ts`) that holds the
 * actual WebSocket tunnel — the popup itself never touches the tunnel
 * directly, same separation as `apps/desktop`'s `AgentBridgeService` talking
 * to the Electron main process over IPC.
 *
 * The token and MCP list themselves are written to `chrome.storage.local`
 * by `content-script.ts` (handed over from the desktop app's own session),
 * not by this popup — `reconnect`/`disconnect` here are a manual override
 * on top of whatever's already stored, for e.g. recovering after an error.
 */
@Injectable({ providedIn: 'root' })
export class BackgroundBridgeService {
  readonly status = signal<AgentStatus>('disconnected');

  constructor() {
    void this.refreshStatus();
    chrome.runtime.onMessage.addListener((message: { type?: string; status?: AgentStatus }) => {
      if (message?.type === 'agent:status' && message.status) {
        this.status.set(message.status);
      }
    });
  }

  async refreshStatus(): Promise<void> {
    const response = (await chrome.runtime.sendMessage({ type: 'get-status' })) as { status?: AgentStatus } | undefined;
    if (response?.status) this.status.set(response.status);
  }

  async reconnect(): Promise<void> {
    await chrome.storage.local.set({ desiredConnected: true });
    const response = (await chrome.runtime.sendMessage({ type: 'connect' })) as { status?: AgentStatus } | undefined;
    if (response?.status) this.status.set(response.status);
  }

  async disconnect(): Promise<void> {
    await chrome.storage.local.set({ desiredConnected: false });
    const response = (await chrome.runtime.sendMessage({ type: 'disconnect' })) as { status?: AgentStatus } | undefined;
    if (response?.status) this.status.set(response.status);
  }
}
