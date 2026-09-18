import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, OneToOne,
} from 'typeorm';
import { Country } from './country.entity';
import { University } from './university.entity';
import { Faculty } from './faculty.entity';
import { ResearchGroup } from './research-group.entity';
import { User } from './user.entity';
import { ParticipantType } from '../common/enums/participant-type.enum';

/**
 * Registro global de autores/personas.
 * Una persona puede ser autor en múltiples postulaciones (M:M con submission_authors).
 * El campo userId vincula opcionalmente a una cuenta de usuario con role=AUTHOR.
 */
@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column({ nullable: true })
  academicTitle: string;

  @Column({ type: 'enum', enum: ParticipantType, nullable: true })
  participantType: ParticipantType;

  /** @deprecated Reemplazado por university/universityId. Se conserva solo para registros históricos. */
  @Column({ nullable: true })
  affiliation: string;

  @ManyToOne(() => University, { eager: true, nullable: true })
  @JoinColumn({ name: 'universityId' })
  university: University;

  @Column({ nullable: true })
  universityId: string;

  @ManyToOne(() => Faculty, { eager: true, nullable: true })
  @JoinColumn({ name: 'facultyId' })
  faculty: Faculty;

  @Column({ nullable: true })
  facultyId: string;

  @ManyToOne(() => ResearchGroup, { eager: true, nullable: true })
  @JoinColumn({ name: 'researchGroupId' })
  researchGroup: ResearchGroup;

  @Column({ nullable: true })
  researchGroupId: string;

  @Column({ nullable: true })
  orcid: string;

  @Column({ nullable: true })
  phone: string;

  @ManyToOne(() => Country, { eager: true, nullable: true })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column({ nullable: true })
  countryId: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  identityDocType: string;

  @Column({ nullable: true })
  identityDocNumber: string;

  @Column({ nullable: true, type: 'text' })
  photoUrl: string;

  @Column({ nullable: true, type: 'text' })
  identityDocUrl: string;

  @Column({ nullable: true })
  identityDocFileName: string;

  /** Cuenta de usuario vinculada (role=AUTHOR) — puede ser null */
  @OneToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ nullable: true })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
