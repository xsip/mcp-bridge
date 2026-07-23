import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowLeft, heroChevronDown, heroChevronRight, heroPhoto } from '@ng-icons/heroicons/outline';
import { firstValueFrom } from 'rxjs';
import { MarketPlaceItemDto, MarketplaceService } from '@mcp-bridge/ui-client';
import { PreviewImageService } from '../../core/marketplace/preview-image.service';
import { ImageLightboxService } from '../../core/image-lightbox/image-lightbox.service';
import { PreviewImageComponent } from '../../components/preview-image/preview-image';
import { MarketplaceItemActionsComponent } from '../../components/marketplace-item-actions/marketplace-item-actions';
import { FileManifestTreeComponent } from '../../components/file-manifest-tree/file-manifest-tree';

/**
 * Marketplace item detail page (`/marketplace/:id`) — full description, all
 * preview images, and the same version picker / Download-Update-Downgrade-
 * Uninstall button as the browse list (`MarketplaceItemActionsComponent`).
 */
@Component({
  selector: 'app-marketplace-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, NgIconComponent, PreviewImageComponent, MarketplaceItemActionsComponent, FileManifestTreeComponent],
  viewProviders: [provideIcons({ heroArrowLeft, heroChevronDown, heroChevronRight, heroPhoto })],
  template: `
    <div class="animate-slide-up">
      <div class="glass sticky -top-8 z-20 -mx-8 -mt-8 border-x-0 border-t-0 border-b-border-glass px-8 pb-4 pt-8 shadow-depth-sm">
        <div class="mx-auto max-w-3xl">
          <a
            routerLink="/marketplace"
            class="press-feedback inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-accent"
          >
            <ng-icon name="heroArrowLeft" class="h-3.5 w-3.5" />
            {{ 'marketplaceDetail.back' | translate }}
          </a>

          @if (item(); as current) {
            <div class="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <h1 class="text-xl font-semibold text-text-primary">{{ current.name }}</h1>
                  <span class="rounded-full bg-primary-2 px-2 py-0.5 text-[10px] font-medium text-text-muted">{{ current.visibility }}</span>
                </div>
                <p class="mt-1 text-xs text-text-muted">
                  {{ current.ownerUsername }} · {{ 'marketplace.downloadCount' | translate: { count: current.totalDownloadCount } }}
                </p>
              </div>

              <app-marketplace-item-actions [item]="current" />
            </div>
          }
        </div>
      </div>

      <div class="mx-auto max-w-3xl">
      @if (loading()) {
        <p class="mt-2 text-sm text-text-muted">{{ 'marketplaceDetail.loading' | translate }}</p>
      } @else if (!item()) {
        <p class="mt-2 rounded-lg border border-error-border bg-error-bg px-3 py-2 text-sm text-error-text">
          {{ 'marketplaceDetail.notFound' | translate }}
        </p>
      } @else {
        @let current = item()!;

        @if (current.previewImages.length > 0) {
          <div class="mt-6 flex flex-wrap gap-3">
            @for (image of current.previewImages; track image.fileId) {
              <button
                type="button"
                (click)="openLightbox(current, image.fileId)"
                class="h-28 w-28 overflow-hidden rounded-xl border border-border-default bg-primary-2 hover-lift"
              >
                <app-preview-image [itemId]="current.id" [fileId]="image.fileId" [alt]="image.filename" />
              </button>
            }
          </div>
        }

        @if (current.description) {
          <div
            class="prose-sm mt-6 max-w-none text-sm text-text-secondary [&_a]:text-accent [&_a]:underline [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            [innerHTML]="current.description"
          ></div>
        }

        <div class="mt-8 border-t border-border-subtle pt-4">
          <h2 class="text-sm font-semibold text-text-primary">{{ 'marketplaceDetail.versions' | translate }}</h2>
          <ul class="mt-3 space-y-2">
            @for (version of current.versions; track version.id) {
              <li class="rounded-lg border border-border-default bg-primary-2 px-3 py-2 text-xs">
                <div class="flex items-center justify-between">
                  <span class="font-medium text-text-primary">{{ version.version }}</span>
                  <span class="text-text-muted">
                    {{ 'marketplace.downloadCount' | translate: { count: version.downloadCount } }} ·
                    {{ version.uploadedBy }}
                  </span>
                </div>

                @if (version.fileManifest.length > 0) {
                  <button
                    type="button"
                    (click)="toggleFiles(version.id)"
                    class="press-feedback mt-1.5 inline-flex items-center gap-1 text-text-muted hover:text-accent"
                  >
                    <ng-icon [name]="isFilesOpen(version.id) ? 'heroChevronDown' : 'heroChevronRight'" class="h-3 w-3" />
                    {{ (isFilesOpen(version.id) ? 'marketplaceDetail.hideFiles' : 'marketplaceDetail.viewFiles') | translate }}
                    · {{ 'marketplaceDetail.fileCount' | translate: { count: version.fileManifest.length } }}
                  </button>

                  @if (isFilesOpen(version.id)) {
                    <div class="mt-2 rounded-md border border-border-subtle bg-primary p-1.5">
                      <app-file-manifest-tree [entries]="version.fileManifest" />
                    </div>
                  }
                } @else {
                  <p class="mt-1.5 text-text-muted">{{ 'marketplaceDetail.noFiles' | translate }}</p>
                }
              </li>
            }
          </ul>
        </div>
      }
      </div>
    </div>
  `,
  styles: ``,
})
export class MarketplaceDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly marketplaceService = inject(MarketplaceService);
  private readonly previewImages = inject(PreviewImageService);
  private readonly lightbox = inject(ImageLightboxService);

  protected readonly item = signal<MarketPlaceItemDto | null>(null);
  protected readonly loading = signal(true);
  private readonly openFileVersions = signal(new Set<string>());

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      void this.router.navigate(['/marketplace']);
      return;
    }

    try {
      this.item.set(await firstValueFrom(this.marketplaceService.getMarketplaceItem(id)));
    } catch {
      this.item.set(null);
    } finally {
      this.loading.set(false);
    }
  }

  protected openLightbox(item: MarketPlaceItemDto, fileId: string): void {
    this.previewImages.getObjectUrl(item.id, fileId).subscribe((url) => this.lightbox.open({ url, alt: item.name }));
  }

  protected isFilesOpen(versionId: string): boolean {
    return this.openFileVersions().has(versionId);
  }

  protected toggleFiles(versionId: string): void {
    const next = new Set(this.openFileVersions());
    if (next.has(versionId)) {
      next.delete(versionId);
    } else {
      next.add(versionId);
    }
    this.openFileVersions.set(next);
  }
}
