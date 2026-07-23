import { Inject, OnModuleDestroy } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import type { WebSocket } from 'ws';
import {
  AGENT_AUTHENTICATOR,
  AgentAuthenticator,
  CONNECTION_REGISTRY,
  ConnectionRegistry,
  isWsMessage,
  PENDING_REQUEST_STORE,
  PendingRequestStore,
  WsMessage,
  WsMessageType,
  WS_PROTOCOL_VERSION,
} from '@mcp-loop/contracts';
import { AppConfigService } from '@mcp-loop/config';
import { AppLogger } from '@mcp-loop/logging';
import { WsAgentSocket } from './agent-socket.adapter';

const HEARTBEAT_ALIVE = Symbol('heartbeatAlive');

type TrackedSocket = WebSocket & { [HEARTBEAT_ALIVE]?: boolean; ownerId?: string };

/**
 * Terminates the raw WebSocket upgrade at `/agents`. Desktop agents connect
 * here and send a `hello` message carrying the JWT of the account they
 * belong to (the same token issued by `POST /auth/login`) — the connection
 * is registered under that account's username and can then serve every MCP
 * the user has configured, per the versioned protocol defined in
 * `@mcp-loop/contracts`.
 */
@WebSocketGateway({ path: '/agents' })
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy {
  private heartbeatTimer?: NodeJS.Timeout;

  constructor(
    @Inject(CONNECTION_REGISTRY) private readonly registry: ConnectionRegistry,
    @Inject(PENDING_REQUEST_STORE) private readonly pendingRequests: PendingRequestStore,
    @Inject(AGENT_AUTHENTICATOR) private readonly authenticator: AgentAuthenticator,
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(AgentGateway.name);
    this.startHeartbeatSweep();
  }

  handleConnection(client: TrackedSocket): void {
    client[HEARTBEAT_ALIVE] = true;

    client.on('pong', () => {
      client[HEARTBEAT_ALIVE] = true;
      if (client.ownerId) {
        this.registry.heartbeat(client.ownerId);
      }
    });

    client.on('message', (raw: Buffer) => this.handleMessage(client, raw));
  }

  handleDisconnect(client: TrackedSocket): void {
    if (client.ownerId) {
      this.registry.disconnect(client.ownerId);
      this.logger.log(`Agent connection for account "${client.ownerId}" closed`);
    }
  }

  onModuleDestroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }
  }

  private handleMessage(client: TrackedSocket, raw: Buffer): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.toString('utf-8'));
    } catch {
      this.logger.warn('Received malformed (non-JSON) WebSocket message');
      return;
    }

    if (!isWsMessage(parsed)) {
      this.logger.warn('Received message that does not match the WS protocol envelope');
      return;
    }

    const message = parsed as WsMessage;

    switch (message.type) {
      case WsMessageType.Hello:
        void this.handleHello(client, message.token);
        break;
      case WsMessageType.Response:
        this.pendingRequests.resolve(message.requestId, {
          status: message.status,
          headers: message.headers,
          body: message.body,
        });
        break;
      case WsMessageType.Error:
        if (message.requestId) {
          this.pendingRequests.reject(message.requestId, new Error(message.message));
        }
        break;
      case WsMessageType.Pong:
        client[HEARTBEAT_ALIVE] = true;
        if (client.ownerId) {
          this.registry.heartbeat(client.ownerId);
        }
        break;
      case WsMessageType.Ping:
        client.send(JSON.stringify({ version: WS_PROTOCOL_VERSION, type: WsMessageType.Pong }));
        break;
      default:
        this.logger.warn(`Unhandled message type: ${(message as WsMessage).type}`);
    }
  }

  private async handleHello(client: TrackedSocket, token: string): Promise<void> {
    if (!token) {
      this.logger.warn('Rejecting hello message without a token');
      client.close(4001, 'token is required');
      return;
    }

    const authenticated = await this.authenticator.authenticate(token);
    if (!authenticated) {
      this.logger.warn('Rejecting hello message with an invalid or expired token');
      client.close(4003, 'Invalid or expired token');
      return;
    }

    client.ownerId = authenticated.ownerId;
    this.registry.register(authenticated.ownerId, new WsAgentSocket(authenticated.ownerId, client));
    this.logger.log(`Agent for account "${authenticated.ownerId}" said hello`);
  }

  private startHeartbeatSweep(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const summary of this.registry.list()) {
        const connection = this.registry.find(summary.ownerId);
        connection?.socket.send(JSON.stringify({ version: WS_PROTOCOL_VERSION, type: WsMessageType.Ping }));
      }
    }, this.config.wsHeartbeatIntervalMs);
  }
}
