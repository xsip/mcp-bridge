import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { parseMcpId } from '@mcp-bridge/utils';
import { McpNotFoundError } from '@mcp-bridge/common';
import { CustomMcpDto } from '../auth/dto/custom-mcp.dto';
import { User, UserDocument } from '../auth/user.schema';
import { Mcp, McpDocument } from './schemas/mcp.schema';

export interface ResolvedMcp {
  ownerId: string;
  mcp: CustomMcpDto;
}

/**
 * Resolves a public mcp id (`<username>-<mcpName>`) used in the proxy URL
 * to the owning account and the active MCP configuration, so `ProxyService`
 * never touches the User or Mcp models directly.
 */
@Injectable()
export class McpLookupService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Mcp.name) private readonly mcpModel: Model<McpDocument>,
  ) {}

  async resolve(mcpId: string): Promise<ResolvedMcp> {
    const parsed = parseMcpId(mcpId);
    if (!parsed) {
      throw new McpNotFoundError(mcpId);
    }

    const user = await this.userModel.findOne({ username: parsed.username }).select('username isActivated').lean().exec();
    if (!user || !user.isActivated) {
      throw new McpNotFoundError(mcpId);
    }

    const mcp = await this.mcpModel.findOne({ ownerId: user.username, name: parsed.mcpName, active: true }).lean().exec();
    if (!mcp) {
      throw new McpNotFoundError(mcpId);
    }

    return {
      ownerId: user.username,
      mcp: { id: mcp.id, name: mcp.name, port: mcp.port, subPath: mcp.subPath, active: mcp.active, headers: mcp.headers },
    };
  }
}
