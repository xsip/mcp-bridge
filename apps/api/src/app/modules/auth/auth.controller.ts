import {
  Body,
  ConflictException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import {InjectModel} from '@nestjs/mongoose';
import {Model, Types} from 'mongoose';
import {JwtService} from '@nestjs/jwt';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import {Public} from './public.decorator';
import {Role} from './roles.decorator';
import {LoginDto} from './login.dto';
import {RegisterDto} from './register.dto';
import {RefreshDto} from './refresh.dto';
import {TokenPairDto} from './token-pair.dto';
import {User, UserDocument} from './user.schema';
import {CurrentUser} from './current-user.decorator';
import {MeDto} from './me.dto';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  /** Signs a fresh access JWT and issues+persists a new (rotated) refresh token for the given user. */
  private async issueTokens(user: UserDocument): Promise<TokenPairDto> {
    const accessToken = this.jwtService.sign(
      { user: user.username, role: user.role },
    );

    const refreshToken = crypto.randomBytes(48).toString('hex');
    user.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    user.refreshTokenExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await user.save();

    return { accessToken, refreshToken };
  }

  // ── GET /auth/me ──────────────────────────────────────────────────────────

  @Get('me')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    operationId: 'getMe',
    summary: 'Get the currently authenticated user',
  })
  @ApiOkResponse({
    description: 'Returns public user profile data',
    type: MeDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  async getMe(
    @CurrentUser() user: User & { _id?: Types.ObjectId },
  ): Promise<MeDto> {

    return {
      username: user.username,
      role: user.role,
      subscription: user.subscription,
      isActivated: user.isActivated,
    };
  }

  // ── POST /auth/login ──────────────────────────────────────────────────────

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ operationId: 'login', summary: 'Log in and receive an access + refresh token pair' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Returns an access token and a refresh token', type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Wrong username or password' })
  async login(@Body() dto: LoginDto): Promise<TokenPairDto> {
    const user = await this.userModel
      .findOne({ username: dto.user.toLowerCase() })
      .exec();

    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('CMS_LOGIN_ERROR_WRONG');
    }

    if (!user.isActivated)
      throw new UnauthorizedException('CMS_LOGIN_ERROR_NOT_ACTIVATED');

    return this.issueTokens(user);
  }

  // ── POST /auth/register ───────────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    operationId: 'register',
    summary: 'Register a new user',
    description:
      'Requires a valid `REGISTER_SECRET` env value in the request body to prevent open registration. ' +
      'Returns the generated activation hash (to be sent via email in a real deployment).',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User created — returns the activation hash in dev mode',
  })
  @ApiUnauthorizedResponse({ description: 'Invalid register secret' })
  @ApiConflictResponse({ description: 'Username or email already taken' })
  async register(
    @Body() dto: RegisterDto,
  ): Promise<{ activationHash?: string }> {
    if (dto.registerSecret !== process.env.REGISTER_SECRET) {
      throw new UnauthorizedException('Invalid register secret');
    }

    const existingByUsername = await this.userModel
      .findOne({ username: dto.username.toLowerCase() })
      .exec();

    if (existingByUsername) {
      throw new ConflictException(
        `Username "${dto.username}" is already registered`,
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Generate a random MD5 activation hash
    const activationHash = crypto
      .createHash('md5')
      .update(crypto.randomBytes(32))
      .digest('hex');

    await this.userModel.create({
      username: dto.username.toLowerCase(),
      passwordHash,
      role: Role.User,
      isActivated: false,
      activationHash,
    });

    // Only expose the hash in the response when explicitly enabled (e.g. local dev).
    // In production, email the hash to the user and leave this env var unset.
    return {
      activationHash:
        process.env.RETURN_REGISTER_HASH === 'true'
          ? activationHash
          : undefined,
    };
  }

  // ── GET /auth/activate ────────────────────────────────────────────────────

  @Public()
  @Get('activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'activateAccount',
    summary: 'Activate a user account',
    description:
      'Verifies the activation hash and marks the account as active. ' +
      'Returns an access + refresh token pair so the user is immediately logged in after activation.',
  })
  @ApiQuery({
    name: 'hash',
    required: true,
    description: 'The MD5 activation hash from the registration response',
  })
  @ApiOkResponse({ description: 'Account activated — returns an access + refresh token pair', type: TokenPairDto })
  @ApiNotFoundResponse({
    description: 'Invalid or already-used activation hash',
  })
  async activate(@Query('hash') hash: string): Promise<TokenPairDto> {
    const user = await this.userModel.findOne({ activationHash: hash }).exec();

    if (!user) {
      throw new NotFoundException('Invalid or already-used activation hash');
    }

    user.isActivated = true;
    user.activationHash = null; // consume the hash so it cannot be reused
    await user.save();

    return this.issueTokens(user);
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'refresh',
    summary: 'Exchange a refresh token for a new access + refresh token pair',
    description: 'Refresh tokens are single-use — every call rotates in a new one, invalidating the old one.',
  })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: 'Returns a new access + refresh token pair', type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or already-used refresh token' })
  async refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    const user = await this.userModel
      .findOne({ username: dto.username.toLowerCase() })
      .exec();

    if (!user || !user.refreshTokenHash || !user.refreshTokenExpiresAt || user.refreshTokenExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!(await bcrypt.compare(dto.refreshToken, user.refreshTokenHash))) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!user.isActivated) {
      throw new UnauthorizedException('CMS_LOGIN_ERROR_NOT_ACTIVATED');
    }

    return this.issueTokens(user);
  }
}
