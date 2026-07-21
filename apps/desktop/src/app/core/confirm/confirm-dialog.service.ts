import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as destructive (red) — use for irreversible deletions. */
  danger?: boolean;
}

interface ConfirmRequest {
  options: ConfirmOptions;
  resolve: (confirmed: boolean) => void;
}

/**
 * Promise-based replacement for `window.confirm()`, rendered by
 * `ConfirmDialogComponent` (mounted once in `app.ts`) so it matches the rest
 * of the app's design instead of the native browser dialog. Only one
 * confirmation can be pending at a time — a second call while one is open
 * would be a bug in the caller, not a case to design for.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  readonly request = signal<ConfirmRequest | null>(null);

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.request.set({ options, resolve });
    });
  }

  respond(confirmed: boolean): void {
    const current = this.request();
    if (!current) return;
    this.request.set(null);
    current.resolve(confirmed);
  }
}
