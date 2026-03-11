import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { Country } from './country.entity';

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

  @Column({ nullable: true })
  affiliation: string;

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

  @CreateDateColumn()
  createdAt: Date;
}
