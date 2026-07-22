import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowUpTray, heroCheckCircle } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemDto } from '@mcp-bridge/ui-client';
import { MyReleasesStore } from '../../core/marketplace/my-releases.store';

/**
 * "Publish" route — create a new marketplace listing, then immediately
 * upload its first version (zip) before it's really "published" in any
 * useful sense. Further versions/edits happen from "My Releases".
 */
@Component({
  selector: 'app-marketplace-publish',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroArrowUpTray, heroCheckCircle })],
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
            <textarea
              id="description"
              name="description"
              rows="3"
              [(ngModel)]="description"
              class="w-full rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
            ></textarea>
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

          <p class="mt-3 text-xs text-text-secondary">{{ 'marketplacePublish.uploadFirstVersion' | translate }}</p>

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

  protected goToMyReleases(): void {
    void this.router.navigate(['/marketplace/my-releases']);
  }
}
