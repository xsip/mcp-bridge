import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { McpTransport } from '../../mcp/schemas/mcp.schema';

/** MCP name constraints — used to build the public id `<username>-<mcpName>`. */
export const MCP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Allowed characters in a sub-path, once normalized to start with "/" and have no trailing "/". */
export const SUB_PATH_PATTERN = /^\/[a-zA-Z0-9\-_/]*[a-zA-Z0-9\-_]$|^\/[a-zA-Z0-9\-_]$/;

export const MCP_TRANSPORTS: McpTransport[] = ['http', 'stdio'];

/**
 * Normalizes user input for the optional local sub-path: trims whitespace,
 * treats blank as "none", ensures a single leading slash, and strips any
 * trailing slash — so `"api/v1"`, `"/api/v1"`, and `"/api/v1/"` all end up
 * stored as `"/api/v1"`.
 */
export function normalizeSubPath(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.length > 1 && withLeadingSlash.endsWith('/') ? withLeadingSlash.slice(0, -1) : withLeadingSlash;
}

/**
 * A local MCP server the user registered on their account. The desktop
 * agent runs it either as an HTTP server on `localhost:<port>` (optionally
 * under `subPath`, e.g. `port: 4001, subPath: "/api/mcp"` reaches
 * `http://localhost:4001/api/mcp`), or as a local child process speaking
 * MCP over stdio (`command` + `args`); the backend never talks to it
 * directly — only the agent does, after receiving a forwarded request for
 * `<username>-<name>` over its WebSocket connection.
 */
export class CustomMcpDto {
  @ApiProperty()
  @IsString()
  id: string;

  @ApiProperty({ example: 'notes', description: 'Unique (per user) name — the public id becomes "<username>-<name>"' })
  @IsString()
  @MinLength(1)
  @MaxLength(63)
  @Matches(MCP_NAME_PATTERN, { message: 'name must be lowercase alphanumeric with optional hyphens' })
  name: string;

  @ApiProperty({ enum: MCP_TRANSPORTS, example: 'http', description: 'How the agent reaches this MCP' })
  @IsIn(MCP_TRANSPORTS)
  transport: McpTransport;

  @ApiPropertyOptional({ example: 3333, description: "Port the local MCP server listens on (transport: http)" })
  @ValidateIf((o) => o.transport === 'http')
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({
    example: '/api/mcp',
    description: 'Optional sub-path on the local server, e.g. "/api/mcp" reaches http://localhost:<port>/api/mcp (transport: http)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SUB_PATH_PATTERN, { message: 'subPath must look like "/segment" or "/segment/segment", no trailing slash' })
  subPath?: string;

  @ApiPropertyOptional({ example: 'npx', description: 'Executable to spawn (transport: stdio)' })
  @ValidateIf((o) => o.transport === 'stdio')
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  command?: string;

  @ApiPropertyOptional({ example: ['-y', '@some/mcp-server'], description: 'Arguments passed to the spawned process (transport: stdio)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  args?: string[];

  @ApiPropertyOptional({ description: 'Extra environment variables for the spawned process (transport: stdio)' })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @ApiProperty()
  @IsBoolean()
  active: boolean;

  @ApiPropertyOptional({ description: 'Custom HTTP headers the agent should attach when calling the local MCP server (transport: http)' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class AddCustomMcpDto {
  @ApiProperty({ example: 'notes' })
  @IsString()
  @MinLength(1)
  @MaxLength(63)
  @Matches(MCP_NAME_PATTERN, { message: 'name must be lowercase alphanumeric with optional hyphens' })
  name: string;

  @ApiPropertyOptional({ enum: MCP_TRANSPORTS, example: 'http', description: 'How the agent reaches this MCP — defaults to "http"' })
  @IsOptional()
  @IsIn(MCP_TRANSPORTS)
  transport?: McpTransport;

  @ApiPropertyOptional({ example: 3333, description: 'Required when transport is "http"' })
  @ValidateIf((o) => (o.transport ?? 'http') === 'http')
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ example: '/api/mcp', description: 'Optional sub-path on the local server (transport: http)' })
  @IsOptional()
  @Transform(({ value }) => normalizeSubPath(value))
  @IsString()
  @MaxLength(255)
  @Matches(SUB_PATH_PATTERN, { message: 'subPath must look like "/segment" or "/segment/segment", no trailing slash' })
  subPath?: string;

  @ApiPropertyOptional({ example: 'npx', description: 'Required when transport is "stdio" — executable to spawn' })
  @ValidateIf((o) => o.transport === 'stdio')
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  command?: string;

  @ApiPropertyOptional({ example: ['-y', '@some/mcp-server'], description: 'Arguments passed to the spawned process (transport: stdio)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  args?: string[];

  @ApiPropertyOptional({ description: 'Extra environment variables for the spawned process (transport: stdio)' })
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}

export class UpdateCustomMcpDto {
  @ApiPropertyOptional({ example: 3333 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @ApiPropertyOptional({ example: '/api/mcp', description: 'Optional sub-path on the local server — send "" to clear it' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(new RegExp(`^$|${SUB_PATH_PATTERN.source}`), {
    message: 'subPath must be empty (to clear) or look like "/segment" or "/segment/segment", no trailing slash',
  })
  subPath?: string;

  @ApiPropertyOptional({ example: 'npx' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  command?: string;

  @ApiPropertyOptional({ example: ['-y', '@some/mcp-server'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(64)
  @IsString({ each: true })
  args?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
