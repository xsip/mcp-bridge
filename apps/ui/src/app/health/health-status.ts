import { Component, inject, signal } from '@angular/core';
import { HealthService } from '@mcp-loop/ui-client';

@Component({
  selector: 'app-health-status',
  template: `
    <div class="rounded-lg border bg-primary-2 p-4">
      <h2 class="text-sm font-medium text-slate-400">Backend status</h2>
      @if (status(); as value) {
        <p class="mt-1 text-2xl font-semibold text-emerald-400">{{ value }}</p>
      } @else if (error()) {
        <p class="mt-1 text-2xl font-semibold text-rose-400">unreachable</p>
      } @else {
        <p class="mt-1 text-2xl font-semibold text-slate-500">checking…</p>
      }
    </div>
  `,
  styles: ``,
})
export class HealthStatus {
  private readonly healthService = inject(HealthService);

  protected readonly status = signal<string | null>(null);
  protected readonly error = signal(false);

  constructor() {
    this.healthService.healthControllerCheck().subscribe({
      next: (response) => this.status.set(response?.status ?? 'ok'),
      error: () => this.error.set(true),
    });
  }
}
