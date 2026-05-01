import {
  Controller, Get, Param, Res, UseGuards, NotFoundException, Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { join, extname } from 'path';
import { existsSync, createReadStream } from 'fs';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Public } from '../../common/decorators/public.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

/**
 * LocalFilesController
 * ─────────────────────────────────────────────────────────────────────────────
 * Sirve archivos almacenados en disco local cuando no hay credenciales cloud.
 *
 *  GET /api/local-files/public/:folder/:filename
 *    → Acceso libre — logos, fotos de ponentes, pautas
 *
 *  GET /api/local-files/private/:folder/:filename
 *    → Requiere JWT (rol admin o evaluator) — manuscritos, docs de identidad
 *
 * En producción con Cloudinary + B2 estos endpoints prácticamente nunca
 * se invocan; las URLs resuelven directo a los CDN.
 */

/** Mapa de extensiones a MIME type — sin dependencia externa */
const MIME_MAP: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.pdf':  'application/pdf',
  '.doc':  'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls':  'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt':  'text/plain',
  '.zip':  'application/zip',
};

function getMimeType(filename: string): string {
  const ext = extname(filename).toLowerCase();
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

@Controller('local-files')
export class LocalFilesController {
  private readonly logger = new Logger(LocalFilesController.name);

  constructor(private readonly storage: StorageService) {}

  // ── Archivos públicos (sin autenticación) ──────────────────────────────────
  @Public()
  @Get('public/:folder/:filename')
  servePublic(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveFile(folder, filename, res);
  }

  // ── Archivos privados (requiere JWT — admin o evaluator) ───────────────────
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.EVALUATOR)
  @Get('private/:folder/:filename')
  servePrivate(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.serveFile(folder, filename, res);
  }

  // ── Método interno ─────────────────────────────────────────────────────────
  private serveFile(folder: string, filename: string, res: Response) {
    // Sanitizar — prevenir path traversal
    const safeFolder   = folder.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeFilename = filename.replace(/[^a-zA-Z0-9._áéíóúÁÉÍÓÚñÑ-]/g, '');

    const fullPath = join(this.storage.localUploadDir, safeFolder, safeFilename);
    
    // Logging para diagnóstico
    this.logger.log(`🔍 Buscando archivo: ${fullPath}`);
    this.logger.log(`📂 UploadDir: ${this.storage.localUploadDir}`);
    this.logger.log(`📁 Folder: ${safeFolder}, File: ${safeFilename}`);
    this.logger.log(`🔍 Existe: ${existsSync(fullPath)}`);

    if (!existsSync(fullPath)) {
      this.logger.warn(`Archivo no encontrado: ${fullPath}`);
      throw new NotFoundException('Archivo no encontrado');
    }

    const mimeType = getMimeType(safeFilename);
    res.setHeader('Content-Type', mimeType);

    // Caché largo para imágenes públicas; sin caché para documentos privados
    if (mimeType.startsWith('image/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    (createReadStream(fullPath) as any).pipe(res);
  }
}
