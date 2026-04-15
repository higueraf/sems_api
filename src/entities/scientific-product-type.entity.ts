import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Submission } from './submission.entity';

@Entity('scientific_product_types')
export class ScientificProductType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true, type: 'int' })
  maxAuthors: number;

  @Column({ nullable: true, type: 'int' })
  minPages: number;

  @Column({ nullable: true, type: 'int' })
  maxPages: number;

  @Column({ nullable: true, type: 'int' })
  maxPresentationMinutes: number;

  @Column({ nullable: true, type: 'text' })
  formatGuidelinesHtml: string;

  @Column({ default: true })
  requiresFile: boolean;

  /**
   * Formatos de archivo permitidos para este tipo de producto.
   * Valores separados por coma: "docx", "pptx", "pdf"
   * Ejemplo: "docx,pdf" o "pptx" o "docx,pptx,pdf"
   * Null significa solo Word (comportamiento legacy).
   */
  @Column({ nullable: true, type: 'text' })
  allowedFileFormats: string;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Submission, (s) => s.productType)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
