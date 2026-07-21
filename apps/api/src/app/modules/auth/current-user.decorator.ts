import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from './user.schema';

/**
 * Injects the currently authenticated user (full DB record, passwordHash excluded)
 * into a controller method parameter.
 *
 * @example
 * async myEndpoint(@CurrentUser() user: User) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): User => {
    return ctx.switchToHttp().getRequest().user as User;
  },
);
