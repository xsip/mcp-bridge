import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

/**
 * Fetches a marketplace item's preview image as a blob and turns it into an
 * object URL — a plain `<img [src]>` can't carry the Authorization header
 * the endpoint requires, so this goes through `HttpClient` (which
 * `authInterceptor` attaches the bearer token to) instead of a raw `src`.
 * Object URLs are cached per (itemId, fileId) for the lifetime of the app;
 * never revoked, but these are small thumbnails, not a meaningful leak.
 */
@Injectable({ providedIn: 'root' })
export class PreviewImageService {
  private readonly http = inject(HttpClient);
  private readonly cache = new Map<string, Observable<string>>();

  getObjectUrl(itemId: string, fileId: string): Observable<string> {
    const key = `${itemId}:${fileId}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const request$ = this.http.get(`/api/marketplace/items/${itemId}/preview-images/${fileId}`, { responseType: 'blob' }).pipe(
      map((blob) => URL.createObjectURL(blob)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cache.set(key, request$);
    return request$;
  }

  /** Drops a cached object URL — call after removing an image so a re-add with the same fileId (impossible in practice, but cheap insurance) doesn't serve a stale blob. */
  invalidate(itemId: string, fileId: string): void {
    this.cache.delete(`${itemId}:${fileId}`);
  }
}
