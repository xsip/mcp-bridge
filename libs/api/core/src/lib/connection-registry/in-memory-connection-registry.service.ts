import { Injectable } from '@nestjs/common';
import type { AgentConnection, AgentSocket, ConnectionRegistry, ConnectionSummary } from '@mcp-loop/contracts';
import { AppLogger } from '@mcp-loop/logging';

/**
 * In-memory implementation of {@link ConnectionRegistry}.
 *
 * Scaling note: this holds connections in a process-local Map, so it only
 * knows about agents connected to *this* backend instance. To run multiple
 * backend instances behind a load balancer, replace this with a Redis-backed
 * registry: agent metadata (ownerId, connectedAt, lastSeen, online) goes in
 * a Redis hash/set so any instance can answer "is this account's agent
 * online and which instance holds its socket", while the actual
 * `AgentSocket` reference necessarily stays local to the instance holding
 * the TCP connection.
 */
@Injectable()
export class InMemoryConnectionRegistry implements ConnectionRegistry {
  private readonly connections = new Map<string, AgentConnection>();

  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(InMemoryConnectionRegistry.name);
  }

  register(ownerId: string, socket: AgentSocket): AgentConnection {
    const existing = this.connections.get(ownerId);
    if (existing && existing.online && existing.socket !== socket) {
      this.logger.warn(`Replacing existing connection for account "${ownerId}"`);
      existing.socket.close(4000, 'Replaced by new connection');
    }

    const now = new Date();
    const connection: AgentConnection = {
      ownerId,
      socket,
      connectedAt: now,
      lastSeen: now,
      online: true,
    };

    this.connections.set(ownerId, connection);
    this.logger.log(`Agent for account "${ownerId}" registered`);
    return connection;
  }

  disconnect(ownerId: string): void {
    const connection = this.connections.get(ownerId);
    if (!connection) {
      return;
    }
    connection.online = false;
    this.connections.delete(ownerId);
    this.logger.log(`Agent for account "${ownerId}" disconnected`);
  }

  find(ownerId: string): AgentConnection | undefined {
    return this.connections.get(ownerId);
  }

  heartbeat(ownerId: string): void {
    const connection = this.connections.get(ownerId);
    if (connection) {
      connection.lastSeen = new Date();
    }
  }

  list(): ConnectionSummary[] {
    return Array.from(this.connections.values()).map(({ ownerId, connectedAt, lastSeen, online }) => ({
      ownerId,
      connectedAt,
      lastSeen,
      online,
    }));
  }

  isOnline(ownerId: string): boolean {
    return this.connections.get(ownerId)?.online ?? false;
  }
}
