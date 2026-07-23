import { Component, inject } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroMinus, heroSquare2Stack, heroStop, heroXMark } from '@ng-icons/heroicons/outline';
import { WindowControlsService } from '../../core/window/window-controls.service';

/**
 * Custom titlebar replacing the native one (the Electron window is created
 * with `frame: false` — see `main.js`). Only rendered inside Electron;
 * outside it (`nx serve desktop` as a plain web app) `isElectron` is false
 * and this renders nothing, same pattern as the sidenav's agent status.
 *
 * The bar itself is `.drag` (from `styles.css`, backed by
 * `-webkit-app-region: drag`) so the window can be dragged by it; the
 * button group is `.no-drag` so clicks reach the buttons instead of
 * starting a drag.
 */
@Component({
  selector: 'app-titlebar',
  standalone: true,
  imports: [NgIconComponent],
  viewProviders: [provideIcons({ heroMinus, heroSquare2Stack, heroStop, heroXMark })],
  template: `
    @if (windowControls.isElectron) {
      <header class="drag flex h-9 shrink-0 items-center justify-between bg-primary-2 pl-3 text-text-primary select-none">
        <div class="flex items-center gap-2">
          <img src="favicon.png" alt="" class="h-4 w-4" />
          <span class="text-xs font-semibold tracking-tight">MCP Loop</span>
        </div>

        <div class="no-drag flex h-full items-stretch">
          <button
            type="button"
            (click)="windowControls.minimize()"
            aria-label="Minimize"
            class="flex w-11 items-center justify-center text-text-secondary hover:bg-primary"
          >
            <ng-icon name="heroMinus" class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            (click)="windowControls.maximizeToggle()"
            [attr.aria-label]="windowControls.isMaximized() ? 'Restore' : 'Maximize'"
            class="flex w-11 items-center justify-center text-text-secondary hover:bg-primary"
          >
            <ng-icon [name]="windowControls.isMaximized() ? 'heroSquare2Stack' : 'heroStop'" class="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            (click)="windowControls.close()"
            aria-label="Close"
            class="flex w-11 items-center justify-center text-text-secondary hover:bg-error-bg hover:text-error-text"
          >
            <ng-icon name="heroXMark" class="h-3.5 w-3.5" />
          </button>
        </div>
      </header>
    }
  `,
  styles: ``,
})
export class TitlebarComponent {
  protected readonly windowControls = inject(WindowControlsService);
}
