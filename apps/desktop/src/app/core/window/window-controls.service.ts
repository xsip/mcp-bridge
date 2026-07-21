import { Injectable, OnDestroy, signal } from '@angular/core';

interface McpBridgeWindowApi {
  minimize(): void;
  maximizeToggle(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(callback: (isMaximized: boolean) => void): () => void;
}

declare global {
  interface Window {
    mcpBridgeWindow?: McpBridgeWindowApi;
  }
}

/**
 * Thin wrapper around `window.mcpBridgeWindow` (Electron preload — see
 * `apps/desktop/electron/preload.js`), driving the custom titlebar's
 * minimize/maximize/close controls now that the window is frameless
 * (`frame: false` in `main.js`). No-ops outside Electron, same as
 * `AgentBridgeService` — the titlebar itself is hidden there too.
 */
@Injectable({ providedIn: 'root' })
export class WindowControlsService implements OnDestroy {
  readonly isElectron = !!window.mcpBridgeWindow;
  readonly isMaximized = signal(false);

  private readonly unsubscribe?: () => void;

  constructor() {
    void window.mcpBridgeWindow?.isMaximized().then((value) => this.isMaximized.set(value));
    this.unsubscribe = window.mcpBridgeWindow?.onMaximizedChange((value) => this.isMaximized.set(value));
  }

  minimize(): void {
    window.mcpBridgeWindow?.minimize();
  }

  maximizeToggle(): void {
    window.mcpBridgeWindow?.maximizeToggle();
  }

  close(): void {
    window.mcpBridgeWindow?.close();
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
