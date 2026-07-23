import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowPath, heroCheckCircle, heroFolder, heroPhoto, heroTrash } from '@ng-icons/heroicons/outline';
import { firstValueFrom } from 'rxjs';
import { MarketPlaceItemDto, MarketplaceService } from '@mcp-bridge/ui-client';
import { DownloadedMcp, MarketplaceFsService } from '../../core/marketplace/marketplace-fs.service';
import { MarketplaceStore } from '../../core/marketplace/marketplace.store';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';
import { PreviewImageComponent } from '../../components/preview-image/preview-image';

/**
 * "On this system" route — Electron-only, lists the marketplace items
 * actually installed on this machine (from the download manifest written by
 * `electron/marketplace-downloader.js`), with the version currently
 * installed, where it landed on disk, an update-available badge + button
 * when the backend has a newer version, and the ability to uninstall.
 */
@Component({
  selector: 'app-marketplace-installed',
  standalone: true,
  imports: [TranslatePipe, NgIconComponent, DatePipe, RouterLink, PreviewImageComponent],
  viewProviders: [provideIcons({ heroCheckCircle, heroFolder, heroTrash, heroArrowPath, heroPhoto })],
  template: `
    <div class="mx-auto max-w-3xl animate-slide-up">
      <h1 class="text-xl font-semibold text-text-primary">{{ 'marketplaceInstalled.title' | translate }}</h1>
      <p class="mt-1 text-sm text-text-secondary">{{ 'marketplaceInstalled.subtitle' | translate }}</p>

      <ul class="mt-6 space-y-3 stagger-children">
        @for (entry of installedList(); track entry.itemId) {
          <li
            class="msg-enter hover-lift cursor-pointer rounded-2xl border border-border-default bg-primary-2 p-4"
            role="link"
            tabindex="0"
            [routerLink]="['/marketplace', entry.itemId]"
            (keydown.enter)="navigateToDetail(entry.itemId)"
          >
            <div class="flex items-start gap-4">
              <div class="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-primary">
                @if (firstPreviewImageFileId(entry); as fileId) {
                  <app-preview-image [itemId]="entry.itemId" [fileId]="fileId" [alt]="entry.itemName" />
                } @else {
                  <div class="flex h-full w-full items-center justify-center text-text-disabled">
                    <ng-icon name="heroPhoto" class="h-6 w-6" />
                  </div>
                }
              </div>

              <div class="flex min-w-0 flex-1 items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <ng-icon name="heroCheckCircle" class="h-4 w-4 shrink-0 text-success-text" />
                    <p class="truncate text-sm font-semibold text-text-primary">{{ entry.itemName }}</p>
                    <span
                      class="rounded-full bg-success-bg px-2 py-0.5 text-[10px] font-medium text-success-text"
                      [class.bg-warn-bg]="updateAvailable(entry)"
                      [class.text-warn-text]="updateAvailable(entry)"
                    >
                      {{ 'marketplace.installedBadge' | translate: { version: entry.version } }}
                      @if (updateAvailable(entry)) {
                        · {{ 'marketplace.updateAvailableBadge' | translate }}
                      }
                    </span>
                  </div>
                  <p class="mt-1 text-xs text-text-secondary">
                    {{ 'marketplaceInstalled.publisher' | translate: { publisher: entry.publisher } }}
                  </p>
                  <p class="mt-1.5 flex items-center gap-1 truncate text-xs text-text-muted">
                    <ng-icon name="heroFolder" class="h-3.5 w-3.5 shrink-0" />
                    {{ entry.installPath }}
                  </p>
                  <p class="mt-1 text-[11px] text-text-muted">
                    {{ 'marketplaceInstalled.downloadedAt' | translate: { date: (entry.downloadedAt | date: 'medium') } }}
                  </p>
                </div>

                <div class="flex shrink-0 items-center gap-2">
                  @if (updateAvailable(entry)) {
                    <button
                      type="button"
                      (click)="$event.stopPropagation(); update(entry)"
                      class="press-feedback inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-depth-sm hover-lift"
                    >
                      <ng-icon name="heroArrowPath" class="h-3.5 w-3.5" />
                      {{ 'marketplace.update' | translate }}
                    </button>
                  }
                  <button
                    type="button"
                    (click)="$event.stopPropagation(); remove(entry)"
                    class="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-error-bg hover:text-error-text"
                  >
                    <ng-icon name="heroTrash" class="h-3.5 w-3.5" />
                    {{ 'marketplace.uninstall' | translate }}
                  </button>
                </div>
              </div>
            </div>

            @if (progressFor(entry.itemId); as progress) {
              <div class="mt-3">
                <div class="mb-1 flex items-center justify-between text-[11px] text-text-muted">
                  <span>{{ ('marketplace.progress.' + progress.phase) | translate }}</span>
                  @if (progress.progress >= 0) {
                    <span>{{ progress.progress }}%</span>
                  }
                </div>
                <div class="h-1.5 w-full overflow-hidden rounded-full bg-primary">
                  <div
                    class="h-full rounded-full bg-accent transition-all duration-300"
                    [class.bg-error-muted]="progress.phase === 'error'"
                    [style.width.%]="progress.progress >= 0 ? progress.progress : 100"
                  ></div>
                </div>
              </div>
            }
          </li>
        } @empty {
          <li class="animate-fade-in rounded-2xl border border-dashed border-border-default p-8 text-center text-sm text-text-muted">
            {{ 'marketplaceInstalled.empty' | translate }}
          </li>
        }
      </ul>
    </div>
  `,
  styles: ``,
})
export class MarketplaceInstalled implements OnInit {
  protected readonly marketplaceFs = inject(MarketplaceFsService);
  private readonly marketplaceStore = inject(MarketplaceStore);
  private readonly marketplaceService = inject(MarketplaceService);
  private readonly router = inject(Router);
  private readonly translate = inject(TranslateService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  /** The current backend item for each installed entry, if it could be fetched (it may have been deleted/made private since). */
  private readonly latestInfo = signal<Map<string, MarketPlaceItemDto>>(new Map());

  ngOnInit(): void {
    if (!this.marketplaceFs.isElectron) {
      void this.router.navigate(['/marketplace']);
      return;
    }
    void this.load();
  }

  private async load(): Promise<void> {
    await this.marketplaceFs.refreshInstalled();

    const entries = this.installedList();
    const results = await Promise.all(
      entries.map(async (entry) => {
        try {
          return await firstValueFrom(this.marketplaceService.getMarketplaceItem(entry.itemId));
        } catch {
          return null;
        }
      }),
    );

    const next = new Map<string, MarketPlaceItemDto>();
    for (const item of results) {
      if (item) next.set(item.id, item);
    }
    this.latestInfo.set(next);
  }

  protected installedList() {
    return Array.from(this.marketplaceFs.installed().values()).sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
  }

  protected progressFor(itemId: string) {
    return this.marketplaceFs.progress().get(itemId);
  }

  protected updateAvailable(entry: DownloadedMcp): boolean {
    const latest = this.latestInfo().get(entry.itemId)?.latestVersion;
    return !!latest && latest !== entry.version;
  }

  /** The item's first preview image, if the backend fetch for it succeeded and it has one — see `latestInfo`. */
  protected firstPreviewImageFileId(entry: DownloadedMcp): string | undefined {
    return this.latestInfo().get(entry.itemId)?.previewImages[0]?.fileId;
  }

  protected navigateToDetail(itemId: string): void {
    void this.router.navigate(['/marketplace', itemId]);
  }

  protected update(entry: DownloadedMcp): void {
    const item = this.latestInfo().get(entry.itemId);
    const latestVersion = item?.latestVersion;
    if (!item || !latestVersion) return;
    void this.marketplaceStore.download(item, latestVersion);
  }

  protected async remove(entry: DownloadedMcp): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('marketplaceInstalled.confirmUninstallTitle'),
      message: this.translate.instant('marketplaceInstalled.confirmUninstall', { name: entry.itemName }),
      confirmLabel: this.translate.instant('marketplace.uninstall'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    await this.marketplaceFs.uninstall(entry.itemId);
  }
}
