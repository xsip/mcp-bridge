import { IsBoolean, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** MCP name constraints — used to build the public id `<username>-<mcpName>`. */
export const MCP_NAME_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** Allowed characters in a sub-path, once normalized to start with "/" and have no trailing "/". */
export const SUB_PATH_PATTERN = /^\/[a-zA-Z0-9\-_/]*[a-zA-Z0-9\-_]$|^\/[a-zA-Z0-9\-_]$/;

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
 * agent runs this MCP on `localhost:<port>`, optionally under `subPath`
 * (e.g. `port: 4001, subPath: "/api/mcp"` reaches
 * `http://localhost:4001/api/mcp`); the backend never talks to that
 * port/path directly — only the agent does, after receiving a forwarded
 * request for `<username>-<name>` over its WebSocket connection.
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

  @ApiProperty({ example: 3333, description: "Port the local MCP server listens on (on the user's machine)" })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiPropertyOptional({
    example: '/api/mcp',
    description: 'Optional sub-path on the local server, e.g. "/api/mcp" reaches http://localhost:<port>/api/mcp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(SUB_PATH_PATTERN, { message: 'subPath must look like "/segment" or "/segment/segment", no trailing slash' })
  subPath?: string;

  @ApiProperty()
  @IsBoolean()
  active: boolean;

  @ApiPropertyOptional({ description: 'Custom HTTP headers the agent should attach when calling the local MCP server' })
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

  @ApiProperty({ example: 3333 })
  @IsInt()
  @Min(1)
  @Max(65535)
  port: number;

  @ApiPropertyOptional({ example: '/api/mcp', description: 'Optional sub-path on the local server' })
  @IsOptional()
  @Transform(({ value }) => normalizeSubPath(value))
  @IsString()
  @MaxLength(255)
  @Matches(SUB_PATH_PATTERN, { message: 'subPath must look like "/segment" or "/segment/segment", no trailing slash' })
  subPath?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;
}
