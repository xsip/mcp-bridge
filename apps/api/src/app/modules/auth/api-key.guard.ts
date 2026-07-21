import {CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException,} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {Request} from 'express';
import {JwtService} from '@nestjs/jwt';
import {InjectModel} from '@nestjs/mongoose';
import {Model} from 'mongoose';
import {IS_PUBLIC_KEY} from './public.decorator';
import {User, UserDocument} from './user.schema';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes marked with @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();

    // if (request.path.startsWith('/tools')) return true;

    const token = this.extractBearer(request);

    if (!token) {
      throw new UnauthorizedException('Missing token');
    }

    let payload: { user: string; role: string; tenant: string | null };
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    // Pull the full user from DB so the request always reflects current DB state.
    // This also catches deleted / deactivated accounts that still hold a valid JWT.
    const dbUser = await this.userModel
      .findOne({ username: payload.user })
      .select('-passwordHash') // never expose the hash downstream
      .lean()
      .exec();

    if (!dbUser) {
      throw new UnauthorizedException('User no longer exists');
    }

    // Reject users who have not yet activated their account.
    if (!dbUser.isActivated) {
      throw new ForbiddenException(
        'Account not activated. Please check your email for the activation link.',
      );
    }


    (request as Request & { user?: unknown; token?: unknown })['user'] = dbUser;

    // Attach the sanitised DB record — role/tenant always up-to-date.
    (request as Request & { user?: unknown; token?: unknown })['token'] = token;

    return true;
  }

  private extractBearer(req: Request): string | undefined {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return undefined;

    const [scheme, token] = authHeader.split(' ');
    return scheme?.toLowerCase() === 'bearer' ? token : undefined;
  }
}
