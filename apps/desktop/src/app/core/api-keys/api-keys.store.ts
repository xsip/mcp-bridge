import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import { ApiKeyDto, ApiKeysService, CreatedApiKeyDto } from '@mcp-bridge/ui-client';
import { extractErrorMessage } from '../http-error.util';
import { ToastService } from '../toast/toast.service';

interface ApiKeysState {
  items: ApiKeyDto[];
  status: 'idle' | 'loading' | 'error';
  error: string | null;
  /** The raw key from the most recent `create()` call — shown once, then dismissed by the user. */
  justCreated: CreatedApiKeyDto | null;
}

const initialState: ApiKeysState = {
  items: [],
  status: 'idle',
  error: null,
  justCreated: null,
};

/** Backs the "API Keys" route — list, generate, and revoke long-lived proxy credentials. */
export const ApiKeysStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, apiKeysService = inject(ApiKeysService), toast = inject(ToastService)) => {
    const fetchAll = rxMethod<void>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(() =>
          apiKeysService.listApiKeys().pipe(
            tap((items) => patchState(store, { items, status: 'idle', error: null })),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', error: extractErrorMessage(error) });
              return of(null);
            }),
          ),
        ),
      ),
    );

    return {
      refresh: fetchAll,

      create: rxMethod<{ name: string }>(
        pipe(
          tap(() => patchState(store, { status: 'loading', error: null })),
          switchMap(({ name }) =>
            apiKeysService.createApiKey({ name }).pipe(
              tap((created) => {
                patchState(store, { justCreated: created, status: 'idle', error: null });
                fetchAll();
              }),
              catchError((error: unknown) => {
                patchState(store, { status: 'error', error: extractErrorMessage(error) });
                return of(null);
              }),
            ),
          ),
        ),
      ),

      dismissCreated(): void {
        patchState(store, { justCreated: null });
      },

      revoke: rxMethod<string>(
        pipe(
          switchMap((id) =>
            apiKeysService.revokeApiKey(id).pipe(
              tap(() => {
                fetchAll();
                toast.success('API key revoked');
              }),
              catchError((error: unknown) => {
                patchState(store, { status: 'error', error: extractErrorMessage(error) });
                return of(null);
              }),
            ),
          ),
        ),
      ),
    };
  }),
);
