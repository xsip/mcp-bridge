import { Module } from '@nestjs/common';
import { BridgeWebsocketModule } from '@mcp-loop/websocket';
import { McpModule } from '../mcp/mcp.module';
import { AuthModule } from '../auth/auth.module';
import { ProxyController } from './proxy.controller';
import { ProxyService } from './proxy.service';

@Module({
  imports: [BridgeWebsocketModule, McpModule, AuthModule],
  controllers: [ProxyController],
  providers: [ProxyService],
})
export class ProxyModule {}
