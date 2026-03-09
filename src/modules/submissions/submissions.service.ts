import {
  Injectable, NotFoundException, BadRequestException,
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
    if (file) {
      if (file.size > 15 * 1024 * 1024) {
        throw new BadRequestException('El archivo no debe superar 15 MB');
      }
      if (!this.ALLOWED_MIME.includes(file.mimetype)) {
        throw new BadRequestException(
          `Tipo de archivo no permitido (${file.mimetype}). Solo se aceptan PDF, DOC y DOCX.`,
        );
      }
    }

    // Generar código de referencia único
    let referenceCode: string;
    let isUnique = false;
    while (!isUnique) {
      referenceCode = this.generateReferenceCode();
      const existing = await this.repo.findOne({ where: { referenceCode } });
      if (!existing) isUnique = true;
    }

    // Subir archivo a Supabase antes de guardar en BD
    let fileUrl: string | undefined;
    if (file && storage) {
      fileUrl = await storage.upload(file, 'submissions', `manuscript-${referenceCode}`);
    }

    const submission = this.repo.create({
      ...dto,
      referenceCode,
      status: SubmissionStatus.RECEIVED,
      ...(file && { fileUrl: fileUrl || `/uploads/${file.filename}`, fileName: file.originalname }),
    });

    const saved = await this.repo.save(submission);

    await this.historyRepo.save(
      this.historyRepo.create({
        submissionId: saved.id,
        newStatus: SubmissionStatus.RECEIVED,
        notes: 'Postulación recibida automáticamente',
      }),
    );

    const populated = await this.findOne(saved.id);
    await this.mailService.sendSubmissionReceived(populated);

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

    if (dto.notifyApplicant !== false) {
      await this.mailService.sendStatusChanged(submission, newStatus, dto.notes);
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

    const success = await this.mailService.sendCustomEmail(
      correspondingAuthor.email,
      correspondingAuthor.fullName,
      dto.subject,
      dto.body,
      id,
      user.id,
    );

    return { success, sentTo: correspondingAuthor.email };
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
