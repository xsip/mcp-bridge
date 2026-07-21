import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthStore } from './auth.store';

// These calls are @Public() on the backend and must never trigger a refresh
// attempt themselves — a 401 from /auth/refresh means the refresh token
// itself is dead, and refreshing again would recurse forever.
const AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/activate', '/auth/refresh'];

/**
 * On a 401 (expired/invalid access token), tries a single silent refresh via
 * `AuthStore.tryRefresh()` and retries the original request with the new
 * token. If the refresh token is also invalid/expired, `tryRefresh()` logs
 * the user out (clears localStorage, redirects to /login) and this passes
 * the original error through.
 */
export const authExpiryInterceptor: HttpInterceptorFn = (req, next) => {
  const authStore = inject(AuthStore);

  if (AUTH_ENDPOINTS.some((path) => req.url.includes(path))) {
    return next(req);
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      return authStore.tryRefresh().pipe(
        switchMap((refreshed) => {
          if (!refreshed) {
            return throwError(() => error);
          }
          const token = authStore.token();
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
        }),
      );
    }),
  );
};
