import { Component, inject } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroExclamationTriangle } from '@ng-icons/heroicons/outline';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';

/**
 * Custom-designed replacement for `window.confirm()`, mounted once in
 * `app.ts`. Renders whatever `ConfirmDialogService.request()` currently
 * holds — nothing when no confirmation is pending. Backdrop click and Esc
 * both cancel, matching native `confirm()` semantics (dismissing = "no").
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [NgIconComponent],
  viewProviders: [provideIcons({ heroExclamationTriangle })],
  host: {
    '(document:keydown.escape)': 'confirmDialog.respond(false)',
  },
  template: `
    @if (confirmDialog.request(); as request) {
      <div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" (click)="confirmDialog.respond(false)">
        <div
          class="animate-pop-in w-full max-w-sm rounded-2xl border border-border-default bg-primary-2 p-6 shadow-depth-xl"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-start gap-3">
            @if (request.options.danger) {
              <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error-bg text-error-text">
                <ng-icon name="heroExclamationTriangle" class="h-5 w-5" />
              </span>
            }
            <div class="min-w-0">
              <h2 class="text-sm font-semibold text-text-primary">{{ request.options.title }}</h2>
              <p class="mt-1.5 text-sm text-text-secondary">{{ request.options.message }}</p>
            </div>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button
              type="button"
              (click)="confirmDialog.respond(false)"
              class="press-feedback rounded-lg border border-border-default px-3.5 py-2 text-sm font-medium text-text-secondary hover:bg-primary"
            >
              {{ request.options.cancelLabel }}
            </button>
            <button
              type="button"
              (click)="confirmDialog.respond(true)"
              class="press-feedback hover-lift rounded-lg px-3.5 py-2 text-sm font-semibold text-white shadow-depth-sm"
              [class.bg-error-text]="request.options.danger"
              [class.bg-accent]="!request.options.danger"
            >
              {{ request.options.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: ``,
})
export class ConfirmDialogComponent {
  protected readonly confirmDialog = inject(ConfirmDialogService);
}
