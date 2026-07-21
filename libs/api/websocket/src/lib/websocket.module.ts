import { Module } from '@nestjs/common';
import { REQUEST_ROUTER, TRANSPORT } from '@mcp-bridge/contracts';
import { CoreModule } from '@mcp-bridge/core';
import { AgentGateway } from './agent.gateway';
import { WsTransportService } from './ws-transport.service';
import { WsRequestRouter } from './ws-request-router.service';

@Module({
  imports: [CoreModule],
  providers: [
    AgentGateway,
    { provide: TRANSPORT, useClass: WsTransportService },
    { provide: REQUEST_ROUTER, useClass: WsRequestRouter },
  ],
  exports: [REQUEST_ROUTER, CoreModule],
})
export class BridgeWebsocketModule {}
