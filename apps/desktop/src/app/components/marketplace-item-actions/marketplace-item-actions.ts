import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroArrowDownTray, heroArrowPath, heroTrash } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemDto } from '@mcp-loop/ui-client';
import { MarketplaceStore } from '../../core/marketplace/marketplace.store';
import { MarketplaceFsService } from '../../core/marketplace/marketplace-fs.service';
import { ConfirmDialogService } from '../../core/confirm/confirm-dialog.service';

/**
 * Version picker + Download/Update/Downgrade/Uninstall button + install
 * progress bar for a single marketplace item — shared between the browse
 * list (`Marketplace`) and the item detail page (`MarketplaceDetail`) so the
 * install-state logic (and its edge cases) exists in exactly one place.
 */
@Component({
  selector: 'app-marketplace-item-actions',
  standalone: true,
  imports: [FormsModule, TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroArrowDownTray, heroArrowPath, heroTrash })],
  template: `
    @if (item().versions.length > 0) {
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <select
          [ngModel]="selectedVersion() ?? item().versions[0].version"
          (ngModelChange)="selectedVersion.set($event)"
          (click)="$event.stopPropagation()"
          class="rounded-lg border border-border-default bg-primary px-2 py-1.5 text-xs text-text-primary"
        >
          @for (version of item().versions; track version.id) {
            <option [value]="version.version">{{ version.version }}</option>
          }
        </select>

        @if (isSelectedVersionInstalled()) {
          <button
            type="button"
            disabled
            (click)="$event.stopPropagation()"
            class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-depth-sm opacity-60"
          >
            <ng-icon name="heroArrowDownTray" class="h-3.5 w-3.5" />
            {{ 'marketplace.download' | translate }}
          </button>
        } @else if (installedVersion()) {
          <button
            type="button"
            (click)="$event.stopPropagation(); download()"
            class="press-feedback inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-depth-sm hover-lift"
          >
            <ng-icon name="heroArrowPath" class="h-3.5 w-3.5" />
            {{ (isDowngrade() ? 'marketplace.downgrade' : 'marketplace.update') | translate }}
          </button>
        } @else {
          <button
            type="button"
            (click)="$event.stopPropagation(); download()"
            class="press-feedback inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white shadow-depth-sm hover-lift"
          >
            <ng-icon name="heroArrowDownTray" class="h-3.5 w-3.5" />
            {{ 'marketplace.download' | translate }}
          </button>
        }

        @if (marketplaceFs.isElectron && installedVersion()) {
          <button
            type="button"
            (click)="$event.stopPropagation(); removeInstalled()"
            class="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border-default px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-error-bg hover:text-error-text"
          >
            <ng-icon name="heroTrash" class="h-3.5 w-3.5" />
            {{ 'marketplace.uninstall' | translate }}
          </button>
        }
      </div>
    }

    @if (progress(); as progress) {
      <div class="mt-3 w-full">
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
  `,
  styles: ``,
})
export class MarketplaceItemActionsComponent {
  readonly item = input.required<MarketPlaceItemDto>();

  protected readonly marketplaceStore = inject(MarketplaceStore);
  protected readonly marketplaceFs = inject(MarketplaceFsService);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly translate = inject(TranslateService);

  protected readonly selectedVersion = signal<string | undefined>(undefined);

  protected progress() {
    return this.marketplaceFs.progress().get(this.item().id);
  }

  /** The version installed locally for this item, if any — only ever populated in Electron (see `MarketplaceFsService.installed`). */
  protected installedVersion(): string | undefined {
    return this.marketplaceFs.installed().get(this.item().id)?.version;
  }

  /** True when the currently-selected dropdown version is exactly what's already installed — greys out Download instead of offering a pointless re-download. */
  protected isSelectedVersionInstalled(): boolean {
    const installed = this.installedVersion();
    if (!installed) return false;
    const selected = this.selectedVersion() ?? this.item().versions[0]?.version;
    return installed === selected;
  }

  /**
   * True when the selected dropdown version is older than what's installed
   * (by upload date, not string comparison — versions are free-form, not
   * enforced semver). Falls back to "update" (false) if the installed
   * version's own asset entry is gone (e.g. that version was since removed).
   */
  protected isDowngrade(): boolean {
    const item = this.item();
    const installed = this.installedVersion();
    const selected = this.selectedVersion() ?? item.versions[0]?.version;
    if (!installed || !selected) return false;

    const installedAsset = item.versions.find((version) => version.version === installed);
    const selectedAsset = item.versions.find((version) => version.version === selected);
    if (!installedAsset || !selectedAsset) return false;

    return new Date(selectedAsset.createdAt).getTime() < new Date(installedAsset.createdAt).getTime();
  }

  protected download(): void {
    const item = this.item();
    const version = this.selectedVersion() ?? item.versions[0]?.version;
    if (!version) return;
    void this.marketplaceStore.download(item, version);
  }

  protected async removeInstalled(): Promise<void> {
    const item = this.item();
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
