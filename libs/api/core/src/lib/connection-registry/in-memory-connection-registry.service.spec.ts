import type { AgentSocket } from '@mcp-bridge/contracts';
import { AppLogger } from '@mcp-bridge/logging';
import { InMemoryConnectionRegistry } from './in-memory-connection-registry.service';

function createSocket(id: string): AgentSocket {
  let open = true;
  return {
    id,
    send: jest.fn(),
    close: jest.fn(() => {
      open = false;
    }),
    isOpen: () => open,
  };
}

describe('InMemoryConnectionRegistry', () => {
  let registry: InMemoryConnectionRegistry;

  beforeEach(() => {
    registry = new InMemoryConnectionRegistry(new AppLogger());
  });

  it('registers a new connection as online', () => {
    const socket = createSocket('sock-1');
    const connection = registry.register('client-1', socket);

    expect(connection.online).toBe(true);
    expect(registry.isOnline('client-1')).toBe(true);
    expect(registry.find('client-1')).toBe(connection);
  });

  it('closes the previous socket when a client reconnects', () => {
    const first = createSocket('sock-1');
    const second = createSocket('sock-2');

    registry.register('client-1', first);
    registry.register('client-1', second);

    expect(first.close).toHaveBeenCalled();
    expect(registry.find('client-1')?.socket).toBe(second);
  });

  it('marks a client offline and removes it on disconnect', () => {
    registry.register('client-1', createSocket('sock-1'));
    registry.disconnect('client-1');

    expect(registry.isOnline('client-1')).toBe(false);
    expect(registry.find('client-1')).toBeUndefined();
  });

  it('updates lastSeen on heartbeat', () => {
    const connection = registry.register('client-1', createSocket('sock-1'));
    const initialLastSeen = connection.lastSeen;

    jest.useFakeTimers();
    jest.advanceTimersByTime(10);
    registry.heartbeat('client-1');
    jest.useRealTimers();

    expect(registry.find('client-1')?.lastSeen.getTime()).toBeGreaterThanOrEqual(initialLastSeen.getTime());
  });

  it('lists all connections as summaries', () => {
    registry.register('client-1', createSocket('sock-1'));
    registry.register('client-2', createSocket('sock-2'));

    const summaries = registry.list();
    expect(summaries).toHaveLength(2);
    expect(summaries.map((s) => s.ownerId).sort()).toEqual(['client-1', 'client-2']);
  });
});
