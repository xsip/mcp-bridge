import type { ConnectionRegistry, PendingRequestStore, Transport } from '@mcp-bridge/contracts';
import { ClientNotFoundError } from '@mcp-bridge/common';
import type { AppConfigService } from '@mcp-bridge/config';
import { AppLogger } from '@mcp-bridge/logging';
import { WsRequestRouter } from './ws-request-router.service';

describe('WsRequestRouter', () => {
  const config = { requestTimeoutMs: 5000 } as unknown as AppConfigService;

  it('throws ClientNotFoundError when the target account has no online agent', async () => {
    const registry = { isOnline: jest.fn().mockReturnValue(false) } as unknown as ConnectionRegistry;
    const pendingRequests = {} as PendingRequestStore;
    const transport = { send: jest.fn() } as unknown as Transport;

    const router = new WsRequestRouter(registry, pendingRequests, transport, config, new AppLogger());

    await expect(
      router.forward({ ownerId: 'alice', mcpName: 'notes', method: 'GET', path: '/', headers: {}, query: {} }),
    ).rejects.toBeInstanceOf(ClientNotFoundError);
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('creates a pending request and sends it through the transport', async () => {
    const registry = { isOnline: jest.fn().mockReturnValue(true) } as unknown as ConnectionRegistry;
    const pendingRequests = {
      create: jest.fn().mockResolvedValue({ status: 200, headers: {}, body: {} }),
    } as unknown as PendingRequestStore;
    const transport = { send: jest.fn() } as unknown as Transport;

    const router = new WsRequestRouter(registry, pendingRequests, transport, config, new AppLogger());
    const response = await router.forward({ ownerId: 'alice', mcpName: 'notes', method: 'GET', path: '/tools', headers: {}, query: {} });

    expect(response).toEqual({ status: 200, headers: {}, body: {} });
    expect(transport.send).toHaveBeenCalledWith('alice', expect.any(String), expect.objectContaining({ path: '/tools', mcpName: 'notes' }));
  });
});
