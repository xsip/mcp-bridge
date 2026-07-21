import { Type, plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min, validateSync } from 'class-validator';

const LOG_LEVELS = ['error', 'warn', 'log', 'debug', 'verbose'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

export class EnvironmentVariables {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  BACKEND_PORT = 3000;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  REQUEST_TIMEOUT = 30_000;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1000)
  WS_HEARTBEAT_INTERVAL = 15_000;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_PENDING_REQUESTS = 1000;

  @IsOptional()
  @IsIn(LOG_LEVELS)
  LOG_LEVEL: LogLevel = 'log';
}

export function validateEnvironment(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors.map((error) => Object.values(error.constraints ?? {}).join(', ')).join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }

  return validated;
}
