import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as bodyParser from 'body-parser';
import * as fs from 'node:fs';
import path from 'node:path';
import { AppModule } from './app/app.module';
import { AppConfigService } from '@mcp-loop/config';
import { AppLogger } from '@mcp-loop/logging';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  const logger = await app.resolve(AppLogger);
  logger.setContext('Bootstrap');
  app.useLogger(logger);
  app.useWebSocketAdapter(new WsAdapter(app));

  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  app.enableCors({
    origin: ['http://localhost:4200', 'http://localhost:4300', 'http://192.168.0.39:4200'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  if (process.env.USE_SWAGGER) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('MCP Loop API')
      .setDescription('Relay backend exposing desktop-agent MCP servers over HTTP')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api', app, document);

    const outputPath = path.resolve(process.cwd(), 'openapi.json');
    fs.writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8');
    logger.log(`OpenAPI JSON written to ${outputPath}`);
  }

  const config = app.get(AppConfigService);
  await app.listen(config.port);
  logger.log(`MCP Loop listening on port ${config.port}`);
}

bootstrap();
