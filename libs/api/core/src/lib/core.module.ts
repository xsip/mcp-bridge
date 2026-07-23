import { Module } from '@nestjs/common';
import { CONNECTION_REGISTRY, PENDING_REQUEST_STORE } from '@mcp-loop/contracts';
import { InMemoryConnectionRegistry } from './connection-registry/in-memory-connection-registry.service';
import { InMemoryPendingRequestStore } from './pending-request-store/in-memory-pending-request-store.service';

@Module({
  providers: [
    { provide: CONNECTION_REGISTRY, useClass: InMemoryConnectionRegistry },
    { provide: PENDING_REQUEST_STORE, useClass: InMemoryPendingRequestStore },
  ],
  exports: [CONNECTION_REGISTRY, PENDING_REQUEST_STORE],
})
export class CoreModule {}
