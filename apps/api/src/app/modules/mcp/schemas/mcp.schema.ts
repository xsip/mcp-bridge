import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type McpDocument = Mcp & Document;

/**
 * A local MCP server a user registered on their account, in its own
 * collection (split out of the User document — see `McpMigrationService`
 * for the one-time move of pre-existing embedded data). The desktop agent
 * runs this MCP on `localhost:<port>`, optionally under `subPath`; the
 * backend itself never talks to that port/path — only the agent does.
 *
 * `id` is an application-level UUID (not Mongo's `_id`) so the public API
 * shape (`CustomMcpDto`) and every existing reference to an MCP's id stay
 * stable across the migration from the embedded representation.
 */
@Schema({ collection: 'mcps', timestamps: true })
export class Mcp {
  @Prop({ required: true, unique: true })
  id: string;

  /** Username of the owning account. */
  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  port: number;

  @Prop({ required: false })
  subPath?: string;

  @Prop({ required: true, default: true })
  active: boolean;

  @Prop({ required: false, type: Object })
  headers?: Record<string, string>;
}

export const McpSchema = SchemaFactory.createForClass(Mcp);
McpSchema.index({ ownerId: 1, name: 1 }, { unique: true });
