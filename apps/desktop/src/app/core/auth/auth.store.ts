import { computed, effect, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { pipe, switchMap, tap } from 'rxjs';
import { catchError, map, Observable, of, shareReplay } from 'rxjs';
import { AuthService, TokenPairDto } from '@mcp-bridge/ui-client';
import { extractErrorMessage } from '../http-error.util';
import { AgentBridgeService } from '../agent/agent-bridge.service';

const TOKEN_STORAGE_KEY = 'mcp-bridge.desktop.token';
const REFRESH_TOKEN_STORAGE_KEY = 'mcp-bridge.desktop.refreshToken';
const USERNAME_STORAGE_KEY = 'mcp-bridge.desktop.username';

export type AuthStatus = 'idle' | 'loading' | 'error';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  username: string | null;
  status: AuthStatus;
  error: string | null;
  /** Set after a successful register when the backend didn't return an activation hash (real email flow). */
  pendingActivation: boolean;
}

const initialState: AuthState = {
  token: null,
  refreshToken: null,
  username: null,
  status: 'idle',
  error: null,
  pendingActivation: false,
};

function persistSession(tokens: TokenPairDto | null, username: string | null): void {
  try {
    if (tokens && username) {
      localStorage.setItem(TOKEN_STORAGE_KEY, tokens.accessToken);
      localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refreshToken);
      localStorage.setItem(USERNAME_STORAGE_KEY, username);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
      localStorage.removeItem(USERNAME_STORAGE_KEY);
    }
  } catch {
    /* localStorage unavailable — session just won't survive a reload */
  }
}

/**
 * Session state for the desktop app, backed by `@ngrx/signals`. Holds the
 * JWT issued by `/auth/login` (or `/auth/activate` right after register)
 * and exposes it to `authInterceptor` for outgoing requests, and to
 * `authGuard` for route protection.
 */
export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ token, status }) => ({
    isAuthenticated: computed(() => token() !== null),
    isLoading: computed(() => status() === 'loading'),
  })),
  withMethods((store, authService = inject(AuthService), router = inject(Router)) => {
    // Dedupes concurrent 401s during a token refresh into a single in-flight
    // request — see authExpiryInterceptor, which is the only other caller.
    let inFlightRefresh: Observable<boolean> | null = null;

    return {
    restoreSession(): void {
      try {
        const token = localStorage.getItem(TOKEN_STORAGE_KEY);
        const refreshToken = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
        const username = localStorage.getItem(USERNAME_STORAGE_KEY);
        if (token && username) {
          patchState(store, { token, refreshToken, username, status: 'idle' });
        }
      } catch {
        /* ignore */
      }
    },

    logout(): void {
      persistSession(null, null);
      patchState(store, initialState);
      void router.navigate(['/login']);
    },

    /**
     * Exchanges the stored refresh token for a new access+refresh pair.
     * Used by authExpiryInterceptor when a request comes back 401 (access
     * token expired). Logs the user out (clearing localStorage, redirecting
     * to /login) if the refresh token is itself invalid/expired.
     */
    tryRefresh(): Observable<boolean> {
      if (inFlightRefresh) return inFlightRefresh;

      const refreshToken = store.refreshToken();
      const username = store.username();
      if (!refreshToken || !username) {
        this.logout();
        return of(false);
      }

      inFlightRefresh = authService.refresh({ username, refreshToken }).pipe(
        map((tokens) => {
          persistSession(tokens, username);
          patchState(store, { token: tokens.accessToken, refreshToken: tokens.refreshToken });
          return true;
        }),
        catchError((error: unknown) => {
          // Only a genuine 401 means the refresh token itself is invalid/expired —
          // log out in that case. A transient error (network blip, server
          // restarting, 5xx) should leave the stored session alone so the next
          // request can retry once the server is back.
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.logout();
          }
          return of(false);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
        tap(() => (inFlightRefresh = null)),
      );
      return inFlightRefresh;
    },

    login: rxMethod<{ username: string; password: string }>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(({ username, password }) =>
          authService.login({ user: username, password }).pipe(
            tap((tokens) => {
              persistSession(tokens, username);
              patchState(store, {
                token: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                username,
                status: 'idle',
                error: null,
                pendingActivation: false,
              });
              void router.navigate(['/mcps']);
            }),
            catchError((error: unknown) => {
              patchState(store, { status: 'error', error: extractErrorMessage(error) });
              return of(null);
            }),
          ),
        ),
      ),
    ),

    register: rxMethod<{ username: string; password: string; registerSecret: string }>(
      pipe(
        tap(() => patchState(store, { status: 'loading', error: null })),
        switchMap(({ username, password, registerSecret }) =>
          authService.register({ username, password, registerSecret }).pipe(
            switchMap((result) => {
              const activationHash = (result as { activationHash?: string } | undefined)?.activationHash;
              if (!activationHash) {
                // Production mode: no hash returned, user must activate via emailed link.
                patchState(store, { status: 'idle', error: null, pendingActivation: true });
                return of(null);
              }
              // Dev convenience: backend returned the hash directly — activate immediately.
              return authService.activateAccount(activationHash).pipe(
                tap((tokens) => {
                  persistSession(tokens, username);
                  patchState(store, {
                    token: tokens.accessToken,
                    refreshToken: tokens.refreshToken,
                    username,
                    status: 'idle',
                    error: null,
                    pendingActivation: false,
                  });
                  void router.navigate(['/mcps']);
                }),
              );
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
  withHooks({
    onInit(store) {
      store.restoreSession();

      // Single source of truth for the tunnel's lifecycle: whenever the
      // session token appears (login, register, or a restored session) the
      // Electron agent connects; whenever it's cleared (logout) it disconnects.
      const agentBridge = inject(AgentBridgeService);
      effect(() => {
        const token = store.token();
        if (token) {
          agentBridge.start(token);
        } else {
          agentBridge.stop();
        }
      });
    },
  }),
);
