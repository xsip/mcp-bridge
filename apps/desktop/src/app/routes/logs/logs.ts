import { Component, OnDestroy, OnInit, effect, inject, signal } from '@angular/core';
import { DatePipe, JsonPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroCheckCircle, heroChevronDown, heroChevronRight, heroTrash, heroXCircle } from '@ng-icons/heroicons/outline';
import {distinctUntilChanged, map} from 'rxjs';
import { LogsStore } from '../../core/logs/logs.store';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';
import { CheckboxComponent } from '@mcp-bridge/ui-components';

/**
 * "Logs" route — every proxied request/response for the current user's
 * MCPs (or, with `?mcpId=`, just one of them — see the "View logs" link
 * on the MCPS route). Polls `GET /mcp/logs` (or `GET /mcp/:mcpId/logs`)
 * continuously while this route is active — see `LogsStore.startPolling()`
 * for why that's scheduled by the store itself rather than a fixed
 * `interval()` here. Rows expand to show the full request/response body;
 * entries are deletable one at a time, in bulk (selected rows), or entirely
 * (within the current filter).
 */
@Component({
  selector: 'app-logs',
  standalone: true,
  imports: [RouterLink, TranslatePipe, NgIconComponent, DatePipe, JsonPipe, CheckboxComponent],
  viewProviders: [provideIcons({ heroCheckCircle, heroXCircle, heroChevronDown, heroChevronRight, heroTrash })],
  template: `
    <div class="mx-auto max-w-5xl animate-slide-up">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold text-text-primary">{{ 'logs.title' | translate }}</h1>
          <p class="mt-1 text-sm text-text-secondary">
            {{ (mcpId() ? 'logs.subtitleFiltered' : 'logs.subtitle') | translate }}
          </p>
        </div>
        <div class="flex items-center gap-3 md:mb-0 mb-5">
          @if (mcpId()) {
            <a routerLink="/logs"
               class="text-xs font-medium text-accent hover:underline">{{ 'logs.clearFilter' | translate }}</a>
          }
          <button
            type="button"
            (click)="deleteAll()"
            class="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-error-border px-3 py-1.5 text-xs font-medium text-error-text hover:bg-error-bg"
          >
            <ng-icon name="heroTrash" class="h-3.5 w-3.5"/>
            {{ (mcpId() ? 'logs.deleteAllFiltered' : 'logs.deleteAll') | translate }}
          </button>
        </div>
      </div>

      @if (logsStore.error(); as error) {
        <p
          class="mt-3 animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
      }

      @if (logsStore.selectedIds().length > 0) {
        <div
          class="animate-slide-down mt-3 flex items-center justify-between rounded-lg border border-accent/40 bg-accent-subtle px-3 py-2 text-xs text-accent-text">
          <span>{{ 'logs.selectedCount' | translate: {count: logsStore.selectedIds().length} }}</span>
          <button type="button" (click)="deleteSelected()"
                  class="press-feedback inline-flex items-center gap-1.5 font-semibold hover:underline">
            <ng-icon name="heroTrash" class="h-3.5 w-3.5"/>
            {{ 'logs.deleteSelected' | translate }}
          </button>
        </div>
      }

      <div class=" hidden md:block mt-4 overflow-hidden rounded-2xl border border-border-default shadow-depth-sm">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-primary-2 text-xs uppercase tracking-wide text-text-muted">
            <tr>
              <th class="w-8 px-4 py-2.5">
                <ui-checkbox
                  [checked]="allOnPageSelected()"
                  (checkedChange)="logsStore.toggleSelectAllOnPage()"
                  [ariaLabel]="'logs.selectAll' | translate"
                />
              </th>
              <th class="w-6 px-2 py-2.5"></th>
              <th class="px-4 py-2.5 font-medium">{{ 'logs.time' | translate }}</th>
              <th class="px-4 py-2.5 font-medium">{{ 'logs.mcp' | translate }}</th>
              <th class="px-4 py-2.5 font-medium">{{ 'logs.request' | translate }}</th>
              <th class="px-4 py-2.5 font-medium">{{ 'logs.status' | translate }}</th>
              <th class="px-4 py-2.5 font-medium">{{ 'logs.duration' | translate }}</th>
              <th class="w-8 px-4 py-2.5"></th>
            </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle bg-primary">
              @for (entry of logsStore.items(); track entry.id) {
                <tr class="animate-fade-in cursor-pointer transition-colors hover:bg-primary-2"
                    (click)="toggleExpanded(entry.id)">
                  <td class="px-4 py-2.5" (click)="$event.stopPropagation()">
                    <ui-checkbox
                      [checked]="logsStore.selectedIds().includes(entry.id)"
                      (checkedChange)="logsStore.toggleSelected(entry.id)"
                    />
                  </td>
                  <td class="px-2 py-2.5 text-text-muted">
                    <ng-icon [name]="isExpanded(entry.id) ? 'heroChevronDown' : 'heroChevronRight'"
                             class="h-3.5 w-3.5"/>
                  </td>
                  <td class="whitespace-nowrap px-4 py-2.5 text-text-muted">{{ entry.timestamp | date: 'HH:mm:ss' }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-2.5 font-medium text-text-primary">{{ entry.mcpName }}</td>
                  <td class="px-4 py-2.5">
                    <span class="font-mono text-xs text-text-secondary">{{ entry.method }} {{ entry.path }}</span>
                    @if (rpcMethod(entry); as rpc) {
                      @if (rpc.method === 'tools/call') {
                        <span class="mt-1.5 mx-1.5 inline-flex items-center rounded-md bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent">{{ rpc.method }} ({{ rpc.name }})</span>

                      } @else {
                        <span
                          class="mt-1.5 inline-flex items-center rounded-md bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent">{{ rpc.method }}</span>
                      }}
                  </td>
                  <td class="whitespace-nowrap px-4 py-2.5">
                    @if (entry.ok) {
                      <span class="inline-flex items-center gap-1 text-success-text">
                        <ng-icon name="heroCheckCircle" class="h-3.5 w-3.5"/>
                        {{ entry.status }}
                      </span>
                    } @else {
                      <span class="inline-flex items-center gap-1 text-error-text" [title]="entry.errorMessage">
                        <ng-icon name="heroXCircle" class="h-3.5 w-3.5"/>
                        {{ 'logs.failed' | translate }}
                      </span>
                    }
                  </td>
                  <td class="whitespace-nowrap px-4 py-2.5 text-text-muted">{{ entry.durationMs }}ms</td>
                  <td class="px-4 py-2.5" (click)="$event.stopPropagation()">
                    <button
                      type="button"
                      (click)="logsStore.deleteOne(entry.id)"
                      class="press-feedback inline-flex h-6 w-6 items-center justify-center rounded-lg text-text-secondary hover:bg-error-bg hover:text-error-text"
                      [attr.aria-label]="'logs.deleteEntry' | translate"
                    >
                      <ng-icon name="heroTrash" class="h-3.5 w-3.5"/>
                    </button>
                  </td>
                </tr>
                @if (isExpanded(entry.id)) {
                  <tr class="animate-accordion-open bg-primary-2">
                    <td colspan="8" class="px-4 py-4">
                      <div class="grid gap-4 sm:grid-cols-2">
                        <div class="min-w-0">
                          <p
                            class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{{ 'logs.requestBody' | translate }}</p>
                          <pre
                            class="max-h-64 overflow-auto rounded-lg border border-border-default bg-primary p-3 font-mono text-xs text-text-secondary">{{
                              (entry.requestBody | json) || ('logs.noBody' | translate)
                            }}</pre>
                        </div>
                        <div class="min-w-0">
                          <p
                            class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{{ 'logs.responseBody' | translate }}</p>
                          <pre
                            class="max-h-64 overflow-auto rounded-lg border border-border-default bg-primary p-3 font-mono text-xs text-text-secondary">{{
                              (entry.responseBody | json) || ('logs.noBody' | translate)
                            }}</pre>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td colspan="8" class="px-4 py-8 text-center text-sm text-text-muted">{{ 'logs.empty' | translate }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mobile cards -->
      <div class="mt-4 space-y-3 stagger-children md:hidden">
        @for (entry of logsStore.items(); track entry.id) {
          <div class="msg-enter hover-lift rounded-2xl border border-border-default bg-primary-2 p-4 shadow-depth-sm">
            <!-- Header -->
            <div class="flex items-start justify-between gap-3">
              <div class="flex min-w-0 items-start gap-3">
                <ui-checkbox
                  [checked]="logsStore.selectedIds().includes(entry.id)"
                  (checkedChange)="logsStore.toggleSelected(entry.id)"
                  class="mt-1"
                />

                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-text-primary">{{ entry.mcpName }}</p>
                  <p class="text-xs text-text-muted">{{ entry.timestamp | date: 'HH:mm:ss' }}</p>
                </div>
              </div>

              <button
                type="button"
                (click)="logsStore.deleteOne(entry.id); $event.stopPropagation()"
                class="press-feedback inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-error-bg hover:text-error-text"
                [attr.aria-label]="'logs.deleteEntry' | translate"
              >
                <ng-icon name="heroTrash" class="h-3.5 w-3.5"/>
              </button>
            </div>

            <!-- Request -->
            <div class="mt-3">
              <p
                class="text-xs font-semibold uppercase tracking-wide text-text-muted">{{ 'logs.request' | translate }}</p>
              <p class="mt-1 break-all font-mono text-xs text-text-secondary">{{ entry.method }} {{ entry.path }}</p>
              @if (rpcMethod(entry); as rpc) {
                @if (rpc.method === 'tools/call') {
                    <span class="mt-1.5 inline-flex items-center rounded-md bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent">{{ rpc.method }} ({{ rpc.name }})</span>
                } @else {
                  <span
                    class="mt-1.5 inline-flex items-center rounded-md bg-accent-subtle px-1.5 py-0.5 font-mono text-[11px] font-medium text-accent">{{ rpc.method }}</span>
                }
              }
            </div>

            <!-- Status / Duration -->
            <div class="mt-3 flex items-center justify-between text-sm">
              @if (entry.ok) {
                <span class="inline-flex items-center gap-1 text-success-text">
                  <ng-icon name="heroCheckCircle" class="h-3.5 w-3.5"/>
                  {{ entry.status }}
                </span>
              } @else {
                <span class="inline-flex items-center gap-1 text-error-text" [title]="entry.errorMessage">
                  <ng-icon name="heroXCircle" class="h-3.5 w-3.5"/>
                  {{ 'logs.failed' | translate }}
                </span>
              }
              <span class="text-xs text-text-muted">{{ entry.durationMs }}ms</span>
            </div>

            <!-- Expand -->
            <button
              type="button"
              class="press-feedback mt-3 flex w-full items-center justify-between rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary hover:bg-primary"
              (click)="toggleExpanded(entry.id)"
            >
              {{ 'logs.requestBody' | translate }}
              <ng-icon [name]="isExpanded(entry.id) ? 'heroChevronDown' : 'heroChevronRight'" class="h-3.5 w-3.5"/>
            </button>

            @if (isExpanded(entry.id)) {
              <div class="animate-accordion-open mt-3 grid gap-3 overflow-hidden">
                <div class="min-w-0">
                  <p
                    class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{{ 'logs.requestBody' | translate }}</p>
                  <pre
                    class="max-h-56 overflow-auto rounded-lg border border-border-default bg-primary p-3 font-mono text-xs text-text-secondary">{{
                      (entry.requestBody | json) || ('logs.noBody' | translate)
                    }}</pre>
                </div>

                <div class="min-w-0">
                  <p
                    class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">{{ 'logs.responseBody' | translate }}</p>
                  <pre
                    class="max-h-56 overflow-auto rounded-lg border border-border-default bg-primary p-3 font-mono text-xs text-text-secondary">{{
                      (entry.responseBody | json) || ('logs.noBody' | translate)
                    }}</pre>
                </div>
              </div>
            }
          </div>
        } @empty {
          <div
            class="animate-fade-in rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
            {{ 'logs.empty' | translate }}
          </div>
        }
      </div>

      @if (logsStore.total() > 0) {
        <div class="mt-4 flex items-center justify-between text-xs text-text-secondary">
          <span>{{ 'logs.totalCount' | translate: {count: logsStore.total()} }}</span>
          <div class="flex items-center gap-3">
            <button
              type="button"
              [disabled]="logsStore.page() <= 1"
              (click)="logsStore.goToPage(logsStore.page() - 1)"
              class="press-feedback rounded-lg border border-border-default px-2.5 py-1.5 font-medium hover:bg-primary-2 disabled:opacity-40"
            >
              {{ 'logs.previous' | translate }}
            </button>
            <span>{{ 'logs.pageOf' | translate: {page: logsStore.page(), pageCount: logsStore.pageCount()} }}</span>
            <button
              type="button"
              [disabled]="logsStore.page() >= logsStore.pageCount()"
              (click)="logsStore.goToPage(logsStore.page() + 1)"
              class="press-feedback rounded-lg border border-border-default px-2.5 py-1.5 font-medium hover:bg-primary-2 disabled:opacity-40"
            >
              {{ 'logs.next' | translate }}
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: ``,
})
export class Logs implements OnInit, OnDestroy {
  protected readonly logsStore = inject(LogsStore);
  private readonly route = inject(ActivatedRoute);
  private readonly translate = inject(TranslateService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  // Tracks the `?mcpId=` query param reactively — the "logs" route stays on
  // the same route config when the "clear filter" link navigates to plain
  // `/logs`, so Angular reuses this component instance and never re-runs
  // ngOnInit; only a live subscription to queryParamMap sees the change.
  protected readonly mcpId = toSignal(this.route.queryParamMap.pipe(map((params) => params.get('mcpId')),distinctUntilChanged()), {
    initialValue: this.route.snapshot.queryParamMap.get('mcpId'),
  });
  private readonly expandedIds = signal<Set<string>>(new Set());

  private initialFetch = true;
  constructor() {
    effect(() => {
      this.logsStore.setFilter(this.mcpId(),this.initialFetch)
      if(this.initialFetch)
        this.initialFetch = false;
    });
  }

  ngOnInit(): void {
    this.logsStore.startPolling();
  }

  ngOnDestroy(): void {
    // The store is `providedIn: 'root'` (its data must survive navigating
    // away and back), so polling has to be stopped explicitly here — it
    // won't stop on its own just because this component is gone.
    this.logsStore.stopPolling();
  }

  /** Pulls out the JSON-RPC `method` (e.g. "tools/call") from an MCP request body, if present. */
  protected rpcMethod(entry: { requestBody?: object }): { method?: unknown; name?: string; } | null {
    const data = (entry.requestBody as { method?: unknown; params?: {name: string;} } | undefined);
    return typeof data?.method === 'string' ? {method: data.method, name: data.params?.name } : null;
  }

  protected isExpanded(id: string): boolean {
    return this.expandedIds().has(id);
  }

  protected toggleExpanded(id: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.expandedIds.set(next);
  }

  protected allOnPageSelected(): boolean {
    const items = this.logsStore.items();
    return items.length > 0 && items.every((item) => this.logsStore.selectedIds().includes(item.id));
  }

  protected async deleteSelected(): Promise<void> {
    const count = this.logsStore.selectedIds().length;
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('logs.confirmDeleteTitle'),
      message: this.translate.instant('logs.confirmDeleteSelected', { count }),
      confirmLabel: this.translate.instant('logs.deleteSelected'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    this.logsStore.deleteSelected();
  }

  protected async deleteAll(): Promise<void> {
    const key = this.mcpId() ? 'logs.confirmDeleteAllFiltered' : 'logs.confirmDeleteAll';
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('logs.confirmDeleteTitle'),
      message: this.translate.instant(key),
      confirmLabel: this.mcpId() ? this.translate.instant('logs.deleteAllFiltered') : this.translate.instant('logs.deleteAll'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    this.logsStore.deleteAllInScope();
  }
}
