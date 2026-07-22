import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { CustomMcpDto } from '@mcp-bridge/ui-client';
import { heroCheck, heroPencilSquare, heroPlus, heroTrash, heroXMark } from '@ng-icons/heroicons/outline';
import { McpsStore } from '../../core/mcps/mcps.store';
import { CheckboxComponent } from '@mcp-bridge/ui-components';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';

/**
 * "MCPS" route — lets the user configure the local MCP servers their
 * desktop agent exposes: add one (name + port, optionally a sub-path when
 * the local server isn't listening at the port's root), toggle it
 * active/inactive, or remove it.
 */
@Component({
  selector: 'app-mcps',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, NgIconComponent, CheckboxComponent],
  viewProviders: [provideIcons({ heroPlus, heroTrash, heroPencilSquare, heroCheck, heroXMark })],
  template: `
    <div class="mx-auto max-w-3xl animate-slide-up">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'mcps.title' | translate }}</h1>
          <p class="mt-1 text-sm text-text-secondary">{{ 'mcps.subtitle' | translate }}</p>
        </div>
      </div>

      <!-- Add form -->
      <form
        class="mt-6 flex md:flex-row flex-col flex-wrap items-end gap-3 rounded-2xl border border-border-default bg-primary-2 p-4 shadow-depth-sm transition-shadow hover:shadow-depth-md"
        (ngSubmit)="submitAdd()"
      >
        <div class="md:min-w-0 w-full flex-1">
          <label for="name" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'mcps.name' | translate }}</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            pattern="[a-z0-9][a-z0-9-]*"
            placeholder="notes"
            [(ngModel)]="newName"
            class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <div class="md:w-28 w-full flex-1">
          <label for="port" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'mcps.port' | translate }}</label>
          <input
            id="port"
            name="port"
            type="number"
            required
            min="1"
            max="65535"
            placeholder="3333"
            [(ngModel)]="newPort"
            class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <div class="md:min-w-0 w-full flex-1">
          <label for="subPath" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'mcps.subPath' | translate }}</label>
          <input
            id="subPath"
            name="subPath"
            type="text"
            pattern="/?[a-zA-Z0-9_/-]*"
            placeholder="/api/mcp"
            [(ngModel)]="newSubPath"
            class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
          />
        </div>
        <button
          type="submit"
          [disabled]="mcpsStore.status() === 'loading'"
          class="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-depth-sm hover-lift press-feedback disabled:opacity-60"
        >
          <ng-icon name="heroPlus" class="h-4 w-4" />
          {{ 'mcps.add' | translate }}
        </button>
      </form>

      @if (mcpsStore.error(); as error) {
        <p class="mt-3 animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
      }

      <!-- List -->
      <ul class="mt-6 space-y-3 stagger-children">
        @for (mcp of mcpsStore.items(); track mcp.id) {
          <li class="msg-enter hover-lift rounded-2xl border border-border-default bg-primary-2 p-4">
            @if (editingId() === mcp.id) {
              <!-- Edit form -->
              <form class="flex flex-wrap items-end gap-3 animate-slide-down" (ngSubmit)="submitEdit(mcp.id)">
                <div class="min-w-0 flex-1">
                  <label class="mb-1 block text-xs font-medium text-text-secondary">{{ 'mcps.name' | translate }}</label>
                  <input
                    type="text"
                    disabled
                    [value]="mcp.name"
                    class="w-full cursor-not-allowed rounded-lg border border-border-default bg-primary-2 px-3 py-2 text-sm text-text-muted"
                  />
                </div>
                <div class="w-28">
                  <label class="mb-1 block text-xs font-medium text-text-secondary">{{ 'mcps.port' | translate }}</label>
                  <input
                    type="number"
                    required
                    min="1"
                    max="65535"
                    [(ngModel)]="editPort"
                    name="editPort"
                    class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <label class="mb-1 block text-xs font-medium text-text-secondary">{{ 'mcps.subPath' | translate }}</label>
                  <input
                    type="text"
                    pattern="/?[a-zA-Z0-9_/-]*"
                    placeholder="/api/mcp"
                    [(ngModel)]="editSubPath"
                    name="editSubPath"
                    class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary focus:shadow-glow-accent focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  [disabled]="mcpsStore.status() === 'loading'"
                  class="press-feedback inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-white shadow-depth-sm hover-lift disabled:opacity-60"
                  [attr.aria-label]="'mcps.save' | translate"
                >
                  <ng-icon name="heroCheck" class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  (click)="cancelEdit()"
                  class="press-feedback inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-primary"
                  [attr.aria-label]="'mcps.cancel' | translate"
                >
                  <ng-icon name="heroXMark" class="h-4 w-4" />
                </button>
              </form>
            } @else {
              <div class="flex md:flex-row flex-col md:items-center items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-text-primary">{{ mcp.name }}</p>
                  <p class="text-xs text-text-muted">localhost:{{ mcp.port }}{{ mcp.subPath || '' }}</p>
                </div>

                <div class="flex shrink-0 items-center gap-2 md:w-auto w-full justify-end">
                  <div
                    (click)="toggleActive(mcp)"
                    class="inline-flex cursor-pointer items-center gap-2 text-xs text-text-secondary"
                  >
                    <ui-checkbox
                      [checked]="mcp.active"
                      (checkedChange)="toggleActive(mcp)"
                      [ariaLabel]="(mcp.active ? 'mcps.active' : 'mcps.inactive') | translate"
                    />
                    {{ (mcp.active ? 'mcps.active' : 'mcps.inactive') | translate }}
                  </div>

                  <a
                    routerLink="/logs"
                    [queryParams]="{ mcpId: mcp.id }"
                    class="rounded-lg px-2 py-1.5 text-xs font-medium text-text-secondary hover:bg-accent-subtle hover:text-accent"
                  >
                    {{ 'mcps.viewLogs' | translate }}
                  </a>

                  <button
                    type="button"
                    (click)="startEdit(mcp)"
                    class="press-feedback inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-accent-subtle hover:text-accent"
                    [attr.aria-label]="'mcps.edit' | translate"
                  >
                    <ng-icon name="heroPencilSquare" class="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    (click)="removeMcp(mcp)"
                    class="press-feedback inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-error-bg hover:text-error-text"
                    [attr.aria-label]="'mcps.remove' | translate"
                  >
                    <ng-icon name="heroTrash" class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            }
          </li>
        } @empty {
          <li class="animate-fade-in rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
            {{ 'mcps.empty' | translate }}
          </li>
        }
      </ul>
    </div>
  `,
  styles: ``,
})
export class Mcps implements OnInit {
  protected readonly mcpsStore = inject(McpsStore);
  private readonly translate = inject(TranslateService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected newName = '';
  protected newPort: number | null = null;
  protected newSubPath = '';

  protected readonly editingId = signal<string | null>(null);
  protected editPort: number | null = null;
  protected editSubPath = '';

  ngOnInit(): void {
    this.mcpsStore.load();
  }

  protected submitAdd(): void {
    if (!this.newName || !this.newPort) return;
    this.mcpsStore.add({ name: this.newName, port: this.newPort, subPath: this.newSubPath || undefined });
    this.newName = '';
    this.newPort = null;
    this.newSubPath = '';
  }

  protected toggleActive(mcp: { id: string; active: boolean }): void {
    this.mcpsStore.update({ id: mcp.id, dto: { active: !mcp.active }, silent: true });
  }

  protected startEdit(mcp: CustomMcpDto): void {
    this.editingId.set(mcp.id);
    this.editPort = mcp.port;
    this.editSubPath = mcp.subPath || '';
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected submitEdit(id: string): void {
    if (!this.editPort) return;
    this.mcpsStore.update({ id, dto: { port: this.editPort, subPath: this.editSubPath || '' } });
    this.editingId.set(null);
  }

  protected async removeMcp(mcp: CustomMcpDto): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('mcps.confirmRemoveTitle'),
      message: this.translate.instant('mcps.confirmRemove', { name: mcp.name }),
      confirmLabel: this.translate.instant('mcps.remove'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    this.mcpsStore.remove(mcp.id);
  }
}
