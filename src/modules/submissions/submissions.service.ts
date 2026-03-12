import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { SubmissionFile, SubmissionFileType } from '../../entities/submission-file.entity';
import { User } from '../../entities/user.entity';
import {
  CreateSubmissionDto, UpdateSubmissionStatusDto,
  SendCustomEmailDto, AssignEvaluatorDto, BulkEmailDto,
} from './dto/submission.dto';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { MailService } from '../mail/mail.service';
import { StorageService } from '../storage/storage.service';
import { setImmediate } from 'timers';

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
const ALLOWED_IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_PDF_MIME   = ['application/pdf'];

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission)               private repo: Repository<Submission>,
    @InjectRepository(SubmissionAuthor)         private authorRepo: Repository<SubmissionAuthor>,
    @InjectRepository(SubmissionStatusHistory)  private historyRepo: Repository<SubmissionStatusHistory>,
    @InjectRepository(SubmissionFile)           private fileRepo: Repository<SubmissionFile>,
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
  ) {
    // Validar manuscrito — solo Word
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

    // Guardar submission en BD
    const submission = this.repo.create({
      ...dto,
      referenceCode,
      status: SubmissionStatus.RECEIVED,
      ...(file && { fileName: file.originalname }),
    });
    const saved = await this.repo.save(submission);

    await this.historyRepo.save(this.historyRepo.create({
      submissionId: saved.id,
      newStatus: SubmissionStatus.RECEIVED,
      notes: 'Postulación recibida automáticamente',
    }));

    // Background: uploads + correo
    setImmediate(async () => {
      // 1. Manuscrito → B2 + crear registro en historial de archivos
      if (file && storage) {
        try {
          const fileUrl = await storage.upload(file, 'submissions', `manuscript-${referenceCode}-v1`);
          // Crear entrada en historial (versión 1, activa)
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
          // Actualizar referencia activa en la submission
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

  findAll(filters: { eventId?: string; status?: string; thematicAxisId?: string; search?: string }) {
    const query = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.productType', 'pt')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('authors.country', 'authorCountry')
      .leftJoinAndSelect('s.country', 'country')
      .orderBy('s.createdAt', 'DESC');

    if (filters.eventId)        query.andWhere('s.eventId = :eventId',     { eventId: filters.eventId });
    if (filters.status)         query.andWhere('s.status = :status',       { status: filters.status });
    if (filters.thematicAxisId) query.andWhere('s.thematicAxisId = :axisId', { axisId: filters.thematicAxisId });
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
      .where('authors.email = :email', { email })
      .orderBy('s.createdAt', 'DESC')
      .getMany();
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
   * La nueva versión se marca automáticamente como activa (oficial),
   * y todas las anteriores se desmarcan.
   */
  async addFileVersion(
    submissionId: string,
    file: Express.Multer.File,
    storage: StorageService,
    uploadedById: string,
    fileType: SubmissionFileType = SubmissionFileType.CORRECTION,
    notes?: string,
  ): Promise<SubmissionFile> {
    // Validar — solo Word
    if (!ALLOWED_WORD_MIME.includes(file.mimetype))
      throw new BadRequestException('Solo se aceptan documentos Word (.doc / .docx)');
    if (file.size > 15 * 1024 * 1024)
      throw new BadRequestException('El archivo no debe superar 15 MB');

    const submission = await this.repo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');

    // Siguiente número de versión
    const lastFile = await this.fileRepo.findOne({
      where: { submissionId },
      order: { version: 'DESC' },
    });
    const nextVersion = (lastFile?.version ?? 0) + 1;

    // Subir a B2
    const fileUrl = await storage.upload(
      file, 'submissions',
      `manuscript-${submission.referenceCode}-v${nextVersion}`,
    );

    // Desmarcar versión activa anterior
    await this.fileRepo.update({ submissionId, isActive: true }, { isActive: false });

    // Crear nuevo registro de versión (activa)
    const newFile = await this.fileRepo.save(this.fileRepo.create({
      submissionId,
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      fileType,
      version: nextVersion,
      isActive: true,
      notes: notes || `Versión ${nextVersion} subida desde el dashboard`,
      uploadedById,
    }));

    // Actualizar referencia oficial en la submission
    await this.repo.update(submissionId, { fileUrl, fileName: file.originalname });

    this.logger.log(`📄 Nueva versión v${nextVersion} subida para ${submission.referenceCode}`);
    return newFile;
  }

  /**
   * Promueve una versión existente a oficial (activa).
   * Útil si el admin quiere volver a una versión anterior.
   */
  async setActiveFileVersion(
    submissionId: string,
    fileId: string,
  ): Promise<SubmissionFile> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, submissionId } });
    if (!file) throw new NotFoundException('Versión de archivo no encontrada');

    // Desmarcar todas las activas
    await this.fileRepo.update({ submissionId, isActive: true }, { isActive: false });

    // Marcar la elegida como activa
    file.isActive = true;
    await this.fileRepo.save(file);

    // Actualizar referencia en submission
    await this.repo.update(submissionId, { fileUrl: file.fileUrl, fileName: file.fileName });

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
      setImmediate(async () => {
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

    setImmediate(async () => {
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

    setImmediate(async () => {
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
    const result = await this.repo
      .createQueryBuilder('s')
      .select('s.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('s.eventId = :eventId', { eventId })
      .groupBy('s.status')
      .getRawMany();
    const stats: Record<string, number> = {};
    for (const row of result) stats[row.status] = parseInt(row.count, 10);
    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return { total, byStatus: stats };
  }
}
