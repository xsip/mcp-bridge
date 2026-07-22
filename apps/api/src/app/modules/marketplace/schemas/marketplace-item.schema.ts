import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketPlaceItemDocument = MarketPlaceItem & Document;

export enum MarketPlaceVisibility {
  /** Listed for every logged-in user. */
  Public = 'public',
  /** Not listed, but reachable by anyone with the item's id. */
  Unlisted = 'unlisted',
  /** Only visible/manageable by the owner. */
  Private = 'private',
}

/** A preview image attached to a marketplace item, stored in GridFS (see `MarketplaceStorageService`). */
export class MarketPlaceItemPreviewImage {
  @Prop({ required: true })
  fileId: string;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  fileSize: number;
}

/**
 * A published MCP listing. Actual version payloads (zip blobs) live in
 * their own `MarketPlaceItemAsset` documents/collection — this document only
 * holds the listing's metadata. `id` is an application-level UUID (not
 * Mongo's `_id`) so it stays stable and URL-safe.
 */
@Schema({ collection: 'marketplace_items', timestamps: true })
export class MarketPlaceItem {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: false, default: '' })
  description: string;

  /** Username of the owning account. */
  @Prop({ required: true, index: true })
  ownerUsername: string;

  @Prop({ required: true, type: String, enum: Object.values(MarketPlaceVisibility), default: MarketPlaceVisibility.Private })
  visibility: MarketPlaceVisibility;

  @Prop({ required: false, type: [MarketPlaceItemPreviewImage], default: [] })
  previewImages: MarketPlaceItemPreviewImage[];

  /** Version string of the most recently added asset — convenience field for listings. */
  @Prop({ required: false, default: null, type: String })
  latestVersion: string | null;

  /**
   * Count of distinct (user, version) downloads across every version —
   * kept denormalized so listing/sorting doesn't need an aggregation over
   * `MarketPlaceItemAsset`. Updated alongside each asset's own
   * `downloadCount` in `MarketplaceService.consumeDownloadToken`.
   */
  @Prop({ required: true, default: 0 })
  totalDownloadCount: number;
}

export const MarketPlaceItemSchema = SchemaFactory.createForClass(MarketPlaceItem);
MarketPlaceItemSchema.index({ ownerUsername: 1, name: 1 }, { unique: true });
MarketPlaceItemSchema.index({ visibility: 1 });
MarketPlaceItemSchema.index({ totalDownloadCount: 1 });
