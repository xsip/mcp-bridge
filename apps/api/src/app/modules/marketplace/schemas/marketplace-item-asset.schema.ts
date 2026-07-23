import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketPlaceItemAssetDocument = MarketPlaceItemAsset & Document;

/** One entry (file or folder) inside an uploaded zip, captured at upload time. */
export class MarketPlaceItemAssetManifestEntry {
  @Prop({ required: true })
  path: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  isDirectory: boolean;
}

/**
 * One published version of a `MarketPlaceItem`. The zip payload itself is
 * stored in GridFS (see `MarketplaceStorageService`); this document only
 * holds the version's metadata and a `fileId` pointer into GridFS.
 */
@Schema({ collection: 'marketplace_item_assets', timestamps: true })
export class MarketPlaceItemAsset {
  @Prop({ required: true, unique: true })
  id: string;

  /** The `MarketPlaceItem.id` this version belongs to. */
  @Prop({ required: true, index: true })
  marketPlaceItemId: string;

  @Prop({ required: true })
  version: string;

  /** GridFS file id (as a string) holding the zip blob. */
  @Prop({ required: true })
  fileId: string;

  @Prop({ required: true })
  fileSize: number;

  @Prop({ required: true })
  originalFilename: string;

  /** sha256 hex digest of the zip contents, for integrity verification. */
  @Prop({ required: true })
  checksum: string;

  /** Username of the account that uploaded this version. */
  @Prop({ required: true })
  uploadedBy: string;

  /** Count of distinct users who have downloaded this specific version. */
  @Prop({ required: true, default: 0 })
  downloadCount: number;

  /** Flat listing of every entry in the zip (files and folders), captured once at upload time. */
  @Prop({ required: true, type: [Object], default: [] })
  fileManifest: MarketPlaceItemAssetManifestEntry[];
}

export const MarketPlaceItemAssetSchema = SchemaFactory.createForClass(MarketPlaceItemAsset);
MarketPlaceItemAssetSchema.index({ marketPlaceItemId: 1, version: 1 }, { unique: true });
