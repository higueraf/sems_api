import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum EmailType {
  SUBMISSION_RECEIVED = 'submission_received',
  STATUS_CHANGED = 'status_changed',
  CUSTOM = 'custom',
  SCHEDULE_ASSIGNED = 'schedule_assigned',
  REVISION_REQUESTED = 'revision_requested',
  CERTIFICATE = 'certificate',
}

@Entity('email_logs')
export class EmailLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  toEmail: string;

  @Column({ nullable: true })
  toName: string;

  @Column()
  subject: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'enum', enum: EmailType, default: EmailType.CUSTOM })
  type: EmailType;

  @Column({ nullable: true })
  relatedSubmissionId: string;

  @Column({ default: false })
  success: boolean;

  @Column({ nullable: true, type: 'text' })
  errorMessage: string;

  @Column({ nullable: true })
  sentById: string;

  @CreateDateColumn()
  createdAt: Date;
}
