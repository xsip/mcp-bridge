/**
 * The very first navigation after app boot is actually two navigations in
 * quick succession — the initial `''` and the `redirectTo: 'mcps'` (or
 * `/login`) it immediately resolves to (see `app.routes.ts`). Animating that
 * pair races two `startViewTransition()` calls against each other and the
 * second aborts the first with a harmless-but-noisy
 * `InvalidStateError: Transition was aborted because of invalid state` in
 * the console. There's no real "previous page" to transition away from on
 * first load anyway, so just skip the first transition outright — every
 * navigation after that (the actual mcps/logs/marketplace/... switches this
 * feature is for) animates normally.
 */
let isFirstNavigation = true;

export function skipInitialRouteTransition({ transition }: { transition: { skipTransition(): void } }): void {
  if (isFirstNavigation) {
    isFirstNavigation = false;
    transition.skipTransition();
  }
}
