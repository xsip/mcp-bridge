import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type McpLogDocument = McpLogRecord & Document;

/**
 * One proxied request/response attempt, in its own collection — split out
 * of `User.customMcps[].logs` specifically for write/read performance:
 * logs are high-churn (one write per proxied request) and unbounded in
 * aggregate, which made them a poor fit for living inside the User
 * document. Indexed for the two access patterns `McpLogService` needs:
 * "every log for this account" and "every log for this MCP", both newest
 * first.
 */
@Schema({ collection: 'mcp_logs', timestamps: false })
export class McpLogRecord {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true, index: true })
  ownerId: string;

  @Prop({ required: true, index: true })
  mcpId: string;

  @Prop({ required: true })
  mcpName: string;

  @Prop({ required: true })
  requestId: string;

  @Prop({ required: true })
  method: string;

  @Prop({ required: true })
  path: string;

  @Prop({ required: false })
  status?: number;

  @Prop({ required: false, type: Object })
  requestBody?: unknown;

  @Prop({ required: false, type: Object })
  responseBody?: unknown;

  @Prop({ required: true })
  ok: boolean;

  @Prop({ required: false })
  errorMessage?: string;

  @Prop({ required: true })
  durationMs: number;

  @Prop({ required: true, index: true })
  timestamp: Date;
}

export const McpLogSchema = SchemaFactory.createForClass(McpLogRecord);
McpLogSchema.index({ ownerId: 1, timestamp: -1 });
McpLogSchema.index({ mcpId: 1, timestamp: -1 });
