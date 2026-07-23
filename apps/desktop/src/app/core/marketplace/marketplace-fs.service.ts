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
  /** The marketplace item's owning username at the time it was installed. */
  publisher: string;
  version: string;
  installPath: string;
  downloadedAt: string;
}

interface McpLoopFsApi {
  getSettings(): Promise<{ downloadDirectory: string | null }>;
  pickDownloadDirectory(): Promise<string | null>;
  listDownloadedMcps(): Promise<DownloadedMcp[]>;
  downloadAndInstall(args: {
    downloadUrl: string;
    accessToken: string;
    itemId: string;
    itemName: string;
    publisher: string;
    version: string;
  }): Promise<{ installPath: string }>;
  uninstall(itemId: string): Promise<void>;
  onDownloadProgress(callback: (progress: DownloadProgress) => void): () => void;
}

declare global {
  interface Window {
    mcpLoopFs?: McpLoopFsApi;
  }
}

/**
 * Bridges to the Electron main process's filesystem work for the
 * marketplace feature (download directory setting, download+unzip+install)
 * — see `electron/marketplace-downloader.js` / `electron/preload.js`. Only
 * present in the real Electron app (`window.mcpLoopFs`); a plain browser
 * tab falls back to a normal browser download, driven entirely from
 * `MarketplaceStore` without this service.
 */
@Injectable({ providedIn: 'root' })
export class MarketplaceFsService implements OnDestroy {
  readonly isElectron = !!window.mcpLoopFs;
  readonly downloadDirectory = signal<string | null>(null);
  /** Latest progress per item id — cleared once a download finishes (kept briefly on error for display). */
  readonly progress = signal<Map<string, DownloadProgress>>(new Map());
  /** Locally installed MCPs, keyed by marketplace item id — powers the "On this system" route and the "already installed" badge in the browse list. */
  readonly installed = signal<Map<string, DownloadedMcp>>(new Map());

  private readonly unsubscribeProgress?: () => void;

  constructor() {
    if (!this.isElectron) return;

    void window.mcpLoopFs?.getSettings().then((settings) => this.downloadDirectory.set(settings.downloadDirectory));
    void this.refreshInstalled();
    this.unsubscribeProgress = window.mcpLoopFs?.onDownloadProgress((progress) => {
      const next = new Map(this.progress());
      next.set(progress.itemId, progress);
      this.progress.set(next);
    });
  }

  async refreshInstalled(): Promise<void> {
    const list = await this.listDownloadedMcps();
    this.installed.set(new Map(list.map((entry) => [entry.itemId, entry])));
  }

  async pickDownloadDirectory(): Promise<string | null> {
    const dir = (await window.mcpLoopFs?.pickDownloadDirectory()) ?? null;
    if (dir) this.downloadDirectory.set(dir);
    return dir;
  }

  listDownloadedMcps(): Promise<DownloadedMcp[]> {
    return window.mcpLoopFs?.listDownloadedMcps() ?? Promise.resolve([]);
  }

  async downloadAndInstall(args: {
    downloadUrl: string;
    accessToken: string;
    itemId: string;
    itemName: string;
    publisher: string;
    version: string;
  }): Promise<{ installPath: string }> {
    if (!window.mcpLoopFs) throw new Error('Not running in the desktop app');
    try {
      const result = await window.mcpLoopFs.downloadAndInstall(args);
      await this.refreshInstalled();
      return result;
    } finally {
      // Give the "done"/"error" state a moment to render before clearing it.
      setTimeout(() => {
        const next = new Map(this.progress());
        next.delete(args.itemId);
        this.progress.set(next);
      }, 3000);
    }
  }

  /** Deletes an installed item's folder and drops it from the manifest — no-op if it isn't installed. */
  async uninstall(itemId: string): Promise<void> {
    if (!window.mcpLoopFs) return;
    await window.mcpLoopFs.uninstall(itemId);
    await this.refreshInstalled();
  }

  ngOnDestroy(): void {
    this.unsubscribeProgress?.();
  }
}
