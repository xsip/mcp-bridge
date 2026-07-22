import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../auth/user.schema';
import {
  AddVersionDto,
  ChangeVisibilityDto,
  CreateMarketPlaceItemDto,
  DownloadLinkDto,
  ListMarketPlaceItemsQueryDto,
  MarketPlaceItemDto,
  MyMarketPlaceDownloadDto,
  PaginatedMarketPlaceItemsDto,
  UpdateMarketPlaceItemDto,
} from './dto/marketplace-item.dto';
import { MarketplaceService } from './marketplace.service';

const ASSET_UPLOAD_OPTIONS = { storage: memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } };
const PREVIEW_IMAGE_UPLOAD_OPTIONS = { storage: memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } };

/**
 * Marketplace listings ("MarketPlaceItem") and their versioned zip assets.
 * Every route requires a logged-in user (global `JwtAuthGuard`) — there is
 * no anonymous/public access, even to `public`-visibility items.
 */
@ApiTags('marketplace')
@ApiBearerAuth()
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('items')
  @ApiOperation({
    operationId: 'listMarketplaceItems',
    summary: 'List public marketplace items plus your own, paginated',
  })
  @ApiOkResponse({ type: PaginatedMarketPlaceItemsDto })
  list(@CurrentUser() user: User, @Query() query: ListMarketPlaceItemsQueryDto): Promise<PaginatedMarketPlaceItemsDto> {
    return this.marketplaceService.list(user, query);
  }

  @Get('users/:username/items')
  @ApiOperation({
    operationId: 'listMarketplaceItemsByUser',
    summary: "List a specific user's marketplace items, paginated (private items only shown to that user)",
  })
  @ApiOkResponse({ type: PaginatedMarketPlaceItemsDto })
  listByUser(
    @CurrentUser() user: User,
    @Param('username') username: string,
    @Query() query: ListMarketPlaceItemsQueryDto,
  ): Promise<PaginatedMarketPlaceItemsDto> {
    return this.marketplaceService.listByUser(user, username, query);
  }

  @Get('my-downloads')
  @ApiOperation({
    operationId: 'getMyMarketplaceDownloads',
    summary: "The current user's download history, flagging items with a newer version available",
  })
  @ApiOkResponse({ type: [MyMarketPlaceDownloadDto] })
  getMyDownloads(@CurrentUser() user: User): Promise<MyMarketPlaceDownloadDto[]> {
    return this.marketplaceService.getMyDownloads(user);
  }

  @Get('items/:id')
  @ApiOperation({ operationId: 'getMarketplaceItem', summary: 'Get a single marketplace item, with its versions' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  getById(@CurrentUser() user: User, @Param('id') id: string): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.getById(user, id);
  }

  @Post('items')
  @ApiOperation({ operationId: 'createMarketplaceItem', summary: 'Create a new marketplace listing' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  create(@CurrentUser() user: User, @Body() dto: CreateMarketPlaceItemDto): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.create(user, dto);
  }

  @Patch('items/:id')
  @ApiOperation({ operationId: 'updateMarketplaceItem', summary: 'Update a marketplace listing (name, description)' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: UpdateMarketPlaceItemDto,
  ): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.update(user, id, dto);
  }

  @Patch('items/:id/visibility')
  @ApiOperation({ operationId: 'changeMarketplaceItemVisibility', summary: 'Change a listing\'s visibility' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  changeVisibility(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: ChangeVisibilityDto,
  ): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.changeVisibility(user, id, dto);
  }

  @Delete('items/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ operationId: 'removeMarketplaceItem', summary: 'Remove a listing and all of its versions' })
  remove(@CurrentUser() user: User, @Param('id') id: string): Promise<void> {
    return this.marketplaceService.remove(user, id);
  }

  @Post('items/:id/preview-images')
  @UseInterceptors(FileInterceptor('file', PREVIEW_IMAGE_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ operationId: 'addMarketplaceItemPreviewImage', summary: 'Add a preview image to a listing' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  addPreviewImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.addPreviewImage(user, id, file);
  }

  @Delete('items/:id/preview-images/:fileId')
  @ApiOperation({ operationId: 'removeMarketplaceItemPreviewImage', summary: 'Remove a preview image from a listing' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  removePreviewImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.removePreviewImage(user, id, fileId);
  }

  @Get('items/:id/preview-images/:fileId')
  @ApiOperation({ operationId: 'getMarketplaceItemPreviewImage', summary: 'Stream a preview image' })
  async getPreviewImage(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, mimeType } = await this.marketplaceService.readPreviewImageStream(user, id, fileId);
    res.setHeader('Content-Type', mimeType);
    stream.on('error', () => res.destroy()).pipe(res);
  }

  @Post('items/:id/versions')
  @UseInterceptors(FileInterceptor('file', ASSET_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ operationId: 'addMarketplaceItemVersion', summary: 'Upload a new version (zip) of a listing' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  addVersion(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() dto: AddVersionDto,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.addVersion(user, id, dto, file);
  }

  @Delete('items/:id/versions/:version')
  @ApiOperation({ operationId: 'removeMarketplaceItemVersion', summary: 'Remove a specific version of a listing' })
  @ApiOkResponse({ type: MarketPlaceItemDto })
  removeVersion(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('version') version: string,
  ): Promise<MarketPlaceItemDto> {
    return this.marketplaceService.removeVersion(user, id, version);
  }

  @Post('items/:id/versions/:version/download-link')
  @ApiOperation({
    operationId: 'createMarketplaceItemDownloadLink',
    summary: 'Issue a single-use, short-lived link to download a specific version',
  })
  @ApiOkResponse({ type: DownloadLinkDto })
  createDownloadLink(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Param('version') version: string,
  ): Promise<DownloadLinkDto> {
    return this.marketplaceService.createDownloadLink(user, id, version);
  }

  @Get('download/:token')
  @ApiOperation({
    operationId: 'downloadMarketplaceItemVersion',
    summary: 'Consume a single-use download link and stream the version zip',
  })
  async download(@CurrentUser() user: User, @Param('token') token: string, @Res() res: Response): Promise<void> {
    const { asset } = await this.marketplaceService.consumeDownloadToken(user, token);
    const stream = await this.marketplaceService.readAssetStream(asset.fileId);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${asset.originalFilename}"`);
    res.setHeader('Content-Length', asset.fileSize.toString());
    stream.on('error', () => res.destroy()).pipe(res);
  }
}
