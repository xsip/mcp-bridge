import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from './user.schema';

/**
 * Injects the currently authenticated user (full DB record, passwordHash excluded)
 * into a controller method parameter.
 *
 * @example
 * async myEndpoint(@CurrentUser() user: User) { ... }
 */
export const CurrentToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    return ctx.switchToHttp().getRequest().token as string;
  },
);
