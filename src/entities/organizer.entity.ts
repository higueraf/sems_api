import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { Country } from './country.entity';
import { OrganizerRole, OrganizerType } from '../common/enums/submission-status.enum';

@Entity('organizers')
export class Organizer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.organizers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @Column({ type: 'enum', enum: OrganizerType, default: OrganizerType.INSTITUTION })
  type: OrganizerType;

  @Column()
  name: string;

  @Column({ nullable: true })
  shortName: string;

  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ type: 'enum', enum: OrganizerRole, default: OrganizerRole.CO_ORGANIZER })
  role: OrganizerRole;

  @ManyToOne(() => Country, { nullable: true, eager: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column({ nullable: true })
  countryId: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  website: string;

  @Column({ nullable: true, type: 'text' })
  logoUrl: string;

  @Column({ nullable: true, type: 'text' })
  photoUrl: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isVisible: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
