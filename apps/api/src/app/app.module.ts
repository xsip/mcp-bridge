import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/api-key.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { AgentAuthModule } from './modules/agent-auth/agent-auth.module';
import { McpModule } from './modules/mcp/mcp.module';
import { MarketplaceModule } from './modules/marketplace/marketplace.module';
import { HealthModule } from './modules/health/health.module';
import { ProxyModule } from './modules/proxy/proxy.module';
import { AppConfigModule } from '@mcp-bridge/config';
import { LoggingModule } from '@mcp-bridge/logging';
import { GlobalExceptionFilter } from '@mcp-bridge/common';
import { BridgeWebsocketModule } from '@mcp-bridge/websocket';

@Module({
  imports: [
    AppConfigModule,
    LoggingModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGODB_URI', 'mongodb://localhost:27017/mcpBridge'),
      }),
    }),
    AuthModule,
    AgentAuthModule,
    McpModule,
    MarketplaceModule,
    BridgeWebsocketModule,
    ProxyModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Root-level guards: JwtAuthGuard resolves the User model + JwtService from
    // AuthModule's re-exports, RolesGuard reads the @Roles() metadata it sets.
    // Routes opt out with @Public() (see ProxyController, HealthController).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
      }),
    },
  ],
})
export class AppModule {}
