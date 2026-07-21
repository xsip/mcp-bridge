import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLES_KEY } from './roles.decorator';
import { User } from './user.schema';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() annotation — allow through
    if (!required || required.length === 0) return true;

    // request['user'] is a full DB User document (passwordHash excluded),
    // set by JwtAuthGuard after verifying the token AND confirming the user
    // still exists in the database.
    const user: User | undefined = context.switchToHttp().getRequest().user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException(
        `This endpoint requires one of the following roles: ${required.join(', ')}`,
      );
    }

    return true;
  }
}
