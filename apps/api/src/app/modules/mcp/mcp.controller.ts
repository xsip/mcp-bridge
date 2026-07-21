import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AddCustomMcpDto, CustomMcpDto, UpdateCustomMcpDto } from '../auth/dto/custom-mcp.dto';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';
import { McpService } from './mcp.service';

/**
 * CRUD over the current user's MCP configurations. Each entry becomes
 * reachable at `/mcp/<username>-<name>` once the user's desktop agent is
 * online — see `ProxyController`.
 */
@ApiTags('mcps')
@ApiBearerAuth()
@Controller('mcps')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Get()
  @ApiOperation({ operationId: 'listMcps', summary: "List the current user's configured MCPs" })
  @ApiOkResponse({ type: [CustomMcpDto] })
  list(@CurrentUser() user: User): Promise<CustomMcpDto[]> {
    return this.mcpService.list(user.username);
  }

  @Post()
  @ApiOperation({ operationId: 'addMcp', summary: 'Register a new local MCP for the current user' })
  @ApiOkResponse({ type: CustomMcpDto })
  add(@CurrentUser() user: User, @Body() dto: AddCustomMcpDto): Promise<CustomMcpDto> {
    return this.mcpService.add(user.username, dto);
  }

  @Patch(':id')
  @ApiOperation({ operationId: 'updateMcp', summary: 'Update an existing MCP (port, active, headers)' })
  @ApiOkResponse({ type: CustomMcpDto })
  update(@CurrentUser() user: User, @Param('id') id: string, @Body() dto: UpdateCustomMcpDto): Promise<CustomMcpDto> {
    return this.mcpService.update(user.username, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'removeMcp', summary: 'Remove an MCP from the current user account' })
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.mcpService.remove(user.username, id);
  }
}
