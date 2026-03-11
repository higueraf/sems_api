import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const config      = app.get(ConfigService);
  const port        = config.get<number>('port');
  const frontendUrl = config.get<string>('frontendUrl');

  // Procesar frontendUrl como un arreglo separado por comas
  const allowedOrigins = frontendUrl 
    ? frontendUrl.split(',').map(url => url.trim())
    : ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'];

  app.enableCors({
    origin: allowedOrigins,
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

  // ── Archivos estáticos en modo disco local ─────────────────────────────────
  // Solo se activa cuando NO hay credenciales cloud configuradas
  // (sin Cloudinary NI Backblaze B2).
  // En producción con cloud completo este bloque queda inactivo.
  //
  // Expone /uploads/* como static assets para compatibilidad con referencias
  // antiguas del tipo /uploads/photos/xxx.jpg que puedan existir en BD.
  //
  const hasCloudinary = !!(
    config.get('cloudinary.cloudName') &&
    config.get('cloudinary.apiKey')    &&
    config.get('cloudinary.apiSecret')
  );
  const hasB2 = !!(
    config.get('b2.keyId')    &&
    config.get('b2.appKey')   &&
    config.get('b2.endpoint')
  );

  if (!hasCloudinary || !hasB2) {
    const rawDest   = config.get<string>('upload.dest') || './uploads';
    const uploadDir = rawDest.startsWith('/')
      ? rawDest
      : join(process.cwd(), rawDest);

    if (!existsSync(uploadDir)) mkdirSync(uploadDir, { recursive: true });

    // Servir archivos desde /uploads/* (compatibilidad con referencias legacy)
    app.useStaticAssets(uploadDir, { prefix: '/uploads' });

    console.log(`📁 Modo disco local activo → ${uploadDir} servido en /uploads`);
  }

  app.setGlobalPrefix('api');

  await app.listen(port);
  console.log(`🚀 SEMS API → http://localhost:${port}/api`);
  console.log(`   Cloud: Cloudinary=${hasCloudinary ? '✅' : '❌'}  B2=${hasB2 ? '✅' : '❌'}`);
}

bootstrap();
