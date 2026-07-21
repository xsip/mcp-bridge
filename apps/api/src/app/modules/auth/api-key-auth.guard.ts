import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { createHash } from 'crypto';
import { Request } from 'express';
import { ApiKey, ApiKeyDocument } from './api-key.schema';
import { User, UserDocument } from './user.schema';

/**
 * Validates the API key sent in the `Authorization` header (either the raw
 * key, or `Bearer <key>`) against the stored SHA-256 hash. Used on
 * `ProxyController` in place of `JwtAuthGuard` — `/mcp/:mcpId` is called by
 * external tools (ChatGPT, curl, etc.), not the desktop app's own session,
 * so it authenticates with a long-lived key rather than a short-lived JWT.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    @InjectModel(ApiKey.name) private readonly apiKeyModel: Model<ApiKeyDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const rawKey = this.extractKey(request);

    if (!rawKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const apiKey = await this.apiKeyModel.findOne({ keyHash }).exec();

    if (!apiKey || apiKey.revokedAt) {
      throw new UnauthorizedException('Invalid or revoked API key');
    }

    const user = await this.userModel
      .findOne({ username: apiKey.ownerId })
      .select('-passwordHash')
      .lean()
      .exec();

    if (!user) {
      throw new UnauthorizedException('API key owner no longer exists');
    }

    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    (request as Request & { user?: unknown; apiKeyId?: string })['user'] = user;
    (request as Request & { user?: unknown; apiKeyId?: string })['apiKeyId'] = apiKey.id;

    return true;
  }

  private extractKey(req: Request): string | undefined {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return undefined;

    const [scheme, value] = authHeader.split(' ');
    if (value && scheme?.toLowerCase() === 'bearer') return value;
    return authHeader;
  }
}
