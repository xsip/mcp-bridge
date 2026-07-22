import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketPlaceUserDownloadDocument = MarketPlaceUserDownload & Document;

/**
 * Records that a user has downloaded a specific version of a marketplace
 * item. One document per (username, asset) pair — `consumeDownloadToken`
 * upserts this and only increments the download counters on first insert,
 * so re-downloading the same version never double-counts. Also doubles as
 * the "what versions does this user already have" ledger, so callers can
 * diff against `MarketPlaceItem.latestVersion` to offer an update.
 */
@Schema({ collection: 'marketplace_user_downloads', timestamps: true })
export class MarketPlaceUserDownload {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true, index: true })
  marketPlaceItemId: string;

  @Prop({ required: true })
  assetId: string;

  @Prop({ required: true })
  version: string;
}

export const MarketPlaceUserDownloadSchema = SchemaFactory.createForClass(MarketPlaceUserDownload);
MarketPlaceUserDownloadSchema.index({ username: 1, assetId: 1 }, { unique: true });
MarketPlaceUserDownloadSchema.index({ username: 1, marketPlaceItemId: 1 });
