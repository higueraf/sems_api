import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { Submission } from './submission.entity';
import { ThematicAxis } from './thematic-axis.entity';
import { AgendaSlotType } from '../common/enums/submission-status.enum';

@Entity('agenda_slots')
export class AgendaSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.agendaSlots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @Column({ type: 'enum', enum: AgendaSlotType, default: AgendaSlotType.PRESENTATION })
  type: AgendaSlotType;

  @Column({ type: 'date' })
  day: Date;

  @Column({ type: 'time' })
  startTime: string;

  @Column({ type: 'time' })
  endTime: string;

  @Column({ nullable: true })
  room: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @ManyToOne(() => Submission, { nullable: true, eager: true })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column({ nullable: true })
  submissionId: string;

  @ManyToOne(() => ThematicAxis, (a) => a.agendaSlots, { nullable: true, eager: true })
  @JoinColumn({ name: 'thematicAxisId' })
  thematicAxis: ThematicAxis;

  @Column({ nullable: true })
  thematicAxisId: string;

  @Column({ nullable: true })
  speakerName: string;

  @Column({ nullable: true })
  speakerAffiliation: string;

  @Column({ nullable: true })
  moderatorName: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: false })
  isPublished: boolean;

  @Column({ default: false })
  speakerNotified: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
