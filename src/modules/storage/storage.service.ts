import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'readable-stream';
import { extname, join } from 'path';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';

/**
 * StorageService — Arquitectura triple con fallback automático
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  MODO 1 — Cloud completo (producción con credenciales)
 *    📷 IMÁGENES  → Cloudinary FREE  (25 GB gratis)
 *    📄 DOCUMENTOS → Backblaze B2 FREE (10 GB gratis, API S3-compatible)
 *
 *  MODO 2 — Disco local / VPS (sin credenciales cloud)
 *    Todo va a la carpeta UPLOAD_DEST (por defecto ./uploads) en el servidor.
 *    El backend sirve los archivos vía /api/local-files/:folder/:filename
 *    → Imágenes: acceso público (logos, fotos agenda)
 *    → Documentos privados: requieren JWT (manuscritos, docs. identidad)
 *
 *  MODO 3 — Mixto (solo Cloudinary o solo B2 configurado)
 *    El servicio usa el proveedor disponible y disco local para el resto.
 *
 *  La selección es automática — sin tocar código, solo env vars.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 *  Variables de entorno (todas opcionales — fallback a disco local si faltan):
 *
 *    CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
 *    B2_KEY_ID, B2_APP_KEY, B2_ENDPOINT, B2_BUCKET
 *    UPLOAD_DEST    = ruta del directorio local (default: ./uploads)
 *    APP_URL        = URL base del servidor (para construir URLs de descarga locales)
 */

export type StorageFolder =
  | 'logos'        // logos de instituciones    → Cloudinary | local/public
  | 'photos'       // fotos de ponentes         → Cloudinary | local/public
  | 'submissions'  // manuscritos Word          → B2         | local/private
  | 'guidelines'   // pautas del evento (PDF)   → B2         | local/public
  | 'identity-docs'; // documentos de identidad → B2         | local/private

/** Carpetas con acceso público (no requieren JWT para servir) */
const PUBLIC_FOLDERS = new Set<StorageFolder>(['logos', 'photos', 'guidelines']);

/** Extensiones que son imágenes → van a Cloudinary */
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg']);

