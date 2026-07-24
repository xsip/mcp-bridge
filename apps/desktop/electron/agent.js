const WebSocket = require('ws');
const { spawn } = require('child_process');

const DEFAULT_WS_URL = process.env.MCP_LOOP_WS_URL || 'ws://localhost:3000/agents';
const RECONNECT_DELAY_MS = 3000;
const STDIO_RESTART_DELAY_MS = 2000;
const STDIO_REQUEST_TIMEOUT_MS = 30000;

function noop() {
  /* no status callback provided */
}

/** Joins an optional local sub-path (e.g. "/api/mcp") with the forwarded request path (always starts with "/"). */
function joinPath(subPath, path) {
  if (!subPath) return path;
  return path === '/' ? subPath : subPath + path;
}

/**
 * Manages one spawned stdio MCP child process: starts it, frames outgoing
 * JSON-RPC messages as newline-delimited JSON on stdin (per the MCP stdio
 * transport spec), and dispatches incoming newline-delimited JSON-RPC
 * responses on stdout back to the caller awaiting that request `id`.
 * Restarts the process if it dies while still wanted.
 */
class StdioMcpProcess {
  constructor(name, { command, args, env }, onStatusChange) {
    this.name = name;
    this.command = command;
    this.args = args || [];
    this.env = env || {};
    this.child = null;
    this.buffer = '';
    this.pending = new Map(); // json-rpc id -> { resolve, reject, timer }
    this.stopped = true; // not spawned yet — spawns lazily on first request, or via start()
    this.restartTimer = null;
    this.nextId = 1;
    this.onStatusChange = onStatusChange || noop;
    this.status = 'stopped'; // 'stopped' | 'starting' | 'running' | 'error'
  }

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    this.onStatusChange(this.name, status);
  }

  start() {
    this.stopped = false;
    this.setStatus('starting');
    this.child = spawn(this.command, this.args, {
      env: { ...process.env, ...this.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.child.stdout.on('data', (chunk) => this.handleStdout(chunk));
    this.child.stderr.on('data', () => {
      // Local MCP process logs — not tunneled anywhere today, just drained
      // so the process never blocks on a full stderr pipe.
    });
    this.child.on('spawn', () => this.setStatus('running'));
    this.child.on('exit', () => {
      this.failAllPending(new Error(`Local MCP "${this.name}" process exited`));
      this.child = null;
      if (!this.stopped) {
        this.setStatus('error');
        this.scheduleRestart();
      }
    });
    this.child.on('error', (error) => {
      this.setStatus('error');
      this.failAllPending(error);
    });
  }

  scheduleRestart() {
    if (this.restartTimer) return;
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      if (!this.stopped) this.start();
    }, STDIO_RESTART_DELAY_MS);
  }

  handleStdout(chunk) {
    this.buffer += chunk.toString();
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim();
      this.buffer = this.buffer.slice(newlineIndex + 1);
      if (!line) continue;

      let message;
      try {
        message = JSON.parse(line);
      } catch {
        continue; // not a JSON-RPC line — ignore (some servers print banners)
      }

      const id = message.id;
      if (id === undefined || id === null) continue; // notification, not a response to a pending call
      const pending = this.pending.get(id);
      if (!pending) continue;
      clearTimeout(pending.timer);
      this.pending.delete(id);
      pending.resolve(message);
    }
  }

  failAllPending(error) {
    for (const [id, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
      this.pending.delete(id);
    }
  }

  /** Sends one JSON-RPC request, returns the matching JSON-RPC response. Restarts a dead process on demand. */
  async request(rpcRequest) {
    if (!this.child) this.start();

    const id = rpcRequest.id ?? this.nextId++;
    const framed = { ...rpcRequest, id };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Local MCP "${this.name}" did not respond in time`));
      }, STDIO_REQUEST_TIMEOUT_MS);

      this.pending.set(id, { resolve, reject, timer });

      try {
        this.child.stdin.write(JSON.stringify(framed) + '\n');
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  stop() {
    this.stopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.failAllPending(new Error(`Local MCP "${this.name}" stopped`));
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.setStatus('stopped');
  }

  /** Kills the current process (if any) and immediately spawns a fresh one. */
  restart() {
    this.stopped = true;
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
    this.failAllPending(new Error(`Local MCP "${this.name}" restarting`));
    if (this.child) {
      this.child.kill();
      this.child = null;
    }
    this.start();
  }
}

/**
 * The actual tunnel: connects out to the backend's `/agents` WebSocket,
 * authenticates with the user's JWT, and answers every forwarded `request`
 * message by calling the matching local MCP — either an HTTP server
 * (`http://127.0.0.1:<port>`) or a local stdio child process — and sending
 * the result back as a `response` message.
 *
 * Lives in the Electron **main** process (real Node, no browser CORS
 * restrictions, real `child_process` access) — the renderer only
 * starts/stops it and keeps its name -> config map in sync via IPC (see
 * preload.js / main.js).
 */
class AgentTunnel {
  constructor(onStatus, onStdioStatus) {
    this.ws = null;
    this.mcps = new Map(); // name -> { transport, port, subPath } | { transport: 'stdio', command, args, env }
    this.stdioProcesses = new Map(); // name -> StdioMcpProcess
    this.onStatus = onStatus || noop;
    this.onStdioStatus = onStdioStatus || noop;
    this.token = null;
    this.reconnectTimer = null;
  }

  setMcps(mcps) {
    this.mcps = new Map(
      (mcps || []).map((mcp) => [
        mcp.name,
        mcp.transport === 'stdio'
          ? { transport: 'stdio', command: mcp.command, args: mcp.args, env: mcp.env }
          : { transport: 'http', port: mcp.port, subPath: mcp.subPath },
      ]),
    );

    // Drop stdio processes for MCPs that were removed, deactivated, or
    // switched away from stdio; leave the rest running (a live stdio
    // process is expensive to restart on every unrelated config change).
    for (const [name, proc] of this.stdioProcesses) {
      const current = this.mcps.get(name);
      if (!current || current.transport !== 'stdio') {
        proc.stop();
        this.stdioProcesses.delete(name);
      }
    }
  }

  getStdioProcess(name, config) {
    let proc = this.stdioProcesses.get(name);
    if (!proc) {
      proc = new StdioMcpProcess(name, config, this.onStdioStatus);
      this.stdioProcesses.set(name, proc);
    }
    return proc;
  }

  /** name -> 'stopped' | 'starting' | 'running' | 'error', for every configured stdio MCP (not-yet-spawned ones report 'stopped'). */
  getStdioStatuses() {
    const statuses = {};
    for (const [name, config] of this.mcps) {
      if (config.transport !== 'stdio') continue;
      statuses[name] = this.stdioProcesses.get(name)?.status || 'stopped';
    }
    return statuses;
  }

  startStdio(name) {
    const config = this.mcps.get(name);
    if (!config || config.transport !== 'stdio') return;
    const proc = this.getStdioProcess(name, config);
    if (!proc.child) proc.start();
  }

  stopStdio(name) {
    this.stdioProcesses.get(name)?.stop();
  }

  restartStdio(name) {
    const config = this.mcps.get(name);
    if (!config || config.transport !== 'stdio') return;
    this.getStdioProcess(name, config).restart();
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

    if (target.transport === 'stdio') {
      await this.handleStdioRequest(requestId, mcpName, target, body);
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

  /**
   * A stdio MCP has no HTTP surface, so the forwarded request's body is
   * expected to already be the MCP JSON-RPC request (the same shape a
   * "streamable HTTP" MCP client would POST) — it's written to the child's
   * stdin and the matching JSON-RPC response read back from stdout.
   */
  async handleStdioRequest(requestId, mcpName, target, body) {
    if (!target.command) {
      this.send({ version: 1, type: 'error', requestId, message: `Local MCP "${mcpName}" has no command configured` });
      return;
    }

    try {
      const proc = this.getStdioProcess(mcpName, target);
      const rpcResponse = await proc.request(body);
      this.send({
        version: 1,
        type: 'response',
        requestId,
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: rpcResponse,
      });
    } catch (error) {
      this.send({
        version: 1,
        type: 'error',
        requestId,
        message: error instanceof Error ? error.message : 'Local stdio request failed',
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
    if (!options.keepToken) {
      this.onStatus('disconnected');
      for (const proc of this.stdioProcesses.values()) proc.stop();
      this.stdioProcesses.clear();
    }
  }
}

module.exports = { AgentTunnel };
