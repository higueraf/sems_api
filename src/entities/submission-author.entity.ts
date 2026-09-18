import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { Country } from './country.entity';
import { University } from './university.entity';
import { Faculty } from './faculty.entity';
import { ResearchGroup } from './research-group.entity';
import { Person } from './person.entity';
import { ParticipantType } from '../common/enums/participant-type.enum';

export enum AcademicTitle {
  STUDENT      = 'Estudiante',
  BACHELOR     = 'Licenciado/a',
  ENGINEER     = 'Ingeniero/a',
  SPECIALIST   = 'Especialista',
  MASTER       = 'Magíster / Mg.',
  PHD          = 'Doctor/a / PhD.',
  POSTDOC      = 'Postdoctorado',
  PROFESSOR    = 'Profesor/a',
  RESEARCHER   = 'Investigador/a',
  OTHER        = 'Otro',
}

export enum IdentityDocType {
  NATIONAL_ID   = 'Cédula Nacional',
  INTERNATIONAL = 'Cédula Internacional',
  PASSPORT      = 'Pasaporte',
}

@Entity('submission_authors')
export class SubmissionAuthor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Submission, (s) => s.authors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  submissionId: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  academicTitle: string;

  /** Rol de participación (profesor / estudiante / profesional graduado). */
  @Column({ type: 'enum', enum: ParticipantType, nullable: true })
  participantType: ParticipantType;

  /** @deprecated Reemplazado por university/universityId. Se conserva solo para registros históricos. */
  @Column({ nullable: true })
  affiliation: string;

  @ManyToOne(() => University, { eager: true, nullable: true })
  @JoinColumn({ name: 'universityId' })
  university: University;

  @Column({ nullable: true })
  universityId: string;

  /** Solo para estudiantes de la institución sede (ej. UMAYOR). */
  @ManyToOne(() => Faculty, { eager: true, nullable: true })
  @JoinColumn({ name: 'facultyId' })
  faculty: Faculty;

  @Column({ nullable: true })
  facultyId: string;

  /** Semillero de investigación al que pertenece (opcional, solo estudiantes). */
  @ManyToOne(() => ResearchGroup, { eager: true, nullable: true })
  @JoinColumn({ name: 'researchGroupId' })
  researchGroup: ResearchGroup;

  @Column({ nullable: true })
  researchGroupId: string;

  // Tipo de correo: institutional | personal
  @Column({ nullable: true })
  emailType: string;

  // Email institucional o personal
  @Column()
  email: string;

  // ORCID — obligatorio desde el formulario
  @Column({ nullable: true })
  orcid: string;

  @Column({ nullable: true })
  phone: string;

  @ManyToOne(() => Country, { eager: true, nullable: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column({ nullable: true })
  countryId: string;

  @Column({ nullable: true })
  city: string;

  @Column({ default: false })
  isCorresponding: boolean;

  @Column({ default: 0 })
  authorOrder: number;

  // Foto del ponente — obligatoria desde el formulario de postulación
  @Column({ nullable: true, type: 'text' })
  photoUrl: string;

  // Tipo de documento: Cédula Nacional | Cédula Internacional | Pasaporte
  @Column({ nullable: true })
  identityDocType: string;

  // Número del documento (cédula o pasaporte)
  @Column({ nullable: true })
  identityDocNumber: string;

  // URL del PDF del documento de identidad en B2 (privado, requiere URL firmada)
  @Column({ nullable: true, type: 'text' })
  identityDocUrl: string;

  // Nombre original del archivo de identidad subido
  @Column({ nullable: true })
  identityDocFileName: string;

  /** Marcado como ponente: recibirá el certificado de ponencia */
  @Column({ default: true })
  isPresenter: boolean;

  /** Vínculo al registro global de personas (M:M deduplicado) */
  @ManyToOne(() => Person, { nullable: true, eager: false })
  @JoinColumn({ name: 'personId' })
  person: Person;

  @Column({ nullable: true })
  personId: string;

  @CreateDateColumn()
  createdAt: Date;
}
