import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Organizer } from './organizer.entity';
import { Country } from './country.entity';

export enum MemberRole {
  RECTOR       = 'rector',
  VICE_RECTOR  = 'vice_rector',
  DEAN         = 'dean',
  DIRECTOR     = 'director',
  RESEARCHER   = 'researcher',
  COORDINATOR  = 'coordinator',
  SPEAKER      = 'speaker',
  PANELIST     = 'panelist',
  COMMITTEE    = 'committee',
  CONTACT      = 'contact',
  OTHER        = 'other',
}

@Entity('organizer_members')
export class OrganizerMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Institución a la que pertenece este miembro */
  @ManyToOne(() => Organizer, (o) => o.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizerId' })
  organizer: Organizer;

  @Column()
  organizerId: string;

  @Column()
  fullName: string;

  /** Título académico: Dr., Mg., PhD., Lic., etc. */
  @Column({ nullable: true })
  academicTitle: string;

  /** Cargo dentro de la institución (ej. "Rector", "Vicerrectora de Investigación") */
  @Column({ nullable: true })
  institutionalPosition: string;

  /** Rol/función que desempeña en el simposio */
  @Column({ type: 'enum', enum: MemberRole, default: MemberRole.COMMITTEE })
  role: MemberRole;

  /** Descripción libre del rol en el simposio (ej. "Presidente del Comité Científico") */
  @Column({ nullable: true })
  roleLabel: string;

  @Column({ nullable: true, type: 'text' })
  bio: string;

  @Column({ nullable: true })
  email: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true, type: 'text' })
  photoUrl: string;

  @ManyToOne(() => Country, { nullable: true, eager: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column({ nullable: true })
  countryId: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isVisible: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
