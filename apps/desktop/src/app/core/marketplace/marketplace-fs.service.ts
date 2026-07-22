import { Injectable, OnDestroy, signal } from '@angular/core';

export type DownloadPhase = 'download' | 'unpacking' | 'done' | 'error';

export interface DownloadProgress {
  itemId: string;
  phase: DownloadPhase;
  /** 0-100, or -1 if indeterminate (e.g. server didn't send a Content-Length). */
  progress: number;
  message?: string;
}

export interface DownloadedMcp {
  itemId: string;
  itemName: string;
  version: string;
  installPath: string;
  downloadedAt: string;
}

interface McpBridgeFsApi {
  getSettings(): Promise<{ downloadDirectory: string | null }>;
  pickDownloadDirectory(): Promise<string | null>;
  listDownloadedMcps(): Promise<DownloadedMcp[]>;
  downloadAndInstall(args: {
    downloadUrl: string;
    accessToken: string;
    itemId: string;
    itemName: string;
    version: string;
  }): Promise<{ installPath: string }>;
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;
}

declare global {
  interface Window {
    mcpBridgeFs?: McpBridgeFsApi;
  }
}

/**
 * Bridges to the Electron main process's filesystem work for the
 * marketplace feature (download directory setting, download+unzip+install)
 * — see `electron/marketplace-downloader.js` / `electron/preload.js`. Only
 * present in the real Electron app (`window.mcpBridgeFs`); a plain browser
 * tab falls back to a normal browser download, driven entirely from
 * `MarketplaceStore` without this service.
 */
@Injectable({ providedIn: 'root' })
export class MarketplaceFsService implements OnDestroy {
  readonly isElectron = !!window.mcpBridgeFs;
  readonly downloadDirectory = signal<string | null>(null);
  /** Latest progress per item id — cleared once a download finishes (kept briefly on error for display). */
  readonly progress = signal<Map<string, DownloadProgress>>(new Map());

  private readonly unsubscribeProgress?: () => void;

  constructor() {
    if (!this.isElectron) return;

    void window.mcpBridgeFs?.getSettings().then((settings) => this.downloadDirectory.set(settings.downloadDirectory));
    this.unsubscribeProgress = window.mcpBridgeFs?.onDownloadProgress((progress) => {
      const next = new Map(this.progress());
      next.set(progress.itemId, progress);
      this.progress.set(next);
    });
  }

  async pickDownloadDirectory(): Promise<string | null> {
    const dir = (await window.mcpBridgeFs?.pickDownloadDirectory()) ?? null;
    if (dir) this.downloadDirectory.set(dir);
    return dir;
  }

  listDownloadedMcps(): Promise<DownloadedMcp[]> {
    return window.mcpBridgeFs?.listDownloadedMcps() ?? Promise.resolve([]);
  }

  async downloadAndInstall(args: {
    downloadUrl: string;
    accessToken: string;
    itemId: string;
    itemName: string;
    version: string;
  }): Promise<{ installPath: string }> {
    if (!window.mcpBridgeFs) throw new Error('Not running in the desktop app');
    try {
      return await window.mcpBridgeFs.downloadAndInstall(args);
    } finally {
      // Give the "done"/"error" state a moment to render before clearing it.
      setTimeout(() => {
        const next = new Map(this.progress());
        next.delete(args.itemId);
        this.progress.set(next);
      }, 3000);
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeProgress?.();
  }
}
