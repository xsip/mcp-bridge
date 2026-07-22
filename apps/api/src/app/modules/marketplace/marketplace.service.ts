import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { Model } from 'mongoose';
import { Role } from '../auth/roles.decorator';
import {
  AddVersionDto,
  ChangeVisibilityDto,
  CreateMarketPlaceItemDto,
  ListMarketPlaceItemsQueryDto,
  MarketPlaceItemDto,
  MyMarketPlaceDownloadDto,
  PaginatedMarketPlaceItemsDto,
  UpdateMarketPlaceItemDto,
} from './dto/marketplace-item.dto';
import { MarketplaceStorageService } from './marketplace-storage.service';
import { MarketPlaceDownloadToken, MarketPlaceDownloadTokenDocument } from './schemas/marketplace-download-token.schema';
import { MarketPlaceItemAsset, MarketPlaceItemAssetDocument } from './schemas/marketplace-item-asset.schema';
import { MarketPlaceItem, MarketPlaceItemDocument, MarketPlaceVisibility } from './schemas/marketplace-item.schema';
import { MarketPlaceUserDownload, MarketPlaceUserDownloadDocument } from './schemas/marketplace-user-download.schema';

const DOWNLOAD_LINK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_PREVIEW_IMAGES = 10;

type MarketPlaceItemFilter = Record<string, unknown>;

interface CurrentUserLike {
  username: string;
  role: Role;
}

/**
 * CRUD + versioning for marketplace listings (`MarketPlaceItem` +
 * `MarketPlaceItemAsset`), plus issuing/consuming the single-use download
 * tokens used to fetch a specific version's zip. Actual blob storage is
 * delegated to `MarketplaceStorageService` (GridFS).
 */
@Injectable()
export class MarketplaceService {
  constructor(
    @InjectModel(MarketPlaceItem.name) private readonly itemModel: Model<MarketPlaceItemDocument>,
    @InjectModel(MarketPlaceItemAsset.name) private readonly assetModel: Model<MarketPlaceItemAssetDocument>,
    @InjectModel(MarketPlaceDownloadToken.name) private readonly tokenModel: Model<MarketPlaceDownloadTokenDocument>,
    @InjectModel(MarketPlaceUserDownload.name) private readonly userDownloadModel: Model<MarketPlaceUserDownloadDocument>,
    private readonly storage: MarketplaceStorageService,
  ) {}

  /** Every public item, plus the viewer's own (private/unlisted) items. */
  async list(user: CurrentUserLike, query: ListMarketPlaceItemsQueryDto): Promise<PaginatedMarketPlaceItemsDto> {
    return this.paginate(
      { $or: [{ visibility: MarketPlaceVisibility.Public }, { ownerUsername: user.username }] },
      query,
    );
  }

  /** A given owner's items, filtered to public-only unless the viewer is that owner (or an admin). */
  async listByUser(user: CurrentUserLike, ownerUsername: string, query: ListMarketPlaceItemsQueryDto): Promise<PaginatedMarketPlaceItemsDto> {
    const canSeeAll = user.username === ownerUsername || user.role === Role.Admin;
    const filter: MarketPlaceItemFilter = canSeeAll
      ? { ownerUsername }
      : { ownerUsername, visibility: MarketPlaceVisibility.Public };
    return this.paginate(filter, query);
  }

  private async paginate(
    filter: MarketPlaceItemFilter,
    query: ListMarketPlaceItemsQueryDto,
  ): Promise<PaginatedMarketPlaceItemsDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const sort: Record<string, 1 | -1> = {};
    if (query.sortByDownloadCount) {
      sort.totalDownloadCount = query.sortByDownloadCount === 'asc' ? 1 : -1;
    }
    if (query.sortByReleaseDate) {
      sort.createdAt = query.sortByReleaseDate === 'asc' ? 1 : -1;
    }
    if (Object.keys(sort).length === 0) {
      sort.createdAt = -1;
    }

    const [items, total] = await Promise.all([
      this.itemModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.itemModel.countDocuments(filter).exec(),
    ]);

