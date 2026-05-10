import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { SubmissionFile, SubmissionFileType } from '../../entities/submission-file.entity';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';
import { User } from '../../entities/user.entity';
import {
  CreateSubmissionDto, UpdateSubmissionStatusDto,
  SendCustomEmailDto, AssignEvaluatorDto, BulkEmailDto,
} from './dto/submission.dto';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';

const STATUS_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  [SubmissionStatus.RECEIVED]:           [SubmissionStatus.UNDER_REVIEW, SubmissionStatus.WITHDRAWN],
  [SubmissionStatus.UNDER_REVIEW]:       [SubmissionStatus.APPROVED, SubmissionStatus.REJECTED, SubmissionStatus.REVISION_REQUESTED, SubmissionStatus.WITHDRAWN],
  [SubmissionStatus.REVISION_REQUESTED]: [SubmissionStatus.UNDER_REVIEW, SubmissionStatus.REJECTED, SubmissionStatus.WITHDRAWN],
  [SubmissionStatus.APPROVED]:           [SubmissionStatus.SCHEDULED, SubmissionStatus.REJECTED],
  [SubmissionStatus.REJECTED]:           [SubmissionStatus.UNDER_REVIEW],
  [SubmissionStatus.WITHDRAWN]:          [],
  [SubmissionStatus.SCHEDULED]:          [SubmissionStatus.APPROVED],
};

