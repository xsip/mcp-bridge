import { Controller, Get, Inject } from '@nestjs/common';
import { CONNECTION_REGISTRY, ConnectionRegistry } from '@mcp-bridge/contracts';
import { Public } from '../auth/public.decorator';
import { HealthResponseDto } from './dto/health-response.dto';

const APP_VERSION = process.env.npm_package_version ?? '0.0.0';

@Public()
@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();

  constructor(@Inject(CONNECTION_REGISTRY) private readonly registry: ConnectionRegistry) {}

  @Get()
  check(): HealthResponseDto {
    return {
      status: 'ok',
      uptime: (Date.now() - this.startedAt) / 1000,
      connectedClients: this.registry.list().filter((connection) => connection.online).length,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}