    return { items: await Promise.all(items.map((item) => this.toDto(item))), total, page, pageSize };
  }

  async getById(user: CurrentUserLike, itemId: string): Promise<MarketPlaceItemDto> {
    const item = await this.findItemOrThrow(itemId);
    this.assertCanView(user, item);
    return this.toDto(item);
  }

  async create(user: CurrentUserLike, dto: CreateMarketPlaceItemDto): Promise<MarketPlaceItemDto> {
    const existing = await this.itemModel.findOne({ ownerUsername: user.username, name: dto.name }).lean().exec();
    if (existing) {
      throw new ConflictException(`A marketplace item named "${dto.name}" already exists on this account`);
    }

    const item = await this.itemModel.create({
      id: randomUUID(),
      name: dto.name,
      description: dto.description ?? '',
      ownerUsername: user.username,
      visibility: dto.visibility ?? MarketPlaceVisibility.Private,
      previewImages: [],
      latestVersion: null,
    });

    return this.toDto(item);
  }

  async update(user: CurrentUserLike, itemId: string, dto: UpdateMarketPlaceItemDto): Promise<MarketPlaceItemDto> {
    const item = await this.findItemOrThrow(itemId);
    this.assertOwner(user, item);

    if (dto.name !== undefined && dto.name !== item.name) {
      const existing = await this.itemModel.findOne({ ownerUsername: user.username, name: dto.name }).lean().exec();
      if (existing) {
        throw new ConflictException(`A marketplace item named "${dto.name}" already exists on this account`);
      }
      item.name = dto.name;
    }
    if (dto.description !== undefined) {
      item.description = dto.description;
    }

    await item.save();
    return this.toDto(item);
  }

  async changeVisibility(user: CurrentUserLike, itemId: string, dto: ChangeVisibilityDto): Promise<MarketPlaceItemDto> {
    const item = await this.findItemOrThrow(itemId);
    this.assertOwner(user, item);
    item.visibility = dto.visibility;
    await item.save();
    return this.toDto(item);
  }

  async remove(user: CurrentUserLike, itemId: string): Promise<void> {
    const item = await this.findItemOrThrow(itemId);
    this.assertOwner(user, item);

    const assets = await this.assetModel.find({ marketPlaceItemId: item.id }).lean().exec();
    await Promise.all(assets.map((asset) => this.storage.deleteAsset(asset.fileId)));
    await Promise.all(item.previewImages.map((image) => this.storage.deletePreviewImage(image.fileId)));

    const assetIds = assets.map((asset) => asset.id);
    await this.assetModel.deleteMany({ marketPlaceItemId: item.id }).exec();
    await this.tokenModel.deleteMany({ assetId: { $in: assetIds } }).exec();
    await this.userDownloadModel.deleteMany({ marketPlaceItemId: item.id }).exec();
    await this.itemModel.deleteOne({ id: item.id }).exec();
  }

  async addPreviewImage(user: CurrentUserLike, itemId: string, file: Express.Multer.File): Promise<MarketPlaceItemDto> {
    const item = await this.findItemOrThrow(itemId);
    this.assertOwner(user, item);

    if (item.previewImages.length >= MAX_PREVIEW_IMAGES) {
      throw new ConflictException(`A marketplace item can have at most ${MAX_PREVIEW_IMAGES} preview images`);
    }

    const stored = await this.storage.storePreviewImage(file.buffer, file.originalname);
    item.previewImages.push({
      fileId: stored.fileId,
      filename: file.originalname,
      mimeType: file.mimetype,
      fileSize: stored.fileSize,
    });
    await item.save();
    return this.toDto(item);
  }

  async removePreviewImage(user: CurrentUserLike, itemId: string, fileId: string): Promise<MarketPlaceItemDto> {
    const item = await this.findItemOrThrow(itemId);
    this.assertOwner(user, item);

    const index = item.previewImages.findIndex((image) => image.fileId === fileId);
    if (index === -1) {
      throw new NotFoundException('No preview image with that id on this item');
    }

    await this.storage.deletePreviewImage(fileId);
    item.previewImages.splice(index, 1);
    await item.save();
    return this.toDto(item);
  }

  async addVersion(
    user: CurrentUserLike,
    itemId: string,
    dto: AddVersionDto,
    file: Express.Multer.File,
  ): Promise<MarketPlaceItemDto> {
    const item = await this.findItemOrThrow(itemId);
    this.assertOwner(user, item);

    const existing = await this.assetModel.findOne({ marketPlaceItemId: item.id, version: dto.version }).lean().exec();
    if (existing) {
      throw new ConflictException(`Version "${dto.version}" already exists for this item`);
    }

    const checksum = createHash('sha256').update(file.buffer).digest('hex');
    const stored = await this.storage.storeAsset(file.buffer, file.originalname);

    await this.assetModel.create({
      id: randomUUID(),
      marketPlaceItemId: item.id,
      version: dto.version,
      fileId: stored.fileId,
      fileSize: stored.fileSize,
      originalFilename: file.originalname,
      checksum,
      uploadedBy: user.username,
    });

    item.latestVersion = dto.version;
    await item.save();
    return this.toDto(item);
  }

  async removeVersion(user: CurrentUserLike, itemId: string, version: string): Promise<MarketPlaceItemDto> {
    const item = await this.findItemOrThrow(itemId);
    this.assertOwner(user, item);

    const asset = await this.assetModel.findOne({ marketPlaceItemId: item.id, version }).exec();
    if (!asset) {
      throw new NotFoundException(`No version "${version}" on this item`);
    }

    await this.storage.deleteAsset(asset.fileId);
    await this.tokenModel.deleteMany({ assetId: asset.id }).exec();
    await this.userDownloadModel.deleteMany({ assetId: asset.id }).exec();
    await this.assetModel.deleteOne({ id: asset.id }).exec();

    if (asset.downloadCount > 0) {
      item.totalDownloadCount = Math.max(0, item.totalDownloadCount - asset.downloadCount);
    }
    if (item.latestVersion === version) {
      const remaining = await this.assetModel.find({ marketPlaceItemId: item.id }).sort({ createdAt: -1 }).limit(1).lean().exec();
      item.latestVersion = remaining[0]?.version ?? null;
    }
    await item.save();

    return this.toDto(item);
  }

  /** Issues a single-use, short-lived token that `consumeDownloadToken` exchanges for the zip stream. */
  async createDownloadLink(user: CurrentUserLike, itemId: string, version: string): Promise<{ token: string; expiresAt: Date }> {
    const item = await this.findItemOrThrow(itemId);
    this.assertCanView(user, item);

    const asset = await this.assetModel.findOne({ marketPlaceItemId: item.id, version }).lean().exec();
    if (!asset) {
      throw new NotFoundException(`No version "${version}" on this item`);
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + DOWNLOAD_LINK_TTL_MS);
    await this.tokenModel.create({ token, assetId: asset.id, username: user.username, expiresAt, used: false });

    return { token, expiresAt };
  }

  /**
   * Atomically marks the token used (so a retried/replayed request can never
   * succeed twice) and returns the asset it pointed to. Also records that
   * this user has downloaded this version — the very first time a given
   * (user, version) pair is recorded, the version's and item's download
   * counters are incremented; repeat downloads of the same version by the
   * same user never double-count (see `MarketPlaceUserDownload`).
   */
  async consumeDownloadToken(user: CurrentUserLike, token: string): Promise<{ asset: MarketPlaceItemAsset }> {
    const tokenDoc = await this.tokenModel.findOneAndUpdate(
      { token, used: false, expiresAt: { $gt: new Date() } },
      { $set: { used: true } },
    ).exec();

    if (!tokenDoc || tokenDoc.username !== user.username) {
      throw new NotFoundException('Invalid, expired, or already-used download link');
    }

    const asset = await this.assetModel.findOne({ id: tokenDoc.assetId }).lean().exec();
    if (!asset) {
      throw new NotFoundException('Invalid, expired, or already-used download link');
    }

    await this.recordDownload(user.username, asset);

    return { asset };
  }

  /** Upserts the (user, asset) download record; increments counters only on first insert. */
  private async recordDownload(username: string, asset: MarketPlaceItemAsset): Promise<void> {
    const result = await this.userDownloadModel
      .updateOne(
        { username, assetId: asset.id },
        { $setOnInsert: { marketPlaceItemId: asset.marketPlaceItemId, version: asset.version } },
        { upsert: true },
      )
      .exec();

    const isFirstDownload = result.upsertedCount > 0;
    if (!isFirstDownload) return;

    await this.assetModel.updateOne({ id: asset.id }, { $inc: { downloadCount: 1 } }).exec();
    await this.itemModel.updateOne({ id: asset.marketPlaceItemId }, { $inc: { totalDownloadCount: 1 } }).exec();
  }

  /** The current user's download history, with an update-available flag against each item's current latest version. */
  async getMyDownloads(user: CurrentUserLike): Promise<MyMarketPlaceDownloadDto[]> {
    const downloads = await this.userDownloadModel.find({ username: user.username }).sort({ updatedAt: -1 }).lean().exec();
    if (downloads.length === 0) return [];

    const items = await this.itemModel
      .find({ id: { $in: downloads.map((download) => download.marketPlaceItemId) } })
      .lean()
      .exec();
    const itemsById = new Map(items.map((item) => [item.id, item]));

    return downloads
      .map((download) => {
        const item = itemsById.get(download.marketPlaceItemId);
        if (!item) return null;
        return {
          marketPlaceItemId: item.id,
          itemName: item.name,
          downloadedVersion: download.version,
          latestVersion: item.latestVersion,
          updateAvailable: item.latestVersion !== null && item.latestVersion !== download.version,
          downloadedAt: (download as unknown as { updatedAt: Date }).updatedAt,
        };
      })
      .filter((entry): entry is MyMarketPlaceDownloadDto => entry !== null);
  }

  async readAssetStream(fileId: string) {
    return this.storage.readAsset(fileId);
  }

  async readPreviewImageStream(user: CurrentUserLike, itemId: string, fileId: string) {
    const item = await this.findItemOrThrow(itemId);
    this.assertCanView(user, item);
    const image = item.previewImages.find((entry) => entry.fileId === fileId);
    if (!image) {
      throw new NotFoundException('No preview image with that id on this item');
    }
    return { stream: await this.storage.readPreviewImage(fileId), mimeType: image.mimeType };
  }

  private async findItemOrThrow(itemId: string): Promise<MarketPlaceItemDocument> {
    const item = await this.itemModel.findOne({ id: itemId }).exec();
    if (!item) {
      throw new NotFoundException(`No marketplace item with id "${itemId}"`);
    }
    return item;
  }

  private assertOwner(user: CurrentUserLike, item: MarketPlaceItem): void {
    if (item.ownerUsername !== user.username && user.role !== Role.Admin) {
      throw new ForbiddenException('Only the owner can modify this marketplace item');
    }
  }

  private assertCanView(user: CurrentUserLike, item: MarketPlaceItem): void {
    if (item.visibility === MarketPlaceVisibility.Private && item.ownerUsername !== user.username && user.role !== Role.Admin) {
      throw new ForbiddenException('This marketplace item is private');
    }
  }

  private async toDto(item: MarketPlaceItem): Promise<MarketPlaceItemDto> {
    const versions = await this.assetModel.find({ marketPlaceItemId: item.id }).sort({ createdAt: -1 }).lean().exec();
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      ownerUsername: item.ownerUsername,
      visibility: item.visibility,
      previewImages: item.previewImages,
      latestVersion: item.latestVersion,
      totalDownloadCount: item.totalDownloadCount,
      versions: versions.map((asset) => ({
        id: asset.id,
        version: asset.version,
        fileSize: asset.fileSize,
        originalFilename: asset.originalFilename,
        checksum: asset.checksum,
        uploadedBy: asset.uploadedBy,
        downloadCount: asset.downloadCount,
        createdAt: (asset as unknown as { createdAt: Date }).createdAt,
      })),
      createdAt: (item as unknown as { createdAt: Date }).createdAt,
      updatedAt: (item as unknown as { updatedAt: Date }).updatedAt,
    };
  }
}
