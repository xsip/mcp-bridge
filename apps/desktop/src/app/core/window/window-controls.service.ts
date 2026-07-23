import { Injectable, OnDestroy, signal } from '@angular/core';

interface McpLoopWindowApi {
  minimize(): void;
  maximizeToggle(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  onMaximizedChange(callback: (isMaximized: boolean) => void): () => void;
}

declare global {
  interface Window {
    mcpLoopWindow?: McpLoopWindowApi;
  }
}

/**
 * Thin wrapper around `window.mcpLoopWindow` (Electron preload — see
 * `apps/desktop/electron/preload.js`), driving the custom titlebar's
 * minimize/maximize/close controls now that the window is frameless
 * (`frame: false` in `main.js`). No-ops outside Electron, same as
 * `AgentBridgeService` — the titlebar itself is hidden there too.
 */
@Injectable({ providedIn: 'root' })
export class WindowControlsService implements OnDestroy {
  readonly isElectron = !!window.mcpLoopWindow;
  readonly isMaximized = signal(false);

  private readonly unsubscribe?: () => void;

  constructor() {
    void window.mcpLoopWindow?.isMaximized().then((value) => this.isMaximized.set(value));
    this.unsubscribe = window.mcpLoopWindow?.onMaximizedChange((value) => this.isMaximized.set(value));
  }

  minimize(): void {
    window.mcpLoopWindow?.minimize();
  }

  maximizeToggle(): void {
    window.mcpLoopWindow?.maximizeToggle();
  }

  close(): void {
    window.mcpLoopWindow?.close();
  }

  ngOnDestroy(): void {
    this.unsubscribe?.();
  }
}
