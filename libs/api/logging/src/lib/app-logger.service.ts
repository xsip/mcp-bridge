import { Injectable, LoggerService, Scope } from '@nestjs/common';

type LogLevel = 'error' | 'warn' | 'log' | 'debug' | 'verbose';

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  log: 2,
  debug: 3,
  verbose: 4,
};

/**
 * Structured logger used throughout the backend instead of `console.log`.
 * Emits single-line JSON so downstream log aggregators (CloudWatch, Loki,
 * Datadog, etc.) can parse fields without additional configuration.
 */
@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger implements LoggerService {
  private context = 'Application';
  private static level: LogLevel = 'log';

  static setLevel(level: LogLevel): void {
    AppLogger.level = level;
  }

  setContext(context: string): void {
    this.context = context;
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, { trace, context });
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, { context });
  }

  log(message: unknown, context?: string): void {
    this.write('log', message, { context });
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, { context });
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, { context });
  }

  private write(level: LogLevel, message: unknown, extra: { trace?: string; context?: string }): void {
    if (LEVEL_WEIGHT[level] > LEVEL_WEIGHT[AppLogger.level]) {
      return;
    }

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      context: extra.context ?? this.context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...(extra.trace ? { trace: extra.trace } : {}),
    };

    const line = JSON.stringify(entry);
    if (level === 'error') {
      process.stderr.write(line + '\n');
    } else {
      process.stdout.write(line + '\n');
    }
  }
}
