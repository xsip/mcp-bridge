export type AgentStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface AgentMcp {
  name: string;
  port: number;
  subPath?: string;
}

interface McpTarget {
  port: number;
  subPath?: string;
}

/** Joins an optional local sub-path (e.g. "/api/mcp") with the forwarded request path (always starts with "/"). */
function joinPath(subPath: string | undefined, path: string): string {
  if (!subPath) return path;
  return path === '/' ? subPath : subPath + path;
}

/**
 * The actual tunnel: connects out to the backend's `/agents` WebSocket,
 * authenticates with the user's JWT, and answers every forwarded `request`
 * message by calling the matching local MCP (`http://127.0.0.1:<port>`)
 * and sending the result back as a `response` message.
 *
 * This is the browser-extension counterpart of `apps/desktop/electron/agent.js` —
 * same wire protocol, ported from Node's `ws`/`fetch` to the browser-native
 * `WebSocket`/`fetch` available in a Manifest V3 service worker. Unlike the
 * Electron main process, this runs in a service worker that Chrome can
 * terminate after ~30s idle — see `background.ts` for the `chrome.alarms`
 * keepalive that works around that.
 */
export class AgentTunnel {
  private ws: WebSocket | null = null;
  private mcps = new Map<string, McpTarget>();
  private token: string | null = null;
  private wsUrl: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStatus: (status: AgentStatus) => void;

  constructor(onStatus: (status: AgentStatus) => void) {
    this.onStatus = onStatus;
  }

  setMcps(mcps: AgentMcp[]): void {
    this.mcps = new Map(mcps.map((mcp) => [mcp.name, { port: mcp.port, subPath: mcp.subPath }]));
  }

  start(wsUrl: string, token: string): void {
    this.wsUrl = wsUrl;
    this.token = token;
    this.stop({ keepToken: true });
    this.connect();
  }

  private connect(): void {
    if (!this.token || !this.wsUrl) return;
    this.onStatus('connecting');
    this.ws = new WebSocket(this.wsUrl);

    this.ws.addEventListener('open', () => {
      this.send({ version: 1, type: 'hello', token: this.token });
    });
    this.ws.addEventListener('message', (event) => void this.handleMessage(event.data));
    this.ws.addEventListener('close', () => {
      this.onStatus('disconnected');
      this.scheduleReconnect();
    });
    this.ws.addEventListener('error', () => {
      this.onStatus('error');
    });
  }

  private scheduleReconnect(): void {
    if (!this.token || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) this.connect();
    }, 3000);
  }

  private async handleMessage(raw: unknown): Promise<void> {
    let message: Record<string, unknown>;
    try {
      message = JSON.parse(String(raw));
    } catch {
      return;
    }

    switch (message['type']) {
      case 'ping':
        this.send({ version: 1, type: 'pong' });
        return;
      case 'pong':
      case 'hello':
        // Hello only flows agent -> backend; a stray hello/pong from the server is a no-op here.
        return;
      case 'request':
        await this.handleRequest(message);
        return;
      default:
        return;
    }
  }

  private async handleRequest(message: Record<string, unknown>): Promise<void> {
    const requestId = message['requestId'] as string;
    const mcpName = message['mcpName'] as string;
    const method = message['method'] as string;
    const path = message['path'] as string;
    const headers = message['headers'] as Record<string, string> | undefined;
    const query = message['query'] as Record<string, unknown> | undefined;
    const body = message['body'];

    const target = this.mcps.get(mcpName);

    if (!target) {
      this.send({ version: 1, type: 'error', requestId, message: `No local MCP named "${mcpName}" is configured` });
      this.onStatus('connected');
      return;
    }

    try {
      const url = new URL(`http://127.0.0.1:${target.port}${joinPath(target.subPath, path)}`);
      for (const [key, value] of Object.entries(query || {})) {
        if (Array.isArray(value)) {
          for (const entry of value) url.searchParams.append(key, String(entry));
        } else if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }

      const forwardHeaders: Record<string, string> = { ...(headers || {}) };
      delete forwardHeaders['content-length'];
      delete forwardHeaders['host'];

      const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';

      const response = await fetch(url, {
        method,
        headers: forwardHeaders,
        body: hasBody ? JSON.stringify(body) : undefined,
      });

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      const contentType = response.headers.get('content-type') || '';
      const responseBody = contentType.includes('application/json')
        ? await response.json().catch(() => undefined)
        : await response.text();

      this.send({
        version: 1,
        type: 'response',
        requestId,
        status: response.status,
        headers: responseHeaders,
        body: responseBody,
      });
    } catch (error) {
      this.send({
        version: 1,
        type: 'error',
        requestId,
        message: error instanceof Error ? error.message : 'Local request failed',
      });
    }
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      if (message['type'] === 'hello') this.onStatus('connected');
    }
  }

  stop(options: { keepToken?: boolean } = {}): void {
    if (!options.keepToken) {
      this.token = null;
      this.wsUrl = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.close();
      this.ws = null;
    }
    if (!options.keepToken) this.onStatus('disconnected');
  }
}
