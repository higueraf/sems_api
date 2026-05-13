import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { SubmissionAuthor } from './submission-author.entity';
import { ScientificProductType } from './scientific-product-type.entity';

@Entity('certificates')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número correlativo único, formato CERT-YYYY-NNNN */
  @Column({ unique: true })
  certificateNumber: string;

  @ManyToOne(() => Submission, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  submissionId: string;

  @ManyToOne(() => SubmissionAuthor, { onDelete: 'CASCADE', eager: true })
  @JoinColumn({ name: 'authorId' })
  author: SubmissionAuthor;

  @Column()
  authorId: string;

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

  /** ID del evento al que pertenece (para filtros eficientes) */
  @Column({ nullable: true })
  eventId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
