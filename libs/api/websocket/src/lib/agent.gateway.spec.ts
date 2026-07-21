import { EventEmitter } from 'events';
import type { AgentAuthenticator, ConnectionRegistry, PendingRequestStore } from '@mcp-bridge/contracts';
import { WS_PROTOCOL_VERSION, WsMessageType } from '@mcp-bridge/contracts';
import type { AppConfigService } from '@mcp-bridge/config';
import { AppLogger } from '@mcp-bridge/logging';
import { AgentGateway } from './agent.gateway';

class FakeSocket extends EventEmitter {
  sent: string[] = [];
  closeCode?: number;
  send(data: string): void {
    this.sent.push(data);
  }
  close(code?: number): void {
    this.closeCode = code;
  }
}

function receive(socket: FakeSocket, payload: unknown): void {
  socket.emit('message', Buffer.from(JSON.stringify(payload)));
}

describe('AgentGateway', () => {
  const config = { wsHeartbeatIntervalMs: 60_000 } as unknown as AppConfigService;

  function createGateway(authenticator: AgentAuthenticator) {
    const registry: ConnectionRegistry = {
      register: jest.fn(),
      disconnect: jest.fn(),
      find: jest.fn(),
      heartbeat: jest.fn(),
      list: jest.fn().mockReturnValue([]),
      isOnline: jest.fn(),
    };
    const pendingRequests = {} as PendingRequestStore;
    const gateway = new AgentGateway(registry, pendingRequests, authenticator, config, new AppLogger());
    gateway.onModuleDestroy();
    return { gateway, registry };
  }

  it('registers the connection under the authenticated ownerId', async () => {
    const authenticator: AgentAuthenticator = { authenticate: jest.fn().mockResolvedValue({ ownerId: 'alice' }) };
    const { gateway, registry } = createGateway(authenticator);
    const socket = new FakeSocket();

    gateway.handleConnection(socket as never);
    receive(socket, { version: WS_PROTOCOL_VERSION, type: WsMessageType.Hello, token: 'valid-jwt' });
    await Promise.resolve();
    await Promise.resolve();

    expect(authenticator.authenticate).toHaveBeenCalledWith('valid-jwt');
    expect(registry.register).toHaveBeenCalledWith('alice', expect.anything());
  });

  it('closes the connection when the token is invalid', async () => {
    const authenticator: AgentAuthenticator = { authenticate: jest.fn().mockResolvedValue(null) };
    const { gateway, registry } = createGateway(authenticator);
    const socket = new FakeSocket();

    gateway.handleConnection(socket as never);
    receive(socket, { version: WS_PROTOCOL_VERSION, type: WsMessageType.Hello, token: 'bad-token' });
    await Promise.resolve();
    await Promise.resolve();

    expect(registry.register).not.toHaveBeenCalled();
    expect(socket.closeCode).toBe(4003);
  });
});
