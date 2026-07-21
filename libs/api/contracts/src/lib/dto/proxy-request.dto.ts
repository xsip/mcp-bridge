import { IsIn, IsObject, IsOptional, IsString } from 'class-validator';

const SUPPORTED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'] as const;

export class ProxyRequestDto {
  @IsString()
  ownerId!: string;

  @IsString()
  mcpName!: string;

  @IsIn(SUPPORTED_METHODS)
  method!: (typeof SUPPORTED_METHODS)[number];

  @IsString()
  path!: string;

  @IsObject()
  headers!: Record<string, string>;

  @IsObject()
  query!: Record<string, string | string[]>;

  @IsOptional()
  body?: unknown;
}
