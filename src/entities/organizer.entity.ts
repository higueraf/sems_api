import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, OneToMany,
} from 'typeorm';
import { Event } from './event.entity';
import { Country } from './country.entity';
import { OrganizerRole, OrganizerType } from '../common/enums/submission-status.enum';
import { OrganizerMember } from './organizer-member.entity';

@Entity('organizers')
export class Organizer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.organizers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  /**
   * 'institution' = universidad/organización · 'person' = persona responsable
   * Se mantiene para retrocompatibilidad con datos existentes.
   */
  @Column({ type: 'enum', enum: OrganizerType, default: OrganizerType.INSTITUTION })
  type: OrganizerType;

  @Column()
  name: string;

  @Column({ nullable: true })
  shortName: string;

  /** Título académico (solo para personas) */
  @Column({ nullable: true })
  title: string;

  /** Cargo en la institución o en el simposio (solo para personas) */
  @Column({ nullable: true })
  institutionalPosition: string;

  @Column({ type: 'enum', enum: OrganizerRole, default: OrganizerRole.CO_ORGANIZER })
  role: OrganizerRole;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @ManyToOne(() => Country, { nullable: true, eager: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column({ nullable: true })
  countryId: string;

  @Column({ nullable: true })
  website: string;

  /** Logo de la institución */
  @Column({ nullable: true, type: 'text' })
  logoUrl: string;

  /** Foto de la persona (solo para type=person) */
  @Column({ nullable: true, type: 'text' })
  photoUrl: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isVisible: boolean;

  
  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
