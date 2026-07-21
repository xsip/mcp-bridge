import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/** Protects the authenticated shell (MCPs/Logs) — redirects to /login if there's no session. */
export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  if (authStore.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/login']);
};

/** Keeps an already-logged-in user off /login and /register — sends them straight to the shell. */
export const guestGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  if (!authStore.isAuthenticated()) {
    return true;
  }
  return inject(Router).createUrlTree(['/mcps']);
};
