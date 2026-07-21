export interface ProxyHttpRequest {
  /** Username of the account that owns the target agent connection. */
  ownerId: string;
  /** Name of the MCP (as configured by the user) this request targets. */
  mcpName: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  query: Record<string, string | string[]>;
  body?: unknown;
}

export interface ProxyHttpResponse {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}
