import {Module} from '@nestjs/common';
import {MongooseModule} from '@nestjs/mongoose';
import {JwtModule} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {AuthController} from './auth.controller';
import {ApiKeyController} from './api-key.controller';
import {ApiKeyService} from './api-key.service';
import {ApiKeyAuthGuard} from './api-key-auth.guard';
import {User, UserSchema} from './user.schema';
import {ApiKey, ApiKeySchema} from './api-key.schema';

/**
 * AuthModule owns the JWT config, the User/ApiKey models, and the auth HTTP endpoints.
 *
 * The three guards (JwtAuthGuard, RolesGuard, TenantAccessGuard) are intentionally
 * NOT declared here — they are registered as APP_GUARD providers directly in
 * AppModule so NestJS resolves them in the root injector, where JwtModule and the
 * User Mongoose model are both visible.  Declaring them here as well would create
 * a second (shadow) instance that the root injector cannot satisfy.
 *
 * ApiKeyAuthGuard is different: it's not a root guard (most routes use the JWT),
 * it's applied directly on ProxyController via `@UseGuards()`. It's still declared
 * and exported here (rather than in ProxyModule) because it needs the same
 * User/ApiKey models this module already owns.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: ApiKey.name, schema: ApiKeySchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1h' },
      }),
    })
  ],
  controllers: [AuthController, ApiKeyController],
  providers: [ApiKeyService, ApiKeyAuthGuard],
  // Export the infra so AppModule's root injector (and ProxyModule) can satisfy guard dependencies.
  exports: [MongooseModule, JwtModule, ApiKeyAuthGuard],
})
export class AuthModule {}
