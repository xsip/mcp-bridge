/**
 * Versioned WebSocket protocol exchanged between the backend and desktop agents.
 *
 * Adding a new message type: extend {@link WsMessageType} and add a new
 * interface, then add it to the {@link WsMessage} union. Existing consumers
 * that switch on `type` are unaffected by new additions (forward-compatible).
 */
export const WS_PROTOCOL_VERSION = 1 as const;

export enum WsMessageType {
  Hello = 'hello',
  Request = 'request',
  Response = 'response',
  Ping = 'ping',
  Pong = 'pong',
  Error = 'error',
}

export interface WsMessageBase {
  version: typeof WS_PROTOCOL_VERSION;
  type: WsMessageType;
}

/**
 * Sent by the desktop agent immediately after connecting, to authenticate.
 * `token` is the same JWT issued by `POST /auth/login` — the agent is
 * identified by the user account it belongs to, not by a self-declared id.
 * A single connection can serve every MCP the user has configured.
 */
export interface WsHelloMessage extends WsMessageBase {
  type: WsMessageType.Hello;
  token: string;
  agentVersion?: string;
}

/** Backend -> agent: forward an HTTP request to be executed against localhost. */
export interface WsRequestMessage extends WsMessageBase {
  type: WsMessageType.Request;
  requestId: string;
  /** Name of the MCP (as configured by the user) this request targets — tells the agent which local port to use. */
  mcpName: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  body?: unknown;
}

/** Agent -> backend: the result of executing a previously forwarded request. */
export interface WsResponseMessage extends WsMessageBase {
  type: WsMessageType.Response;
  requestId: string;
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface WsPingMessage extends WsMessageBase {
  type: WsMessageType.Ping;
}

export interface WsPongMessage extends WsMessageBase {
  type: WsMessageType.Pong;
}

/** Agent -> backend: signals that a forwarded request could not be completed. */
export interface WsErrorMessage extends WsMessageBase {
  type: WsMessageType.Error;
  requestId?: string;
  message: string;
}

export type WsMessage =
  | WsHelloMessage
  | WsRequestMessage
  | WsResponseMessage
  | WsPingMessage
  | WsPongMessage
  | WsErrorMessage;

export function isWsMessage(value: unknown): value is WsMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate['version'] === WS_PROTOCOL_VERSION &&
    typeof candidate['type'] === 'string' &&
    Object.values(WsMessageType).includes(candidate['type'] as WsMessageType)
  );
}
