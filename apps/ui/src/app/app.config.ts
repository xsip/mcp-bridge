import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import {provideHttpClient, withFetch} from '@angular/common/http';
import { provideApi } from '@mcp-bridge/ui-client';
import { appRoutes } from './app.routes';
import {provideTranslateService} from "@ngx-translate/core";
import {provideTranslateHttpLoader} from "@ngx-translate/http-loader";

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(appRoutes),
    provideHttpClient(withFetch()),
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
