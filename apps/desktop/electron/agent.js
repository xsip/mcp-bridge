const WebSocket = require('ws');

const DEFAULT_WS_URL = process.env.MCP_LOOP_WS_URL || 'ws://localhost:3000/agents';
const RECONNECT_DELAY_MS = 3000;
function noop() {
  /* no status callback provided */
}

/** Joins an optional local sub-path (e.g. "/api/mcp") with the forwarded request path (always starts with "/"). */
function joinPath(subPath, path) {
  if (!subPath) return path;
  return path === '/' ? subPath : subPath + path;
}

/**
 * The actual tunnel: connects out to the backend's `/agents` WebSocket,
 * authenticates with the user's JWT, and answers every forwarded `request`
 * message by calling the matching local MCP (`http://127.0.0.1:<port>`)
 * and sending the result back as a `response` message.
 *
 * Lives in the Electron **main** process (real Node, no browser CORS
 * restrictions) — the renderer only starts/stops it and keeps its
 * name -> port map in sync via IPC (see preload.js / main.js).
 */
class AgentTunnel {
  constructor(onStatus) {
    this.ws = null;
    this.mcps = new Map(); // name -> { port, subPath }
    this.onStatus = onStatus || noop;
    this.token = null;
    this.reconnectTimer = null;
  }

  setMcps(mcps) {
    this.mcps = new Map((mcps || []).map((mcp) => [mcp.name, { port: mcp.port, subPath: mcp.subPath }]));
  }

  start(token) {
    this.token = token;
    this.stop({ keepToken: true });
    this.connect();
  }

  connect() {
    if (!this.token) return;
    this.onStatus('connecting');
    this.ws = new WebSocket(DEFAULT_WS_URL);

    this.ws.on('open', () => {
      this.send({ version: 1, type: 'hello', token: this.token });
    });

    this.ws.on('message', (raw) => this.handleMessage(raw));

    this.ws.on('close', () => {
      this.onStatus('disconnected');
      this.scheduleReconnect();
    });

    this.ws.on('error', () => {
      this.onStatus('error');
    });
  }

  scheduleReconnect() {
    if (!this.token || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.token) this.connect();
    }, RECONNECT_DELAY_MS);
  }

  async handleMessage(raw) {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.type) {
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

  async handleRequest(message) {
    const { requestId, mcpName, method, path, headers, query, body } = message;
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
          for (const entry of value) url.searchParams.append(key, entry);
        } else if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }

      const forwardHeaders = { ...(headers || {}) };
      delete forwardHeaders['content-length'];
      delete forwardHeaders['host'];

      const hasBody = body !== undefined && method !== 'GET' && method !== 'HEAD';

      const response = await fetch(url, {
        method,
        headers: forwardHeaders,
        body: hasBody ? JSON.stringify(body) : undefined,
      });

      const responseHeaders = {};
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

  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      if (message.type === 'hello') this.onStatus('connected');
    }
  }

  stop(options = {}) {
    if (!options.keepToken) this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    if (!options.keepToken) this.onStatus('disconnected');
  }
}

module.exports = { AgentTunnel };
