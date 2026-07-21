import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

const DEFAULT_DURATION_MS = 3500;
const ERROR_DURATION_MS = 5500;

/**
 * Global toast queue, rendered by `ToastContainerComponent` (mounted once in
 * `app.ts`). Used for transient confirmations of an action that already
 * happened (MCP added/updated/removed, logs deleted, API key
 * created/revoked, ...) — as opposed to the inline error banners already on
 * each route, which stay for validation-style errors tied to a specific
 * form/action still on screen.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;

  show(message: string, type: ToastType = 'info', durationMs = DEFAULT_DURATION_MS): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, type, message }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error', ERROR_DURATION_MS);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }
}
