import { AppLogger } from '@mcp-loop/logging';
import type { AppConfigService } from '@mcp-loop/config';
import { RequestTimeoutError, TooManyPendingRequestsError } from '@mcp-loop/common';
import { InMemoryPendingRequestStore } from './in-memory-pending-request-store.service';

function createConfig(maxPendingRequests: number): AppConfigService {
  return { maxPendingRequests } as unknown as AppConfigService;
}

describe('InMemoryPendingRequestStore', () => {
  it('resolves a pending request with the matching response', async () => {
    const store = new InMemoryPendingRequestStore(createConfig(10), new AppLogger());

    const pending = store.create('req-1', 5000);
    store.resolve('req-1', { status: 200, headers: {}, body: { ok: true } });

    await expect(pending).resolves.toEqual({ status: 200, headers: {}, body: { ok: true } });
    expect(store.has('req-1')).toBe(false);
  });

  it('rejects with a RequestTimeoutError when nothing resolves in time', async () => {
    jest.useFakeTimers();
    const store = new InMemoryPendingRequestStore(createConfig(10), new AppLogger());

    const pending = store.create('req-2', 50);
    jest.advanceTimersByTime(51);

    await expect(pending).rejects.toBeInstanceOf(RequestTimeoutError);
    jest.useRealTimers();
  });

  it('throws TooManyPendingRequestsError once the limit is reached', () => {
    const store = new InMemoryPendingRequestStore(createConfig(1), new AppLogger());
    store.create('req-1', 5000).catch(() => undefined);

    expect(() => store.create('req-2', 5000)).toThrow(TooManyPendingRequestsError);
  });

  it('ignores resolve calls for unknown request ids', () => {
    const store = new InMemoryPendingRequestStore(createConfig(10), new AppLogger());
    expect(() => store.resolve('unknown', { status: 200, headers: {} })).not.toThrow();
  });
});
