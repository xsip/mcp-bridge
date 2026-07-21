import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Mark a route as public — skips API key authentication.
 * Example:
 *   @Public()
 *   @Get()
 *   findAll() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
