import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from './current-user.decorator';
import { User } from './user.schema';
import { ApiKeyService } from './api-key.service';
import { ApiKeyDto, CreateApiKeyDto, CreatedApiKeyDto } from './dto/api-key.dto';

/**
 * CRUD over the current user's API keys — long-lived credentials for
 * `/mcp/:mcpId` proxy calls (see `ApiKeyAuthGuard`), managed here via the
 * user's normal JWT session.
 */
@ApiTags('api-keys')
@ApiBearerAuth()
@Controller('auth/api-keys')
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  @ApiOperation({ operationId: 'listApiKeys', summary: "List the current user's API keys" })
  @ApiOkResponse({ type: [ApiKeyDto] })
  list(@CurrentUser() user: User): Promise<ApiKeyDto[]> {
    return this.apiKeyService.list(user.username);
  }

  @Post()
  @ApiOperation({
    operationId: 'createApiKey',
    summary: 'Generate a new API key',
    description: 'The raw key is only ever returned in this response — store it now, it cannot be retrieved again.',
  })
  @ApiOkResponse({ type: CreatedApiKeyDto })
  create(@CurrentUser() user: User, @Body() dto: CreateApiKeyDto): Promise<CreatedApiKeyDto> {
    return this.apiKeyService.create(user.username, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'revokeApiKey', summary: 'Revoke an API key' })
  revoke(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.apiKeyService.revoke(user.username, id);
  }
}
