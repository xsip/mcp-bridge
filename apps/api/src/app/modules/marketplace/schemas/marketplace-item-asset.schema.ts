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

  /** md5 hex digest of the file's content — undefined for directories. Used to detect changes between versions. */
  @Prop({ required: false })
  hash?: string;

  /** Newline-count of the file's content — undefined for directories or content that looks binary. */
  @Prop({ required: false })
  lines?: number;
}

/** One file's line-count change between this version and the previous one. */
export class MarketPlaceItemAssetChangelogEntry {
  @Prop({ required: true })
  path: string;

  @Prop({ required: false })
  previousLines?: number;

  @Prop({ required: false })
  currentLines?: number;
}

/**
 * Diff between this version's zip and the previous version's zip, computed
 * once at upload time (see `MarketplaceService.addVersion`) by comparing
 * each file's md5 hash — never recomputed on read.
 */
export class MarketPlaceItemAssetChangelog {
  /** The version this one was compared against, or null if this is the item's first version. */
  @Prop({ required: false, default: null, type: String })
  previousVersion: string | null;

  @Prop({ required: true, type: [Object], default: [] })
  added: MarketPlaceItemAssetChangelogEntry[];

  @Prop({ required: true, type: [Object], default: [] })
  removed: MarketPlaceItemAssetChangelogEntry[];

  @Prop({ required: true, type: [Object], default: [] })
  modified: MarketPlaceItemAssetChangelogEntry[];
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

  /** Diff against the previous version, computed once at upload time — null for an item's first version. */
  @Prop({ required: false, type: Object, default: null })
  changelog: MarketPlaceItemAssetChangelog | null;
}

export const MarketPlaceItemAssetSchema = SchemaFactory.createForClass(MarketPlaceItemAsset);
MarketPlaceItemAssetSchema.index({ marketPlaceItemId: 1, version: 1 }, { unique: true });
