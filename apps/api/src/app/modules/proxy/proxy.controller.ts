import { All, Controller, Param, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiSecurity, ApiExcludeController } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { ApiKeyAuthGuard } from '../auth/api-key-auth.guard';
import { ProxyService } from './proxy.service';

/**
 * Thin HTTP entrypoint for `/mcp/:mcpId/*`, where `mcpId` is `<username>-<mcpName>`.
 * Called by ChatGPT (or any other MCP-capable client) directly, so it can't
 * require the account owner's own short-lived JWT session — instead it's
 * `@Public()` (opts out of the global `JwtAuthGuard`) and separately guarded
 * by `ApiKeyAuthGuard`, which validates a long-lived API key sent in the
 * `Authorization` header (generated/revoked via `ApiKeyController`). All
 * proxying logic lives in {@link ProxyService} — this controller only adapts
 * Express's request/response objects to and from the service's plain types.
 *
 * Excluded from the generated OpenAPI doc (and therefore the Angular client):
 * its wildcard `*path` catch-all describes an opaque passthrough to whatever
 * MCP the caller addresses, not a typed API surface, and older OpenAPI
 * tooling chokes on wildcard path parameters in a Swagger-generated spec.
 * `@ApiSecurity('apiKey')` documents the auth scheme for anyone reading the
 * source even though `@ApiExcludeController()` keeps it out of the spec.
 */
@ApiExcludeController()
@ApiSecurity('apiKey')
@Public()
@UseGuards(ApiKeyAuthGuard)
@Controller('mcp')
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All(':mcpId')
  async proxyRoot(@Param('mcpId') mcpId: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    await this.proxyService.handle(mcpId, '/', req, res);
  }

  @All(':mcpId/*path')
  async proxy(@Param('mcpId') mcpId: string, @Param('path') path: string | string[], @Req() req: Request, @Res() res: Response): Promise<void> {
    const subPath = Array.isArray(path) ? path.join('/') : path;
    await this.proxyService.handle(mcpId, `/${subPath}`, req, res);
  }
}
