import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroBarsArrowDown, heroBarsArrowUp, heroMagnifyingGlass, heroMagnifyingGlassPlus, heroPhoto } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemDto } from '@mcp-bridge/ui-client';
import { MarketplaceStore } from '../../core/marketplace/marketplace.store';
import { MarketplaceFsService } from '../../core/marketplace/marketplace-fs.service';
import { PreviewImageService } from '../../core/marketplace/preview-image.service';
import { ImageLightboxService } from '../../core/image-lightbox/image-lightbox.service';
import { PreviewImageComponent } from '../../components/preview-image/preview-image';
import { MarketplaceItemActionsComponent } from '../../components/marketplace-item-actions/marketplace-item-actions';

/**
 * "Marketplace" route — browse published MCP listings, search by name, sort
 * by download count or release date. Each card shows a thumbnail (hover for
 * a bigger preview) and links to the item's detail page; the version picker
 * and Download/Update/Downgrade/Uninstall button live in
 * `MarketplaceItemActionsComponent`, shared with the detail page.
 */
@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent, PreviewImageComponent, MarketplaceItemActionsComponent],
  viewProviders: [provideIcons({ heroMagnifyingGlass, heroBarsArrowUp, heroBarsArrowDown, heroPhoto, heroMagnifyingGlassPlus })],
  template: `
    <div class="animate-slide-up">
      <div class="glass sticky -top-8 z-20 -mx-8 -mt-8 border-x-0 border-t-0 border-b-border-glass px-8 pb-4 pt-8 shadow-depth-sm">
        <div class="mx-auto max-w-4xl">
          <div>
            <h1 class="text-xl font-semibold text-text-primary">{{ 'marketplace.title' | translate }}</h1>
            <p class="mt-1 text-sm text-text-secondary">{{ 'marketplace.subtitle' | translate }}</p>
          </div>

          <div class="mt-6 flex flex-wrap items-center gap-3">
            <div class="relative min-w-0 flex-1">
              <ng-icon
                name="heroMagnifyingGlass"
                class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              />
              <input
                type="text"
                [ngModel]="marketplaceStore.search()"
                (ngModelChange)="onSearchChange($event)"
                [placeholder]="'marketplace.searchPlaceholder' | translate"
                class="w-full rounded-lg border border-border-default bg-primary py-2 pl-9 pr-3 text-sm text-text-primary"
              />
            </div>

            <button
              type="button"
              (click)="toggleReleaseDateSort()"
              class="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary hover:bg-primary-2"
              [class.text-accent]="marketplaceStore.sortByReleaseDate()"
            >
              <ng-icon [name]="marketplaceStore.sortByReleaseDate() === 'asc' ? 'heroBarsArrowUp' : 'heroBarsArrowDown'" class="h-3.5 w-3.5" />
              {{ 'marketplace.sortByDate' | translate }}
            </button>

            <button
              type="button"
              (click)="toggleDownloadCountSort()"
              class="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-2 text-xs font-medium text-text-secondary hover:bg-primary-2"
              [class.text-accent]="marketplaceStore.sortByDownloadCount()"
            >
              <ng-icon [name]="marketplaceStore.sortByDownloadCount() === 'asc' ? 'heroBarsArrowUp' : 'heroBarsArrowDown'" class="h-3.5 w-3.5" />
              {{ 'marketplace.sortByDownloads' | translate }}
            </button>
          </div>
        </div>
      </div>

      <div class="mx-auto max-w-4xl">
      @if (marketplaceStore.error(); as error) {
        <p class="mt-3 animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
      }

      <ul class="mt-6 space-y-3 stagger-children">
        @for (item of marketplaceStore.items(); track item.id) {
          <li
            class="msg-enter hover-lift cursor-pointer rounded-2xl border border-border-default bg-primary-2 p-4"
            role="link"
            tabindex="0"
            (click)="openDetail(item)"
            (keydown.enter)="openDetail(item)"
          >
            <div class="flex flex-wrap items-start gap-4">
              <div class="group relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary">
                @if (item.previewImages.length > 0) {
                  <app-preview-image [itemId]="item.id" [fileId]="item.previewImages[0].fileId" [alt]="item.name" />
                  <button
                    type="button"
                    (click)="$event.stopPropagation(); openLightbox(item)"
                    class="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100"
                    aria-label="Preview image"
                  >
                    <ng-icon name="heroMagnifyingGlassPlus" class="h-5 w-5" />
                  </button>
                } @else {
                  <div class="flex h-full w-full items-center justify-center text-text-disabled">
                    <ng-icon name="heroPhoto" class="h-6 w-6" />
                  </div>
                }
              </div>

              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <p class="truncate text-sm font-semibold text-text-primary">{{ item.name }}</p>
                      <span class="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium text-text-muted">{{ item.visibility }}</span>
                      @if (installedVersion(item.id); as installed) {
                        <span
                          class="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-medium text-success-text"
                          [class.bg-warn-bg]="installed !== item.latestVersion"
                          [class.text-warn-text]="installed !== item.latestVersion"
                        >
                          {{ 'marketplace.installedBadge' | translate: { version: installed } }}
                          @if (installed !== item.latestVersion) {
                            · {{ 'marketplace.updateAvailableBadge' | translate }}
                          }
                        </span>
                      }
                    </div>
                    @if (descriptionSnippet(item); as snippet) {
                      <p class="mt-1 line-clamp-2 text-xs text-text-secondary">{{ snippet }}</p>
                    }
                    <p class="mt-1.5 text-xs text-text-muted">
                      {{ item.ownerUsername }} · {{ 'marketplace.downloadCount' | translate: { count: item.totalDownloadCount } }}
                    </p>
                  </div>

                  <app-marketplace-item-actions [item]="item" />
                </div>
              </div>
            </div>
          </li>
        } @empty {
          <li class="animate-fade-in rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
            {{ 'marketplace.empty' | translate }}
          </li>
        }
      </ul>

      @if (marketplaceStore.pageCount() > 1) {
        <div class="mt-4 flex items-center justify-center gap-3 text-xs text-text-secondary">
          <button
            type="button"
            [disabled]="marketplaceStore.page() <= 1"
            (click)="marketplaceStore.setPage(marketplaceStore.page() - 1)"
            class="press-feedback rounded-lg border border-border-default px-2.5 py-1.5 font-medium hover:bg-primary-2 disabled:opacity-40"
          >
            {{ 'marketplace.previous' | translate }}
          </button>
          <span>{{ 'marketplace.pageOf' | translate: { page: marketplaceStore.page(), pageCount: marketplaceStore.pageCount() } }}</span>
          <button
            type="button"
            [disabled]="marketplaceStore.page() >= marketplaceStore.pageCount()"
            (click)="marketplaceStore.setPage(marketplaceStore.page() + 1)"
            class="press-feedback rounded-lg border border-border-default px-2.5 py-1.5 font-medium hover:bg-primary-2 disabled:opacity-40"
          >
            {{ 'marketplace.next' | translate }}
          </button>
        </div>
      }
      </div>
    </div>
  `,
  styles: ``,
})
export class Marketplace implements OnInit {
  protected readonly marketplaceStore = inject(MarketplaceStore);
  private readonly marketplaceFs = inject(MarketplaceFsService);
  private readonly router = inject(Router);
  private readonly previewImages = inject(PreviewImageService);
  private readonly lightbox = inject(ImageLightboxService);

  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.marketplaceStore.load();
  }

  protected onSearchChange(value: string): void {
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => this.marketplaceStore.setSearch(value), 300);
  }

  protected toggleReleaseDateSort(): void {
    const current = this.marketplaceStore.sortByReleaseDate();
    this.marketplaceStore.setSortByReleaseDate(current === 'desc' ? 'asc' : 'desc');
  }

  protected toggleDownloadCountSort(): void {
    const current = this.marketplaceStore.sortByDownloadCount();
    this.marketplaceStore.setSortByDownloadCount(current === 'desc' ? 'asc' : 'desc');
  }

  /** The version installed locally for this item, if any — only ever populated in Electron. Kept here (not in the actions component) since the badge is card-level UI, not part of the action button itself. */
  protected installedVersion(itemId: string): string | undefined {
    return this.marketplaceFs.installed().get(itemId)?.version;
  }

  /** Plain-text, tag-stripped snippet of the (HTML) description for the list view — full rich rendering only happens on the detail page. */
  protected descriptionSnippet(item: MarketPlaceItemDto): string {
    if (!item.description) return '';
    const div = document.createElement('div');
    div.innerHTML = item.description;
    return (div.textContent || '').trim();
  }

  protected openDetail(item: MarketPlaceItemDto): void {
    void this.router.navigate(['/marketplace', item.id]);
  }

  protected openLightbox(item: MarketPlaceItemDto): void {
    const fileId = item.previewImages[0]?.fileId;
    if (!fileId) return;
    this.previewImages.getObjectUrl(item.id, fileId).subscribe((url) => this.lightbox.open({ url, alt: item.name }));
  }
}
