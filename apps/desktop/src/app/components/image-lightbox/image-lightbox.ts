import { Component, inject } from '@angular/core';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { heroXMark } from '@ng-icons/heroicons/outline';
import { ImageLightboxService } from '../../core/image-lightbox/image-lightbox.service';

/**
 * Full-screen image preview overlay, mounted once in `app.ts` — mirrors
 * `ConfirmDialogComponent`'s pattern (backdrop click / Esc both close).
 */
@Component({
  selector: 'app-image-lightbox',
  standalone: true,
  imports: [NgIconComponent],
  viewProviders: [provideIcons({ heroXMark })],
  host: {
    '(document:keydown.escape)': 'lightbox.close()',
  },
  template: `
    @if (lightbox.image(); as image) {
      <div class="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6" (click)="lightbox.close()">
        <button
          type="button"
          (click)="lightbox.close()"
          class="press-feedback absolute right-6 top-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
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
  protected readonly lightbox = inject(ImageLightboxService);
}
