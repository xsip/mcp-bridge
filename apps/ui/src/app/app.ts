import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ImageLightboxComponent } from '@mcp-loop/ui-components';
import { NavComponent } from './components/nav/nav';

@Component({
  imports: [RouterModule, NavComponent, ImageLightboxComponent],
  selector: 'app-root',
  template: `
    <div class="min-h-screen bg-primary text-secondary">
      <ui-nav />
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
    <ui-image-lightbox />
  `,
  styles: ``,
})
export class App {
  protected title = 'ui';
}
