import {
  AfterViewInit,
  Directive,
  ElementRef,
  inject,
  Input,
  NgZone,
  OnDestroy,
} from '@angular/core';

/**
 * Applies its bound value as the host's `background-image` (lazily — only once
 * the host scrolls within roughly one viewport of the visible area) and nudges
 * `background-position` on scroll for a light parallax effect. Browser-only;
 * only ever applied inside `@if (isBrowser)` blocks in this repo, but the
 * `window` checks make it safe standalone too.
 *
 * Usage: `<div [uiParallax]="'some-image.png'"></div>`
 */
@Directive({
  selector: '[uiParallax]',
  standalone: true,
})
export class ParallaxDirective implements AfterViewInit, OnDestroy {
  @Input('uiParallax') imageUrl = '';

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private ticking = false;
  private loaded = false;
  private readonly onScroll = () => this.requestTick();

  ngAfterViewInit(): void {
    if (typeof window === 'undefined') return;
    this.zone.runOutsideAngular(() => {
      window.addEventListener('scroll', this.onScroll, { passive: true });
      window.addEventListener('resize', this.onScroll, { passive: true });
      this.update();
    });
  }

  ngOnDestroy(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('scroll', this.onScroll);
    window.removeEventListener('resize', this.onScroll);
  }

  private requestTick(): void {
    if (this.ticking) return;
    this.ticking = true;
    requestAnimationFrame(() => {
      this.update();
      this.ticking = false;
    });
  }

  private update(): void {
    const host = this.el.nativeElement;
    const rect = host.getBoundingClientRect();
    const viewportHeight = window.innerHeight || 1;

    if (!this.loaded && rect.top < viewportHeight * 2 && rect.bottom > -viewportHeight) {
      host.style.backgroundImage = `url(${this.imageUrl})`;
      this.loaded = true;
    }
    if (!this.loaded) return;

    const viewportCenter = viewportHeight / 2;
    const distanceFromCenter = rect.top + rect.height / 2 - viewportCenter;
    // The host uses `background-size: contain`, so the whole image is always
    // visible no matter the offset — this just floats it within the box.
    const offset = Math.max(-20, Math.min(20, distanceFromCenter * -0.05));
    host.style.backgroundPosition = `center calc(50% + ${offset}px)`;
  }
}
