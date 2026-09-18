import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { SubmissionAuthor } from './submission-author.entity';
import { ScientificProductType } from './scientific-product-type.entity';
import { Event } from './event.entity';
import { User } from './user.entity';

export enum CertificateType {
  AUTHOR = 'author',
  PEER_REVIEWER = 'peer_reviewer',
}

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Tipo de certificado: de autor (producción científica) o de par académico (evaluador) */
  @Column({ type: 'enum', enum: CertificateType, default: CertificateType.AUTHOR })
  certificateType: CertificateType;

  /** Número correlativo único, formato CERT-YYYY-NNNN */
  @Column({ unique: true })
  certificateNumber: string;

  @ManyToOne(() => Submission, { onDelete: 'CASCADE', eager: false, nullable: true })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission | null;

  @Column({ nullable: true })
  submissionId: string | null;

  @ManyToOne(() => SubmissionAuthor, { onDelete: 'CASCADE', eager: true, nullable: true })
  @JoinColumn({ name: 'authorId' })
  author: SubmissionAuthor | null;

  @Column({ nullable: true })
  authorId: string | null;

  /** Usuario evaluador, solo para certificados de tipo "par académico" */
  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false, nullable: true })
  @JoinColumn({ name: 'evaluatorId' })
  evaluator: User | null;

  @Column({ nullable: true })
  evaluatorId: string | null;

  @ManyToOne(() => ScientificProductType, { eager: true, nullable: true })
  @JoinColumn({ name: 'productTypeId' })
  productType: ScientificProductType;

  @Column({ nullable: true })
  productTypeId: string;

  /** Nombre del tipo desnormalizado para consultas rápidas */
  @Column({ nullable: true })
  productTypeName: string;

  /** Código único de verificación (UUID corto) */
  @Column({ unique: true })
  verificationCode: string;

  /** URL del PDF en el storage (Cloudinary, B2 o local) - Formato DIPLOMA */
  @Column({ nullable: true, type: 'text' })
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  /** URL del PDF en el storage - Formato CARTA */
  @Column({ nullable: true, type: 'text' })
  fileUrlCarta: string;

  @Column({ nullable: true })
  fileNameCarta: string;

  /** Fecha en que se emitió el certificado */
  @Column({ type: 'timestamptz' })
  issuedAt: Date;

  /** Fecha en que se envió el correo (null = pendiente) */
  @Column({ nullable: true, type: 'timestamptz' })
  emailSentAt: Date;

  @ManyToOne(() => Event, { nullable: true, eager: false })
  @JoinColumn({ name: 'eventId' })
  event: Event | null;

  /** ID del evento al que pertenece (para filtros eficientes) */
  @Column({ nullable: true })
  eventId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
