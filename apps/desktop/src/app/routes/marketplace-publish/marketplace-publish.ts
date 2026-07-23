import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowUpTray, heroCheckCircle, heroPhoto, heroTrash } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemDto } from '@mcp-bridge/ui-client';
import { MyReleasesStore } from '../../core/marketplace/my-releases.store';
import { RichTextEditorComponent } from '../../components/rich-text-editor/rich-text-editor';
import { PreviewImageComponent } from '../../components/preview-image/preview-image';

/**
 * "Publish" route — create a new marketplace listing, then immediately
 * upload its first version (zip) and any preview images before it's really
 * "published" in any useful sense. Further versions/edits happen from "My
 * Releases".
 */
@Component({
  selector: 'app-marketplace-publish',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent, RichTextEditorComponent, PreviewImageComponent],
  viewProviders: [provideIcons({ heroArrowUpTray, heroCheckCircle, heroPhoto, heroTrash })],
  template: `
    <div class="mx-auto max-w-2xl animate-slide-up">
      <h1 class="text-xl font-semibold text-text-primary">{{ 'marketplacePublish.title' | translate }}</h1>
      <p class="mt-1 text-sm text-text-secondary">{{ 'marketplacePublish.subtitle' | translate }}</p>

      @if (!createdItem()) {
        <form class="mt-6 space-y-4 rounded-2xl border border-border-default bg-primary-2 p-4" (ngSubmit)="submitCreate()">
          <div>
            <label for="name" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplacePublish.name' | translate }}</label>
            <input
              id="name"
              name="name"
              type="text"
              required
              [(ngModel)]="name"
              class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
            />
          </div>
          <div>
            <label for="description" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplacePublish.description' | translate }}</label>
            <app-rich-text-editor [(ngModel)]="description" name="description" editorId="description" />
          </div>
          <div>
            <label for="visibility" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplacePublish.visibility' | translate }}</label>
            <select
              id="visibility"
              name="visibility"
              [(ngModel)]="visibility"
              class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
            >
              <option value="private">{{ 'marketplacePublish.visibilityPrivate' | translate }}</option>
              <option value="unlisted">{{ 'marketplacePublish.visibilityUnlisted' | translate }}</option>
              <option value="public">{{ 'marketplacePublish.visibilityPublic' | translate }}</option>
            </select>
          </div>
          <button
            type="submit"
            [disabled]="creating()"
            class="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-depth-sm hover-lift press-feedback disabled:opacity-60"
          >
            {{ 'marketplacePublish.create' | translate }}
          </button>
        </form>
      } @else {
        <div class="mt-6 rounded-2xl border border-border-default bg-primary-2 p-4">
          <div class="flex items-center gap-2 text-sm font-medium text-success-text">
            <ng-icon name="heroCheckCircle" class="h-4 w-4" />
            {{ 'marketplacePublish.itemCreated' | translate: { name: createdItem()!.name } }}
          </div>

          <!-- Preview images -->
          <p class="mt-4 text-xs font-medium text-text-secondary">{{ 'marketplacePublish.previewImages' | translate }}</p>
          <div class="mt-2 flex flex-wrap gap-2">
            @for (image of createdItem()!.previewImages; track image.fileId) {
              <div class="group relative h-20 w-20 overflow-hidden rounded-lg border border-border-default bg-primary">
                <app-preview-image [itemId]="createdItem()!.id" [fileId]="image.fileId" [alt]="image.filename" />
                <button
                  type="button"
                  (click)="removePreviewImage(image.fileId)"
                  class="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/50 group-hover:opacity-100"
                  [attr.aria-label]="'marketplacePublish.removeImage' | translate"
                >
                  <ng-icon name="heroTrash" class="h-4 w-4" />
                </button>
              </div>
            }
            <label
              class="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border-default text-text-muted hover:border-accent hover:text-accent"
            >
              <ng-icon name="heroPhoto" class="h-5 w-5" />
              <span class="text-[10px]">{{ 'marketplacePublish.addImage' | translate }}</span>
              <input type="file" accept="image/*" class="hidden" (change)="onImageSelected($event)" [disabled]="uploadingImage()" />
            </label>
          </div>

          <p class="mt-5 text-xs text-text-secondary">{{ 'marketplacePublish.uploadFirstVersion' | translate }}</p>

          <form class="mt-3 flex flex-wrap items-end gap-3" (ngSubmit)="submitVersion()">
            <div class="w-32">
              <label for="version" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplacePublish.version' | translate }}</label>
              <input
                id="version"
                name="version"
                type="text"
                required
                placeholder="1.0.0"
                [(ngModel)]="version"
                class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
              />
            </div>
            <div class="min-w-0 flex-1">
              <label for="file" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'marketplacePublish.zipFile' | translate }}</label>
              <input
                id="file"
                name="file"
                type="file"
                accept=".zip"
                required
                (change)="onFileSelected($event)"
                class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-accent-subtle file:px-2 file:py-1 file:text-xs file:text-accent"
              />
            </div>
            <button
              type="submit"
              [disabled]="uploading() || !selectedFile()"
              class="inline-flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-depth-sm hover-lift press-feedback disabled:opacity-60"
            >
              <ng-icon name="heroArrowUpTray" class="h-4 w-4" />
              {{ 'marketplacePublish.upload' | translate }}
            </button>
          </form>

          @if (versionUploaded()) {
            <p class="mt-3 text-xs text-success-text">{{ 'marketplacePublish.versionUploaded' | translate }}</p>
            <button
              type="button"
              (click)="goToMyReleases()"
              class="mt-2 press-feedback rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-primary"
            >
              {{ 'marketplacePublish.viewInMyReleases' | translate }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: ``,
})
export class MarketplacePublish {
  private readonly myReleasesStore = inject(MyReleasesStore);
  private readonly router = inject(Router);

  protected name = '';
  protected description = '';
  protected visibility: 'private' | 'unlisted' | 'public' = 'private';
  protected version = '';

  protected readonly creating = signal(false);
  protected readonly uploading = signal(false);
  protected readonly uploadingImage = signal(false);
  protected readonly versionUploaded = signal(false);
  protected readonly createdItem = signal<MarketPlaceItemDto | null>(null);
  protected readonly selectedFile = signal<File | null>(null);

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile.set(input.files?.[0] ?? null);
  }

  protected async submitCreate(): Promise<void> {
    if (!this.name) return;
    this.creating.set(true);
    const created = await this.myReleasesStore.create({
      name: this.name,
      description: this.description || undefined,
      visibility: this.visibility,
    });
    this.creating.set(false);
    if (created) this.createdItem.set(created);
  }

  protected async submitVersion(): Promise<void> {
    const item = this.createdItem();
    const file = this.selectedFile();
    if (!item || !file || !this.version) return;

    this.uploading.set(true);
    const updated = await this.myReleasesStore.addVersion(item.id, this.version, file);
    this.uploading.set(false);
    if (updated) {
      this.createdItem.set(updated);
      this.versionUploaded.set(true);
    }
  }

  protected async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    const item = this.createdItem();
    input.value = '';
    if (!file || !item) return;

    this.uploadingImage.set(true);
    const updated = await this.myReleasesStore.addPreviewImage(item.id, file);
    this.uploadingImage.set(false);
    if (updated) this.createdItem.set(updated);
  }

  protected async removePreviewImage(fileId: string): Promise<void> {
    const item = this.createdItem();
    if (!item) return;
    await this.myReleasesStore.removePreviewImage(item.id, fileId);
    this.createdItem.set({ ...item, previewImages: item.previewImages.filter((image) => image.fileId !== fileId) });
  }

  protected goToMyReleases(): void {
    void this.router.navigate(['/marketplace/my-releases']);
  }
}
