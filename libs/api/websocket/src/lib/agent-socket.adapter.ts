import type { WebSocket } from 'ws';
import type { AgentSocket } from '@mcp-bridge/contracts';

/** Wraps a raw `ws` WebSocket so the rest of the codebase depends only on {@link AgentSocket}. */
export class WsAgentSocket implements AgentSocket {
  constructor(
    public readonly id: string,
    private readonly socket: WebSocket,
  ) {}

  send(data: string): void {
    if (this.isOpen()) {
      this.socket.send(data);
    }
  }

  close(code?: number, reason?: string): void {
    this.socket.close(code, reason);
  }

  isOpen(): boolean {
    return this.socket.readyState === this.socket.OPEN;
  }
}
