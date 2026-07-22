import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ClientNotFoundError, McpNotFoundError, RequestTimeoutError, TooManyPendingRequestsError } from '../errors/domain-errors';
import { AppLogger } from '@mcp-bridge/logging';

interface ErrorBody {
  statusCode: number;
  message: string;
  error: string;
}

/**
 * Maps every thrown error to a safe JSON body. Stack traces are never sent
 * to the client; the full error is logged server-side instead.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const { status, body } = this.mapException(exception);

    // if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(body.message, exception instanceof Error ? exception.stack : undefined);
    // } else {
      // this.logger.warn(body.message);
    // }

    response.status(status).json(body);
  }

  private mapException(exception: unknown): { status: number; body: ErrorBody } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message = typeof response === 'string' ? response : (response as { message?: string }).message ?? exception.message;
      return { status, body: { statusCode: status, message: Array.isArray(message) ? message.join(', ') : message, error: exception.name } };
    }

    if (exception instanceof McpNotFoundError) {
      return {
        status: HttpStatus.NOT_FOUND,
        body: { statusCode: HttpStatus.NOT_FOUND, message: exception.message, error: 'McpNotFound' },
      };
    }

    if (exception instanceof ClientNotFoundError) {
      return {
        status: HttpStatus.BAD_GATEWAY,
        body: { statusCode: HttpStatus.BAD_GATEWAY, message: exception.message, error: 'ClientNotFound' },
      };
    }

    if (exception instanceof RequestTimeoutError) {
      return {
        status: HttpStatus.GATEWAY_TIMEOUT,
        body: { statusCode: HttpStatus.GATEWAY_TIMEOUT, message: exception.message, error: 'RequestTimeout' },
      };
    }

    if (exception instanceof TooManyPendingRequestsError) {
      return {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        body: { statusCode: HttpStatus.SERVICE_UNAVAILABLE, message: exception.message, error: 'TooManyPendingRequests' },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error', error: 'InternalServerError' },
    };
  }
}
