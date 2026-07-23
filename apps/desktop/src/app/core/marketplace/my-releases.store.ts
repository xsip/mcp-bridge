import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, firstValueFrom, of, pipe, switchMap, tap } from 'rxjs';
import {
  ChangeVisibilityDto,
  CreateMarketPlaceItemDto,
  MarketPlaceItemDto,
  MarketplaceService,
  UpdateMarketPlaceItemDto,
} from '@mcp-loop/ui-client';
import { extractErrorMessage } from '../http-error.util';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../toast/toast.service';
import { PreviewImageService } from './preview-image.service';

interface MyReleasesState {
  items: MarketPlaceItemDto[];
  total: number;
  page: number;
  pageSize: number;
  status: 'idle' | 'loading' | 'error';
  error: string | null;
}

const initialState: MyReleasesState = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 20,
  status: 'idle',
  error: null,
};

/**
 * Manage-your-own-listings state, backing both the "Publish" (create + first
 * version) and "My Releases" (edit/version/visibility/delete) routes. Both
 * only ever operate on the current user's own items — the backend enforces
 * ownership regardless, this just scopes what's fetched/shown.
 */
export const MyReleasesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((
    store,
    marketplaceService = inject(MarketplaceService),
    authStore = inject(AuthStore),
    toast = inject(ToastService),
    previewImages = inject(PreviewImageService),
  ) => ({
    load: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(() => {
          const username = authStore.username();
          if (!username) return of(null);
          return marketplaceService.listMarketplaceItemsByUser(username, undefined, store.page(), store.pageSize()).pipe(
            tap((result) => patchState(store, { items: result.items, total: result.total, page: result.page, status: 'idle' })),
            catchError(() => {
              patchState(store, { status: 'error', error: 'Failed to load your releases.' });
              return of(null);
            }),
          );
        }),
      ),
    ),

    setPage(page: number): void {
      patchState(store, { page });
      this.load();
    },

    async create(dto: CreateMarketPlaceItemDto): Promise<MarketPlaceItemDto | null> {
      try {
        const created = await firstValueFrom(marketplaceService.createMarketplaceItem(dto));
        patchState(store, { items: [created, ...store.items()], total: store.total() + 1 });
        toast.success(`"${created.name}" created`);
        return created;
      } catch (error) {
        toast.error(extractErrorMessage(error));
        return null;
      }
    },

    async update(id: string, dto: UpdateMarketPlaceItemDto): Promise<void> {
      try {
        const updated = await firstValueFrom(marketplaceService.updateMarketplaceItem(id, dto));
        patchState(store, { items: store.items().map((item) => (item.id === id ? updated : item)) });
        toast.success(`"${updated.name}" updated`);
      } catch (error) {
        toast.error(extractErrorMessage(error));
      }
    },

    async changeVisibility(id: string, dto: ChangeVisibilityDto): Promise<void> {
      try {
        const updated = await firstValueFrom(marketplaceService.changeMarketplaceItemVisibility(id, dto));
        patchState(store, { items: store.items().map((item) => (item.id === id ? updated : item)) });
        toast.success(`Visibility changed to "${dto.visibility}"`);
      } catch (error) {
        toast.error(extractErrorMessage(error));
      }
    },

    async remove(id: string): Promise<void> {
      const removed = store.items().find((item) => item.id === id);
      try {
        await firstValueFrom(marketplaceService.removeMarketplaceItem(id));
        patchState(store, { items: store.items().filter((item) => item.id !== id), total: Math.max(0, store.total() - 1) });
        toast.success(removed ? `"${removed.name}" removed` : 'Removed');
      } catch (error) {
        toast.error(extractErrorMessage(error));
      }
    },

    async addVersion(id: string, version: string, file: Blob): Promise<MarketPlaceItemDto | null> {
      try {
        const updated = await firstValueFrom(marketplaceService.addMarketplaceItemVersion(id, version, file));
        patchState(store, { items: store.items().map((item) => (item.id === id ? updated : item)) });
        toast.success(`Version "${version}" added`);
        return updated;
      } catch (error) {
        toast.error(extractErrorMessage(error));
        return null;
      }
    },

    async addVersionFromGithub(id: string, version: string, githubUrl: string): Promise<MarketPlaceItemDto | null> {
      try {
        const updated = await firstValueFrom(marketplaceService.addMarketplaceItemVersionFromGithub(id, { version, githubUrl }));
        patchState(store, { items: store.items().map((item) => (item.id === id ? updated : item)) });
        toast.success(`Version "${version}" added from GitHub`);
        return updated;
      } catch (error) {
        toast.error(extractErrorMessage(error));
        return null;
      }
    },

    async removeVersion(id: string, version: string): Promise<void> {
      try {
        const updated = await firstValueFrom(marketplaceService.removeMarketplaceItemVersion(id, version));
        patchState(store, { items: store.items().map((item) => (item.id === id ? updated : item)) });
        toast.success(`Version "${version}" removed`);
      } catch (error) {
        toast.error(extractErrorMessage(error));
      }
    },

    async addPreviewImage(id: string, file: Blob): Promise<MarketPlaceItemDto | null> {
      try {
        const updated = await firstValueFrom(marketplaceService.addMarketplaceItemPreviewImage(id, file));
        patchState(store, { items: store.items().map((item) => (item.id === id ? updated : item)) });
        return updated;
      } catch (error) {
        toast.error(extractErrorMessage(error));
        return null;
      }
    },

    async removePreviewImage(id: string, fileId: string): Promise<void> {
      try {
        const updated = await firstValueFrom(marketplaceService.removeMarketplaceItemPreviewImage(id, fileId));
        patchState(store, { items: store.items().map((item) => (item.id === id ? updated : item)) });
        previewImages.invalidate(id, fileId);
      } catch (error) {
        toast.error(extractErrorMessage(error));
      }
    },
  })),
);
