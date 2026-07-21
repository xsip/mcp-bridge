export enum Role {
  Admin = 'admin',
  User = 'user',
}

export const ROLES_KEY = 'roles';

import { SetMetadata } from '@nestjs/common';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
