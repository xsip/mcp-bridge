import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowUpTray, heroCodeBracket, heroPencilSquare, heroPhoto, heroTrash, heroXMark } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemDto } from '@mcp-loop/ui-client';
import { MyReleasesStore } from '../../core/marketplace/my-releases.store';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';
import { RichTextEditorComponent } from '../../components/rich-text-editor/rich-text-editor';
import { PreviewImageComponent } from '../../components/preview-image/preview-image';

/**
 * "My Releases" route — manage the current user's own marketplace listings:
 * edit name/description (rich text), change visibility, add/remove preview
 * images, upload new versions, remove a version, or delete the whole
 * listing.
 */
@Component({
  selector: 'app-marketplace-my-releases',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent, RichTextEditorComponent, PreviewImageComponent],
  viewProviders: [provideIcons({ heroPencilSquare, heroTrash, heroXMark, heroArrowUpTray, heroPhoto, heroCodeBracket })],
  template: `
    <div class="animate-slide-up">
      <div class="glass sticky -top-8 z-20 -mx-8 -mt-8 border-x-0 border-t-0 border-b-border-glass px-8 pb-4 pt-8 shadow-depth-sm">
        <div class="mx-auto max-w-4xl">
          <h1 class="text-xl font-semibold text-text-primary">{{ 'marketplaceMyReleases.title' | translate }}</h1>
          <p class="mt-1 text-sm text-text-secondary">{{ 'marketplaceMyReleases.subtitle' | translate }}</p>
        </div>
      </div>

      <div class="mx-auto max-w-4xl">
      @if (store.error(); as error) {
        <p class="mt-3 animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
      }

      <ul class="mt-6 space-y-3 stagger-children">
        @for (item of store.items(); track item.id) {
          <li class="msg-enter rounded-2xl border border-border-default bg-primary-2 p-4">
            @if (editingId() === item.id) {
              <form class="space-y-3" (ngSubmit)="submitEdit(item.id)">
                <div>
                  <label for="editName-{{ item.id }}" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplaceMyReleases.name' | translate }}</label>
                  <input
                    id="editName-{{ item.id }}"
                    type="text"
                    [(ngModel)]="editName"
                    name="editName"
                    class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
                  />
                </div>
                <div>
                  <label for="editDescription-{{ item.id }}" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplaceMyReleases.description' | translate }}</label>
                  <app-rich-text-editor [(ngModel)]="editDescription" name="editDescription" editorId="editDescription-{{ item.id }}" />
                </div>
                <div class="flex items-center gap-2">
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
                </div>
              </form>
            } @else {
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-semibold text-text-primary">{{ item.name }}</p>
                  @if (item.description) {
                    <div class="mt-1 line-clamp-3 text-xs text-text-secondary [&_a]:text-accent [&_a]:underline" [innerHTML]="item.description"></div>
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

            <!-- Preview images -->
            <div class="mt-3 border-t border-border-subtle pt-3">
              <p class="text-xs font-medium text-text-secondary">{{ 'marketplaceMyReleases.previewImages' | translate }}</p>
              <div class="mt-2 flex flex-wrap gap-2">
                @for (image of item.previewImages; track image.fileId) {
                  <div class="group relative h-16 w-16 overflow-hidden rounded-lg border border-border-default bg-primary">
                    <app-preview-image [itemId]="item.id" [fileId]="image.fileId" [alt]="image.filename" />
                    <button
                      type="button"
                      (click)="removePreviewImage(item.id, image.fileId)"
                      class="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/50 group-hover:opacity-100"
                      [attr.aria-label]="'marketplaceMyReleases.removeImage' | translate"
                    >
                      <ng-icon name="heroTrash" class="h-3.5 w-3.5" />
                    </button>
                  </div>
                }
                <label
                  class="flex h-16 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-default text-text-muted hover:border-accent hover:text-accent"
                >
                  <ng-icon name="heroPhoto" class="h-4 w-4" />
                  <span class="text-[9px]">{{ 'marketplaceMyReleases.addImage' | translate }}</span>
                  <input type="file" accept="image/*" class="hidden" (change)="onImageSelected(item.id, $event)" />
                </label>
              </div>
            </div>

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

              <div class="mt-3 flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  (click)="setVersionMode(item.id, 'file')"
                  class="press-feedback rounded-md px-2 py-1 font-medium"
                  [class.bg-accent-subtle]="versionMode(item.id) === 'file'"
                  [class.text-accent]="versionMode(item.id) === 'file'"
                  [class.text-text-muted]="versionMode(item.id) !== 'file'"
                >
                  {{ 'marketplaceMyReleases.uploadZip' | translate }}
                </button>
                <button
                  type="button"
                  (click)="setVersionMode(item.id, 'github')"
                  class="press-feedback rounded-md px-2 py-1 font-medium"
                  [class.bg-accent-subtle]="versionMode(item.id) === 'github'"
                  [class.text-accent]="versionMode(item.id) === 'github'"
                  [class.text-text-muted]="versionMode(item.id) !== 'github'"
                >
                  {{ 'marketplaceMyReleases.fromGithub' | translate }}
                </button>
              </div>

              @if (versionMode(item.id) === 'file') {
                <form class="mt-2 flex flex-wrap items-end gap-2" (ngSubmit)="submitAddVersion(item.id)">
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
              } @else {
                <form class="mt-2 flex flex-wrap items-end gap-2" (ngSubmit)="submitAddVersionFromGithub(item.id)">
                  <div class="w-24">
                    <input
                      type="text"
                      placeholder="1.0.1"
                      required
                      [(ngModel)]="newVersion[item.id]"
                      name="newVersionGh-{{ item.id }}"
                      class="w-full rounded-lg border border-border-default bg-primary px-2 py-1.5 text-xs text-text-primary"
                    />
                  </div>
                  <input
                    type="url"
                    required
                    [placeholder]="'marketplaceMyReleases.githubUrlPlaceholder' | translate"
                    [(ngModel)]="newVersionGithubUrl[item.id]"
                    name="newVersionGithubUrl-{{ item.id }}"
                    class="min-w-0 flex-1 rounded-lg border border-border-default bg-primary px-2 py-1.5 text-xs text-text-primary"
                  />
                  <button
                    type="submit"
                    [disabled]="!newVersionGithubUrl[item.id] || addingFromGithub(item.id)"
                    class="press-feedback inline-flex items-center gap-1 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-depth-sm hover-lift disabled:opacity-60"
                  >
                    <ng-icon name="heroCodeBracket" class="h-3.5 w-3.5" />
                    {{ (addingFromGithub(item.id) ? 'marketplaceMyReleases.importing' : 'marketplaceMyReleases.addVersion') | translate }}
                  </button>
                </form>
              }
            </div>
          </li>
        } @empty {
          <li class="animate-fade-in rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
            {{ 'marketplaceMyReleases.empty' | translate }}
          </li>
        }
      </ul>
      </div>
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
  protected readonly newVersionGithubUrl: Record<string, string> = {};

  private readonly versionModeByItem = signal<Record<string, 'file' | 'github'>>({});
  private readonly addingFromGithubIds = signal(new Set<string>());

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

  protected async onImageSelected(itemId: string, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    await this.store.addPreviewImage(itemId, file);
  }

  protected async removePreviewImage(itemId: string, fileId: string): Promise<void> {
    await this.store.removePreviewImage(itemId, fileId);
  }

  protected versionMode(itemId: string): 'file' | 'github' {
    return this.versionModeByItem()[itemId] ?? 'file';
  }

  protected setVersionMode(itemId: string, mode: 'file' | 'github'): void {
    this.versionModeByItem.set({ ...this.versionModeByItem(), [itemId]: mode });
  }

  protected addingFromGithub(itemId: string): boolean {
    return this.addingFromGithubIds().has(itemId);
  }

  protected async submitAddVersionFromGithub(itemId: string): Promise<void> {
    const version = this.newVersion[itemId];
    const githubUrl = this.newVersionGithubUrl[itemId];
    if (!version || !githubUrl) return;

    this.addingFromGithubIds.set(new Set(this.addingFromGithubIds()).add(itemId));
    const updated = await this.store.addVersionFromGithub(itemId, version, githubUrl);
    const next = new Set(this.addingFromGithubIds());
    next.delete(itemId);
    this.addingFromGithubIds.set(next);

    if (updated) {
      delete this.newVersion[itemId];
      delete this.newVersionGithubUrl[itemId];
    }
  }
}
