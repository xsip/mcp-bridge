import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroFolderOpen } from '@ng-icons/heroicons/outline';
import { MarketplaceFsService } from '../../core/marketplace/marketplace-fs.service';

/**
 * "Settings" route — Electron-only (filesystem access doesn't exist in a
 * plain browser tab, see `MarketplaceFsService.isElectron`). Currently just
 * the marketplace download directory; redirects away if somehow reached
 * outside Electron (e.g. a stale bookmark/deep link).
 */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroFolderOpen })],
  template: `
    <div class="mx-auto max-w-2xl animate-slide-up">
      <h1 class="text-xl font-semibold text-text-primary">{{ 'settings.title' | translate }}</h1>
      <p class="mt-1 text-sm text-text-secondary">{{ 'settings.subtitle' | translate }}</p>

      <div class="mt-6 rounded-2xl border border-border-default bg-primary-2 p-4">
        <label for="downloadDirectory" class="mb-1 block text-xs font-medium text-text-secondary">{{ 'settings.downloadDirectory' | translate }}</label>
        <div class="flex items-center gap-2">
          <input
            id="downloadDirectory"
            type="text"
            readonly
            [value]="marketplaceFs.downloadDirectory() || ('settings.noDirectorySet' | translate)"
            class="w-full min-w-0 flex-1 rounded-lg border border-border-default bg-primary px-3 py-2 text-sm text-text-primary"
          />
          <button
            type="button"
            (click)="pickDirectory()"
            class="press-feedback inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-white shadow-depth-sm hover-lift"
          >
            <ng-icon name="heroFolderOpen" class="h-4 w-4" />
            {{ 'settings.chooseDirectory' | translate }}
          </button>
        </div>
        <p class="mt-2 text-xs text-text-muted">{{ 'settings.downloadDirectoryHint' | translate }}</p>
      </div>
    </div>
  `,
  styles: ``,
})
export class Settings implements OnInit {
  protected readonly marketplaceFs = inject(MarketplaceFsService);
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (!this.marketplaceFs.isElectron) {
      void this.router.navigate(['/marketplace']);
    }
  }

  protected async pickDirectory(): Promise<void> {
    await this.marketplaceFs.pickDownloadDirectory();
  }
}
