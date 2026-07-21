import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroBars3 } from '@ng-icons/heroicons/outline';
import { DarkModeToggleComponent, LanguageSwitcherComponent } from '@mcp-bridge/ui-components';
import { MobileSidenavComponent, MobileNavLink } from '../mobile-sidenav/mobile-sidenav';
import { ActiveSectionService } from '../../services/active-section.service';

const NAV_LINKS: MobileNavLink[] = [
  { labelKey: 'nav.links.howItWorks', fragment: 'how-it-works' },
  { labelKey: 'nav.links.features', fragment: 'features' },
  { labelKey: 'nav.links.faq', fragment: 'faq' },
];

/**
 * Site-wide header: logo, desktop nav links, dark-mode toggle, and the
 * "Go to Dashboard" CTA. Below the `md` breakpoint the links collapse
 * behind a hamburger button that opens `MobileSidenavComponent`.
 *
 * Nav links scroll smoothly to their in-page section (via
 * `ActiveSectionService.scrollToSection`) instead of doing a router
 * fragment navigation, and highlight themselves once that section becomes
 * active while the user scrolls.
 */
@Component({
  selector: 'ui-nav',
  standalone: true,
  imports: [RouterLink, TranslatePipe, NgIconComponent, DarkModeToggleComponent, LanguageSwitcherComponent, MobileSidenavComponent],
  viewProviders: [provideIcons({ heroBars3 })],
  template: `
    <header class="sticky top-0 z-30 border-b border-border-default bg-primary/85 backdrop-blur">
      <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <a routerLink="/" class="flex items-center gap-2">
          <img src="logo-no-text.png" alt="MCP Bridge" class="h-12" />
          <span class="text-sm font-semibold tracking-tight text-text-primary">MCP Bridge</span>
        </a>

        <nav class="hidden items-center gap-1 md:flex" [attr.aria-label]="'nav.primaryMenu' | translate">
          @for (link of navLinks; track link.fragment) {
            <a
              [href]="'#' + link.fragment"
              (click)="onLinkClick($event, link.fragment)"
              class="rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent-subtle hover:text-accent"
              [class.text-accent]="isActive(link.fragment)"
              [class.bg-accent-subtle]="isActive(link.fragment)"
              [class.text-text-secondary]="!isActive(link.fragment)"
            >
              {{ link.labelKey | translate }}
            </a>
          }
        </nav>

        <div class="flex items-center gap-2">
          <ui-language-switcher />
          <ui-dark-mode-toggle />

          <a
            routerLink="/dashboard"
            class="hidden rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white shadow-depth-sm hover-lift md:inline-flex"
          >
            {{ 'nav.goToDashboard' | translate }}
          </a>

          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border-default text-text-secondary hover:border-accent/50 hover:bg-accent-subtle hover:text-accent md:hidden"
            [attr.aria-label]="'nav.openMenu' | translate"
            (click)="isMobileMenuOpen.set(true)"
          >
            <ng-icon name="heroBars3" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>

    <ui-mobile-sidenav [open]="isMobileMenuOpen()" [links]="navLinks" (closed)="isMobileMenuOpen.set(false)" />
  `,
})
export class NavComponent {
  private readonly activeSection = inject(ActiveSectionService);

  protected readonly navLinks = NAV_LINKS;
  protected readonly isMobileMenuOpen = signal(false);

  protected isActive(fragment: string): boolean {
    return this.activeSection.activeHref() === '#' + fragment;
  }

  protected onLinkClick(event: Event, fragment: string): void {
    event.preventDefault();
    this.activeSection.scrollToSection('#' + fragment);
  }
}
