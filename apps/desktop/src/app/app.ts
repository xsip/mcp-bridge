import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ImageLightboxComponent } from '@mcp-loop/ui-components';
import { TitlebarComponent } from './components/titlebar/titlebar';
import { ToastContainerComponent } from './components/toast/toast-container';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog';

@Component({
  imports: [RouterOutlet, TitlebarComponent, ToastContainerComponent, ConfirmDialogComponent, ImageLightboxComponent],
  selector: 'app-root',
  template: `
    <div class="flex h-screen flex-col overflow-hidden">
      <app-titlebar />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <router-outlet></router-outlet>
      </div>
    </div>
    <app-toast-container />
    <app-confirm-dialog />
    <ui-image-lightbox [topOffsetPx]="36" />
  `,
  styles: ``,
})
export class App {
  protected title = 'desktop';
}
