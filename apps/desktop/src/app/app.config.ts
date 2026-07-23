import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withViewTransitions } from '@angular/router';
import { skipInitialRouteTransition } from './core/route-transition.util';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideApi } from '@mcp-bridge/ui-client';
import { appRoutes } from './app.routes';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { authInterceptor } from './core/auth/auth.interceptor';
import { authExpiryInterceptor } from './core/auth/auth-expiry.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Route-transition animations — see the `::view-transition-*` rules in
    // libs/ui/styles/styles.css for the actual enter/exit animation; this
    // just tells the router to wrap each navigation in
    // `document.startViewTransition()` so those rules get a chance to run.
    provideRouter(appRoutes, withViewTransitions({ onViewTransitionCreated: skipInitialRouteTransition })),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, authExpiryInterceptor])),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: '/i18n/',
        suffix: '.json?hash=' + Date.now(),
      }),
      fallbackLang: 'en',
      lang: 'en',
    }),
    // Points the generated client at the backend. In production this should
    // come from an environment file rather than being hardcoded.
    provideApi('/api'),
  ],
};
