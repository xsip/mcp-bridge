import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { Model } from 'mongoose';
import { AddCustomMcpDto, CustomMcpDto, UpdateCustomMcpDto, normalizeSubPath } from '../auth/dto/custom-mcp.dto';
import { Mcp, McpDocument } from './schemas/mcp.schema';

/**
 * Owns CRUD operations on a user's MCPs, stored in their own `mcps`
 * collection (see `Mcp` schema). Each user configures one or more local
 * MCP servers (name + the port/sub-path their desktop agent should
 * forward to); the public id for a given MCP is `<username>-<name>`.
 */
@Injectable()
export class McpService {
  constructor(@InjectModel(Mcp.name) private readonly mcpModel: Model<McpDocument>) {}

  async list(username: string): Promise<CustomMcpDto[]> {
    const mcps = await this.mcpModel.find({ ownerId: username }).lean().exec();
    return mcps.map(toDto);
  }

  async add(username: string, dto: AddCustomMcpDto): Promise<CustomMcpDto> {
    const existing = await this.mcpModel.findOne({ ownerId: username, name: dto.name }).lean().exec();
    if (existing) {
      throw new ConflictException(`An MCP named "${dto.name}" already exists on this account`);
    }

    const mcp = await this.mcpModel.create({
      id: randomUUID(),
      ownerId: username,
      name: dto.name,
      transport: dto.transport ?? 'http',
      port: dto.port,
      subPath: dto.subPath,
      command: dto.command,
      args: dto.args,
      env: dto.env,
      active: true,
      headers: dto.headers,
    });

    return toDto(mcp);
  }

  async update(username: string, mcpId: string, dto: UpdateCustomMcpDto): Promise<CustomMcpDto> {
    const mcp = await this.mcpModel.findOne({ ownerId: username, id: mcpId }).exec();
    if (!mcp) {
      throw new NotFoundException(`No MCP with id "${mcpId}" on this account`);
    }

    if (dto.port !== undefined) {
      mcp.port = dto.port;
    }
    if (dto.subPath !== undefined) {
      mcp.subPath = normalizeSubPath(dto.subPath);
    }
    if (dto.command !== undefined) {
      mcp.command = dto.command;
    }
    if (dto.args !== undefined) {
      mcp.args = dto.args;
    }
    if (dto.env !== undefined) {
      mcp.env = dto.env;
    }
    if (dto.active !== undefined) {
      mcp.active = dto.active;
    }
    if (dto.headers !== undefined) {
      mcp.headers = dto.headers;
    }

    await mcp.save();
    return toDto(mcp);
  }

  async remove(username: string, mcpId: string): Promise<void> {
    const result = await this.mcpModel.deleteOne({ ownerId: username, id: mcpId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`No MCP with id "${mcpId}" on this account`);
    }
  }
}

function toDto(mcp: Mcp): CustomMcpDto {
  return {
    id: mcp.id,
    name: mcp.name,
    transport: mcp.transport ?? 'http',
    port: mcp.port,
    subPath: mcp.subPath,
    command: mcp.command,
    args: mcp.args,
    env: mcp.env,
    active: mcp.active,
    headers: mcp.headers,
  };
}
