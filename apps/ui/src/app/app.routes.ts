import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () => import('./routes/landing/landing').then((m) => m.Landing),
  },
];
