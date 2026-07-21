import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from './env.validation';

/**
 * Typed facade over `@nestjs/config`'s `ConfigService`, so the rest of the
 * codebase never reads `process.env` or untyped config keys directly.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService<EnvironmentVariables, true>) {}

  get port(): number {
    return this.configService.get('BACKEND_PORT', { infer: true });
  }

  get requestTimeoutMs(): number {
    return this.configService.get('REQUEST_TIMEOUT', { infer: true });
  }

  get wsHeartbeatIntervalMs(): number {
    return this.configService.get('WS_HEARTBEAT_INTERVAL', { infer: true });
  }

  get maxPendingRequests(): number {
    return this.configService.get('MAX_PENDING_REQUESTS', { infer: true });
  }

  get logLevel(): EnvironmentVariables['LOG_LEVEL'] {
    return this.configService.get('LOG_LEVEL', { infer: true });
  }
}
