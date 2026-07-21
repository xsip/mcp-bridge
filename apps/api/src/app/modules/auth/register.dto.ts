import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * No hyphens allowed: a user's MCPs are addressed as `<username>-<mcpName>`,
 * and that id is parsed by splitting on the first hyphen. If usernames could
 * contain hyphens, the split would be ambiguous.
 */
export class RegisterDto {
  @ApiProperty({ example: 'admin', description: 'Unique username (lowercase alphanumeric / underscore, no hyphens)' })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-z0-9_]+$/, { message: 'username must be lowercase alphanumeric or underscore, with no hyphens' })
  username: string;

  @ApiProperty({ example: 'hunter2', description: 'Password (min 8 chars)' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'SUPER_SECRET_REGISTER_KEY',
    description: 'Server-side registration secret from env REGISTER_SECRET',
  })
  @IsString()
  registerSecret: string;

}
