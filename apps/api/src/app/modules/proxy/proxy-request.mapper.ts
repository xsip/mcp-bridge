import type { Request } from 'express';
import type { ProxyHttpRequest } from '@mcp-loop/contracts';

/** A small set of hop-by-hop / connection-specific headers that must not be forwarded to the agent. */
const EXCLUDED_HEADERS = new Set(['host', 'connection', 'content-length', 'authorization']);

export function requestToProxyRequest(ownerId: string, mcpName: string, path: string, req: Request): ProxyHttpRequest {
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || EXCLUDED_HEADERS.has(key.toLowerCase())) {
      continue;
    }
    headers[key] = Array.isArray(value) ? value.join(', ') : value;
  }

  return {
    ownerId,
    mcpName,
    method: req.method,
    path,
    headers,
    query: req.query as Record<string, string | string[]>,
    body: req.body,
  };
}
