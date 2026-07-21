import { ApiProperty } from '@nestjs/swagger';
import { McpLogWithContextDto } from './mcp-log-entry.dto';

/** A page of log entries, returned by both `GET /mcp/logs` and `GET /mcp/:mcpId/logs`. */
export class McpLogPageDto {
  @ApiProperty({ type: [McpLogWithContextDto] })
  items: McpLogWithContextDto[];

  @ApiProperty({ description: 'Total number of matching log entries across all pages' })
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
