import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { ThematicAxis } from './thematic-axis.entity';
import { ScientificProductType } from './scientific-product-type.entity';
import { Country } from './country.entity';
import { SubmissionAuthor } from './submission-author.entity';
import { SubmissionStatusHistory } from './submission-status-history.entity';
import { SubmissionFile } from './submission-file.entity';
import { SubmissionStatus } from '../common/enums/submission-status.enum';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  referenceCode: string;

  @ManyToOne(() => Event, (e) => e.submissions, { eager: false })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @ManyToOne(() => ThematicAxis, (a) => a.submissions, { eager: true })
  @JoinColumn({ name: 'thematicAxisId' })
  thematicAxis: ThematicAxis;

  @Column()
  thematicAxisId: string;

  @ManyToOne(() => ScientificProductType, (t) => t.submissions, { eager: true })
  @JoinColumn({ name: 'productTypeId' })
  productType: ScientificProductType;

  @Column()
  productTypeId: string;

  /**
   * IDs de todos los tipos de producto científico seleccionados.
   * productTypeId apunta al primero (por compatibilidad).
   */
  @Column({ type: 'jsonb', nullable: true })
  productTypeIds: string[];

  /**
   * Estatus independiente por tipo de producto científico.
   * Clave: productTypeId, Valor: SubmissionStatus
   * Se inicializa con todos los productTypeIds en 'received' al crear la postulación.
   */
  @Column({ type: 'jsonb', nullable: true, default: {} })
  productStatuses: Record<string, string>;

  @Column()
  titleEs: string;

  @Column({ nullable: true })
  titleEn: string;

  @Column({ type: 'text' })
  abstractEs: string;

  @Column({ nullable: true, type: 'text' })
  abstractEn: string;

  @Column({ nullable: true, type: 'text' })
  keywordsEs: string;

  @Column({ nullable: true, type: 'text' })
  keywordsEn: string;

  @Column({ nullable: true, type: 'text' })
  introduction: string;

  @Column({ nullable: true, type: 'text' })
  methodology: string;

  @Column({ nullable: true, type: 'text' })
  results: string;

  @Column({ nullable: true, type: 'text' })
  discussion: string;

  @Column({ nullable: true, type: 'text' })
  conclusions: string;

  @Column({ nullable: true, type: 'text' })
  bibliography: string;

  // URL del documento ACTIVO/OFICIAL — apunta al archivo más reciente marcado isActive
  // Se actualiza automáticamente cada vez que se sube una nueva versión
  @Column({ nullable: true })
  fileUrl: string;

  @Column({ nullable: true })
  fileName: string;

  @Column({ nullable: true, type: 'decimal', precision: 5, scale: 2 })
  plagiarismScore: number;

  @Column({ nullable: true })
  plagiarismReportUrl: string;

  @Column({ type: 'enum', enum: SubmissionStatus, default: SubmissionStatus.RECEIVED })
  status: SubmissionStatus;

  @Column({ nullable: true })
  assignedEvaluatorId: string;

  @ManyToOne(() => Country, { eager: true, nullable: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column({ nullable: true })
  countryId: string;

  @Column({ nullable: true })
  usesAi: boolean;

  @Column({ nullable: true, type: 'text' })
  aiUsageDescription: string;

  @Column({ nullable: true, type: 'int' })
  pageCount: number;

  @OneToMany(() => SubmissionAuthor, (a) => a.submission, { cascade: true, eager: true })
  authors: SubmissionAuthor[];

  @OneToMany(() => SubmissionStatusHistory, (h) => h.submission, { cascade: true })
  statusHistory: SubmissionStatusHistory[];

  // Historial completo de versiones del documento
  @OneToMany(() => SubmissionFile, (f) => f.submission, { cascade: true })
  files: SubmissionFile[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
