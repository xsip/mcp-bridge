import { Injectable, signal } from '@angular/core';

export interface LightboxImage {
  url: string;
  alt: string;
}

/**
 * Global "open this image big" overlay state, rendered by
 * `ImageLightboxComponent` (mounted once in `app.ts`) — same
 * signal-holds-the-request shape as `ConfirmDialogService`.
 */
@Injectable({ providedIn: 'root' })
export class ImageLightboxService {
  readonly image = signal<LightboxImage | null>(null);

  open(image: LightboxImage): void {
    this.image.set(image);
  }

  close(): void {
    this.image.set(null);
  }
}
