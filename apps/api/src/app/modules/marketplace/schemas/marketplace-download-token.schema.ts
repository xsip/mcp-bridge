import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MarketPlaceDownloadTokenDocument = MarketPlaceDownloadToken & Document;

/**
 * A single-use token exchanged for a version's zip blob. Issued by
 * `POST /marketplace/items/:id/versions/:version/download-link` and consumed
 * exactly once by `GET /marketplace/download/:token`, which flips `used` in
 * the same lookup so a retried/replayed token can never succeed twice.
 */
@Schema({ collection: 'marketplace_download_tokens', timestamps: true })
export class MarketPlaceDownloadToken {
  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true, index: true })
  assetId: string;

  /** Username of the account the token was issued to. */
  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ required: true, default: false })
  used: boolean;
}

export const MarketPlaceDownloadTokenSchema = SchemaFactory.createForClass(MarketPlaceDownloadToken);
// TTL index — Mongo automatically drops expired (and thus useless) tokens.
MarketPlaceDownloadTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
