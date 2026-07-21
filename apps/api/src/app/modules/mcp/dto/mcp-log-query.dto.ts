import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const DEFAULT_LOG_PAGE_SIZE = 25;
export const MAX_LOG_PAGE_SIZE = 100;

/** Pagination query params for both `GET /mcp/logs` and `GET /mcp/:mcpId/logs`. */
export class McpLogQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1, minimum: 1, description: '1-based page number' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ type: Number, default: DEFAULT_LOG_PAGE_SIZE, minimum: 1, maximum: MAX_LOG_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LOG_PAGE_SIZE)
  pageSize = DEFAULT_LOG_PAGE_SIZE;
}
