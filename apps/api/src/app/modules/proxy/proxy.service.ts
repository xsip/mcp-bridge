import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import { REQUEST_ROUTER, RequestRouter } from '@mcp-bridge/contracts';
import { AppLogger } from '@mcp-bridge/logging';
import { McpLookupService } from '../mcp/mcp-lookup.service';
import { McpLogService } from '../mcp/mcp-log.service';
import { requestToProxyRequest } from './proxy-request.mapper';

/**
 * Hop-by-hop / length-related headers that Express recomputes itself when
 * `res.json()`/`res.end()` serializes the (already-parsed-and-reserialized)
 * body. Passing the agent's original `content-length` straight through
 * produces a response with both `Content-Length` and `Transfer-Encoding`
 * set — which Node's HTTP parser (and most strict clients) reject outright.
 */
const EXCLUDED_RESPONSE_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection']);

/**
 * Application service for the proxy use case. Contains no controller or
 * transport-specific logic: it resolves the public mcp id to an owning
 * account via {@link McpLookupService}, then depends only on
 * {@link RequestRouter} to deliver the request — the underlying transport
 * (WebSocket today) can be swapped without touching this class.
 *
 * Every attempt — success or failure — is recorded via {@link McpLogService}
 * against the resolved MCP, so `GET /mcp/:mcpId/logs` and `GET /mcp/logs`
 * reflect exactly what was proxied.
 */
@Injectable()
export class ProxyService {
  constructor(
    @Inject(REQUEST_ROUTER) private readonly router: RequestRouter,
    private readonly mcpLookup: McpLookupService,
    private readonly mcpLog: McpLogService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(ProxyService.name);
  }

  async handle(mcpId: string, path: string, req: Request, res: Response): Promise<void> {
    const { ownerId, mcp } = await this.mcpLookup.resolve(mcpId);
    const proxyRequest = requestToProxyRequest(ownerId, mcp.name, path, req);

    this.logger.log(`Proxying ${proxyRequest.method} ${proxyRequest.path} for "${mcpId}" -> account "${ownerId}"`);

    const requestId = randomUUID();
    const startedAt = Date.now();

    try {
      const response = await this.router.forward(proxyRequest);

      this.recordLog(ownerId, mcp.id, mcp.name, {
        requestId,
        method: proxyRequest.method,
        path: proxyRequest.path,
        status: response.status,
        requestBody: req.body,
        responseBody: response.body,
        ok: true,
        durationMs: Date.now() - startedAt,
      });

      for (const [header, value] of Object.entries(response.headers)) {
        if (value !== undefined && !EXCLUDED_RESPONSE_HEADERS.has(header.toLowerCase())) {
          res.setHeader(header, value);
        }
      }
      res.status(response.status);
      if (response.body === undefined) {
        res.end();
      } else {
        res.json(response.body);
      }
    } catch (error) {
      this.recordLog(ownerId, mcp.id, mcp.name, {
        requestId,
        method: proxyRequest.method,
        path: proxyRequest.path,
        ok: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startedAt,
      });

      throw error;
    }
  }

  /** Fire-and-forget: logging must never slow down or fail the proxied response. */
  private recordLog(ownerId: string, mcpId: string, mcpName: string, input: Parameters<McpLogService['record']>[3]): void {
    this.mcpLog.record(ownerId, mcpId, mcpName, input).catch((error: unknown) => {
      this.logger.warn(`Failed to persist MCP log entry: ${error instanceof Error ? error.message : String(error)}`);
    });
  }
}
