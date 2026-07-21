import { IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'CI server', description: 'A label to tell this key apart from others in the list' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}

export class ApiKeyDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'First few characters of the key, for identification — the rest is never shown again' })
  prefix: string;

  @ApiProperty()
  createdAt: string;

  @ApiProperty({ nullable: true, type: String })
  lastUsedAt: string | null;

  @ApiProperty({ nullable: true, type: String })
  revokedAt: string | null;
}

export class CreatedApiKeyDto extends ApiKeyDto {
  @ApiProperty({ description: 'The full raw API key — shown once, at creation time, and never retrievable again' })
  key: string;
}