const ALLOWED_WORD_MIME = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_PPT_MIME = [
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
];
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PDF_MIME   = ['application/pdf'];
const MAX_PRODUCT_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/** Devuelve los MIME types permitidos según el campo allowedFileFormats del tipo de producto. */
function getAllowedMimesForFormats(formats?: string): string[] {
  if (!formats) return ALLOWED_WORD_MIME;
  const fmts = formats.split(',').map(f => f.trim().toLowerCase());
  const mimes: string[] = [];
  if (fmts.includes('docx') || fmts.includes('doc'))  mimes.push(...ALLOWED_WORD_MIME);
  if (fmts.includes('pptx') || fmts.includes('ppt'))  mimes.push(...ALLOWED_PPT_MIME);
  if (fmts.includes('pdf'))                            mimes.push(...ALLOWED_PDF_MIME);
  return mimes.length ? mimes : ALLOWED_WORD_MIME;
}

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission)               private repo: Repository<Submission>,
    @InjectRepository(SubmissionAuthor)         private authorRepo: Repository<SubmissionAuthor>,
    @InjectRepository(SubmissionStatusHistory)  private historyRepo: Repository<SubmissionStatusHistory>,
    @InjectRepository(SubmissionFile)           private fileRepo: Repository<SubmissionFile>,
    @InjectRepository(ScientificProductType)    private productTypeRepo: Repository<ScientificProductType>,
    private mailService: MailService,
  ) {}

  private generateReferenceCode(): string {
    const year   = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SEMS-${year}-${random}`;
  }

  // ── Crear postulación ───────────────────────────────────────────────────────

  async create(
    dto: CreateSubmissionDto,
    file?: Express.Multer.File,
    storage?: StorageService,
    authorPhotos: Express.Multer.File[] = [],
    authorIdDocs: Express.Multer.File[] = [],
    /** Archivos por tipo de producto: clave = productTypeId, valor = archivo */
    productFiles: Express.Multer.File[] = [],
  ) {
    // Validar archivos por tipo de producto
    if (productFiles.length > 0) {
      const productTypeIds = productFiles
        .map(f => f.fieldname.replace('productFile_', ''))
        .filter(Boolean);
      const productTypes = productTypeIds.length
        ? await this.productTypeRepo.findBy({ id: In(productTypeIds) })
        : [];

      for (const pf of productFiles) {
        const ptId = pf.fieldname.replace('productFile_', '');
        const pt   = productTypes.find(p => p.id === ptId);
        const allowed = getAllowedMimesForFormats(pt?.allowedFileFormats);
        if (pf.size > MAX_PRODUCT_FILE_SIZE)
          throw new BadRequestException(`El archivo "${pf.originalname}" supera 20 MB`);

        let isValid = allowed.includes(pf.mimetype);
        // Fallback para Postman/herramientas genéricas que envían application/octet-stream
        if (!isValid && pf.mimetype === 'application/octet-stream') {
          const ext = pf.originalname.split('.').pop()?.toLowerCase() || '';
          const fmts = (pt?.allowedFileFormats || 'docx').split(',').map(f => f.trim().toLowerCase());
          if (fmts.includes(ext) || (ext === 'ppt' && fmts.includes('pptx')) || (ext === 'doc' && fmts.includes('docx'))) {
            isValid = true;
          }
        }

        if (!isValid) {
          const fmts = pt?.allowedFileFormats || 'docx';
          throw new BadRequestException(
            `El archivo "${pf.originalname}" no es un formato válido para "${pt?.name ?? ptId}". Formatos permitidos: ${fmts}`,
          );
        }
      }
    }

    // Compatibilidad: validar manuscrito legacy — solo Word
    if (file) {
      if (file.size > 15 * 1024 * 1024)
        throw new BadRequestException('El manuscrito no debe superar 15 MB');
      if (!ALLOWED_WORD_MIME.includes(file.mimetype))
        throw new BadRequestException('El manuscrito debe ser un documento Word (.doc o .docx). No se aceptan PDF ni otros formatos.');
    }

    // Validar fotos de autores
    for (const photo of authorPhotos) {
      if (photo.size > 5 * 1024 * 1024)
        throw new BadRequestException(`La foto "${photo.originalname}" supera 5 MB`);
      if (!ALLOWED_IMAGE_MIME.includes(photo.mimetype))
        throw new BadRequestException('Las fotos deben ser JPG, PNG o WebP');
    }

    // Validar documentos de identidad (PDF)
    for (const doc of authorIdDocs) {
      if (doc.size > 5 * 1024 * 1024)
        throw new BadRequestException(`El documento "${doc.originalname}" supera 5 MB`);
      if (!ALLOWED_PDF_MIME.includes(doc.mimetype))
        throw new BadRequestException('El documento de identidad debe ser PDF');
    }

    // Código único
    let referenceCode: string;
    let isUnique = false;
    while (!isUnique) {
      referenceCode = this.generateReferenceCode();
      const existing = await this.repo.findOne({ where: { referenceCode } });
      if (!existing) isUnique = true;
    }

    // productTypeIds: usar los del DTO o construir desde productTypeId
    const allProductTypeIds = dto.productTypeIds?.length
      ? dto.productTypeIds
      : [dto.productTypeId];

    // Archivo principal (legacy): primer archivo por tipo de producto o el 'file' legacy
    const primaryProductFile = productFiles.find(
      f => f.fieldname === `productFile_${dto.productTypeId}`,
    ) ?? productFiles[0];
    const primaryFile = primaryProductFile ?? file;

    // Guardar submission en BD
    const submission = this.repo.create({
      ...dto,
      referenceCode,
      productTypeIds: allProductTypeIds,
      status: SubmissionStatus.RECEIVED,
      ...(primaryFile && { fileName: primaryFile.originalname }),
    });
    const saved = await this.repo.save(submission);

    await this.historyRepo.save(this.historyRepo.create({
      submissionId: saved.id,
      newStatus: SubmissionStatus.RECEIVED,
      notes: 'Postulación recibida automáticamente',
    }));

    // Background: uploads + correo
    setTimeout(async () => {
      // 1. Archivos por tipo de producto científico
      if (productFiles.length > 0 && storage) {
        try {
          // Cargar datos de tipos de producto para obtener nombre y formatos
          const ptIds = productFiles
            .map(f => f.fieldname.replace('productFile_', ''))
            .filter(Boolean);
          const productTypes = await this.productTypeRepo.findBy({ id: In(ptIds) });
          const ptMap = Object.fromEntries(productTypes.map(p => [p.id, p]));

          let primaryFileUrl: string | null = null;
          let primaryFileName: string | null = null;

          for (const pf of productFiles) {
            const ptId = pf.fieldname.replace('productFile_', '');
            const pt   = ptMap[ptId];
            try {
              const slug    = (pt?.name ?? ptId).replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '-').replace(/-+/g, '-').toLowerCase();
              const fileUrl = await storage.upload(
                pf, 'submissions',
                `${slug}-${referenceCode}-v1`,
              );
              await this.fileRepo.save(this.fileRepo.create({
                submissionId:  saved.id,
                fileUrl,
                fileName:      pf.originalname,
                fileSize:      pf.size,
                fileType:      SubmissionFileType.MANUSCRIPT,
                version:       1,
                isActive:      true,
                productTypeId: ptId,
                productTypeName: pt?.name ?? ptId,
                notes:         'Versión inicial — enviada por el postulante',
              }));
              // El primer archivo (tipo de producto principal) se guarda como referencia
              if (ptId === dto.productTypeId || primaryFileUrl === null) {
                primaryFileUrl  = fileUrl;
                primaryFileName = pf.originalname;
              }
              this.logger.log(`📄 Archivo v1 [${pt?.name ?? ptId}] subido: ${fileUrl}`);
            } catch (err) {
              this.logger.error(`Error subiendo archivo [${pt?.name ?? ptId}] [${referenceCode}]: ${err.message}`);
            }
          }

          if (primaryFileUrl) {
            await this.repo.update(saved.id, { fileUrl: primaryFileUrl, fileName: primaryFileName });
          }
        } catch (err) {
          this.logger.error(`Error procesando archivos de producto [${referenceCode}]: ${err.message}`);
        }
      }

      // 1b. Manuscrito legacy (compatibilidad con flujo anterior)
      if (!productFiles.length && file && storage) {
        try {
          const fileUrl = await storage.upload(file, 'submissions', `manuscript-${referenceCode}-v1`);
          await this.fileRepo.save(this.fileRepo.create({
            submissionId: saved.id,
            fileUrl,
            fileName: file.originalname,
            fileSize: file.size,
            fileType: SubmissionFileType.MANUSCRIPT,
            version: 1,
            isActive: true,
            notes: 'Versión inicial — enviada por el postulante',
          }));
          await this.repo.update(saved.id, { fileUrl, fileName: file.originalname });
          this.logger.log(`📄 Manuscrito v1 subido: ${fileUrl}`);
        } catch (err) {
          this.logger.error(`Error subiendo manuscrito [${referenceCode}]: ${err.message}`);
        }
      }

      // 2. Fotos y documentos de autores
      if ((authorPhotos.length > 0 || authorIdDocs.length > 0) && storage) {
        try {
          const populated = await this.repo.findOne({
            where: { id: saved.id },
            relations: ['authors'],
          });
          if (populated?.authors?.length) {
            const sorted = [...populated.authors].sort((a, b) => a.authorOrder - b.authorOrder);

            for (const photoFile of authorPhotos) {
              const match = photoFile.fieldname.match(/authorPhoto_(\d+)/);
              if (!match) continue;
              const author = sorted[parseInt(match[1], 10)];
              if (!author) continue;
              try {
                const photoUrl = await storage.upload(photoFile, 'photos', `author-${author.id}`);
                await this.authorRepo.update(author.id, { photoUrl });
              } catch (e) {
                this.logger.error(`Error foto ${author.fullName}: ${e.message}`);
              }
            }

            for (const docFile of authorIdDocs) {
              const match = docFile.fieldname.match(/authorIdDoc_(\d+)/);
              if (!match) continue;
              const author = sorted[parseInt(match[1], 10)];
              if (!author) continue;
              try {
                const identityDocUrl = await storage.upload(
                  docFile, 'submissions', `idoc-${author.id}`,
                );
                await this.authorRepo.update(author.id, {
                  identityDocUrl,
                  identityDocFileName: docFile.originalname,
                });
              } catch (e) {
                this.logger.error(`Error doc. identidad ${author.fullName}: ${e.message}`);
              }
            }
          }
        } catch (err) {
          this.logger.error(`Error archivos de autores [${referenceCode}]: ${err.message}`);
        }
      }

      // 3. Correo de confirmación
      try {
        const populated = await this.repo.findOne({
          where: { id: saved.id },
          relations: ['thematicAxis', 'productType', 'authors', 'authors.country'],
        });
        if (populated) await this.mailService.sendSubmissionReceived(populated);
      } catch (err) {
        this.logger.error(`Error correo confirmación [${referenceCode}]: ${err.message}`);
      }
    });

    return saved;
  }

  // ── Listar / buscar ─────────────────────────────────────────────────────────

  findAll(filters: { eventId?: string; status?: string; thematicAxisId?: string; productTypeId?: string; search?: string }) {
    const query = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.productType', 'pt')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('authors.country', 'authorCountry')
      .leftJoinAndSelect('s.country', 'country')
      .orderBy('s.createdAt', 'DESC');

    if (filters.eventId)        query.andWhere('s.eventId = :eventId',       { eventId: filters.eventId });
    if (filters.status)         query.andWhere('s.status = :status',         { status: filters.status });
    if (filters.thematicAxisId) query.andWhere('s.thematicAxisId = :axisId', { axisId: filters.thematicAxisId });
    if (filters.productTypeId)  query.andWhere('s.productTypeId = :ptId',    { ptId: filters.productTypeId });
    if (filters.search) {
      query.andWhere(
        '(s.titleEs ILIKE :q OR s.referenceCode ILIKE :q OR authors.fullName ILIKE :q OR authors.email ILIKE :q)',
        { q: `%${filters.search}%` },
      );
    }
    return query.getMany();
  }

  async findOne(id: string) {
    const s = await this.repo.findOne({
      where: { id },
      relations: [
        'thematicAxis', 'productType', 'authors', 'authors.country',
        'country', 'event', 'statusHistory', 'statusHistory.changedBy',
        'files', 'files.uploadedBy',
      ],
    });
    if (!s) throw new NotFoundException('Submission not found');
    // Ordenar archivos: más reciente primero
    if (s.files) s.files.sort((a, b) => b.version - a.version);
    return s;
  }

  async findByEmail(email: string) {
    return this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.productType', 'pt')
      .leftJoinAndSelect('s.statusHistory', 'statusHistory')
      .where('authors.email = :email', { email })
      .orderBy('s.createdAt', 'DESC')
      .addOrderBy('statusHistory.createdAt', 'ASC')
      .getMany();
  }

  async findByReferenceCode(referenceCode: string) {
    const sub = await this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.productType', 'pt')
      .leftJoinAndSelect('s.statusHistory', 'statusHistory')
      .where('s.referenceCode = :referenceCode', { referenceCode })
      .addOrderBy('statusHistory.createdAt', 'ASC')
      .getOne();
    return sub ? [sub] : [];
  }

  // ── Historial de archivos ───────────────────────────────────────────────────

  async getFileHistory(submissionId: string) {
    return this.fileRepo.find({
      where: { submissionId },
      relations: ['uploadedBy'],
      order: { version: 'DESC' },
    });
  }

  /**
   * Sube una nueva versión del documento desde el dashboard admin.
   * La nueva versión se marca automáticamente como activa (oficial) para su tipo de producto.
   * Si productTypeId es null, opera en modo legacy (una sola versión global).
   */
  async addFileVersion(
    submissionId: string,
    file: Express.Multer.File,
    storage: StorageService,
    uploadedById: string,
    fileType: SubmissionFileType = SubmissionFileType.CORRECTION,
    notes?: string,
    productTypeId?: string,
  ): Promise<SubmissionFile> {
    // Determinar formatos permitidos según el tipo de producto
    let pt: ScientificProductType | null = null;
    if (productTypeId) {
      pt = await this.productTypeRepo.findOne({ where: { id: productTypeId } });
    }
    const allowedMimes = getAllowedMimesForFormats(pt?.allowedFileFormats);

    if (!allowedMimes.includes(file.mimetype)) {
      const fmts = pt?.allowedFileFormats || 'docx';
      throw new BadRequestException(
        `El archivo no es un formato válido para "${pt?.name ?? 'este tipo de producto'}". Formatos permitidos: ${fmts}`,
      );
    }
    if (file.size > MAX_PRODUCT_FILE_SIZE)
      throw new BadRequestException('El archivo no debe superar 20 MB');

    const submission = await this.repo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');

    // Siguiente número de versión — contado por productTypeId si aplica
    const lastFileQuery: any = { submissionId };
    if (productTypeId) lastFileQuery.productTypeId = productTypeId;

    const lastFile = await this.fileRepo.findOne({
      where: lastFileQuery,
      order: { version: 'DESC' },
    });
    const nextVersion = (lastFile?.version ?? 0) + 1;

    // Slug del tipo de producto para el nombre del archivo en B2
    const slug = pt?.name
      ? pt.name.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]/g, '-').replace(/-+/g, '-').toLowerCase()
      : 'manuscrito';

    // Subir a B2
    const fileUrl = await storage.upload(
      file, 'submissions',
      `${slug}-${submission.referenceCode}-v${nextVersion}`,
    );

    // Desmarcar versión activa anterior del mismo tipo de producto
    if (productTypeId) {
      await this.fileRepo.update(
        { submissionId, productTypeId, isActive: true },
        { isActive: false },
      );
    } else {
      // Modo legacy: desmarcar todas las activas sin productTypeId
      await this.fileRepo.update(
        { submissionId, isActive: true },
        { isActive: false },
      );
    }

    // Crear nuevo registro de versión (activa)
    const newFile = await this.fileRepo.save(this.fileRepo.create({
      submissionId,
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      fileType,
      version: nextVersion,
      isActive: true,
      productTypeId: productTypeId ?? null,
      productTypeName: pt?.name ?? null,
      notes: notes || `Versión ${nextVersion} subida desde el dashboard`,
      uploadedById,
    }));

    // Actualizar referencia oficial en la submission si es el tipo principal
    if (!productTypeId || productTypeId === submission.productTypeId) {
      await this.repo.update(submissionId, { fileUrl, fileName: file.originalname });
    }

    this.logger.log(
      `📄 Nueva versión v${nextVersion} [${pt?.name ?? 'legacy'}] subida para ${submission.referenceCode}`,
    );
    return newFile;
  }

  /**
   * Promueve una versión existente a oficial (activa) dentro de su tipo de producto.
   * Útil si el admin quiere volver a una versión anterior.
   */
  async setActiveFileVersion(
    submissionId: string,
    fileId: string,
  ): Promise<SubmissionFile> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, submissionId } });
    if (!file) throw new NotFoundException('Versión de archivo no encontrada');

    // Desmarcar activas del mismo tipo de producto
    if (file.productTypeId) {
      await this.fileRepo.update(
        { submissionId, productTypeId: file.productTypeId, isActive: true },
        { isActive: false },
      );
    } else {
      await this.fileRepo.update({ submissionId, isActive: true }, { isActive: false });
    }

    // Marcar la elegida como activa
    file.isActive = true;
    await this.fileRepo.save(file);

    // Actualizar referencia en submission si es el tipo principal
    const submission = await this.repo.findOne({ where: { id: submissionId } });
    if (!file.productTypeId || file.productTypeId === submission?.productTypeId) {
      await this.repo.update(submissionId, { fileUrl: file.fileUrl, fileName: file.fileName });
    }

    return file;
  }

  /**
   * Descarga: genera presigned URL para cualquier versión del historial.
   */
  async getFileDownloadUrl(
    fileId: string,
    storage: StorageService,
  ): Promise<{ url: string; fileName: string }> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) throw new NotFoundException('Archivo no encontrado');
    const url = await storage.getSignedUrl(file.fileUrl, 3600);
    return { url, fileName: file.fileName };
  }

  // ── Documento de identidad del autor ───────────────────────────────────────

  async getAuthorIdDocUrl(authorId: string, storage: StorageService) {
    const author = await this.authorRepo.findOne({ where: { id: authorId } });
    if (!author) throw new NotFoundException('Author not found');
    if (!author.identityDocUrl)
      return { url: null, message: 'Este autor no tiene documento de identidad cargado' };
    const url = await storage.getSignedUrl(author.identityDocUrl, 3600);
    return { url, authorName: author.fullName, fileName: author.identityDocFileName };
  }

  /**
   * Reemplaza el documento de identidad de un autor desde el dashboard.
   * Elimina el anterior de B2 antes de subir el nuevo.
   */
  async replaceAuthorIdDoc(
    authorId: string,
    file: Express.Multer.File,
    storage: StorageService,
  ): Promise<SubmissionAuthor> {
    if (!ALLOWED_PDF_MIME.includes(file.mimetype))
      throw new BadRequestException('El documento de identidad debe ser PDF');
    if (file.size > 5 * 1024 * 1024)
      throw new BadRequestException('El PDF no debe superar 5 MB');

    const author = await this.authorRepo.findOne({ where: { id: authorId } });
    if (!author) throw new NotFoundException('Author not found');

    // Eliminar el anterior si existe
    if (author.identityDocUrl) {
      await storage.delete(author.identityDocUrl).catch(() => null);
    }

    // Subir el nuevo
    const identityDocUrl = await storage.upload(file, 'submissions', `idoc-${authorId}`);
    author.identityDocUrl      = identityDocUrl;
    author.identityDocFileName = file.originalname;
    return this.authorRepo.save(author);
  }

  // ── Cambiar estado ──────────────────────────────────────────────────────────

  async changeStatus(id: string, dto: UpdateSubmissionStatusDto, user: User) {
    const submission = await this.findOne(id);
    const newStatus  = dto.newStatus as SubmissionStatus;
    const allowed    = STATUS_TRANSITIONS[submission.status];

    if (!allowed.includes(newStatus))
      throw new BadRequestException(
        `Transición no permitida: ${submission.status} → ${newStatus}. Permitidos: ${allowed.join(', ')}`,
      );

    const previousStatus = submission.status;
    submission.status    = newStatus;
    await this.repo.save(submission);

    await this.historyRepo.save(this.historyRepo.create({
      submissionId: id,
      previousStatus,
      newStatus,
      notes:         dto.notes,
      internalNotes: dto.internalNotes,
      changedById:   user.id,
      notifiedApplicant: dto.notifyApplicant ?? true,
    }));

    if (dto.notifyApplicant !== false) {
      setTimeout(async () => {
        try { await this.mailService.sendStatusChanged(submission, newStatus, dto.notes); }
        catch (err) { this.logger.error(`Error correo estado [${id}]: ${err.message}`); }
      });
    }
    return this.findOne(id);
  }

  async assignEvaluator(id: string, dto: AssignEvaluatorDto) {
    const submission = await this.findOne(id);
    submission.assignedEvaluatorId = dto.evaluatorId;
    return this.repo.save(submission);
  }

  // ── Correo personalizado con adjunto Word opcional ──────────────────────────

  async sendCustomEmail(
    id: string,
    dto: SendCustomEmailDto,
    user: User,
    attachmentFile?: Express.Multer.File | { buffer: Buffer; originalname: string; mimetype: string },
  ) {
    const submission = await this.findOne(id);
    const author = submission.authors.find((a) => a.isCorresponding) || submission.authors[0];
    if (!author) throw new BadRequestException('Sin autor para esta postulación');

    setTimeout(async () => {
      try {
        await this.mailService.sendCustomEmail(
          author.email, author.fullName,
          dto.subject, dto.body,
          submission.id, user.id,
          attachmentFile,
        );
      } catch (err) {
        this.logger.error(`Error correo personalizado [${id}]: ${err.message}`);
      }
    });
    return { success: true, sentTo: author.email };
  }

  async sendBulkEmail(dto: BulkEmailDto, user: User) {
    const query = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.authors', 'authors')
      .where('s.eventId = :eventId', { eventId: dto.eventId });
    if (dto.status) query.andWhere('s.status = :status', { status: dto.status });

    const submissions = await query.getMany();
    if (!submissions.length)
      return { queued: 0, message: 'No hay postulaciones que coincidan con el filtro' };

    let attachmentBuffer: Buffer | undefined;
    let attachmentName: string | undefined;
    if (dto.attachmentBase64 && dto.attachmentName) {
      attachmentBuffer = Buffer.from(dto.attachmentBase64, 'base64');
      attachmentName   = dto.attachmentName;
    }

    setTimeout(async () => {
      let sent = 0; let failed = 0;
      for (const sub of submissions) {
        const author = sub.authors.find((a) => a.isCorresponding) || sub.authors[0];
        if (!author) continue;
        try {
          await this.mailService.sendCustomEmail(
            author.email, author.fullName,
            dto.subject, dto.body,
            sub.id, user.id,
            attachmentBuffer
              ? { buffer: attachmentBuffer, originalname: attachmentName, mimetype: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' } as any
              : undefined,
          );
          sent++;
        } catch (err) {
          failed++;
          this.logger.error(`Bulk email error [${sub.referenceCode}]: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 300));
      }
      this.logger.log(`📧 Bulk: ${sent} enviados, ${failed} fallidos`);
    });

    return {
      queued: submissions.length,
      message: `Envío iniciado para ${submissions.length} postulante(s).`,
    };
  }

  async getStatusHistory(id: string) {
    return this.historyRepo.find({
      where: { submissionId: id },
      relations: ['changedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  // ── Fotos de autores ────────────────────────────────────────────────────────

  async updateAuthorPhoto(authorId: string, photoUrl: string | null, storage?: StorageService) {
    const author = await this.authorRepo.findOne({ where: { id: authorId } });
    if (!author) throw new NotFoundException('Author not found');
    if (author.photoUrl && storage) await storage.delete(author.photoUrl).catch(() => null);
    author.photoUrl = photoUrl;
    return this.authorRepo.save(author);
  }

  // ── Descarga de manuscrito activo ───────────────────────────────────────────

  async getDownloadUrl(id: string, storage: StorageService) {
    const submission = await this.repo.findOne({ where: { id } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (!submission.fileUrl) return { url: null, message: 'Sin archivo adjunto' };
    const url = await storage.getSignedUrl(submission.fileUrl, 3600);
    return { url, fileName: submission.fileName };
  }

  async getStats(eventId: string) {
    // Stats globales por estado
    const globalRows = await this.repo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.eventId = :eventId', { eventId })
      .groupBy('s.status')
      .getRawMany();

    const byStatus: Record<string, number> = {};
    for (const row of globalRows) byStatus[row.status] = parseInt(row.count, 10);
    const total = Object.values(byStatus).reduce((a, b) => a + b, 0);

    // Stats por tipo de producción científica y estado
    const productRows = await this.repo
      .createQueryBuilder('s')
      .leftJoin('s.productType', 'pt')
      .select('s.productTypeId', 'productTypeId')
      .addSelect('pt.name', 'productTypeName')
      .addSelect('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.eventId = :eventId', { eventId })
      .groupBy('s.productTypeId')
      .addGroupBy('pt.name')
      .addGroupBy('s.status')
      .orderBy('pt.name', 'ASC')
      .getRawMany();

    // Agrupar por tipo de producto
    const productMap: Record<string, { productTypeId: string; productTypeName: string; total: number; byStatus: Record<string, number> }> = {};
    for (const row of productRows) {
      const ptId = row.productTypeId;
      if (!productMap[ptId]) {
        productMap[ptId] = {
          productTypeId: ptId,
          productTypeName: row.productTypeName ?? 'Sin tipo',
          total: 0,
          byStatus: {},
        };
      }
      const count = parseInt(row.count, 10);
      productMap[ptId].byStatus[row.status] = count;
      productMap[ptId].total += count;
    }

    return { total, byStatus, byProductType: Object.values(productMap) };
  }
}
