import {Component, DestroyRef, inject, signal} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SidenavComponent } from '../../components/sidenav/sidenav';
import {BlobBackgroundDirective} from "../../directives/blob-background.directive";
import { McpsStore } from '../../core/mcps/mcps.store';

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
      <main class="route-transition-content flex-1 overflow-y-auto p-8">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: ``,
})
export class Shell {
  private destroyRef = inject(DestroyRef);

  // McpsStore is `providedIn: 'root'` (tree-shakable/lazy) — without this,
  // it's only ever constructed (and its `onInit` effect that pushes the
  // active MCP list to the tunnel starts running) once the user actually
  // visits the MCPs route. Injecting it here, in the shell every
  // authenticated route mounts under, means the tunnel gets the real MCP
  // list immediately after login/refresh regardless of which tab is open.
  private readonly mcpsStore = inject(McpsStore);

  private mediaQuery = window.matchMedia('(min-width: 640px)');
  smallMode = signal<boolean>(this.mediaQuery.matches);
  constructor() {
    this.mcpsStore.load();
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
