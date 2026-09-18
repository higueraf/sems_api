import {
  Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Person } from '../../entities/person.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionFile, SubmissionFileType } from '../../entities/submission-file.entity';
import { Certificate, CertificateType } from '../../entities/certificate.entity';
import { User } from '../../entities/user.entity';
import { SubmissionStatus } from '../../common/enums/submission-status.enum';
import { StorageService } from '../storage/storage.service';
import { PersonsService } from '../persons/persons.service';
import { SubmissionsService } from '../submissions/submissions.service';
import { AdminAuthorDto } from '../submissions/dto/submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

/** Estatus en los que el autor todavía puede editar/subir documentos */
const EDITABLE_STATUSES = [
  SubmissionStatus.RECEIVED,
  SubmissionStatus.UNDER_REVIEW,
  SubmissionStatus.REVISION_REQUESTED,
];

/** Estatus en los que el autor todavía puede agregar/quitar autores (solo antes de entrar a revisión) */
const AUTHOR_MANAGEMENT_STATUSES = [SubmissionStatus.RECEIVED];

@Injectable()
export class PortalService {
  private readonly logger = new Logger(PortalService.name);

  constructor(
    @InjectRepository(Person)           private personRepo: Repository<Person>,
    @InjectRepository(SubmissionAuthor) private authorRepo: Repository<SubmissionAuthor>,
    @InjectRepository(Submission)       private submissionRepo: Repository<Submission>,
    @InjectRepository(SubmissionFile)   private fileRepo: Repository<SubmissionFile>,
    @InjectRepository(Certificate)      private certRepo: Repository<Certificate>,
    @InjectRepository(User)             private userRepo: Repository<User>,
    private storage: StorageService,
    private personsService: PersonsService,
    private submissionsService: SubmissionsService,
  ) {}

  private isEditable(status: SubmissionStatus): boolean {
    return EDITABLE_STATUSES.includes(status);
  }

  private canManageAuthors(status: SubmissionStatus): boolean {
    return AUTHOR_MANAGEMENT_STATUSES.includes(status);
  }

  /**
   * Obtiene la persona (perfil de autor) vinculada al userId, si existe.
   * Un evaluador puro (sin historial como autor) no tiene Person → null.
   */
  private async getPersonByUserId(userId: string): Promise<Person | null> {
    return this.personRepo.findOne({ where: { userId } });
  }

  /** Valida que el autor logueado tiene acceso a la postulación */
  private async assertAuthorAccess(userId: string, submissionId: string): Promise<SubmissionAuthor> {
    const person = await this.getPersonByUserId(userId);
    if (!person) throw new ForbiddenException('No tienes acceso a esta postulación');
    const author = await this.authorRepo.findOne({
      where: { personId: person.id, submissionId },
    });
    if (!author) throw new ForbiddenException('No tienes acceso a esta postulación');
    return author;
  }

