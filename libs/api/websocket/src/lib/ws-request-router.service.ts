import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CONNECTION_REGISTRY,
  ConnectionRegistry,
  PENDING_REQUEST_STORE,
  PendingRequestStore,
  ProxyHttpRequest,
  ProxyHttpResponse,
  RequestRouter,
  TRANSPORT,
  Transport,
} from '@mcp-bridge/contracts';
import { ClientNotFoundError } from '@mcp-bridge/common';
import { AppConfigService } from '@mcp-bridge/config';
import { AppLogger } from '@mcp-bridge/logging';

/**
 * Coordinates a single proxied HTTP request: validates the target account
 * has an online agent, registers a pending request, forwards it over the
 * transport, and awaits the correlated response.
 */
@Injectable()
export class WsRequestRouter implements RequestRouter {
  constructor(
    @Inject(CONNECTION_REGISTRY) private readonly registry: ConnectionRegistry,
    @Inject(PENDING_REQUEST_STORE) private readonly pendingRequests: PendingRequestStore,
    @Inject(TRANSPORT) private readonly transport: Transport,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(WsRequestRouter.name);
  }

  async forward(request: ProxyHttpRequest): Promise<ProxyHttpResponse> {
    if (!this.registry.isOnline(request.ownerId)) {
      throw new ClientNotFoundError(request.ownerId);
    }

    const requestId = randomUUID();
    const pending = this.pendingRequests.create(requestId, this.config.requestTimeoutMs);

    this.logger.log(`Forwarding ${request.method} ${request.path} for mcp "${request.mcpName}" to "${request.ownerId}" as request "${requestId}"`);
    this.transport.send(request.ownerId, requestId, request);

    return pending;
  }
}