/** Prefijo interno para referencias a disco local */
const LOCAL_PREFIX = 'local://';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  // ── Cloudinary ──────────────────────────────────────────────────────────────
  private readonly cloudinaryOk: boolean;

  // ── Backblaze B2 ────────────────────────────────────────────────────────────
  private readonly b2: S3Client | null = null;
  private readonly b2Bucket: string;

  // ── Disco local ─────────────────────────────────────────────────────────────
  private readonly uploadDir: string;  // ruta absoluta en disco
  private readonly appUrl: string;     // URL base para construir links de descarga

  constructor(private readonly cfg: ConfigService) {

    // ── Cloudinary ───────────────────────────────────────────────────────────
    const cloudName = this.cfg.get<string>('cloudinary.cloudName');
    const apiKey    = this.cfg.get<string>('cloudinary.apiKey');
    const apiSecret = this.cfg.get<string>('cloudinary.apiSecret');
    this.cloudinaryOk = !!(cloudName && apiKey && apiSecret);

    if (this.cloudinaryOk) {
      cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret });
      this.logger.log('☁️  Cloudinary OK → logos/fotos');
    } else {
      this.logger.warn('⚠️  Cloudinary no configurado → imágenes irán a disco local');
    }

    // ── Backblaze B2 ─────────────────────────────────────────────────────────
    const b2KeyId    = this.cfg.get<string>('b2.keyId');
    const b2AppKey   = this.cfg.get<string>('b2.appKey');
    const b2Endpoint = this.cfg.get<string>('b2.endpoint');
    this.b2Bucket    = this.cfg.get<string>('b2.bucket') || 'sems-docs';

    if (b2KeyId && b2AppKey && b2Endpoint) {
      this.b2 = new S3Client({
        endpoint:    `https://${b2Endpoint}`,
        region:      'us-east-005',
        credentials: { accessKeyId: b2KeyId, secretAccessKey: b2AppKey },
        forcePathStyle: true,
      });
      this.logger.log(`🗄️  Backblaze B2 OK → documentos | bucket: ${this.b2Bucket}`);
    } else {
      this.logger.warn('⚠️  Backblaze B2 no configurado → documentos irán a disco local');
    }

    // ── Disco local ──────────────────────────────────────────────────────────
    const rawDest  = this.cfg.get<string>('upload.dest') || './uploads';
    // Resolvemos relativo al CWD (donde se ejecuta el proceso Node)
    this.uploadDir = rawDest.startsWith('/') ? rawDest : join(process.cwd(), rawDest);
    this.appUrl    = (this.cfg.get<string>('appUrl') || 'http://localhost:3000').replace(/\/+$/, '');

    // Crear subcarpetas si no existen
    const folders: StorageFolder[] = ['logos', 'photos', 'submissions', 'guidelines', 'identity-docs'];
    for (const f of folders) {
      const dir = join(this.uploadDir, f);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.logger.log(`📁 Carpeta creada: ${dir}`);
      }
    }

    const mode = this.cloudinaryOk && this.b2
      ? '🟢 Cloud completo (Cloudinary + B2)'
      : this.cloudinaryOk
        ? '🟡 Mixto (Cloudinary + disco local para docs)'
        : this.b2
          ? '🟡 Mixto (B2 + disco local para imágenes)'
          : `🟠 Disco local completo → ${this.uploadDir}`;

    this.logger.log(`StorageService listo | Modo: ${mode}`);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // MÉTODO PRINCIPAL — enruta según disponibilidad de credenciales
  // ════════════════════════════════════════════════════════════════════════════

  async upload(
    file: Express.Multer.File,
    folder: StorageFolder,
    nameHint?: string,
  ): Promise<string> {
    const ext     = extname(file.originalname).toLowerCase();
    const isImage = IMAGE_EXT.has(ext);

    // Imágenes → Cloudinary o disco local
    if (isImage && (folder === 'logos' || folder === 'photos')) {
      if (this.cloudinaryOk) return this.toCloudinary(file, folder, nameHint);
      return this.toLocalDisk(file, folder, nameHint);
    }

    // Documentos → B2 o disco local
    if (this.b2) return this.toB2(file, folder, nameHint);
    return this.toLocalDisk(file, folder, nameHint);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // CLOUDINARY
  // ════════════════════════════════════════════════════════════════════════════

  private toCloudinary(
    file: Express.Multer.File,
    folder: StorageFolder,
    publicId?: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const up = cloudinary.uploader.upload_stream(
        {
          folder:        `sems/${folder}`,
          public_id:     publicId,
          overwrite:     true,
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
    } catch {
      this.logger.warn(`No se pudo borrar de Cloudinary: ${url}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // BACKBLAZE B2
  // ════════════════════════════════════════════════════════════════════════════

  private async toB2(
    file: Express.Multer.File,
    folder: StorageFolder,
    nameHint?: string,
  ): Promise<string> {
    const ext = extname(file.originalname);
    const key = nameHint
      ? `${folder}/${nameHint}${ext}`
      : `${folder}/${uuidv4()}${ext}`;

    await this.b2.send(new PutObjectCommand({
      Bucket:      this.b2Bucket,
      Key:         key,
      Body:        file.buffer,
      ContentType: file.mimetype,
    }));

    const ref = `b2://${this.b2Bucket}/${key}`;
    this.logger.log(`✅ B2 → ${ref}`);
    return ref;
  }

  async deleteFromB2(ref: string): Promise<void> {
    if (!ref?.startsWith('b2://') || !this.b2) return;
    try {
      const withoutScheme = ref.replace('b2://', '');
      const slash  = withoutScheme.indexOf('/');
      const bucket = withoutScheme.slice(0, slash);
      const key    = withoutScheme.slice(slash + 1);
      await this.b2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      this.logger.log(`🗑️  B2 eliminado: ${key}`);
    } catch {
      this.logger.warn(`No se pudo borrar de B2: ${ref}`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // DISCO LOCAL — fallback completo cuando no hay credenciales cloud
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Escribe el archivo en `UPLOAD_DEST/<folder>/<filename>` y devuelve
   * una referencia interna con el prefijo `local://`.
   *
   * La referencia se traduce a URL real en `getSignedUrl()`:
   *   - Carpetas públicas  → URL directa servida por NestJS static assets
   *   - Carpetas privadas  → URL con token temporal via `/api/local-files/...`
   */
  private toLocalDisk(
    file: Express.Multer.File,
    folder: StorageFolder,
    nameHint?: string,
  ): string {
    const ext      = extname(file.originalname);
    const filename = nameHint
      ? `${nameHint}${ext}`
      : `${uuidv4()}${ext}`;

    const destDir = join(this.uploadDir, folder);
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });

    const destPath = join(destDir, filename);
    writeFileSync(destPath, file.buffer);

    const ref = `${LOCAL_PREFIX}${folder}/${filename}`;
    this.logger.log(`✅ Disco local → ${destPath}`);
    return ref;
  }

  /**
   * Elimina un archivo guardado en disco local.
   */
  private deleteFromLocalDisk(ref: string): void {
    const relativePath = ref.replace(LOCAL_PREFIX, '');
    const fullPath     = join(this.uploadDir, relativePath);
    try {
      if (existsSync(fullPath)) {
        unlinkSync(fullPath);
        this.logger.log(`🗑️  Local eliminado: ${fullPath}`);
      }
    } catch {
      this.logger.warn(`No se pudo eliminar archivo local: ${fullPath}`);
    }
  }

  /**
   * Resuelve la ruta absoluta en disco para una referencia local.
   * Usado por el endpoint de descarga de archivos privados.
   */
  resolveLocalPath(ref: string): string {
    if (!ref.startsWith(LOCAL_PREFIX))
      throw new BadRequestException('No es una referencia local');
    const relativePath = ref.replace(LOCAL_PREFIX, '');
    return join(this.uploadDir, relativePath);
  }

  private normalizeUrl(url: string): string {
    // Corregir dobles slashes
    url = url.replace(/\/+/g, '/');
    
    // Corregir dominios sin punto (xyzlocal -> xyz.local)
    url = url.replace(/(\w+)local/g, '$1.local');
    
    // Asegurar que no haya protocolos duplicados
    url = url.replace(/(https?:\/\/)+/g, '$1');
    
    return url;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // getSignedUrl — punto único de resolución de URLs
  // ════════════════════════════════════════════════════════════════════════════

  /**
   * Resuelve cualquier tipo de referencia a una URL descargable:
   *
   *  - https://... (Cloudinary, CDN público) → devuelve tal cual
   *  - b2://bucket/key                        → presigned URL de B2 (1h)
   *  - local://folder/filename               → URL del servidor local
   *       · carpeta pública  → /api/local-files/public/<folder>/<file>
   *       · carpeta privada  → /api/local-files/private/<folder>/<file>
   *         (el endpoint privado requiere JWT — valida en el controller)
   */
  async getSignedUrl(ref: string, _expiresIn = 3600): Promise<string> {
    if (!ref) return ref;

    // Logging para diagnóstico
    this.logger.log(`🔗 Resolviendo URL para referencia: ${ref}`);
    this.logger.log(`🌐 APP_URL configurada: ${this.appUrl}`);

    // ── Cloudinary / cualquier URL https pública ─────────────────────────────
    if (ref.startsWith('http://') || ref.startsWith('https://')) {
      this.logger.log(`✅ URL pública detectada: ${ref}`);
      return ref;
    }

    // ── Backblaze B2 ─────────────────────────────────────────────────────────
    if (ref.startsWith('b2://')) {
      if (!this.b2) throw new BadRequestException('Backblaze B2 no configurado');
      const withoutScheme = ref.replace('b2://', '');
      const slash  = withoutScheme.indexOf('/');
      const bucket = withoutScheme.slice(0, slash);
      const key    = withoutScheme.slice(slash + 1);
      const cmd    = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(this.b2, cmd, { expiresIn: _expiresIn });
    }

    // ── Disco local ──────────────────────────────────────────────────────────
    if (ref.startsWith(LOCAL_PREFIX)) {
      const relativePath = ref.replace(LOCAL_PREFIX, '');          // "photos/author-xxx.jpg"
      const folder       = relativePath.split('/')[0] as StorageFolder;
      const isPublic     = PUBLIC_FOLDERS.has(folder);
      const visibility   = isPublic ? 'public' : 'private';
      
      // Construir URL segura sin dobles slashes y con normalización
      const baseUrl = this.normalizeUrl(this.appUrl);
      const urlPath = `/api/local-files/${visibility}/${relativePath}`.replace(/\/+/g, '/');
      const finalUrl = `${baseUrl}${urlPath}`;
      
      this.logger.log(`📁 URL local generada: ${finalUrl}`);
      this.logger.log(`📂 Base URL normalizada: ${baseUrl}`);
      this.logger.log(`📂 Visibility: ${visibility}, Path: ${relativePath}`);
      
      return finalUrl;
    }

    // ── Referencia legada /uploads/... (sin prefijo local://) ────────────────
    if (ref.startsWith('/uploads/')) {
      const baseUrl = this.normalizeUrl(this.appUrl);
      const cleanRef = ref.replace(/\/+/g, '/');
      return `${baseUrl}${cleanRef}`;
    }

    return ref;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // delete — punto único de eliminación
  // ════════════════════════════════════════════════════════════════════════════

  async delete(ref: string): Promise<void> {
    if (!ref) return;
    if (ref.includes('cloudinary.com'))   return this.deleteFromCloudinary(ref);
    if (ref.startsWith('b2://'))          return this.deleteFromB2(ref);
    if (ref.startsWith(LOCAL_PREFIX))     return this.deleteFromLocalDisk(ref);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Utilidades públicas
  // ════════════════════════════════════════════════════════════════════════════

  /** Directorio raíz de uploads en disco (para servirlo como static assets) */
  get localUploadDir(): string { return this.uploadDir; }

  get isCloudinaryReady(): boolean { return this.cloudinaryOk; }
  get isB2Ready(): boolean         { return this.b2 !== null; }
  get isLocalMode(): boolean       { return !this.cloudinaryOk && !this.b2; }

  isLocalRef(ref: string): boolean {
    return ref?.startsWith(LOCAL_PREFIX) || ref?.startsWith('/uploads/');
  }

  isPrivateFolder(folder: string): boolean {
    return !PUBLIC_FOLDERS.has(folder as StorageFolder);
  }
}
