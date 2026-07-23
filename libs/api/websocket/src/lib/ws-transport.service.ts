import { Inject, Injectable } from '@nestjs/common';
import { CONNECTION_REGISTRY, ConnectionRegistry, ProxyHttpRequest, Transport, WsMessageType, WsRequestMessage, WS_PROTOCOL_VERSION } from '@mcp-loop/contracts';
import { ClientNotFoundError } from '@mcp-loop/common';

/**
 * Sends a proxy request to a specific account's agent over its WebSocket
 * connection. Implements {@link Transport} so {@link RequestRouter} never
 * depends on the gateway or the underlying socket library directly.
 */
@Injectable()
export class WsTransportService implements Transport {
  constructor(@Inject(CONNECTION_REGISTRY) private readonly registry: ConnectionRegistry) {}

  send(ownerId: string, requestId: string, request: ProxyHttpRequest): void {
    const connection = this.registry.find(ownerId);
    if (!connection || !connection.online || !connection.socket.isOpen()) {
      throw new ClientNotFoundError(ownerId);
    }

    const message: WsRequestMessage = {
      version: WS_PROTOCOL_VERSION,
      type: WsMessageType.Request,
      requestId,
      mcpName: request.mcpName,
      method: request.method,
      path: request.path,
      headers: request.headers,
      query: request.query,
      body: request.body,
    };

    connection.socket.send(JSON.stringify(message));
  }
}
