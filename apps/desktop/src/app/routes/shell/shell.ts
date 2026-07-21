import {Component, DestroyRef, inject, signal} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidenavComponent } from '../../components/sidenav/sidenav';
import {BlobBackgroundDirective} from "../../directives/blob-background.directive";

/**
 * Authenticated app shell: sidenav + routed content (MCPS / Logs).
 *
 * The outer container is a fixed `h-full` (not `min-h-screen` — that lets
 * it grow past its available space instead of clipping it) with
 * `overflow-hidden`, so `<main>`'s own `overflow-y-auto` is what scrolls,
 * not the whole page. `h-full` (rather than `h-screen`) fills whatever
 * space `<app-root>` leaves it below the titlebar, instead of assuming it
 * owns the whole viewport.
 */
@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, SidenavComponent, BlobBackgroundDirective],
  template: `
    <div appBlobBackground class="flex h-full overflow-hidden bg-primary text-secondary">
      <ui-sidenav [smallMode]="smallMode()" />
      <main class="flex-1 overflow-y-auto p-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: ``,
})
export class Shell {
  private destroyRef = inject(DestroyRef);

  private mediaQuery = window.matchMedia('(min-width: 640px)');
  smallMode = signal<boolean>(this.mediaQuery.matches);
  constructor() {
    this.smallMode.set(!this.mediaQuery.matches);
    const listener = (e: MediaQueryListEvent) => {
      this.smallMode.set(!e.matches);
    };

    this.mediaQuery.addEventListener('change', listener);

    this.destroyRef.onDestroy(() => {
      this.mediaQuery.removeEventListener('change', listener);
    });
  }
}
