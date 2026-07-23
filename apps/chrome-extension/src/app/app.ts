import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from './core/settings.service';
import { BackgroundBridgeService } from './core/background-bridge.service';

/**
 * The extension popup. There is deliberately no login form here — the
 * desktop app (running as a plain web page) hands its session over
 * directly via `content-script.ts` the moment the user is logged in there
 * (see `AgentBridgeService`), so this popup only needs to: configure which
 * backend to point at, show whether a session has been linked, and expose a
 * manual connect/disconnect override plus a live status readout.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="w-80 bg-primary p-4 text-text-primary">
      <div class="flex items-center gap-2">
        <img src="logo-no-text.png" alt="" class="h-6 w-6" />
        <h1 class="text-sm font-semibold">MCP Loop Agent</h1>
      </div>

      <div class="mt-4">
        <label for="backendUrl" class="mb-1 block text-xs font-medium text-text-secondary">Backend URL</label>
        <div class="flex gap-2">
          <input
            id="backendUrl"
            type="text"
            [(ngModel)]="backendUrlInput"
            placeholder="http://localhost:3000"
            class="w-full rounded-lg border border-border-default bg-primary-2 px-2.5 py-1.5 text-xs text-text-primary"
          />
          <button
            type="button"
            (click)="saveBackendUrl()"
            class="press-feedback shrink-0 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            Save
          </button>
        </div>
        <p class="mt-1 text-[11px] text-text-muted">Where the tunnel connects — must match the account's backend.</p>
      </div>

      <div class="mt-4 rounded-lg border border-border-default bg-primary-2 px-2.5 py-2 text-xs">
        @if (settings.hasSession()) {
          <span class="inline-flex items-center gap-1.5 text-success-text">
            <span class="h-1.5 w-1.5 rounded-full bg-success-muted"></span>
            Linked to a dashboard session
          </span>
        } @else {
          <span class="inline-flex items-center gap-1.5 text-text-muted">
            <span class="h-1.5 w-1.5 rounded-full bg-text-disabled"></span>
            Not linked — open the MCP Loop dashboard and log in
          </span>
        }
      </div>

      <div class="mt-3 flex items-center gap-2 rounded-lg border border-border-default bg-primary-2 px-2.5 py-2 text-xs">
        <span
          class="h-2 w-2 shrink-0 rounded-full transition-colors duration-300"
          [class.bg-success-muted]="bridge.status() === 'connected'"
          [class.animate-glow-pulse]="bridge.status() === 'connected'"
          [class.bg-warn-muted]="bridge.status() === 'connecting'"
          [class.animate-pulse]="bridge.status() === 'connecting'"
          [class.bg-error-muted]="bridge.status() === 'error'"
          [class.bg-text-disabled]="bridge.status() === 'disconnected'"
        ></span>
        <span class="text-text-secondary">{{ bridge.status() }}</span>
        @if (settings.hasSession()) {
          <button
            type="button"
            (click)="toggleConnection()"
            class="press-feedback ml-auto rounded-lg border border-border-default px-2.5 py-1 text-xs font-medium hover:bg-primary"
          >
            {{ bridge.status() === 'disconnected' || bridge.status() === 'error' ? 'Connect' : 'Disconnect' }}
          </button>
        }
      </div>

      <p class="mt-3 text-[11px] text-text-muted">
        Normally managed automatically while a MCP Loop dashboard tab is open — this toggle is a manual override.
      </p>

      <div class="mt-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">MCPs</p>
        <div class="mt-2 overflow-hidden rounded-lg border border-border-default">
          <table class="w-full text-left text-xs">
            <thead class="bg-primary-2 text-[11px] uppercase tracking-wide text-text-muted">
              <tr>
                <th class="px-2.5 py-1.5 font-medium">Name</th>
                <th class="px-2.5 py-1.5 font-medium">Local address</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle bg-primary-2">
              @for (mcp of settings.mcps(); track mcp.name) {
                <tr>
                  <td class="truncate px-2.5 py-1.5 font-medium">{{ mcp.name }}</td>
                  <td class="whitespace-nowrap px-2.5 py-1.5 text-text-muted">localhost:{{ mcp.port }}{{ mcp.subPath || '' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="2" class="px-2.5 py-3 text-center text-text-muted">No MCPs yet — add one in the dashboard.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: ``,
})
export class App implements OnInit {
  protected readonly settings = inject(SettingsService);
  protected readonly bridge = inject(BackgroundBridgeService);

  protected backendUrlInput = '';

  async ngOnInit(): Promise<void> {
    await this.settings.ready();
    this.backendUrlInput = this.settings.backendUrl();
  }

  protected async saveBackendUrl(): Promise<void> {
    if (!this.backendUrlInput) return;
    await this.settings.setBackendUrl(this.backendUrlInput);
  }

  protected async toggleConnection(): Promise<void> {
    if (this.bridge.status() === 'disconnected' || this.bridge.status() === 'error') {
      await this.bridge.reconnect();
    } else {
      await this.bridge.disconnect();
    }
  }
}
