import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import {
  heroArrowDownTray,
  heroArrowPath,
  heroBarsArrowDown,
  heroBarsArrowUp,
  heroMagnifyingGlass,
  heroTrash,
} from '@ng-icons/heroicons/outline';
import { MarketPlaceItemDto } from '@mcp-bridge/ui-client';
import { MarketplaceStore } from '../../core/marketplace/marketplace.store';
import { MarketplaceFsService } from '../../core/marketplace/marketplace-fs.service';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';

/**
 * "Marketplace" route — browse published MCP listings, search by name, sort
 * by download count or release date, and download a chosen version (which
 * either installs itself via the Electron agent, or falls back to a plain
 * browser download of the zip — see `MarketplaceStore.download`).
 */
@Component({
  selector: 'app-marketplace',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroMagnifyingGlass, heroArrowDownTray, heroBarsArrowUp, heroBarsArrowDown, heroArrowPath, heroTrash })],
  template: `
    <div class="mx-auto max-w-4xl animate-slide-up">
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

      @if (marketplaceStore.error(); as error) {
        <p class="mt-3 animate-shake rounded-lg border border-error-border bg-error-bg px-3 py-2 text-xs text-error-text">{{ error }}</p>
      }

      <ul class="mt-6 space-y-3 stagger-children">
        @for (item of marketplaceStore.items(); track item.id) {
          <li class="msg-enter hover-lift rounded-2xl border border-border-default bg-primary-2 p-4">
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
                @if (item.description) {
                  <p class="mt-1 line-clamp-2 text-xs text-text-secondary">{{ item.description }}</p>
                }
                <p class="mt-1.5 text-xs text-text-muted">
                  {{ item.ownerUsername }} · {{ 'marketplace.downloadCount' | translate: { count: item.totalDownloadCount } }}
                </p>
              </div>

              @if (item.versions.length > 0) {
                <div class="flex shrink-0 items-center gap-2">
                  <select
                    [ngModel]="selectedVersion(item.id) ?? item.versions[0].version"
                    (ngModelChange)="setSelectedVersion(item.id, $event)"
                    class="rounded-lg border border-border-default bg-primary px-2 py-1.5 text-xs text-text-primary"
                  >
                    @for (version of item.versions; track version.id) {
                      <option [value]="version.version">{{ version.version }}</option>
                    }
                  </select>

                  @if (isSelectedVersionInstalled(item)) {
                    <button
                      type="button"
                      disabled
                      class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-depth-sm opacity-60"
                    >
                      <ng-icon name="heroArrowDownTray" class="h-3.5 w-3.5" />
                      {{ 'marketplace.download' | translate }}
                    </button>
                  } @else if (installedVersion(item.id)) {
                    <button
                      type="button"
                      (click)="download(item)"
                      class="press-feedback inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-depth-sm hover-lift"
                    >
                      <ng-icon name="heroArrowPath" class="h-3.5 w-3.5" />
                      {{ (isDowngrade(item) ? 'marketplace.downgrade' : 'marketplace.update') | translate }}
                    </button>
                  } @else {
                    <button
                      type="button"
                      (click)="download(item)"
                      class="press-feedback inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-depth-sm hover-lift"
                    >
                      <ng-icon name="heroArrowDownTray" class="h-3.5 w-3.5" />
                      {{ 'marketplace.download' | translate }}
                    </button>
                  }

                  @if (marketplaceFs.isElectron && installedVersion(item.id)) {
                    <button
                      type="button"
                      (click)="removeInstalled(item)"
                      class="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-error-bg hover:text-error-text"
                    >
                      <ng-icon name="heroTrash" class="h-3.5 w-3.5" />
                      {{ 'marketplace.uninstall' | translate }}
                    </button>
                  }
                </div>
              }
            </div>

            @if (progressFor(item.id); as progress) {
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
  `,
  styles: ``,
})
export class Marketplace implements OnInit {
  protected readonly marketplaceStore = inject(MarketplaceStore);
  protected readonly marketplaceFs = inject(MarketplaceFsService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly translate = inject(TranslateService);

  private readonly selectedVersions = signal<Map<string, string>>(new Map());
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

  protected selectedVersion(itemId: string): string | undefined {
    return this.selectedVersions().get(itemId);
  }

  protected setSelectedVersion(itemId: string, version: string): void {
    const next = new Map(this.selectedVersions());
    next.set(itemId, version);
    this.selectedVersions.set(next);
  }

  protected progressFor(itemId: string) {
    return this.marketplaceFs.progress().get(itemId);
  }

  /** The version installed locally for this item, if any — only ever populated in Electron (see `MarketplaceFsService.installed`). */
  protected installedVersion(itemId: string): string | undefined {
    return this.marketplaceFs.installed().get(itemId)?.version;
  }

  /** True when the currently-selected dropdown version is exactly what's already installed — greys out Download instead of offering a pointless re-download. */
  protected isSelectedVersionInstalled(item: MarketPlaceItemDto): boolean {
    const installed = this.installedVersion(item.id);
    if (!installed) return false;
    const selected = this.selectedVersion(item.id) ?? item.versions[0]?.version;
    return installed === selected;
  }

  /**
   * True when the selected dropdown version is older than what's installed
   * (by upload date, not string comparison — versions are free-form, not
   * enforced semver). Falls back to "update" (false) if the installed
   * version's own asset entry is gone (e.g. that version was since removed).
   */
  protected isDowngrade(item: MarketPlaceItemDto): boolean {
    const installed = this.installedVersion(item.id);
    const selected = this.selectedVersion(item.id) ?? item.versions[0]?.version;
    if (!installed || !selected) return false;

    const installedAsset = item.versions.find((version) => version.version === installed);
    const selectedAsset = item.versions.find((version) => version.version === selected);
    if (!installedAsset || !selectedAsset) return false;

    return new Date(selectedAsset.createdAt).getTime() < new Date(installedAsset.createdAt).getTime();
  }

  protected download(item: MarketPlaceItemDto): void {
    const version = this.selectedVersion(item.id) ?? item.versions[0]?.version;
    if (!version) return;
    void this.marketplaceStore.download(item, version);
  }

  protected async removeInstalled(item: MarketPlaceItemDto): Promise<void> {
    const confirmed = await this.confirmDialog.confirm({
      title: this.translate.instant('marketplace.confirmUninstallTitle'),
      message: this.translate.instant('marketplace.confirmUninstall', { name: item.name }),
      confirmLabel: this.translate.instant('marketplace.uninstall'),
      cancelLabel: this.translate.instant('common.cancel'),
      danger: true,
    });
    if (!confirmed) return;
    await this.marketplaceFs.uninstall(item.id);
  }
}
