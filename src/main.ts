import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config = app.get(ConfigService);
  const port        = config.get<number>('port');
  const frontendUrl = config.get<string>('frontendUrl');

  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // NOTA: Los archivos ya no se sirven desde disco.
  // Imágenes → Cloudinary CDN  |  Documentos → Backblaze B2 (presigned URLs)
  // useStaticAssets eliminado — Render tiene filesystem efímero.

  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`🚀 SEMS API → http://localhost:${port}/api`);
}

bootstrap();
