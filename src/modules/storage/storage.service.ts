import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * StorageService — Arquitectura dual 100% GRATUITA
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  📷 IMÁGENES  (logos, fotos ponentes)
 *     → Cloudinary FREE  |  25 GB gratis permanentes
 *       Optimización automática + CDN global
 *
 *  📄 DOCUMENTOS  (manuscritos Word/PDF, pautas)
 *     → Backblaze B2 FREE  |  10 GB gratis permanentes
 *       API S3-compatible, sin tarjeta de crédito
 *       Para 1.500 manuscritos × 4MB = ~6 GB  →  entra en free tier
 *
 *  🔄 FALLBACK  (sin credenciales configuradas)
 *     → Disco local de Render  (temporal, solo para desarrollo)
 */

export type StorageFolder =
  | 'logos'        // logos de instituciones    → Cloudinary
  | 'photos'       // fotos de ponentes         → Cloudinary
  | 'submissions'  // manuscritos Word/PDF       → Backblaze B2
  | 'guidelines';  // pautas del evento (PDF)   → Backblaze B2

/** Extensiones que son imágenes → van a Cloudinary */
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  // ── Cloudinary ──────────────────────────────────────────────────────────────
  private readonly cloudinaryOk: boolean;

  // ── Backblaze B2 (API S3-compatible) ────────────────────────────────────────
  private readonly b2: S3Client | null = null;
  private readonly b2Bucket: string;
  private readonly b2PublicUrl: string; // URL pública del bucket (CDN Cloudflare si activado)

  constructor(private readonly cfg: ConfigService) {

    // ── Cloudinary setup ─────────────────────────────────────────────────────
    const cloudName = this.cfg.get<string>('cloudinary.cloudName');
    const apiKey    = this.cfg.get<string>('cloudinary.apiKey');
    const apiSecret = this.cfg.get<string>('cloudinary.apiSecret');
    this.cloudinaryOk = !!(cloudName && apiKey && apiSecret);

    if (this.cloudinaryOk) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      this.logger.log('☁️  Cloudinary OK → logos/fotos (25 GB free)');
    } else {
      this.logger.warn('⚠️  Cloudinary sin configurar → fallback disco local');
    }

    // ── Backblaze B2 setup ───────────────────────────────────────────────────
    // Credenciales: https://secure.backblaze.com/app_keys.htm
    // Endpoint:     Settings → Buckets → Endpoint (ej: s3.us-west-004.backblazeb2.com)
    const b2KeyId     = this.cfg.get<string>('b2.keyId');
    const b2AppKey    = this.cfg.get<string>('b2.appKey');
    const b2Endpoint  = this.cfg.get<string>('b2.endpoint');  // sin https://
    this.b2Bucket     = this.cfg.get<string>('b2.bucket') || 'sems-docs';
    this.b2PublicUrl  = this.cfg.get<string>('b2.publicUrl') || '';

    if (b2KeyId && b2AppKey && b2Endpoint) {
      this.b2 = new S3Client({
        endpoint: `https://${b2Endpoint}`,
        region: 'us-east-005',  // B2 usa esta región genérica para la API S3
        credentials: { accessKeyId: b2KeyId, secretAccessKey: b2AppKey },
        forcePathStyle: true,   // necesario para B2
      });
      this.logger.log(`🗄️  Backblaze B2 OK → manuscritos/documentos (10 GB free) | bucket: ${this.b2Bucket}`);
    } else {
      this.logger.warn('⚠️  Backblaze B2 sin configurar → fallback disco local para documentos');
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL — enruta automáticamente según tipo de archivo
  // ════════════════════════════════════════════════════════════════════════════

  async upload(
    file: Express.Multer.File,
    folder: StorageFolder,
    nameHint?: string,
  ): Promise<string> {
    const ext     = extname(file.originalname).toLowerCase();
    const isImage = IMAGE_EXT.has(ext);

    if (isImage && (folder === 'logos' || folder === 'photos')) {
      return this.toCloudinary(file, folder, nameHint);
    }
    return this.toB2(file, folder, nameHint);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLOUDINARY — imágenes
  // ════════════════════════════════════════════════════════════════════════════

  private toCloudinary(
    file: Express.Multer.File,
    folder: StorageFolder,
    publicId?: string,
  ): Promise<string> {
    if (!this.cloudinaryOk) {
      this.logger.warn('Cloudinary no disponible — guardando en disco local');
      return Promise.resolve(`/uploads/${folder}/${publicId || uuidv4()}`);
    }

    return new Promise((resolve, reject) => {
      const up = cloudinary.uploader.upload_stream(
        {
          folder: `sems/${folder}`,
          public_id: publicId,
          overwrite: true,
          resource_type: 'image',
          transformation: [
            { quality: 'auto:good', fetch_format: 'auto' },
            { width: 1200, height: 1200, crop: 'limit' },
          ],
        },
        (err, result: UploadApiResponse) => {
          if (err) return reject(new BadRequestException(`Cloudinary: ${err.message}`));
          this.logger.log(`✅ Cloudinary → ${result.secure_url}`);
          resolve(result.secure_url);
        },
      );
      const r = new Readable();
      r.push(file.buffer);
      r.push(null);
      r.pipe(up);
    });
  }

  async deleteFromCloudinary(url: string): Promise<void> {
    if (!this.cloudinaryOk || !url?.includes('cloudinary.com')) return;
    try {
      const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
      if (m?.[1]) await cloudinary.uploader.destroy(m[1]);
    } catch (e) {
      this.logger.warn(`No se pudo borrar de Cloudinary: ${url}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BACKBLAZE B2 — documentos Word/PDF
  // ════════════════════════════════════════════════════════════════════════════

  private async toB2(
    file: Express.Multer.File,
    folder: StorageFolder,
    nameHint?: string,
  ): Promise<string> {
    if (!this.b2) {
      // Fallback a disco — solo útil en desarrollo local
      this.logger.warn('B2 no disponible — guardando en disco local');
      return `/uploads/${folder}/${nameHint || uuidv4()}${extname(file.originalname)}`;
    }

    const ext  = extname(file.originalname);
    const key  = nameHint ? `${folder}/${nameHint}${ext}` : `${folder}/${uuidv4()}${ext}`;

    await this.b2.send(new PutObjectCommand({
      Bucket:      this.b2Bucket,
      Key:         key,
      Body:        file.buffer,
      ContentType: file.mimetype,
    }));

    // Guardamos la referencia interna — el backend genera la URL firmada al descargar
    const ref = `b2://${this.b2Bucket}/${key}`;
    this.logger.log(`✅ Backblaze B2 → ${ref}`);
    return ref;
  }

  /**
   * Genera una URL de descarga firmada válida por `expiresIn` segundos.
   * - Si es URL de Cloudinary: devuelve tal cual (ya es pública y permanente)
   * - Si es referencia B2 (b2://...): genera presigned URL temporal
   * - Si es URL local: devuelve tal cual
   */
  async getSignedUrl(ref: string, expiresIn = 3600): Promise<string> {
    if (!ref) return ref;

    // URL de Cloudinary o URL local directa
    if (!ref.startsWith('b2://')) return ref;

    if (!this.b2) throw new BadRequestException('Backblaze B2 no configurado');

    // Parsear b2://<bucket>/<key>
    const withoutScheme = ref.replace('b2://', '');
    const slash         = withoutScheme.indexOf('/');
    const bucket        = withoutScheme.slice(0, slash);
    const key           = withoutScheme.slice(slash + 1);

    const cmd = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(this.b2, cmd, { expiresIn });
    return url;
  }

  async deleteFromB2(ref: string): Promise<void> {
    if (!ref?.startsWith('b2://') || !this.b2) return;
    try {
      const withoutScheme = ref.replace('b2://', '');
      const slash         = withoutScheme.indexOf('/');
      const bucket        = withoutScheme.slice(0, slash);
      const key           = withoutScheme.slice(slash + 1);
      await this.b2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      this.logger.log(`🗑️  B2 eliminado: ${key}`);
    } catch (e) {
      this.logger.warn(`No se pudo borrar de B2: ${ref}`);
    }
  }

  /** Elimina de cualquier backend detectando automáticamente el formato de la URL */
  async delete(ref: string): Promise<void> {
    if (ref?.includes('cloudinary.com')) return this.deleteFromCloudinary(ref);
    if (ref?.startsWith('b2://'))         return this.deleteFromB2(ref);
  }

  get isCloudinaryReady(): boolean { return this.cloudinaryOk; }
  get isB2Ready(): boolean         { return this.b2 !== null; }
}
