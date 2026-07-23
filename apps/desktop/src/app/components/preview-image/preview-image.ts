import { Component, OnChanges, inject, input, signal } from '@angular/core';
import { PreviewImageService } from '../../core/marketplace/preview-image.service';

/**
 * Renders a single marketplace preview image, resolving the authenticated
 * blob URL via `PreviewImageService` — see that service for why a plain
 * `<img src>` doesn't work here. Shows nothing (parent controls the empty
 * state/placeholder) until the blob has loaded.
 */
@Component({
  selector: 'app-preview-image',
  standalone: true,
  template: `
    @if (url(); as src) {
      <img [src]="src" [alt]="alt()" class="h-full w-full object-cover" />
    }
  `,
})
export class PreviewImageComponent implements OnChanges {
  readonly itemId = input.required<string>();
  readonly fileId = input.required<string>();
  readonly alt = input<string>('');

  private readonly previewImages = inject(PreviewImageService);
  protected readonly url = signal<string | null>(null);

  ngOnChanges(): void {
    this.url.set(null);
    this.previewImages.getObjectUrl(this.itemId(), this.fileId()).subscribe((url) => this.url.set(url));
  }
}
