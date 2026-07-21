import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthStore } from './auth.store';

/**
 * Attaches the stored JWT as a Bearer token to every outgoing request.
 * `/auth/login`, `/auth/register`, `/auth/activate` don't need it (they're
 * `@Public()` on the backend), but sending it harmlessly no-ops there too.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthStore).token();
  if (!token) {
    return next(req);
  }

  return next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }));
};
