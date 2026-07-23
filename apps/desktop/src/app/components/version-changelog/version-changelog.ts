import { Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroMinusCircle, heroPencilSquare, heroPlusCircle } from '@ng-icons/heroicons/outline';
import { MarketPlaceItemAssetChangelogDto } from '@mcp-bridge/ui-client';

/**
 * Renders the file-level diff computed once at upload time (see
 * `MarketplaceService.buildChangelog`) between a version's zip and the
 * previous version's — added/removed/modified files, each with a
 * before/after line count where available.
 */
@Component({
  selector: 'app-version-changelog',
  standalone: true,
  imports: [TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroPlusCircle, heroMinusCircle, heroPencilSquare })],
  template: `
    @let log = changelog();

    <p class="text-xs text-text-muted">
      {{
        (log.previousVersion ? 'marketplaceDetail.changelogComparedTo' : 'marketplaceDetail.changelogInitialRelease')
          | translate: { version: log.previousVersion }
      }}
    </p>

    @if (log.added.length === 0 && log.removed.length === 0 && log.modified.length === 0) {
      <p class="mt-2 text-xs text-text-muted">{{ 'marketplaceDetail.changelogNoChanges' | translate }}</p>
    } @else {
      <ul class="mt-2 space-y-1">
        @for (entry of log.added; track entry.path) {
          <li class="flex items-center gap-1.5 text-xs">
            <ng-icon name="heroPlusCircle" class="h-3.5 w-3.5 shrink-0 text-success-text" />
            <span class="min-w-0 flex-1 truncate text-text-primary">{{ entry.path }}</span>
            @if (entry.currentLines !== undefined) {
              <span class="shrink-0 text-text-muted">{{ 'marketplaceDetail.changelogLines' | translate: { count: entry.currentLines } }}</span>
            }
          </li>
        }
        @for (entry of log.modified; track entry.path) {
          <li class="flex items-center gap-1.5 text-xs">
            <ng-icon name="heroPencilSquare" class="h-3.5 w-3.5 shrink-0 text-warn-text" />
            <span class="min-w-0 flex-1 truncate text-text-primary">{{ entry.path }}</span>
            <span class="shrink-0 text-text-muted">{{ entry.previousLines ?? '?' }} → {{ entry.currentLines ?? '?' }}</span>
          </li>
        }
        @for (entry of log.removed; track entry.path) {
          <li class="flex items-center gap-1.5 text-xs">
            <ng-icon name="heroMinusCircle" class="h-3.5 w-3.5 shrink-0 text-error-text" />
            <span class="min-w-0 flex-1 truncate text-text-muted line-through">{{ entry.path }}</span>
            @if (entry.previousLines !== undefined) {
              <span class="shrink-0 text-text-muted">{{ 'marketplaceDetail.changelogLines' | translate: { count: entry.previousLines } }}</span>
            }
          </li>
        }
      </ul>
    }
  `,
  styles: ``,
})
export class VersionChangelogComponent {
  readonly changelog = input.required<MarketPlaceItemAssetChangelogDto>();
}
