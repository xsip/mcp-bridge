import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowUpTray, heroPencilSquare, heroTrash, heroXMark } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemDto } from '@mcp-bridge/ui-client';
import { MyReleasesStore } from '../../core/marketplace/my-releases.store';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';

/**
 * "My Releases" route — manage the current user's own marketplace listings:
 * edit name/description, change visibility, upload new versions, remove a
 * version, or delete the whole listing.
 */
@Component({
  selector: 'app-marketplace-my-releases',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroPencilSquare, heroTrash, heroXMark, heroArrowUpTray })],
  template: `
    <div class="mx-auto max-w-4xl animate-slide-up">
      <h1 class="text-xl font-semibold text-text-primary">{{ 'marketplaceMyReleases.title' | translate }}</h1>
      <p class="mt-1 text-sm text-text-secondary">{{ 'marketplaceMyReleases.subtitle' | translate }}</p>

      @if (store.error(); as error) {
        <p class="mt-3 animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
      }

      <ul class="mt-6 space-y-3 stagger-children">
        @for (item of store.items(); track item.id) {
          <li class="msg-enter rounded-2xl border border-border-default bg-primary-2 p-4">
            @if (editingId() === item.id) {
              <form class="flex flex-wrap items-end gap-3" (ngSubmit)="submitEdit(item.id)">
                <div class="min-w-0 flex-1">
                  <label for="editName-{{ item.id }}" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplaceMyReleases.name' | translate }}</label>
                  <input
                    id="editName-{{ item.id }}"
                    type="text"
                    [(ngModel)]="editName"
                    name="editName"
                    class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div class="min-w-0 flex-1">
                  <label for="editDescription-{{ item.id }}" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplaceMyReleases.description' | translate }}</label>
                  <input
                    id="editDescription-{{ item.id }}"
                    type="text"
                    [(ngModel)]="editDescription"
                    name="editDescription"
                    class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <button
                  type="submit"
                  class="press-feedback inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3 text-xs font-semibold text-white shadow-depth-sm hover-lift"
                >
                  {{ 'marketplaceMyReleases.save' | translate }}
                </button>
                <button
                  type="button"
                  (click)="cancelEdit()"
                  class="press-feedback inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border-default text-text-secondary hover:bg-primary"
                >
                  <ng-icon name="heroXMark" class="h-4 w-4" />
                </button>
              </form>
            } @else {
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-text-primary">{{ item.name }}</p>
                  @if (item.description) {
                    <p class="mt-1 text-xs text-text-secondary">{{ item.description }}</p>
                  }
                  <p class="mt-1.5 text-xs text-text-muted">
                    {{ 'marketplaceMyReleases.downloadCount' | translate: { count: item.totalDownloadCount } }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  <select
                    [ngModel]="item.visibility"
                    (ngModelChange)="changeVisibility(item.id, $event)"
                    class="rounded-lg border border-border-default bg-primary px-2 py-1.5 text-xs text-text-primary"
                  >
                    <option value="private">{{ 'marketplaceMyReleases.visibilityPrivate' | translate }}</option>
                    <option value="unlisted">{{ 'marketplaceMyReleases.visibilityUnlisted' | translate }}</option>
                    <option value="public">{{ 'marketplaceMyReleases.visibilityPublic' | translate }}</option>
                  </select>

                  <button
                    type="button"
                    (click)="startEdit(item)"
                    class="press-feedback inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-accent-subtle hover:text-accent"
                    [attr.aria-label]="'marketplaceMyReleases.edit' | translate"
                  >
                    <ng-icon name="heroPencilSquare" class="h-3.5 w-3.5" />
                  </button>

                  <button
                    type="button"
                    (click)="removeItem(item)"
                    class="press-feedback inline-flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary hover:bg-error-bg hover:text-error-text"
                    [attr.aria-label]="'marketplaceMyReleases.remove' | translate"
                  >
                    <ng-icon name="heroTrash" class="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            }

            <!-- Versions -->
            <div class="mt-3 border-t border-border-subtle pt-3">
              <ul class="space-y-1.5">
                @for (version of item.versions; track version.id) {
                  <li class="flex items-center justify-between gap-2 text-xs">
                    <span class="text-text-secondary">
                      {{ version.version }}
                      <span class="text-text-muted">
                        · {{ 'marketplaceMyReleases.downloadCount' | translate: { count: version.downloadCount } }}
                      </span>
                    </span>
                    <button
                      type="button"
                      (click)="removeVersion(item, version.version)"
                      class="press-feedback inline-flex h-6 w-6 items-center justify-center rounded-lg text-text-secondary hover:bg-error-bg hover:text-error-text"
                      [attr.aria-label]="'marketplaceMyReleases.removeVersion' | translate"
                    >
                      <ng-icon name="heroTrash" class="h-3 w-3" />
                    </button>
                  </li>
                } @empty {
                  <li class="text-xs text-text-muted">{{ 'marketplaceMyReleases.noVersions' | translate }}</li>
                }
              </ul>

              <form class="mt-3 flex flex-wrap items-end gap-2" (ngSubmit)="submitAddVersion(item.id)">
                <div class="w-24">
                  <input
                    type="text"
                    placeholder="1.0.1"
                    required
                    [(ngModel)]="newVersion[item.id]"
                    name="newVersion-{{ item.id }}"
                    class="w-full rounded-lg border border-border-default bg-primary px-2 py-1.5 text-xs text-text-primary"
                  />
                </div>
                <input
                  type="file"
                  accept=".zip"
                  required
                  (change)="onFileSelected(item.id, $event)"
                  class="min-w-0 flex-1 rounded-lg border border-border-default bg-primary px-2 py-1.5 text-xs text-text-primary file:mr-2 file:rounded-md file:border-0 file:bg-accent-subtle file:px-2 file:py-1 file:text-[11px] file:text-accent"
                />
                <button
                  type="submit"
                  [disabled]="!newVersionFiles[item.id]"
                  class="press-feedback inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-depth-sm hover-lift disabled:opacity-60"
                >
                  <ng-icon name="heroArrowUpTray" class="h-3.5 w-3.5" />
                  {{ 'marketplaceMyReleases.addVersion' | translate }}
                </button>
              </form>
            </div>
          </li>
        } @empty {
          <li class="animate-fade-in rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
            {{ 'marketplaceMyReleases.empty' | translate }}
          </li>
        }
      </ul>
    </div>
  `,
  styles: ``,
})
export class MarketplaceMyReleases implements OnInit {
  protected readonly store = inject(MyReleasesStore);
  private readonly translate = inject(TranslateService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly editingId = signal<string | null>(null);
  protected editName = '';
  protected editDescription = '';

  protected readonly newVersion: Record<string, string> = {};
  protected readonly newVersionFiles: Record<string, File | undefined> = {};

  ngOnInit(): void {
    this.store.load();
  }

  protected startEdit(item: MarketPlaceItemDto): void {
    this.editingId.set(item.id);
    this.editName = item.name;
    this.editDescription = item.description;
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
  }

  protected async submitEdit(id: string): Promise<void> {
    await this.store.update(id, { name: this.editName, description: this.editDescription });
    this.editingId.set(null);
  }

  protected changeVisibility(id: string, visibility: 'private' | 'unlisted' | 'public'): void {
    void this.store.changeVisibility(id, { visibility });
  }

  protected async removeItem(item: MarketPlaceItemDto): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('marketplaceMyReleases.confirmRemoveTitle'),
      message: this.translate.instant('marketplaceMyReleases.confirmRemove', { name: item.name }),
      confirmLabel: this.translate.instant('marketplaceMyReleases.remove'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    void this.store.remove(item.id);
  }

  protected async removeVersion(item: MarketPlaceItemDto, version: string): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('marketplaceMyReleases.confirmRemoveVersionTitle'),
      message: this.translate.instant('marketplaceMyReleases.confirmRemoveVersion', { version }),
      confirmLabel: this.translate.instant('marketplaceMyReleases.remove'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    void this.store.removeVersion(item.id, version);
  }

  protected onFileSelected(itemId: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.newVersionFiles[itemId] = input.files?.[0] ?? undefined;
  }

  protected async submitAddVersion(itemId: string): Promise<void> {
    const version = this.newVersion[itemId];
    const file = this.newVersionFiles[itemId];
    if (!version || !file) return;

    const updated = await this.store.addVersion(itemId, version, file);
    if (updated) {
      delete this.newVersion[itemId];
      delete this.newVersionFiles[itemId];
    }
  }
}
