import { Route } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';

export const appRoutes: Route[] = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./routes/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./routes/register/register').then((m) => m.Register),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./routes/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'mcps' },
      { path: 'mcps', loadComponent: () => import('./routes/mcps/mcps').then((m) => m.Mcps) },
      { path: 'logs', loadComponent: () => import('./routes/logs/logs').then((m) => m.Logs) },
      { path: 'auth-keys', loadComponent: () => import('./routes/api-keys/api-keys').then((m) => m.ApiKeys) },
      { path: 'marketplace', loadComponent: () => import('./routes/marketplace/marketplace').then((m) => m.Marketplace) },
      {
        path: 'marketplace/publish',
        loadComponent: () => import('./routes/marketplace-publish/marketplace-publish').then((m) => m.MarketplacePublish),
      },
      {
        path: 'marketplace/my-releases',
        loadComponent: () =>
          import('./routes/marketplace-my-releases/marketplace-my-releases').then((m) => m.MarketplaceMyReleases),
      },
      {
        path: 'marketplace/installed',
        loadComponent: () =>
          import('./routes/marketplace-installed/marketplace-installed').then((m) => m.MarketplaceInstalled),
      },
      {
        // Must stay after the literal marketplace/* routes above — Angular matches in array order, and
        // ':id' would otherwise shadow 'publish'/'my-releases'/'installed'.
        path: 'marketplace/:id',
        loadComponent: () => import('./routes/marketplace-detail/marketplace-detail').then((m) => m.MarketplaceDetail),
      },
      { path: 'settings', loadComponent: () => import('./routes/settings/settings').then((m) => m.Settings) },
    ],
  },
  { path: '**', redirectTo: '' },
];
