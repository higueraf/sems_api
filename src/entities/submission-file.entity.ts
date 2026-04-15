import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { User } from './user.entity';
import { ScientificProductType } from './scientific-product-type.entity';

export enum SubmissionFileType {
  MANUSCRIPT  = 'manuscript',   // versión del documento principal
  CORRECTION  = 'correction',   // versión con correcciones
  FINAL       = 'final',        // versión definitiva marcada por admin
}

@Entity('submission_files')
export class SubmissionFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Submission, (s) => s.files, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  submissionId: string;

  // URL en B2 — b2://bucket/key
  @Column({ type: 'text' })
  fileUrl: string;

  // Nombre original del archivo
  @Column()
  fileName: string;

  // Tamaño en bytes
  @Column({ nullable: true, type: 'int' })
  fileSize: number;

  // Tipo de versión
  @Column({
    type: 'enum',
    enum: SubmissionFileType,
    default: SubmissionFileType.MANUSCRIPT,
  })
  fileType: SubmissionFileType;

  // Número de versión — incrementado automáticamente por el service
  @Column({ default: 1 })
  version: number;

  // Nota/descripción de la versión (ej: "Correcciones solicitadas por comité")
  @Column({ nullable: true, type: 'text' })
  notes: string;

  // Si es la versión activa/oficial de la postulación
  @Column({ default: false })
  isActive: boolean;

  // Tipo de producto científico al que pertenece este archivo
  // Nullable para compatibilidad con registros anteriores
  @ManyToOne(() => ScientificProductType, { nullable: true, eager: true })
  @JoinColumn({ name: 'productTypeId' })
  productType: ScientificProductType;

  @Column({ nullable: true })
  productTypeId: string;

  // Nombre del tipo de producto (desnormalizado para mostrar sin join)
  @Column({ nullable: true })
  productTypeName: string;

  // Quién subió este archivo (admin o el sistema en la postulación inicial)
  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'uploadedById' })
  uploadedBy: User;

  @Column({ nullable: true })
  uploadedById: string;

  @CreateDateColumn()
  createdAt: Date;
}
