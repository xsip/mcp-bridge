import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes, randomUUID, createHash } from 'crypto';
import { ApiKey, ApiKeyDocument } from './api-key.schema';
import { ApiKeyDto, CreatedApiKeyDto } from './dto/api-key.dto';

const KEY_PREFIX = 'mcpk_';
const PREFIX_DISPLAY_LENGTH = 12;

function hashKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Issues and manages long-lived API keys used to authenticate `/mcp/:mcpId`
 * proxy calls (see `ApiKeyAuthGuard`), as an alternative to the short-lived
 * JWT used everywhere else. Keys are opaque random tokens; only their
 * SHA-256 hash is ever persisted, so a leaked database dump can't be used
 * to reconstruct working keys.
 */
@Injectable()
export class ApiKeyService {
  constructor(@InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKeyDocument>) {}

  async list(username: string): Promise<ApiKeyDto[]> {
    const keys = await this.apiKeyModel.find({ ownerId: username }).sort({ createdAt: -1 }).lean().exec();
    return keys.map(toDto);
  }

  async create(username: string, name: string): Promise<CreatedApiKeyDto> {
    const rawKey = `${KEY_PREFIX}${randomBytes(32).toString('hex')}`;

    const apiKey = await this.apiKeyModel.create({
      id: randomUUID(),
      ownerId: username,
      name,
      keyHash: hashKey(rawKey),
      prefix: rawKey.slice(0, PREFIX_DISPLAY_LENGTH),
      lastUsedAt: null,
      revokedAt: null,
    });

    return { ...toDto(apiKey), key: rawKey };
  }

  async revoke(username: string, id: string): Promise<void> {
    const apiKey = await this.apiKeyModel.findOne({ ownerId: username, id }).exec();
    if (!apiKey) {
      throw new NotFoundException(`No API key with id "${id}" on this account`);
    }
    if (apiKey.revokedAt) {
      throw new ForbiddenException('This API key is already revoked');
    }

    apiKey.revokedAt = new Date();
    await apiKey.save();
  }
}

function toDto(apiKey: ApiKey & { createdAt?: Date }): ApiKeyDto {
  return {
    id: apiKey.id,
    name: apiKey.name,
    prefix: apiKey.prefix,
    createdAt: (apiKey.createdAt ?? new Date()).toISOString(),
    lastUsedAt: apiKey.lastUsedAt ? apiKey.lastUsedAt.toISOString() : null,
    revokedAt: apiKey.revokedAt ? apiKey.revokedAt.toISOString() : null,
  };
}

export { hashKey };
