import { Component, OnInit, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroClipboard, heroKey, heroPlus, heroTrash } from '@ng-icons/heroicons/outline';
import { ApiKeysStore } from '../../core/api-keys/api-keys.store';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';

/**
 * "API Keys" route — generate long-lived credentials for authenticating
 * `/mcp/:mcpId` proxy calls from outside the desktop app (ChatGPT, curl,
 * etc.), and revoke ones no longer needed. The raw key is only ever shown
 * once, right after `create()` — see `ApiKeysStore.justCreated`.
 */
@Component({
  selector: 'app-api-keys',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent, DatePipe],
  viewProviders: [provideIcons({ heroPlus, heroTrash, heroKey, heroClipboard })],
  template: `
    <div class="animate-slide-up">
      <div class="glass sticky -top-8 z-20 -mx-8 -mt-8 border-x-0 border-t-0 border-b-border-glass px-8 pb-4 pt-8 shadow-depth-sm">
        <div class="mx-auto max-w-3xl">
          <h1 class="text-xl font-semibold text-text-primary">{{ 'apiKeys.title' | translate }}</h1>
          <p class="mt-1 text-sm text-text-secondary">{{ 'apiKeys.subtitle' | translate }}</p>
        </div>
      </div>

      <div class="mx-auto max-w-3xl">
      @if (apiKeysStore.justCreated(); as created) {
        <div class="animate-bounce-in mt-6 rounded-2xl border border-accent/40 bg-accent-subtle p-4 shadow-glow-accent">
          <p class="text-sm font-semibold text-accent-text">{{ 'apiKeys.createdTitle' | translate }}</p>
          <p class="mt-1 text-xs text-accent-text">{{ 'apiKeys.createdHint' | translate }}</p>
          <div class="mt-3 flex items-center gap-2">
            <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-border-default bg-primary px-3 py-2 text-xs text-text-primary">{{
              created.key
            }}</code>
            <button
              type="button"
              (click)="copyKey(created.key)"
              class="press-feedback inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary hover:bg-primary-2"
            >
              <ng-icon name="heroClipboard" class="h-3.5 w-3.5" />
              {{ 'apiKeys.copy' | translate }}
            </button>
          </div>
          <button type="button" (click)="apiKeysStore.dismissCreated()" class="mt-3 text-xs font-medium text-accent hover:underline">
            {{ 'apiKeys.dismiss' | translate }}
          </button>
        </div>
      }

      <!-- Add form -->
      <form
        class="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-border-default bg-primary-2 p-4 shadow-depth-sm transition-shadow hover:shadow-depth-md"
        (ngSubmit)="submitCreate()"
      >
        <div class="min-w-0 flex-1">
          <label for="name" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'apiKeys.name' | translate }}</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            placeholder="CI server"
            [(ngModel)]="newName"
            class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          [disabled]="apiKeysStore.status() === 'loading'"
          class="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-depth-sm hover-lift press-feedback disabled:opacity-60"
        >
          <ng-icon name="heroPlus" class="h-4 w-4" />
          {{ 'apiKeys.generate' | translate }}
        </button>
      </form>

      @if (apiKeysStore.error(); as error) {
        <p class="mt-3 animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
      }

      <!-- List -->
      <ul class="mt-6 space-y-3 stagger-children">
        @for (key of apiKeysStore.items(); track key.id) {
          <li class="msg-enter  {{key.revokedAt ? 'opacity-70! ': 'hover-lift'}} rounded-2xl border border-border-default bg-primary-2 p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-text-primary">{{ key.name }}</p>
                <p class="font-mono text-xs text-text-muted">{{ key.prefix }}…</p>
                <p class="mt-0.5 text-xs text-text-muted">
                  {{ 'apiKeys.created' | translate }} {{ key.createdAt | date: 'medium' }}
                  @if (key.lastUsedAt) {
                    · {{ 'apiKeys.lastUsed' | translate }} {{ key.lastUsedAt | date: 'medium' }}
                  }
                </p>
              </div>

              <div class="flex shrink-0 items-center gap-2">
                @if (key.revokedAt) {
                  <span class="animate-pop-in rounded-lg bg-error-bg px-2 py-1 text-xs font-medium text-error-text">{{ 'apiKeys.revoked' | translate }}</span>
                } @else {
                  <button
                    type="button"
                    (click)="revoke(key.id)"
                    class="press-feedback inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-error-bg hover:text-error-text"
                    [attr.aria-label]="'apiKeys.revoke' | translate"
                  >
                    <ng-icon name="heroTrash" class="h-3.5 w-3.5" />
                  </button>
                }
              </div>
            </div>
          </li>
        } @empty {
          <li class="animate-fade-in rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
            {{ 'apiKeys.empty' | translate }}
          </li>
        }
      </ul>
      </div>
    </div>
  `,
  styles: ``,
})
export class ApiKeys implements OnInit {
  protected readonly apiKeysStore = inject(ApiKeysStore);
  private readonly translate = inject(TranslateService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected newName = '';

  ngOnInit(): void {
    this.apiKeysStore.refresh();
  }

  protected submitCreate(): void {
    if (!this.newName) return;
    this.apiKeysStore.create({ name: this.newName });
    this.newName = '';
  }

  protected async revoke(id: string): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('apiKeys.confirmRevokeTitle'),
      message: this.translate.instant('apiKeys.confirmRevoke'),
      confirmLabel: this.translate.instant('apiKeys.revoke'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    this.apiKeysStore.revoke(id);
  }

  protected copyKey(key: string): void {
    void navigator.clipboard?.writeText(key);
  }
}
