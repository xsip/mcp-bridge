import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';

export interface StoredFile {
  fileId: string;
  fileSize: number;
}

/**
 * Thin wrapper around two GridFS buckets (zip assets and preview images) —
 * the only place in the marketplace module that touches GridFS directly.
 * Zips can be tens of MBs, so they're streamed rather than buffered as a
 * single Mongo document field.
 */
@Injectable()
export class MarketplaceStorageService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  private bucket(name: 'marketplace_assets' | 'marketplace_previews'): GridFSBucket {
    if (!this.connection.db) {
      throw new Error('Mongo connection not established');
    }
    return new GridFSBucket(this.connection.db, { bucketName: name });
  }

  async storeAsset(buffer: Buffer, filename: string): Promise<StoredFile> {
    return this.upload(this.bucket('marketplace_assets'), buffer, filename);
  }

  async storePreviewImage(buffer: Buffer, filename: string): Promise<StoredFile> {
    return this.upload(this.bucket('marketplace_previews'), buffer, filename);
  }

  readAsset(fileId: string): Readable {
    return this.download(this.bucket('marketplace_assets'), fileId);
  }

  readPreviewImage(fileId: string): Readable {
    return this.download(this.bucket('marketplace_previews'), fileId);
  }

  async deleteAsset(fileId: string): Promise<void> {
    await this.bucket('marketplace_assets').delete(new ObjectId(fileId));
  }

  async deletePreviewImage(fileId: string): Promise<void> {
    await this.bucket('marketplace_previews').delete(new ObjectId(fileId));
  }

  private upload(bucket: GridFSBucket, buffer: Buffer, filename: string): Promise<StoredFile> {
    return new Promise((resolve, reject) => {
      const uploadStream = bucket.openUploadStream(filename);
      uploadStream.on('error', reject);
      uploadStream.on('finish', () => {
        resolve({ fileId: uploadStream.id.toString(), fileSize: uploadStream.length ?? buffer.length });
      });
      Readable.from(buffer).pipe(uploadStream);
    });
  }

  /**
   * Returns the GridFS read stream directly (not a Promise) — resolving on
   * the stream's `'file'` event would deadlock, since that event only fires
   * once something actually starts reading (e.g. `.pipe()`), which triggers
   * the internal lookup. Callers should attach an `'error'` listener before
   * consuming it; a missing/bad id surfaces as a stream error, not a thrown
   * exception, since the lookup happens asynchronously once read begins.
   */
  private download(bucket: GridFSBucket, fileId: string): Readable {
    let objectId: ObjectId;
    try {
      objectId = new ObjectId(fileId);
    } catch {
      throw new NotFoundException('File not found');
    }
    return bucket.openDownloadStream(objectId);
  }
}
