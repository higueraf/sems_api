import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { User } from '../../entities/user.entity';
import {
  CreateSubmissionDto, UpdateSubmissionStatusDto,
  SendCustomEmailDto, AssignEvaluatorDto,
} from './dto/submission.dto';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { MailService } from '../mail/mail.service';
import { UserRole } from '../../common/enums/role.enum';
import { StorageService } from '../storage/storage.service';

// Valid status transitions to enforce workflow integrity
const STATUS_TRANSITIONS: Record<SubmissionStatus, SubmissionStatus[]> = {
  [SubmissionStatus.RECEIVED]: [SubmissionStatus.UNDER_REVIEW, SubmissionStatus.WITHDRAWN],
  [SubmissionStatus.UNDER_REVIEW]: [
    SubmissionStatus.APPROVED,
    SubmissionStatus.REJECTED,
    SubmissionStatus.REVISION_REQUESTED,
    SubmissionStatus.WITHDRAWN,
  ],
  [SubmissionStatus.REVISION_REQUESTED]: [
    SubmissionStatus.UNDER_REVIEW,
    SubmissionStatus.REJECTED,
    SubmissionStatus.WITHDRAWN,
  ],
  [SubmissionStatus.APPROVED]: [SubmissionStatus.SCHEDULED, SubmissionStatus.REJECTED],
  [SubmissionStatus.REJECTED]: [SubmissionStatus.UNDER_REVIEW],
  [SubmissionStatus.WITHDRAWN]: [],
  [SubmissionStatus.SCHEDULED]: [SubmissionStatus.APPROVED],
};

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);

  constructor(
    @InjectRepository(Submission) private repo: Repository<Submission>,
    @InjectRepository(SubmissionAuthor) private authorRepo: Repository<SubmissionAuthor>,
    @InjectRepository(SubmissionStatusHistory) private historyRepo: Repository<SubmissionStatusHistory>,
    private mailService: MailService,
  ) {}

  private generateReferenceCode(): string {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    return `SEMS-${year}-${random}`;
  }

  private readonly ALLOWED_MIME = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  async create(
    dto: CreateSubmissionDto,
    file?: Express.Multer.File,
    storage?: StorageService,
  ) {
    // ── Validaciones síncronas (antes de tocar BD o storage) ────────────────
    if (file) {
      if (file.size > 15 * 1024 * 1024)
        throw new BadRequestException('El archivo no debe superar 15 MB');
      if (!this.ALLOWED_MIME.includes(file.mimetype))
        throw new BadRequestException(
          `Tipo de archivo no permitido (${file.mimetype}). Solo se aceptan PDF, DOC y DOCX.`,
        );
    }

    // ── Código de referencia único ──────────────────────────────────────────
    let referenceCode: string;
    let isUnique = false;
    while (!isUnique) {
      referenceCode = this.generateReferenceCode();
      const existing = await this.repo.findOne({ where: { referenceCode } });
      if (!existing) isUnique = true;
    }

    // ── Guardar en BD inmediatamente (sin esperar B2) ───────────────────────
    // fileUrl queda null temporalmente; se actualiza en background
    const submission = this.repo.create({
      ...dto,
      referenceCode,
      status: SubmissionStatus.RECEIVED,
      ...(file && { fileName: file.originalname }),
    });
    const saved = await this.repo.save(submission);

    // Historial de estado
    await this.historyRepo.save(
      this.historyRepo.create({
        submissionId: saved.id,
        newStatus: SubmissionStatus.RECEIVED,
        notes: 'Postulación recibida automáticamente',
      }),
    );

    // ── Background: subida a B2 + correo (NO bloquean la respuesta) ─────────
    // El ponente recibe respuesta inmediata con su referenceCode.
    // El archivo se sube a B2 y el correo se envía en paralelo sin await.
    setImmediate(async () => {
      try {
        // 1. Subir archivo a Backblaze B2
        if (file && storage) {
          const fileUrl = await storage.upload(
            file,
            'submissions',
            `manuscript-${referenceCode}`,
          );
          await this.repo.update(saved.id, { fileUrl });
          this.logger.log(`📄 Manuscrito subido a B2: ${fileUrl}`);
        }
      } catch (err) {
        this.logger.error(`Error subiendo manuscrito a B2 [${referenceCode}]: ${err.message}`);
      }

      try {
        // 2. Enviar correo de confirmación
        const populated = await this.repo.findOne({
          where: { id: saved.id },
          relations: ['thematicAxis', 'productType', 'authors', 'authors.country'],
        });
        if (populated) await this.mailService.sendSubmissionReceived(populated);
      } catch (err) {
        this.logger.error(`Error enviando correo [${referenceCode}]: ${err.message}`);
      }
    });

    return saved;
  }

  findAll(filters: { eventId?: string; status?: string; thematicAxisId?: string; search?: string }) {
    const query = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.productType', 'pt')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('authors.country', 'authorCountry')
      .leftJoinAndSelect('s.country', 'country')
      .orderBy('s.createdAt', 'DESC');

    if (filters.eventId) query.andWhere('s.eventId = :eventId', { eventId: filters.eventId });
    if (filters.status) query.andWhere('s.status = :status', { status: filters.status });
    if (filters.thematicAxisId) query.andWhere('s.thematicAxisId = :axisId', { axisId: filters.thematicAxisId });
    if (filters.search) {
      query.andWhere(
        '(s.titleEs ILIKE :search OR s.referenceCode ILIKE :search OR authors.fullName ILIKE :search OR authors.email ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }

    return query.getMany();
  }

  async findOne(id: string) {
    const submission = await this.repo.findOne({
      where: { id },
      relations: ['thematicAxis', 'productType', 'authors', 'authors.country', 'country', 'event', 'statusHistory', 'statusHistory.changedBy'],
    });
    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
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

  async changeStatus(id: string, dto: UpdateSubmissionStatusDto, user: User) {
    const submission = await this.findOne(id);
    const newStatus = dto.newStatus as SubmissionStatus;
    const allowedNext = STATUS_TRANSITIONS[submission.status];

    if (!allowedNext.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from '${submission.status}' to '${newStatus}'. Allowed: ${allowedNext.join(', ')}`,
      );
    }

    const previousStatus = submission.status;
    submission.status = newStatus;
    await this.repo.save(submission);

    await this.historyRepo.save(
      this.historyRepo.create({
        submissionId: id,
        previousStatus,
        newStatus,
        notes: dto.notes,
        internalNotes: dto.internalNotes,
        changedById: user.id,
        notifiedApplicant: dto.notifyApplicant ?? true,
      }),
    );

    // Correo en background — no bloquea la respuesta al admin
    if (dto.notifyApplicant !== false) {
      setImmediate(async () => {
        try {
          await this.mailService.sendStatusChanged(submission, newStatus, dto.notes);
        } catch (err) {
          this.logger.error(`Error enviando correo de cambio de estado [${id}]: ${err.message}`);
        }
      });
    }

    return this.findOne(id);
  }

  async assignEvaluator(id: string, dto: AssignEvaluatorDto) {
    const submission = await this.findOne(id);
    submission.assignedEvaluatorId = dto.evaluatorId;
    return this.repo.save(submission);
  }

  async sendCustomEmail(id: string, dto: SendCustomEmailDto, user: User) {
    const submission = await this.findOne(id);
    const correspondingAuthor = submission.authors.find((a) => a.isCorresponding) || submission.authors[0];
    if (!correspondingAuthor) throw new BadRequestException('No author found for this submission');

    // Correo individual en background
    setImmediate(async () => {
      try {
        await this.mailService.sendCustomEmail(
          correspondingAuthor.email,
          correspondingAuthor.fullName,
          dto.subject,
          dto.body,
          id,
          user.id,
        );
      } catch (err) {
        this.logger.error(`Error enviando correo personalizado [${id}]: ${err.message}`);
      }
    });

    return { success: true, sentTo: correspondingAuthor.email };
  }

  /**
   * Envío masivo de correos a postulantes.
   * Filtra por estado si se indica. Responde inmediatamente con el total
   * a enviar y despacha todos los correos en background con un delay
   * de 300ms entre cada uno para no saturar Gmail SMTP.
   */
  async sendBulkEmail(
    dto: { subject: string; body: string; status?: string; eventId: string },
    user: User,
  ) {
    const query = this.repo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.productType', 'pt')
      .where('s.eventId = :eventId', { eventId: dto.eventId });

    if (dto.status) {
      query.andWhere('s.status = :status', { status: dto.status });
    }

    const submissions = await query.getMany();
    const total = submissions.length;

    if (total === 0) {
      return { queued: 0, message: 'No hay postulaciones que coincidan con el filtro' };
    }

    // Despachar en background con throttle de 300ms entre correos
    // para respetar el límite de Gmail (500/día, ~1.7/seg)
    setImmediate(async () => {
      let sent = 0;
      let failed = 0;
      for (const sub of submissions) {
        const author = sub.authors.find((a) => a.isCorresponding) || sub.authors[0];
        if (!author) continue;
        try {
          await this.mailService.sendCustomEmail(
            author.email,
            author.fullName,
            dto.subject,
            dto.body,
            sub.id,
            user.id,
          );
          sent++;
        } catch (err) {
          failed++;
          this.logger.error(`Bulk email error [${sub.referenceCode}]: ${err.message}`);
        }
        // Throttle: 300ms entre correos → máx ~200/min, dentro del límite de Gmail
        await new Promise((r) => setTimeout(r, 300));
      }
      this.logger.log(`📧 Bulk email completado: ${sent} enviados, ${failed} fallidos`);
    });

    return {
      queued: total,
      message: `Envío iniciado para ${total} postulante${total !== 1 ? 's' : ''}. Los correos se despachan en segundo plano.`,
    };
  }

  async getStatusHistory(id: string) {
    return this.historyRepo.find({
      where: { submissionId: id },
      relations: ['changedBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateAuthorPhoto(
    authorId: string,
    photoUrl: string | null,
    storage?: StorageService,
  ) {
    const author = await this.authorRepo.findOne({ where: { id: authorId } });
    if (!author) throw new NotFoundException('Author not found');
    // Eliminar foto anterior de Cloudinary si existe y se reemplaza
    if (author.photoUrl && storage) {
      await storage.delete(author.photoUrl).catch(() => null);
    }
    author.photoUrl = photoUrl;
    return this.authorRepo.save(author);
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
    for (const row of result) {
      stats[row.status] = parseInt(row.count, 10);
    }

    const total = Object.values(stats).reduce((a, b) => a + b, 0);
    return { total, byStatus: stats };
  }
}
