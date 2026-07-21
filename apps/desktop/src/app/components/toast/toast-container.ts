import { Component, inject } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroCheckCircle, heroExclamationCircle, heroInformationCircle, heroXMark } from '@ng-icons/heroicons/outline';
import { ToastService } from '../../core/toast/toast.service';

/**
 * Global toast stack, mounted once in `app.ts` so it floats above every
 * route. Each toast slides in from the right and auto-dismisses (see
 * `ToastService`); the close button dismisses it early.
 */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [NgIconComponent],
  viewProviders: [provideIcons({ heroCheckCircle, heroExclamationCircle, heroInformationCircle, heroXMark })],
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-end gap-2 p-4">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="animate-slide-in-right pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-xl border p-3 shadow-depth-lg backdrop-blur-sm"
          [class.border-success-border]="toast.type === 'success'"
          [class.bg-success-bg]="toast.type === 'success'"
          [class.border-error-border]="toast.type === 'error'"
          [class.bg-error-bg]="toast.type === 'error'"
          [class.border-border-default]="toast.type === 'info'"
          [class.bg-primary-2]="toast.type === 'info'"
        >
          <ng-icon
            [name]="toast.type === 'success' ? 'heroCheckCircle' : toast.type === 'error' ? 'heroExclamationCircle' : 'heroInformationCircle'"
            class="mt-0.5 h-4 w-4 shrink-0"
            [class.text-success-text]="toast.type === 'success'"
            [class.text-error-text]="toast.type === 'error'"
            [class.text-text-secondary]="toast.type === 'info'"
          />
          <p
            class="min-w-0 flex-1 text-sm"
            [class.text-success-text]="toast.type === 'success'"
            [class.text-error-text]="toast.type === 'error'"
            [class.text-text-primary]="toast.type === 'info'"
          >
            {{ toast.message }}
          </p>
          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="press-feedback -m-1 shrink-0 rounded-lg p-1 text-current opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <ng-icon name="heroXMark" class="h-3.5 w-3.5" />
          </button>
        </div>
      }
    </div>
  `,
  styles: ``,
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
