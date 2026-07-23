import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, firstValueFrom, of, pipe, switchMap, tap } from 'rxjs';
import { MarketPlaceItemDto, MarketplaceService } from '@mcp-loop/ui-client';
import { extractErrorMessage } from '../http-error.util';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../toast/toast.service';
import { resolveBackendUrl } from '../agent/backend-url';
import { MarketplaceFsService } from './marketplace-fs.service';

export type SortDirection = 'asc' | 'desc';

interface MarketplaceState {
  items: MarketPlaceItemDto[];
  total: number;
  page: number;
  pageSize: number;
  search: string;
  sortByDownloadCount: SortDirection | null;
  sortByReleaseDate: SortDirection | null;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

const initialState: MarketplaceState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  search: '',
  sortByDownloadCount: null,
  sortByReleaseDate: 'desc',
  status: 'idle',
  error: null,
};

/**
 * Browse state for the "Marketplace" route: search/sort/pagination against
 * `GET /marketplace/items`, plus driving a download — either straight to a
 * browser download (plain browser) or through `MarketplaceFsService`'s
 * Electron IPC bridge (download + unzip + delete zip + record it).
 */
export const MarketplaceStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ total, pageSize }) => ({
    pageCount: computed(() => Math.max(1, Math.ceil(total() / pageSize()))),
  })),
  withMethods(
    (
      store,
      marketplaceService = inject(MarketplaceService),
      authStore = inject(AuthStore),
      marketplaceFs = inject(MarketplaceFsService),
      toast = inject(ToastService),
    ) => ({
      load: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { status: 'loading', error: null })),
          switchMap(() =>
            marketplaceService
              .listMarketplaceItems(
                store.search() || undefined,
                store.page(),
                store.pageSize(),
                store.sortByDownloadCount() ?? undefined,
                store.sortByReleaseDate() ?? undefined,
              )
              .pipe(
                tap((result) =>
                  patchState(store, { items: result.items, total: result.total, page: result.page, status: 'idle' }),
                ),
                catchError(() => {
                  patchState(store, { status: 'error', error: 'Failed to load marketplace items.' });
                  return of(null);
                }),
              ),
          ),
        ),
      ),

      setSearch(search: string): void {
        patchState(store, { search, page: 1 });
        this.load();
      },

      /** The two sorts are mutually exclusive in the UI — picking one clears the other. */
      setSortByDownloadCount(direction: SortDirection | null): void {
        patchState(store, { sortByDownloadCount: direction, sortByReleaseDate: direction ? null : 'desc', page: 1 });
        this.load();
      },

      setSortByReleaseDate(direction: SortDirection | null): void {
        patchState(store, { sortByReleaseDate: direction, sortByDownloadCount: null, page: 1 });
        this.load();
      },

      setPage(page: number): void {
        patchState(store, { page });
        this.load();
      },

      /**
       * Downloads a specific version. In Electron, hands the one-time link
       * off to the main process to fetch + unzip + install (progress tracked
       * via `MarketplaceFsService.progress`); in a plain browser, just
       * triggers a normal file download of the raw zip.
       */
      async download(item: MarketPlaceItemDto, version: string): Promise<void> {
        const accessToken = authStore.token();
        if (!accessToken) return;

        try {
          const link = await firstValueFrom(marketplaceService.createMarketplaceItemDownloadLink(item.id, version));
          // resolveBackendUrl() is the raw backend origin (no dev-proxy "/api" prefix rewrite — same as the WS
          // tunnel URL in electron/agent.js), since this needs to work from the Electron main process too, which
          // has no relative-to-the-page proxy to ride on.
          const downloadUrl = `${resolveBackendUrl()}/marketplace/download/${link.token}`;

          if (marketplaceFs.isElectron) {
            await marketplaceFs.downloadAndInstall({
              downloadUrl,
              accessToken,
              itemId: item.id,
              itemName: item.name,
              publisher: item.ownerUsername,
              version,
            });
            toast.success(`"${item.name}" ${version} downloaded and installed`);
          } else {
            await downloadInBrowser(downloadUrl, accessToken, `${item.name}-${version}.zip`);
          }
        } catch (error) {
          toast.error(extractErrorMessage(error));
        }
      },
    }),
  ),
);

async function downloadInBrowser(url: string, accessToken: string, filename: string): Promise<void> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error(`Download failed (HTTP ${response.status})`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);
}
