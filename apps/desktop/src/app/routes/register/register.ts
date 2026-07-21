import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { AuthStore } from '../../core/auth/auth.store';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="flex min-h-full items-center justify-center bg-primary px-6">
      <div class="w-full max-w-sm animate-pop-in rounded-2xl border border-border-default bg-primary-2 p-8 shadow-depth-lg">
        @if (authStore.pendingActivation()) {
          <h1 class="text-lg font-semibold text-text-primary">{{ 'auth.register.checkEmailTitle' | translate }}</h1>
          <p class="mt-2 text-sm text-text-secondary">{{ 'auth.register.checkEmailBody' | translate }}</p>
          <a routerLink="/login" class="mt-6 inline-block text-sm font-semibold text-accent hover:underline">{{ 'auth.backToLogin' | translate }}</a>
        } @else {
          <h1 class="text-lg font-semibold text-text-primary">{{ 'auth.register.title' | translate }}</h1>
          <p class="mt-1 text-sm text-text-secondary">{{ 'auth.register.subtitle' | translate }}</p>

          <form class="mt-6 space-y-4" (ngSubmit)="submit()">
            <div>
              <label for="username" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'auth.username' | translate }}</label>
              <input
                id="username"
                name="username"
                type="text"
                autocomplete="username"
                required
                pattern="[a-z0-9_]+"
                [(ngModel)]="username"
                class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
              />
              <p class="mt-1 text-xs text-text-muted">{{ 'auth.register.usernameHint' | translate }}</p>
            </div>

            <div>
              <label for="password" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'auth.password' | translate }}</label>
              <input
                id="password"
                name="password"
                type="password"
                autocomplete="new-password"
                required
                minlength="8"
                [(ngModel)]="password"
                class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
              />
            </div>

            <div>
              <label for="registerSecret" class="mb-1 block text-xs font-medium text-text-secondary">
                {{ 'auth.register.secret' | translate }}
              </label>
              <input
                id="registerSecret"
                name="registerSecret"
                type="password"
                required
                [(ngModel)]="registerSecret"
                class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
              />
              <p class="mt-1 text-xs text-text-muted">{{ 'auth.register.secretHint' | translate }}</p>
            </div>

            @if (authStore.error(); as error) {
              <p class="animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
            }

            <button
              type="submit"
              [disabled]="authStore.isLoading()"
              class="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white shadow-depth-sm hover-lift press-feedback disabled:opacity-60"
            >
              {{ (authStore.isLoading() ? 'auth.register.submitting' : 'auth.register.submit') | translate }}
            </button>
          </form>

          <p class="mt-6 text-center text-sm text-text-secondary">
            {{ 'auth.register.haveAccount' | translate }}
            <a routerLink="/login" class="font-semibold text-accent hover:underline">{{ 'auth.backToLogin' | translate }}</a>
          </p>
        }
      </div>
    </div>
  `,
  styles: ``,
})
export class Register {
  protected readonly authStore = inject(AuthStore);

  protected username = '';
  protected password = '';
  protected registerSecret = '';

  protected submit(): void {
    if (!this.username || !this.password || !this.registerSecret) return;
    this.authStore.register({ username: this.username, password: this.password, registerSecret: this.registerSecret });
  }
}
