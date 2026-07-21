import {
  AfterViewInit,
  Directive,
  ElementRef,
  inject,
  input,
  OnDestroy,
  PLATFORM_ID,
  Renderer2,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type AnimateOnScrollEffect = 'up' | 'down' | 'left' | 'right' | 'fade' | 'zoom';

/**
 * Reveals the host element as it scrolls into view — fading/sliding/zooming in
 * from its resting (fully visible, untransformed) state.
 *
 * SSR/no-JS safety: the "pre-animation" hidden state (`ui-aos-init`) is only
 * ever added from `ngAfterViewInit`, which never runs on the server and never
 * runs at all if the client doesn't execute Angular's JS. So server-rendered
 * markup, and any client with JS disabled, always shows the element fully
 * visible — there is no CSS rule anywhere that hides it by default. Only once
 * this directive runs in a real browser does the element briefly go
 * transparent/offset, then the `IntersectionObserver` reveals it (adds
 * `ui-aos-visible`) the moment it scrolls near the viewport.
 *
 * Usage: `<div uiAnimateOnScroll="left">...</div>` (effect defaults to "up").
 */
@Directive({
  selector: '[uiAnimateOnScroll]',
  standalone: true,
})
export class AnimateOnScrollDirective implements AfterViewInit, OnDestroy {
  readonly effect = input<AnimateOnScrollEffect>('up', { alias: 'uiAnimateOnScroll' });
  /** Stagger delay in ms, applied via `transition-delay` — for cascading groups of siblings. */
  readonly aosDelay = input(0);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);

  private observer?: IntersectionObserver;

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const host = this.el.nativeElement;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) return;

    this.renderer.addClass(host, 'ui-aos');
    this.renderer.addClass(host, `ui-aos--${this.effect()}`);
    const delay = this.aosDelay();
    if (delay) {
      this.renderer.setStyle(host, 'transition-delay', `${delay}ms`);
    }
    // Added only here (browser + JS running) — never present in SSR output.
    this.renderer.addClass(host, 'ui-aos-init');

    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          this.renderer.addClass(host, 'ui-aos-visible');
          this.observer?.unobserve(host);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    this.observer.observe(host);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
