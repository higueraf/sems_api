import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { EventFormat } from '../common/enums/submission-status.enum';
import { EventPageSection } from './event-page-section.entity';
import { ThematicAxis } from './thematic-axis.entity';
import { Organizer } from './organizer.entity';
import { Guideline } from './guideline.entity';
import { Submission } from './submission.entity';
import { AgendaSlot } from './agenda-slot.entity';

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  edition: string;

  @Column({ nullable: true, type: 'text' })
  tagline: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ type: 'date', nullable: true })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @Column({ nullable: true })
  location: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  country: string;

  @Column({ type: 'enum', enum: EventFormat, default: EventFormat.HYBRID })
  format: EventFormat;

  @Column({ nullable: true })
  registrationUrl: string;

  @Column({ nullable: true, type: 'text' })
  bannerImageUrl: string;

  @Column({ nullable: true, type: 'text' })
  logoUrl: string;

  @Column({ nullable: true })
  certifiedHours: number;

  @Column({ nullable: true, type: 'int' })
  expectedAttendees: number;

  @Column({ nullable: true, type: 'int' })
  maxPresentations: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  isAgendaPublished: boolean;

  @Column({ nullable: true })
  submissionDeadline: Date;

  @Column({ nullable: true })
  reviewDeadline: Date;

  @Column({ nullable: true })
  contactEmail: string;

  @Column({ nullable: true })
  contactPhone: string;

  @OneToMany(() => EventPageSection, (s) => s.event)
  pageSections: EventPageSection[];

  @OneToMany(() => ThematicAxis, (a) => a.event)
  thematicAxes: ThematicAxis[];

  @OneToMany(() => Organizer, (o) => o.event)
  organizers: Organizer[];

  @OneToMany(() => Guideline, (g) => g.event)
  guidelines: Guideline[];

  @OneToMany(() => Submission, (s) => s.event)
  submissions: Submission[];

  @OneToMany(() => AgendaSlot, (s) => s.event)
  agendaSlots: AgendaSlot[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
