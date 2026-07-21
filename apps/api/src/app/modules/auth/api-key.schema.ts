import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ApiKeyDocument = ApiKey & Document;

/**
 * A long-lived credential a user can generate to authenticate calls to
 * `/mcp/:mcpId` (the proxy) without their short-lived JWT — see
 * `ApiKeyAuthGuard`. Only `keyHash` (a SHA-256 digest of the raw key) is
 * ever persisted; the raw key itself is returned once, at creation time,
 * and never stored or retrievable again.
 */
@Schema({ collection: 'apiKeys', timestamps: true })
export class ApiKey {
  @Prop({ required: true, unique: true })
  id: string;

  /** Username of the owning account. */
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true })
  name: string;

  /** SHA-256 hex digest of the raw key — looked up directly, not compared via bcrypt. */
  @Prop({ required: true, unique: true })
  keyHash: string;

  /** First few characters of the raw key, kept in the clear so the user can tell keys apart in the list. */
  @Prop({ required: true })
  prefix: string;

  @Prop({ required: false, default: null, type: Date })
  lastUsedAt: Date | null;

  /** Set once the key is revoked; a revoked key is rejected by ApiKeyAuthGuard but kept around for audit purposes. */
  @Prop({ required: false, default: null, type: Date })
  revokedAt: Date | null;
}

export const ApiKeySchema = SchemaFactory.createForClass(ApiKey);
