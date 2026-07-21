import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Body for `DELETE /mcp/logs`. Exactly one of `ids`/`mcpId` should be sent;
 * if neither is, every log the caller owns is deleted. See
 * `McpLogService.deleteMany` for the precedence.
 */
export class DeleteMcpLogsDto {
  @ApiPropertyOptional({ type: [String], description: 'Delete exactly these log entries (bulk-select in the UI)' })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids?: string[];

  @ApiPropertyOptional({ description: 'Delete every log entry for this one MCP' })
  @IsOptional()
  @IsString()
  mcpId?: string;
}
