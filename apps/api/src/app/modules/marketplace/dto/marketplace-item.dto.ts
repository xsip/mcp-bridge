import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MarketPlaceVisibility } from '../schemas/marketplace-item.schema';

export type SortDirection = 'asc' | 'desc';

export class MarketPlaceItemPreviewImageDto {
  @ApiProperty()
  fileId: string;

  @ApiProperty()
  filename: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  fileSize: number;
}

export class MarketPlaceItemAssetDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  version: string;

  @ApiProperty()
  fileSize: number;

  @ApiProperty()
  originalFilename: string;

  @ApiProperty()
  checksum: string;

  @ApiProperty()
  uploadedBy: string;

  @ApiProperty()
  downloadCount: number;

  @ApiProperty()
  createdAt: Date;
}

export class MarketPlaceItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  ownerUsername: string;

  @ApiProperty({ enum: MarketPlaceVisibility })
  visibility: MarketPlaceVisibility;

  @ApiProperty({ type: [MarketPlaceItemPreviewImageDto] })
  previewImages: MarketPlaceItemPreviewImageDto[];

  @ApiPropertyOptional({ type: String, nullable: true })
  latestVersion: string | null;

  @ApiProperty()
  totalDownloadCount: number;

  @ApiProperty({ type: [MarketPlaceItemAssetDto] })
  versions: MarketPlaceItemAssetDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class CreateMarketPlaceItemDto {
  @ApiProperty({ example: 'my-cool-mcp' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'Does cool things.', description: 'Rich text (HTML) — rendered sanitized by the client' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;

  @ApiPropertyOptional({ enum: MarketPlaceVisibility, default: MarketPlaceVisibility.Private })
  @IsOptional()
  @IsEnum(MarketPlaceVisibility)
  visibility?: MarketPlaceVisibility;
}

export class UpdateMarketPlaceItemDto {
  @ApiPropertyOptional({ example: 'my-cool-mcp' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: 'Does cool things.', description: 'Rich text (HTML) — rendered sanitized by the client' })
  @IsOptional()
  @IsString()
  @MaxLength(20000)
  description?: string;
}

export class ChangeVisibilityDto {
  @ApiProperty({ enum: MarketPlaceVisibility })
  @IsEnum(MarketPlaceVisibility)
  visibility: MarketPlaceVisibility;
}

export class AddVersionDto {
  @ApiProperty({ example: '1.0.0' })
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  version: string;
}

export class DownloadLinkDto {
  @ApiProperty()
  token: string;

  @ApiProperty()
  expiresAt: Date;
}

export class ListMarketPlaceItemsQueryDto {
  @ApiPropertyOptional({ description: 'Case-insensitive substring match against the item name' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort by total download count' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortByDownloadCount?: SortDirection;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], description: 'Sort by release date (creation date)' })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortByReleaseDate?: SortDirection;
}

export class PaginatedMarketPlaceItemsDto {
  @ApiProperty({ type: [MarketPlaceItemDto] })
  items: MarketPlaceItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}

export class MyMarketPlaceDownloadDto {
  @ApiProperty()
  marketPlaceItemId: string;

  @ApiProperty()
  itemName: string;

  @ApiProperty({ description: 'The version this user last downloaded' })
  downloadedVersion: string;

  @ApiPropertyOptional({ description: "The item's current latest version, if it still exists", type: String, nullable: true })
  latestVersion: string | null;

  @ApiProperty({ description: 'True if the item has a newer version than the one downloaded' })
  updateAvailable: boolean;

  @ApiProperty()
  downloadedAt: Date;
}
