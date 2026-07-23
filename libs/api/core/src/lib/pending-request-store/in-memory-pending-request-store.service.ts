import { Injectable } from '@nestjs/common';
import type { PendingRequestStore, ProxyHttpResponse } from '@mcp-loop/contracts';
import { RequestTimeoutError, TooManyPendingRequestsError } from '@mcp-loop/common';
import { AppConfigService } from '@mcp-loop/config';
import { AppLogger } from '@mcp-loop/logging';

interface PendingEntry {
  resolve: (response: ProxyHttpResponse) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * In-memory implementation of {@link PendingRequestStore}.
 *
 * Scaling note: pending requests are resolved via in-process Promises, which
 * only works when the HTTP caller and the WebSocket connection are handled
 * by the same instance. Horizontally scaling requires either sticky routing
 * (so a clientId's WS connection and its HTTP proxy requests always land on
 * the same instance) or a distributed store such as Redis pub/sub, where the
 * instance holding the socket publishes the response and the instance
 * awaiting it subscribes for the matching requestId.
 */
@Injectable()
export class InMemoryPendingRequestStore implements PendingRequestStore {
  private readonly pending = new Map<string, PendingEntry>();

  constructor(
    private readonly config: AppConfigService,
    private readonly logger: AppLogger,
  ) {
    this.logger.setContext(InMemoryPendingRequestStore.name);
  }

  create(requestId: string, timeoutMs: number): Promise<ProxyHttpResponse> {
    if (this.pending.size >= this.config.maxPendingRequests) {
      throw new TooManyPendingRequestsError(this.config.maxPendingRequests);
    }

    return new Promise<ProxyHttpResponse>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(requestId);
        this.logger.warn(`Request "${requestId}" timed out after ${timeoutMs}ms`);
        reject(new RequestTimeoutError(requestId));
      }, timeoutMs);

      this.pending.set(requestId, { resolve, reject, timeout });
    });
  }

  resolve(requestId: string, response: ProxyHttpResponse): void {
    const entry = this.pending.get(requestId);
    if (!entry) {
      this.logger.warn(`Received response for unknown or already-settled request "${requestId}"`);
      return;
    }
    clearTimeout(entry.timeout);
    this.pending.delete(requestId);
    entry.resolve(response);
  }

  reject(requestId: string, error: Error): void {
    const entry = this.pending.get(requestId);
    if (!entry) {
      return;
    }
    clearTimeout(entry.timeout);
    this.pending.delete(requestId);
    entry.reject(error);
  }

  has(requestId: string): boolean {
    return this.pending.has(requestId);
  }

  size(): number {
    return this.pending.size;
  }
}
