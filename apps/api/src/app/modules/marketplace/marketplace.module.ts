import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceStorageService } from './marketplace-storage.service';
import { MarketPlaceItem, MarketPlaceItemSchema } from './schemas/marketplace-item.schema';
import { MarketPlaceItemAsset, MarketPlaceItemAssetSchema } from './schemas/marketplace-item-asset.schema';
import { MarketPlaceDownloadToken, MarketPlaceDownloadTokenSchema } from './schemas/marketplace-download-token.schema';
import { MarketPlaceUserDownload, MarketPlaceUserDownloadSchema } from './schemas/marketplace-user-download.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: MarketPlaceItem.name, schema: MarketPlaceItemSchema },
      { name: MarketPlaceItemAsset.name, schema: MarketPlaceItemAssetSchema },
      { name: MarketPlaceDownloadToken.name, schema: MarketPlaceDownloadTokenSchema },
      { name: MarketPlaceUserDownload.name, schema: MarketPlaceUserDownloadSchema },
    ]),
  ],
  controllers: [MarketplaceController],
  providers: [MarketplaceService, MarketplaceStorageService],
})
export class MarketplaceModule {}
