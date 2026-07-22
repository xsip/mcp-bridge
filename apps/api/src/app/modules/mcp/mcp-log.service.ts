import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { McpLogWithContextDto } from './dto/mcp-log-entry.dto';
import { McpLogPageDto } from './dto/mcp-log-page.dto';
import { McpLogRecord, McpLogDocument } from './schemas/mcp-log.schema';
import { Mcp, McpDocument } from './schemas/mcp.schema';

/** How many log entries are kept per MCP — oldest entries beyond this are trimmed after each write. */
const MAX_LOGS_PER_MCP = 1000;

export interface RecordLogInput {
  requestId: string;
  method: string;
  path: string;
  status?: number;
  requestBody?: unknown;
  responseBody?: unknown;
  ok: boolean;
  errorMessage?: string;
  durationMs: number;
}

/**
 * Persists and retrieves per-MCP request/response logs, in their own
 * `mcp_logs` collection — split out of the User document specifically for
 * performance: logs are high-churn (one write per proxied request) and
 * unbounded in aggregate, so keeping them off the User document keeps
 * every other read/write against that document fast regardless of how
 * much traffic an account's MCPs have seen.
 */
@Injectable()
export class McpLogService {
  constructor(
    @InjectModel(McpLogRecord.name) private readonly mcpLogModel: Model<McpLogDocument>,
    @InjectModel(Mcp.name) private readonly mcpModel: Model<McpDocument>,
  ) {}

  async record(ownerId: string, mcpId: string, mcpName: string, input: RecordLogInput): Promise<void> {
    await this.mcpLogModel.create({
      id: randomUUID(),
      ownerId,
      mcpId,
      mcpName,
      timestamp: new Date(),
      ...input,
    });

    await this.trim(mcpId);
  }

  async listForMcp(
    ownerId: string,
    mcpId: string,
    page: number,
    pageSize: number,
    toolCallsOnly = false,
    todayOnly = false,
  ): Promise<McpLogPageDto> {
    const mcp = await this.mcpModel.findOne({ ownerId, id: mcpId }).lean().exec();
    if (!mcp) {
      throw new NotFoundException(`No MCP with id "${mcpId}" on this account`);
    }

    return this.paginate(this.withFilters({ ownerId, mcpId }, toolCallsOnly, todayOnly), page, pageSize);
  }

  listForOwner(ownerId: string, page: number, pageSize: number, toolCallsOnly = false, todayOnly = false): Promise<McpLogPageDto> {
    return this.paginate(this.withFilters({ ownerId }, toolCallsOnly, todayOnly), page, pageSize);
  }

  /**
   * Narrows a log filter to JSON-RPC "tools/call" entries and/or today's
   * calendar day (server-local), both independently toggleable and
   * combinable — either, both, or neither can be applied at once.
   */
  private withFilters(filter: Record<string, unknown>, toolCallsOnly: boolean, todayOnly: boolean): Record<string, unknown> {
    const combined = { ...filter };
    if (toolCallsOnly) {
      combined['requestBody.method'] = 'tools/call';
    }
    if (todayOnly) {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      combined['timestamp'] = { $gte: startOfToday };
    }
    return combined;
  }

  /** Deletes one log entry, scoped to its owner so a user can never delete another account's logs. */
  async deleteOne(ownerId: string, logId: string): Promise<void> {
    const result = await this.mcpLogModel.deleteOne({ ownerId, id: logId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`No log entry with id "${logId}" on this account`);
    }
  }

  /**
   * Bulk delete, scoped to the owner. Precedence: an explicit `ids` list
   * wins; otherwise `mcpId` deletes every log for that one MCP; with
   * neither, every log the owner has is deleted.
   */
  async deleteMany(ownerId: string, options: { ids?: string[]; mcpId?: string }): Promise<number> {
    const filter: Record<string, unknown> = { ownerId };
    if (options.ids?.length) {
      filter['id'] = { $in: options.ids };
    } else if (options.mcpId) {
      filter['mcpId'] = options.mcpId;
    }

    const result = await this.mcpLogModel.deleteMany(filter).exec();
    return result.deletedCount ?? 0;
  }

  private async paginate(filter: Record<string, unknown>, page: number, pageSize: number): Promise<McpLogPageDto> {
    const skip = (page - 1) * pageSize;
    const [items, total] = await Promise.all([
      this.mcpLogModel.find(filter).sort({ timestamp: -1 }).skip(skip).limit(pageSize).lean().exec(),
      this.mcpLogModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map(toDto),
      total,
      page,
      pageSize,
    };
  }

  /** Keeps at most `MAX_LOGS_PER_MCP` entries per MCP, oldest first to go. */
  private async trim(mcpId: string): Promise<void> {
    const count = await this.mcpLogModel.countDocuments({ mcpId }).exec();
    const surplus = count - MAX_LOGS_PER_MCP;
    if (surplus <= 0) return;

    const oldest = await this.mcpLogModel.find({ mcpId }).sort({ timestamp: 1 }).limit(surplus).select('_id').lean().exec();
    await this.mcpLogModel.deleteMany({ _id: { $in: oldest.map((doc) => doc._id) } }).exec();
  }
}

function toDto(entry: McpLogRecord): McpLogWithContextDto {
  return {
    id: entry.id,
    mcpId: entry.mcpId,
    mcpName: entry.mcpName,
    requestId: entry.requestId,
    method: entry.method,
    path: entry.path,
    status: entry.status,
    requestBody: entry.requestBody,
    responseBody: entry.responseBody,
    ok: entry.ok,
    errorMessage: entry.errorMessage,
    durationMs: entry.durationMs,
    timestamp: entry.timestamp instanceof Date ? entry.timestamp.toISOString() : entry.timestamp,
  };
}
