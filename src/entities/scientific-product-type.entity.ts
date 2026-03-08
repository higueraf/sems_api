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

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Submission, (s) => s.productType)
  submissions: Submission[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
