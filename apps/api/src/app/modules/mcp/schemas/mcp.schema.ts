import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type McpDocument = Mcp & Document;

export type McpTransport = 'http' | 'stdio';

/**
 * A local MCP server a user registered on their account, in its own
 * collection (split out of the User document — see `McpMigrationService`
 * for the one-time move of pre-existing embedded data). The desktop agent
 * runs this MCP either as an HTTP server on `localhost:<port>` (optionally
 * under `subPath`), or as a local child process talking MCP over stdio
 * (`command` + `args`); the backend itself never talks to it directly —
 * only the agent does.
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

  @Prop({ required: true, default: 'http' })
  transport: McpTransport;

  /** Required when `transport` is "http". */
  @Prop({ required: false })
  port?: number;

  /** Only used when `transport` is "http". */
  @Prop({ required: false })
  subPath?: string;

  /** Required when `transport` is "stdio" — the executable to spawn. */
  @Prop({ required: false })
  command?: string;

  /** Only used when `transport` is "stdio". */
  @Prop({ required: false, type: [String] })
  args?: string[];

  /** Only used when `transport` is "stdio" — extra environment variables for the spawned process. */
  @Prop({ required: false, type: Object })
  env?: Record<string, string>;

  @Prop({ required: true, default: true })
  active: boolean;

  /** Only used when `transport` is "http". */
  @Prop({ required: false, type: Object })
  headers?: Record<string, string>;
}

export const McpSchema = SchemaFactory.createForClass(Mcp);
McpSchema.index({ ownerId: 1, name: 1 }, { unique: true });
