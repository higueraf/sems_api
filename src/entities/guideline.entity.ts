import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { GuidelineCategory } from '../common/enums/submission-status.enum';

@Entity('guidelines')
export class Guideline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.guidelines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @Column()
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: GuidelineCategory, default: GuidelineCategory.GENERAL })
  category: GuidelineCategory;

  @Column({ nullable: true })
  iconName: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isVisible: boolean;

  @Column({ nullable: true, type: 'text' })
  fileUrl: string | null;

  @Column({ nullable: true })
  fileName: string | null;

  @Column({ nullable: true })
  fileMimeType: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
