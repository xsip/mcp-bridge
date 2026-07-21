import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One proxied request/response pair for a single MCP, persisted in its own
 * `mcp_logs` collection (see `McpLogService`) — kept out of the User/Mcp
 * documents specifically so high-churn log writes never slow down
 * unrelated reads/writes against those documents.
 */
export class McpLogEntryDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: 'Correlation id for this proxied request, distinct per attempt' })
  requestId: string;

  @ApiProperty()
  method: string;

  @ApiProperty()
  path: string;

  @ApiPropertyOptional({ description: 'HTTP status returned by the agent — absent if the request failed before a response arrived' })
  status?: number;

  @ApiProperty({ description: 'Whether the request completed with a response, regardless of status code' })
  ok: boolean;

  @ApiPropertyOptional({ description: 'Set when the request failed (agent offline, timeout, ...)' })
  errorMessage?: string;

  @ApiProperty()
  durationMs: number;

  @ApiPropertyOptional({ description: 'Body sent to the local MCP server, if any' })
  requestBody?: unknown;

  @ApiPropertyOptional({ description: 'Body returned by the local MCP server — absent if the request failed before a response arrived' })
  responseBody?: unknown;

  @ApiProperty({ description: 'ISO 8601 timestamp' })
  timestamp: string;
}

/** A log entry plus which MCP it belongs to — the shape `GET /mcp/logs` returns. */
export class McpLogWithContextDto extends McpLogEntryDto {
  @ApiProperty()
  mcpId: string;

  @ApiProperty()
  mcpName: string;
}
