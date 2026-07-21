import { Module } from '@nestjs/common';
import { BridgeWebsocketModule } from '@mcp-bridge/websocket';
import { HealthController } from './health.controller';

@Module({
  imports: [BridgeWebsocketModule],
  controllers: [HealthController],
})
export class HealthModule {}
