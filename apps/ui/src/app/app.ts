import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavComponent } from './components/nav/nav';

@Component({
  imports: [RouterModule, NavComponent],
  selector: 'app-root',
  template: `
    <div class="min-h-screen bg-primary text-secondary">
      <ui-nav />
      <main>
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: ``,
})
export class App {
  protected title = 'ui';
}
