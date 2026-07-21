import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AppLogger } from '@mcp-bridge/logging';
import { User, UserDocument } from '../auth/user.schema';
import { Mcp, McpDocument } from './schemas/mcp.schema';
import { McpLogRecord, McpLogDocument } from './schemas/mcp-log.schema';

/** Shape of the legacy embedded data — no longer part of the `User` schema, so read via the raw driver. */
interface LegacyLogEntry {
  id: string;
  requestId: string;
  method: string;
  path: string;
  status?: number;
  requestBody?: unknown;
  responseBody?: unknown;
  ok: boolean;
  errorMessage?: string;
  durationMs: number;
  timestamp: string;
}

interface LegacyMcp {
  id: string;
  name: string;
  port: number;
  subPath?: string;
  active: boolean;
  headers?: Record<string, string>;
  logs?: LegacyLogEntry[];
}

interface LegacyUserDoc {
  _id: Types.ObjectId;
  username: string;
  customMcps?: LegacyMcp[];
}

/**
 * One-time move of `User.customMcps` (and its embedded `logs`) into the
 * dedicated `mcps`/`mcp_logs` collections — run once at boot, idempotent,
 * and safe to leave in place permanently (it's a no-op once every user has
 * been migrated). Reads the legacy field via the raw driver
 * (`userModel.collection`) since it was removed from the `User` schema —
 * Mongoose only returns declared paths otherwise.
 *
 * Preserves the original `id` of every migrated MCP and log entry, so
 * anything that already referenced them (a running desktop agent, a
 * bookmarked `/mcp/<username>-<name>` URL) keeps working unchanged.
 */
@Injectable()
export class McpMigrationService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Mcp.name) private readonly mcpModel: Model<McpDocument>,
    @InjectModel(McpLogRecord.name) private readonly mcpLogModel: Model<McpLogDocument>,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(McpMigrationService.name);
  }

  async onModuleInit(): Promise<void> {
    const legacyUsers = (await this.userModel.collection
      .find({ customMcps: { $exists: true, $not: { $size: 0 } } })
      .toArray()) as unknown as LegacyUserDoc[];

    if (legacyUsers.length === 0) return;

    this.logger.log(`Migrating legacy customMcps for ${legacyUsers.length} user(s) into the mcps/mcp_logs collections`);

    for (const user of legacyUsers) {
      for (const legacyMcp of user.customMcps ?? []) {
        await this.migrateMcp(user.username, legacyMcp);
      }
      await this.userModel.collection.updateOne({ _id: user._id }, { $unset: { customMcps: '' } });
    }

    this.logger.log('Legacy customMcps migration complete');
  }

  private async migrateMcp(ownerId: string, legacyMcp: LegacyMcp): Promise<void> {
    const alreadyMigrated = await this.mcpModel.exists({ id: legacyMcp.id });
    if (!alreadyMigrated) {
      await this.mcpModel.create({
        id: legacyMcp.id,
        ownerId,
        name: legacyMcp.name,
        port: legacyMcp.port,
        subPath: legacyMcp.subPath,
        active: legacyMcp.active,
        headers: legacyMcp.headers,
      });
    }

    for (const legacyLog of legacyMcp.logs ?? []) {
      const logAlreadyMigrated = await this.mcpLogModel.exists({ id: legacyLog.id });
      if (logAlreadyMigrated) continue;

      await this.mcpLogModel.create({
        id: legacyLog.id,
        ownerId,
        mcpId: legacyMcp.id,
        mcpName: legacyMcp.name,
        requestId: legacyLog.requestId,
        method: legacyLog.method,
        path: legacyLog.path,
        status: legacyLog.status,
        requestBody: legacyLog.requestBody,
        responseBody: legacyLog.responseBody,
        ok: legacyLog.ok,
        errorMessage: legacyLog.errorMessage,
        durationMs: legacyLog.durationMs,
        timestamp: new Date(legacyLog.timestamp),
      });
    }
  }
}
