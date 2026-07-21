import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';
import { DeleteMcpLogsDto } from './dto/delete-mcp-logs.dto';
import { McpLogPageDto } from './dto/mcp-log-page.dto';
import { McpLogQueryDto } from './dto/mcp-log-query.dto';
import { McpLogService } from './mcp-log.service';

/**
 * Read/delete access to proxied request/response logs. Deliberately kept
 * under `/mcp` (singular — matching `ProxyController`'s public passthrough
 * prefix) rather than `/mcps`, per the endpoint shape this was speced
 * against (`GET /mcp/logs`, `GET /mcp/:mcpId/logs`).
 *
 * Route precedence note: `ProxyController` registers `@All(':mcpId')` and
 * `@All(':mcpId/*path')` on the same `/mcp` prefix (covering every HTTP
 * method, including DELETE), which would otherwise swallow every route
 * here. This controller lives in `McpModule`, imported before
 * `ProxyModule` in `AppModule` — Nest registers routes in module-import
 * order, so these more specific routes are matched first. Confirmed by
 * booting the app and requesting these paths directly.
 */
@ApiTags('mcp-logs')
@ApiBearerAuth()
@Controller('mcp')
export class McpLogsController {
  constructor(private readonly mcpLogService: McpLogService) {}

  @Get('logs')
  @ApiOperation({ operationId: 'listAllMcpLogs', summary: "List (paginated) proxied request/response logs for every MCP the current user owns" })
  @ApiOkResponse({ type: McpLogPageDto })
  listAll(@CurrentUser() user: User, @Query() query: McpLogQueryDto): Promise<McpLogPageDto> {
    return this.mcpLogService.listForOwner(user.username, query.page, query.pageSize);
  }

  @Delete('logs')
  @ApiOperation({
    operationId: 'deleteMcpLogs',
    summary: 'Bulk-delete log entries: by id, by mcpId, or every log the caller owns if neither is given',
  })
  @ApiOkResponse({ description: 'Number of deleted entries', type: Number })
  deleteMany(@CurrentUser() user: User, @Body() dto: DeleteMcpLogsDto): Promise<number> {
    return this.mcpLogService.deleteMany(user.username, dto);
  }

  @Get(':mcpId/logs')
  @ApiOperation({ operationId: 'listMcpLogs', summary: 'List (paginated) proxied request/response logs for a single owned MCP' })
  @ApiOkResponse({ type: McpLogPageDto })
  listForMcp(@CurrentUser() user: User, @Param('mcpId') mcpId: string, @Query() query: McpLogQueryDto): Promise<McpLogPageDto> {
    return this.mcpLogService.listForMcp(user.username, mcpId, query.page, query.pageSize);
  }

  @Delete('logs/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'deleteMcpLog', summary: 'Delete a single log entry' })
  deleteOne(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.mcpLogService.deleteOne(user.username, id);
  }
}
