import type { AgentConnection, AgentSocket, ConnectionSummary } from './connection.types';
import type { ProxyHttpRequest, ProxyHttpResponse } from './proxy.types';

/**
 * Tracks which users currently have a desktop agent connected.
 *
 * In-memory implementation lives in `@mcp-bridge/core`. To scale horizontally
 * across multiple backend instances, replace it with a Redis-backed
 * implementation (e.g. a Redis hash keyed by ownerId plus pub/sub for
 * cross-instance invalidation) that implements this same interface.
 */
export interface ConnectionRegistry {
  register(ownerId: string, socket: AgentSocket): AgentConnection;
  disconnect(ownerId: string): void;
  find(ownerId: string): AgentConnection | undefined;
  heartbeat(ownerId: string): void;
  list(): ConnectionSummary[];
  isOnline(ownerId: string): boolean;
}

/**
 * Correlates outgoing WebSocket requests with their eventual responses.
 *
 * In-memory implementation lives in `@mcp-bridge/core`. Because pending
 * requests are held as in-process Promises, this implementation only works
 * when the HTTP request and the owning WebSocket connection are handled by
 * the same backend instance. To scale horizontally, replace it with a
 * distributed store (e.g. Redis + pub/sub, or a message broker) so any
 * instance can resolve a request regardless of which instance holds the
 * socket.
 */
export interface PendingRequestStore {
  create(requestId: string, timeoutMs: number): Promise<ProxyHttpResponse>;
  resolve(requestId: string, response: ProxyHttpResponse): void;
  reject(requestId: string, error: Error): void;
  has(requestId: string): boolean;
  size(): number;
}

/**
 * Sends a proxied HTTP request to the appropriate agent and returns its
 * response. Depends on {@link ConnectionRegistry}, {@link PendingRequestStore}
 * and {@link Transport} rather than any concrete gateway implementation.
 */
export interface RequestRouter {
  forward(request: ProxyHttpRequest): Promise<ProxyHttpResponse>;
}

/**
 * Abstracts the wire-level send operation for a given account, decoupling
 * the router from the WebSocket gateway implementation.
 */
export interface Transport {
  send(ownerId: string, requestId: string, request: ProxyHttpRequest): void;
}

/** Result of successfully authenticating a desktop agent's `hello` message. */
export interface AuthenticatedAgent {
  ownerId: string;
}

/**
 * Verifies the credential a desktop agent presents in its `hello` message
 * and resolves it to the account (ownerId) it belongs to.
 *
 * Implemented in `apps/api` (it needs the User model + JWT secret) and
 * injected into the gateway via the `AGENT_AUTHENTICATOR` token, so
 * `libs/websocket` never depends on the concrete auth stack.
 */
export interface AgentAuthenticator {
  authenticate(token: string): Promise<AuthenticatedAgent | null>;
}
