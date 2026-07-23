import { Injectable, OnDestroy, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const ACTIVATION_LINE_PX = 160; // roughly sticky-nav height + a little breathing room

/**
 * Scrollspy: tracks which `#section` the user has scrolled past most recently and silently
 * syncs the URL hash (via history.replaceState, so it never adds a history entry or triggers
 * a router navigation/jump). Singleton — one scroll listener shared by every component that
 * needs the active link.
 */
@Injectable({ providedIn: 'root' })
export class ActiveSectionService implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);
  private sections: { href: string; el: HTMLElement }[] = [];
  private started = false;
  private rafId?: number;
  private onScroll = () => this.scheduleUpdate();

  readonly activeHref = signal<string | null>(null);

  observe(hrefs: string[]): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Re-scan every call: when navigating away and back, the previous section
    // elements are destroyed and new ones take their place in the DOM, so a
    // stale reference would silently stop matching any scroll position.
    this.sections = hrefs
      .map((href) => ({ href, el: document.getElementById(href.slice(1)) }))
      .filter((s): s is { href: string; el: HTMLElement } => !!s.el);

    if (!this.sections.length) return;

    if (!this.started) {
      this.started = true;
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
    }
    this.update(true);
  }

  /** Smoothly scrolls to `href` (e.g. `"#features"`), offsetting for the sticky nav. */
  scrollToSection(href: string): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const id = href.startsWith('#') ? href.slice(1) : href;
    const el = document.getElementById(id);
    if (!el) return;

    const top = el.getBoundingClientRect().top + window.scrollY - ACTIVATION_LINE_PX + 1;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  private scheduleUpdate(): void {
    if (this.rafId != null) return;
    this.rafId = requestAnimationFrame(() => {
      this.rafId = undefined;
      this.update();
    });
  }

  private update(initialNavigation = false): void {
    const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    const atTop = window.innerHeight + window.scrollY < this.sections[0].el.offsetTop;

    let current: string | null = null;
    if (atBottom) {
      // The last section may be shorter than the activation band and never cross it
      // (e.g. a short footer) — landing at the bottom of the page always counts as "there".
      current = this.sections[this.sections.length - 1].href;
    } else if(atTop && !initialNavigation) {
      current = '#';
    } else {
      for (const { href, el } of this.sections) {
        if (el.getBoundingClientRect().top <= ACTIVATION_LINE_PX) {
          current = href;
        }
      }
    }

    if (current !== this.activeHref()) {
      this.activeHref.set(current);
      history.replaceState(null, '', current);
    }
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
    if (this.rafId != null) cancelAnimationFrame(this.rafId);
  }
}