  /** Lista todas las postulaciones del autor logueado */
  async getMySubmissions(userId: string) {
    const person = await this.getPersonByUserId(userId);
    if (!person) return [];
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
      canEdit: this.isEditable(s.status),
      canEditAuthors: this.canManageAuthors(s.status),
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
      .leftJoinAndSelect('authors.university', 'authorUniversity')
      .leftJoinAndSelect('authors.faculty', 'authorFaculty')
      .leftJoinAndSelect('authors.researchGroup', 'authorResearchGroup')
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
      abstractEn: submission.abstractEn,
      keywordsEs: submission.keywordsEs,
      keywordsEn: submission.keywordsEn,
      status: submission.status,
      productStatuses: submission.productStatuses,
      productTypeIds: submission.productTypeIds,
      createdAt: submission.createdAt,
      canEdit: this.isEditable(submission.status),
      canEditAuthors: this.canManageAuthors(submission.status),
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
        participantType: a.participantType,
        affiliation: a.affiliation,
        universityId: a.universityId,
        university: a.university ? { id: a.university.id, name: a.university.name, isHostInstitution: a.university.isHostInstitution } : null,
        facultyId: a.facultyId,
        faculty: a.faculty ? { id: a.faculty.id, name: a.faculty.name } : null,
        researchGroupId: a.researchGroupId,
        researchGroup: a.researchGroup ? { id: a.researchGroup.id, name: a.researchGroup.name } : null,
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

    if (!this.isEditable(submission.status)) {
      throw new BadRequestException(
        'Ya no puedes actualizar documentos en el estatus actual de tu postulación',
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

  /** Actualiza los campos de texto de una postulación (solo si el estatus lo permite) */
  async updateSubmission(userId: string, submissionId: string, dto: UpdateSubmissionDto) {
    await this.assertAuthorAccess(userId, submissionId);

    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Postulación no encontrada');

    if (!this.isEditable(submission.status)) {
      throw new BadRequestException(
        'Ya no puedes editar los datos de tu postulación en el estatus actual',
      );
    }

    await this.submissionRepo.update(submissionId, dto);
    this.logger.log(`✏️ Postulación editada por autor [${submission.referenceCode}]`);
    return this.getMySubmission(userId, submissionId);
  }

  /** Agrega un coautor a la postulación (solo permitido en estado "received") */
  async addAuthor(userId: string, submissionId: string, dto: AdminAuthorDto) {
    await this.assertAuthorAccess(userId, submissionId);

    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Postulación no encontrada');

    if (!this.canManageAuthors(submission.status)) {
      throw new BadRequestException(
        'Ya no puedes agregar autores en el estatus actual de tu postulación',
      );
    }

    // El autor de correspondencia es siempre quien radicó la postulación
    await this.submissionsService.addAuthor(submissionId, { ...dto, isCorresponding: false });
    this.logger.log(`➕ Coautor agregado por el autor [${submission.referenceCode}]`);
    return this.getMySubmission(userId, submissionId);
  }

  /** Quita un coautor de la postulación (solo permitido en estado "received") */
  async removeAuthor(userId: string, submissionId: string, authorId: string) {
    await this.assertAuthorAccess(userId, submissionId);

    const submission = await this.submissionRepo.findOne({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Postulación no encontrada');

    if (!this.canManageAuthors(submission.status)) {
      throw new BadRequestException(
        'Ya no puedes quitar autores en el estatus actual de tu postulación',
      );
    }

    const author = await this.authorRepo.findOne({ where: { id: authorId, submissionId } });
    if (!author) throw new NotFoundException('Autor no encontrado');
    if (author.isCorresponding) {
      throw new BadRequestException('No puedes eliminar al autor de correspondencia');
    }

    await this.submissionsService.removeAuthor(authorId);
    this.logger.log(`➖ Coautor eliminado por el autor [${submission.referenceCode}]`);
    return this.getMySubmission(userId, submissionId);
  }

  /** Certificados del autor para una postulación */
  async getMyCertificates(userId: string, submissionId: string) {
    const authorAccess = await this.assertAuthorAccess(userId, submissionId);

    const certs = await this.certRepo.find({
      where: { authorId: authorAccess.id, submissionId },
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
    const cert = await this.certRepo.findOne({
      where: { id: certId },
      relations: ['author'],
    });
    if (!cert) throw new NotFoundException('Certificado no encontrado');

    if (cert.certificateType === CertificateType.PEER_REVIEWER) {
      // Certificado de par académico: pertenece directamente al usuario evaluador
      if (cert.evaluatorId !== userId) {
        throw new ForbiddenException('No tienes acceso a este certificado');
      }
    } else {
      // Certificado de autor: validar a través del perfil de persona vinculado
      const person = await this.getPersonByUserId(userId);
      if (!person || cert.author?.personId !== person.id) {
        throw new ForbiddenException('No tienes acceso a este certificado');
      }
    }

    const ref = format === 'carta' ? cert.fileUrlCarta : cert.fileUrl;
    if (!ref) throw new NotFoundException(`El certificado en formato ${format} no está disponible aún`);

    const url = await this.storage.getSignedUrl(ref, 3600);
    return { url, fileName: format === 'carta' ? cert.fileNameCarta : cert.fileName };
  }

  /** Todos los certificados del usuario logueado: como autor (todas sus postulaciones/eventos) y como evaluador (par académico) */
  async getAllMyCertificates(userId: string) {
    const person = await this.getPersonByUserId(userId);

    const authorEntries = person
      ? await this.authorRepo.find({ where: { personId: person.id }, select: ['id'] })
      : [];

    const [authorCerts, peerCerts] = await Promise.all([
      authorEntries.length
        ? this.certRepo.find({
          where: { authorId: In(authorEntries.map(a => a.id)) },
          relations: ['submission', 'submission.event'],
          order: { issuedAt: 'DESC' },
        })
        : Promise.resolve([]),
      this.certRepo.find({
        where: { evaluatorId: userId, certificateType: CertificateType.PEER_REVIEWER },
        relations: ['event'],
        order: { issuedAt: 'DESC' },
      }),
    ]);

    const mapped = [
      ...authorCerts.map(c => ({
        id: c.id,
        certificateType: c.certificateType,
        certificateNumber: c.certificateNumber,
        productTypeName: c.productTypeName,
        issuedAt: c.issuedAt,
        emailSentAt: c.emailSentAt,
        hasFile: !!c.fileUrl,
        hasFileCarta: !!c.fileUrlCarta,
        submission: c.submission ? {
          id: c.submission.id,
          referenceCode: c.submission.referenceCode,
          titleEs: c.submission.titleEs,
        } : null,
        event: c.submission?.event ? {
          id: c.submission.event.id,
          name: c.submission.event.name,
          year: c.submission.event.startDate ? new Date(c.submission.event.startDate).getFullYear() : undefined,
        } : null,
      })),
      ...peerCerts.map(c => ({
        id: c.id,
        certificateType: c.certificateType,
        certificateNumber: c.certificateNumber,
        productTypeName: c.productTypeName,
        issuedAt: c.issuedAt,
        emailSentAt: c.emailSentAt,
        hasFile: !!c.fileUrl,
        hasFileCarta: !!c.fileUrlCarta,
        submission: null,
        event: c.event ? {
          id: c.event.id,
          name: c.event.name,
          year: c.event.startDate ? new Date(c.event.startDate).getFullYear() : undefined,
        } : null,
      })),
    ];

    mapped.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
    return mapped;
  }

  /** Datos de cuenta del autor logueado */
  async getAccount(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
    };
  }

  /** Actualiza nombre/apellido de la cuenta y propaga a Person/submission_authors */
  async updateAccount(userId: string, dto: { firstName: string; lastName: string }) {
    await this.userRepo.update(userId, { firstName: dto.firstName, lastName: dto.lastName });

    const person = await this.personRepo.findOne({ where: { userId } });
    if (person) {
      await this.personsService.update(person.id, { fullName: `${dto.firstName} ${dto.lastName}` });
    }

    return this.getAccount(userId);
  }

  /** Cambia la contraseña del autor logueado, validando la actual */
  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'email', 'password'],
    });
    if (!user) throw new NotFoundException('Usuario no encontrado');

    if (!(await user.validatePassword(dto.currentPassword))) {
      throw new BadRequestException('La contraseña actual es incorrecta');
    }

    user.password = dto.newPassword;
    await this.userRepo.save(user);
    return { success: true };
  }
}
