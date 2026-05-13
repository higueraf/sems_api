import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { User } from './user.entity';
import { SubmissionStatus } from '../common/enums/submission-status.enum';

@Entity('submission_status_history')
export class SubmissionStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Submission, (s) => s.statusHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  submissionId: string;

  @Column({ type: 'enum', enum: SubmissionStatus, nullable: true })
  previousStatus: SubmissionStatus;

  @Column({ type: 'enum', enum: SubmissionStatus })
  newStatus: SubmissionStatus;

  @Column({ nullable: true, type: 'text' })
  notes: string;

  @Column({ nullable: true, type: 'text' })
  internalNotes: string;

  @ManyToOne(() => User, { nullable: true, eager: true })
  @JoinColumn({ name: 'changedById' })
  changedBy: User;

  @Column({ nullable: true })
  changedById: string;

  @Column({ default: false })
  notifiedApplicant: boolean;

  /** Cuando está seteado, este registro corresponde al cambio de estatus de un tipo de producto específico */
  @Column({ nullable: true })
  productTypeId: string;

  @CreateDateColumn()
  createdAt: Date;
}
