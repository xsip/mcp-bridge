import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="flex min-h-full items-center justify-center bg-primary px-6">
      <div class="w-full max-w-sm animate-pop-in rounded-2xl border border-border-default bg-primary-2 p-8 shadow-depth-lg">
        <h1 class="text-lg font-semibold text-text-primary">{{ 'auth.login.title' | translate }}</h1>
        <p class="mt-1 text-sm text-text-secondary">{{ 'auth.login.subtitle' | translate }}</p>

        <form class="mt-6 space-y-4" (ngSubmit)="submit()">
          <div>
            <label for="username" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'auth.username' | translate }}</label>
            <input
              id="username"
              name="username"
              type="text"
              autocomplete="username"
              required
              [(ngModel)]="username"
              class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
            />
          </div>

          <div>
            <label for="password" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'auth.password' | translate }}</label>
            <input
              id="password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              [(ngModel)]="password"
              class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
            />
          </div>

          @if (authStore.error(); as error) {
            <p class="animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
          }

          <button
            type="submit"
            [disabled]="authStore.isLoading()"
            class="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-depth-sm hover-lift press-feedback disabled:opacity-60"
          >
            {{ (authStore.isLoading() ? 'auth.login.submitting' : 'auth.login.submit') | translate }}
          </button>
        </form>

        <p class="mt-6 text-center text-sm text-text-secondary">
          {{ 'auth.login.noAccount' | translate }}
          <a routerLink="/register" class="font-semibold text-accent hover:underline">{{ 'auth.registerNow' | translate }}</a>
        </p>
      </div>
    </div>
  `,
  styles: ``,
})
export class Login {
  protected readonly authStore = inject(AuthStore);

  protected username = '';
  protected password = '';

  protected submit(): void {
    if (!this.username || !this.password) return;
    this.authStore.login({ username: this.username, password: this.password });
  }
}
