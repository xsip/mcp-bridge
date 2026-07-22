import { Component, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroGlobeAlt, heroXMark } from '@ng-icons/heroicons/outline';
import { ActiveSectionService } from '../../services/active-section.service';

export interface MobileNavLink {
  labelKey: string;
  fragment: string;
  /** Optional heroicons outline icon name, rendered before the label. */
  icon?: string;
}

/**
 * Slide-in mobile navigation drawer, opened from `Nav`'s hamburger button.
 * Owns no open/close state itself — fully controlled via `open` input and
 * the `closed` output, so `Nav` stays the single source of truth.
 *
 * Usage:
 *   <ui-mobile-sidenav [open]="isMenuOpen()" [links]="navLinks" (closed)="isMenuOpen.set(false)" />
 */
@Component({
  selector: 'ui-mobile-sidenav',
  standalone: true,
  imports: [RouterLink, TranslatePipe, NgIconComponent],
  viewProviders: [provideIcons({ heroXMark, heroGlobeAlt })],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-40 md:hidden">
        <button
          type="button"
          class="absolute inset-0 h-full w-full cursor-default bg-surface-sunken/70 animate-fade-in"
          [attr.aria-label]="'nav.closeMenu' | translate"
          (click)="closed.emit()"
        ></button>
        <nav
          class="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col gap-1 border-l border-border-default bg-primary p-6 shadow-depth-xl animate-slide-in-right"
          [attr.aria-label]="'nav.mobileMenu' | translate"
        >
          <button
            type="button"
            class="mb-4 ml-auto inline-flex h-8 w-8 items-center justify-center rounded-xl text-text-secondary hover:bg-accent-subtle hover:text-accent"
            [attr.aria-label]="'nav.closeMenu' | translate"
            (click)="closed.emit()"
          >
            <ng-icon name="heroXMark" class="h-4 w-4" />
          </button>

          @for (link of links(); track link.fragment) {
            <a
              [href]="'#' + link.fragment"
              (click)="onLinkClick($event, link.fragment)"
              class="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent-subtle hover:text-accent"
              [class.text-accent]="isActive(link.fragment)"
              [class.bg-accent-subtle]="isActive(link.fragment)"
              [class.text-text-secondary]="!isActive(link.fragment)"
            >
              @if (link.icon) {
                <ng-icon [name]="link.icon" class="h-4 w-4" />
              }
              {{ link.labelKey | translate }}
            </a>
          }

          <a
            href="https://github.com/xsip/mcp-bridge"
            target="_blank"
            (click)="closed.emit()"
            class="mt-4 rounded-lg bg-accent px-3 py-2.5 text-center text-sm font-semibold text-white hover-lift"
          >
            {{ 'nav.goToDashboard' | translate }}
          </a>
        </nav>
      </div>
    }
  `,
})
export class MobileSidenavComponent {
  private readonly activeSection = inject(ActiveSectionService);

  readonly open = input.required<boolean>();
  readonly links = input.required<MobileNavLink[]>();
  readonly closed = output<void>();

  protected isActive(fragment: string): boolean {
    return this.activeSection.activeHref() === '#' + fragment;
  }

  protected onLinkClick(event: Event, fragment: string): void {
    event.preventDefault();
    this.closed.emit();
    this.activeSection.scrollToSection('#' + fragment);
  }
}
