import { Component, inject, input } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { ImageLightboxService } from './image-lightbox.service';

/**
 * Full-screen image preview overlay, mounted once in an app's root
 * component — mirrors the `ConfirmDialogComponent` pattern (backdrop click /
 * Esc both close).
 *
 * `topOffsetPx` lets a host reserve space for its own fixed header (e.g. the
 * desktop app's custom titlebar) instead of the overlay covering it; it
 * defaults to 0, which covers the full viewport.
 */
@Component({
  selector: 'ui-image-lightbox',
  standalone: true,
  imports: [NgIconComponent],
  viewProviders: [provideIcons({ heroXMark })],
  host: {
    '(document:keydown.escape)': 'lightbox.close()',
  },
  template: `
    @if (lightbox.image(); as image) {
      <div
        class="animate-fade-in fixed inset-x-0 bottom-0 z-50 flex items-center justify-center bg-primary/80 p-6"
        [style.top.px]="topOffsetPx()"
        (click)="lightbox.close()"
      >
        <button
          type="button"
          (click)="lightbox.close()"
          class="press-feedback absolute right-6 top-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-2/90 text-secondary hover:bg-white/20"
          aria-label="Close"
        >
          <ng-icon name="heroXMark" class="h-5 w-5" />
        </button>
        <img
          [src]="image.url"
          [alt]="image.alt"
          class="animate-pop-in max-h-full max-w-full rounded-xl object-contain shadow-depth-xl"
          (click)="$event.stopPropagation()"
        />
      </div>
    }
  `,
  styles: ``,
})
export class ImageLightboxComponent {
  readonly topOffsetPx = input(0);

  protected readonly lightbox = inject(ImageLightboxService);
}
