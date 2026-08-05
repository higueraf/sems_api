import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Person } from '../../entities/person.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionFile, SubmissionFileType } from '../../entities/submission-file.entity';
import { Certificate } from '../../entities/certificate.entity';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    @InjectRepository(Person)           private personRepo: Repository<Person>,
    @InjectRepository(SubmissionAuthor) private authorRepo: Repository<SubmissionAuthor>,
    @InjectRepository(Submission)       private submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionFile)   private fileRepo: Repository<SubmissionFile>,
    @InjectRepository(Certificate)      private certRepo: Repository<Certificate>,
    private storage: StorageService,
  ) {}

  /** Obtiene la persona vinculada al userId del autor logueado */
  private async getPersonByUserId(userId: string): Promise<Person> {
    const person = await this.personRepo.findOne({ where: { userId } });
    if (!person) throw new NotFoundException('No se encontró un perfil de autor vinculado a este usuario');
    return person;
  }

  /** Valida que el autor logueado tiene acceso a la postulación */
  private async assertAuthorAccess(userId: string, submissionId: string): Promise<SubmissionAuthor> {
    const person = await this.getPersonByUserId(userId);
    const author = await this.authorRepo.findOne({
      where: { personId: person.id, submissionId },
    });
    if (!author) throw new ForbiddenException('No tienes acceso a esta postulación');
    return author;
  }

  /** Lista todas las postulaciones del autor logueado */
  async getMySubmissions(userId: string) {
    const person = await this.getPersonByUserId(userId);
    const authorEntries = await this.authorRepo.find({
      where: { personId: person.id },
      select: ['submissionId'],
    });
    if (!authorEntries.length) return [];

    const submissionIds = [...new Set(authorEntries.map(a => a.submissionId))];
    const submissions = await this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('s.event', 'event')
      .where('s.id IN (:...ids)', { ids: submissionIds })
      .orderBy('s.createdAt', 'DESC')
      .getMany();

    return submissions.map(s => ({
      id: s.id,
      referenceCode: s.referenceCode,
      titleEs: s.titleEs,
      titleEn: s.titleEn,
      status: s.status,
      productStatuses: s.productStatuses,
      productTypeIds: s.productTypeIds,
      createdAt: s.createdAt,
      thematicAxis: s.thematicAxis ? { id: s.thematicAxis.id, name: s.thematicAxis.name } : null,
      event: s.event ? {
        id: s.event.id,
        name: s.event.name,
        year: s.event.startDate ? new Date(s.event.startDate).getFullYear() : undefined,
      } : null,
      authorCount: s.authors?.length ?? 0,
    }));
  }

  /** Detalle de una postulación con historial público y archivos */
  async getMySubmission(userId: string, submissionId: string) {
    await this.assertAuthorAccess(userId, submissionId);

    const submission = await this.submissionRepo
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.thematicAxis', 'axis')
      .leftJoinAndSelect('s.authors', 'authors')
      .leftJoinAndSelect('authors.country', 'authorCountry')
      .leftJoinAndSelect('s.event', 'event')
      .leftJoinAndSelect('s.statusHistory', 'history')
      .where('s.id = :id', { id: submissionId })
      .orderBy('history.createdAt', 'ASC')
      .getOne();

    if (!submission) throw new NotFoundException('Postulación no encontrada');

    // Solo notas públicas del historial (no internalNotes)
    const publicHistory = (submission.statusHistory ?? []).map(h => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      notes: h.notes,            // solo notas públicas
      productTypeId: h.productTypeId,
      createdAt: h.createdAt,
    }));

    // Archivos activos (accesibles para el autor)
    const files = await this.fileRepo.find({
      where: { submissionId, isActive: true },
      order: { createdAt: 'DESC' },
    });

    return {
      id: submission.id,
      referenceCode: submission.referenceCode,
      titleEs: submission.titleEs,
      titleEn: submission.titleEn,
      abstractEs: submission.abstractEs,
      status: submission.status,
      productStatuses: submission.productStatuses,
      productTypeIds: submission.productTypeIds,
      createdAt: submission.createdAt,
      thematicAxis: submission.thematicAxis
        ? { id: submission.thematicAxis.id, name: submission.thematicAxis.name }
        : null,
      event: submission.event
        ? {
          id: submission.event.id,
          name: submission.event.name,
          year: submission.event.startDate ? new Date(submission.event.startDate).getFullYear() : undefined,
        }
        : null,
      authors: (submission.authors ?? []).map(a => ({
        id: a.id,
        fullName: a.fullName,
        academicTitle: a.academicTitle,
        email: a.email,
        isCorresponding: a.isCorresponding,
        isPresenter: a.isPresenter,
        authorOrder: a.authorOrder,
      })),
      statusHistory: publicHistory,
      files: files.map(f => ({
        id: f.id,
        fileName: f.fileName,
        fileType: f.fileType,
        version: f.version,
        notes: f.notes,
        productTypeId: f.productTypeId,
        productTypeName: f.productTypeName,
        createdAt: f.createdAt,
      })),
    };
  }

  /** Sube una versión corregida (solo permitido en estado revision_requested) */
  async uploadRevision(
    userId: string,
    submissionId: string,
    file: Express.Multer.File,
    notes?: string,
  ) {
    await this.assertAuthorAccess(userId, submissionId);

    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Postulación no encontrada');

    const globalStatus = submission.status;
    const hasRevisionRequested =
      globalStatus === SubmissionStatus.REVISION_REQUESTED ||
      Object.values(submission.productStatuses ?? {}).some(
        s => s === SubmissionStatus.REVISION_REQUESTED,
      );

    if (!hasRevisionRequested) {
      throw new BadRequestException(
        'Solo puedes subir una corrección cuando el estatus de la postulación es "Revisión solicitada"',
      );
    }

    // Contar versiones existentes para este tipo de contenido
    const existingCount = await this.fileRepo.count({
      where: { submissionId, fileType: SubmissionFileType.CORRECTION },
    });

    const fileUrl = await this.storage.upload(
      file, 'submissions',
      `correction-${submission.referenceCode}-v${existingCount + 1}`,
    );

    // Desactivar versiones anteriores del mismo tipo
    await this.fileRepo.update(
      { submissionId, fileType: SubmissionFileType.CORRECTION, isActive: true },
      { isActive: false },
    );

    const saved = await this.fileRepo.save(this.fileRepo.create({
      submissionId,
      fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      fileType: SubmissionFileType.CORRECTION,
      version: existingCount + 1,
      isActive: true,
      notes: notes ?? 'Corrección subida por el autor',
    }));

    this.logger.log(`📤 Revisión subida por autor [${submission.referenceCode}] v${existingCount + 1}`);
    return { id: saved.id, version: saved.version, fileName: saved.fileName };
  }

  /** Certificados del autor para una postulación */
  async getMyCertificates(userId: string, submissionId: string) {
    await this.assertAuthorAccess(userId, submissionId);
    const person = await this.getPersonByUserId(userId);

    // Buscar el submission_author de este usuario en esta postulación
    const author = await this.authorRepo.findOne({
      where: { personId: person.id, submissionId },
    });
    if (!author) return [];

    const certs = await this.certRepo.find({
      where: { authorId: author.id, submissionId },
      order: { createdAt: 'DESC' },
    });

    return certs.map(c => ({
      id: c.id,
      certificateNumber: c.certificateNumber,
      productTypeName: c.productTypeName,
      issuedAt: c.issuedAt,
      emailSentAt: c.emailSentAt,
      hasFile: !!c.fileUrl,
      hasFileCarta: !!c.fileUrlCarta,
    }));
  }

  /** Genera URL firmada para descargar un certificado */
  async getCertDownloadUrl(userId: string, certId: string, format: 'diploma' | 'carta' = 'diploma') {
    const person = await this.getPersonByUserId(userId);

    const cert = await this.certRepo.findOne({
      where: { id: certId },
      relations: ['author'],
    });
    if (!cert) throw new NotFoundException('Certificado no encontrado');

    // Validar que el certificado pertenece al autor logueado
    if (cert.author?.personId !== person.id) {
      throw new ForbiddenException('No tienes acceso a este certificado');
    }

    const ref = format === 'carta' ? cert.fileUrlCarta : cert.fileUrl;
    if (!ref) throw new NotFoundException(`El certificado en formato ${format} no está disponible aún`);

    const url = await this.storage.getSignedUrl(ref, 3600);
    return { url, fileName: format === 'carta' ? cert.fileNameCarta : cert.fileName };
  }
}
