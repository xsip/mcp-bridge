import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module';
import { McpController } from './mcp.controller';
import { McpLogsController } from './mcp-logs.controller';
import { McpService } from './mcp.service';
import { McpLookupService } from './mcp-lookup.service';
import { McpLogService } from './mcp-log.service';
import { McpMigrationService } from './mcp-migration.service';
import { Mcp, McpSchema } from './schemas/mcp.schema';
import { McpLogRecord, McpLogSchema } from './schemas/mcp-log.schema';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Mcp.name, schema: McpSchema },
      { name: McpLogRecord.name, schema: McpLogSchema },
    ]),
  ],
  controllers: [McpController, McpLogsController],
  providers: [McpService, McpLookupService, McpLogService, McpMigrationService],
  exports: [McpLookupService, McpLogService],
})
export class McpModule {}
