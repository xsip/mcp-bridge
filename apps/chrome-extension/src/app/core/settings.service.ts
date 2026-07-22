import { Injectable, OnDestroy, signal } from '@angular/core';

export const DEFAULT_BACKEND_URL = 'http://localhost:3000';

export interface StoredMcp {
  name: string;
  port: number;
  subPath?: string;
}

interface StoredSettings {
  backendUrl?: string;
  token?: string | null;
  mcps?: StoredMcp[];
}

/**
 * Reads just the backend URL from `chrome.storage.local` — used in
 * `main.ts` *before* Angular bootstraps, since `provideApi()` needs the base
 * URL as a static DI value up front. The popup is a fresh page load every
 * time it's opened (MV3 popups aren't kept alive), so reading storage once
 * here — rather than making the API base URL reactive — is enough: changing
 * the backend URL takes effect the next time the popup is opened.
 */
export async function readStoredBackendUrl(): Promise<string> {
  const { backendUrl } = (await chrome.storage.local.get(['backendUrl'])) as StoredSettings;
  return backendUrl || DEFAULT_BACKEND_URL;
}

/**
 * Thin wrapper around `chrome.storage.local` for the popup's own settings.
 *
 * There's deliberately no login/session state owned here: the token (and
 * the MCP list shown in the popup's table) come from the desktop app
 * (running as a plain web page) handing them over via `content-script.ts`
 * the moment the user is logged in there — see
 * `apps/desktop/src/app/core/agent/agent-bridge.service.ts`. This service
 * only reads that data back and owns the backend URL setting; it also
 * stays live via `chrome.storage.onChanged` since the popup can be open
 * while the desktop app pushes an updated MCP list (e.g. one just added).
 */
@Injectable({ providedIn: 'root' })
export class SettingsService implements OnDestroy {
  readonly backendUrl = signal(DEFAULT_BACKEND_URL);
  readonly hasSession = signal(false);
  readonly mcps = signal<StoredMcp[]>([]);

  private readonly loaded = this.load();
  private readonly onStorageChanged = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'local') return;
    if (changes['token']) this.hasSession.set(!!changes['token'].newValue);
    if (changes['mcps']) this.mcps.set((changes['mcps'].newValue as StoredMcp[] | undefined) || []);
    if (changes['backendUrl']) this.backendUrl.set((changes['backendUrl'].newValue as string | undefined) || DEFAULT_BACKEND_URL);
  };

  constructor() {
    chrome.storage.onChanged.addListener(this.onStorageChanged);
  }

  /** Resolves once the signals above reflect what's actually in storage — await before reading them. */
  ready(): Promise<void> {
    return this.loaded;
  }

  private async load(): Promise<void> {
    const stored = (await chrome.storage.local.get(['backendUrl', 'token', 'mcps'])) as StoredSettings;
    this.backendUrl.set(stored.backendUrl || DEFAULT_BACKEND_URL);
    this.hasSession.set(!!stored.token);
    this.mcps.set(stored.mcps || []);
  }

  async setBackendUrl(backendUrl: string): Promise<void> {
    this.backendUrl.set(backendUrl);
    await chrome.storage.local.set({ backendUrl });
  }

  ngOnDestroy(): void {
    chrome.storage.onChanged.removeListener(this.onStorageChanged);
  }
}
