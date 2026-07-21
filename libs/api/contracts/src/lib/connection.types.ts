/**
 * Abstraction over the underlying socket used to talk to a desktop agent.
 * Kept minimal so the registry and router never depend on a concrete
 * WebSocket implementation (e.g. `ws`, socket.io).
 */
export interface AgentSocket {
  readonly id: string;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  isOpen(): boolean;
}

/**
 * A desktop agent connection, identified by the username of the account it
 * authenticated as. One connection can serve every MCP that user has
 * configured (see {@link ProxyHttpRequest.mcpName}).
 */
export interface AgentConnection {
  ownerId: string;
  socket: AgentSocket;
  connectedAt: Date;
  lastSeen: Date;
  online: boolean;
}

export interface ConnectionSummary {
  ownerId: string;
  connectedAt: Date;
  lastSeen: Date;
  online: boolean;
}
