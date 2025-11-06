/* eslint-disable */

import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import helmet from 'helmet';
import { VersioningType } from '@nestjs/common/enums/version-type.enum';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { HttpExceptionFilter } from './common/interceptors/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { join } from 'path';
import * as bodyParser from 'body-parser';
import { DocumentBuilder } from '@nestjs/swagger/dist/document-builder';
import { SwaggerModule } from '@nestjs/swagger/dist/swagger-module';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env file manually before NestJS starts
// This ensures .env is loaded even if ConfigModule has issues
const envPath = resolve(__dirname, '..', '.env');
const envLoaded = dotenv.config({ path: envPath });
console.log('📄 Loading .env from:', envPath);
if (envLoaded.error) {
  console.warn('⚠️  Warning: Could not load .env file:', envLoaded.error.message);
} else {
  console.log('✅ .env file loaded successfully');
}

// Debug: Check PayOS env vars (without showing full values)
console.log('🔍 PayOS env check (main.ts):');
console.log('  - PAYOS_CLIENT_ID:', process.env.PAYOS_CLIENT_ID ? `✅ Set (${process.env.PAYOS_CLIENT_ID.length} chars)` : '❌ Missing');
console.log('  - PAYOS_API_KEY:', process.env.PAYOS_API_KEY ? `✅ Set (${process.env.PAYOS_API_KEY.length} chars)` : '❌ Missing');
console.log('  - PAYOS_CHECKSUM_KEY:', process.env.PAYOS_CHECKSUM_KEY ? `✅ Set (${process.env.PAYOS_CHECKSUM_KEY.length} chars)` : '❌ Missing');

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const reflector = app.get(Reflector);
  app.use(cookieParser());
  app.useGlobalGuards(new JwtAuthGuard(reflector));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    prefix: '/public', // đổi prefix cho rõ ràng
  });

  const configService = app.get(ConfigService);
  const port = configService.get<string>('PORT');
  app.enableCors({
    allowedHeaders: ['content-type', 'authorization'],
    origin: configService.get<string>('FE_URL') || 'http://localhost:3000',
    credentials: true,
  });
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  app.use(helmet());
  app.enableVersioning({
    defaultVersion: '1',
    prefix: 'api/v',
    type: VersioningType.URI
  });
  const config = new DocumentBuilder()
    .setTitle('File Upload & Management API')
    .setDescription('Complete file upload system with MongoDB integration')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));

  const server = await app.listen(port || 8080);
  // Increase timeout for analytics endpoints (5 minutes)
  server.setTimeout(300000);
}
bootstrap();


