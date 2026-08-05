import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn, OneToOne,
} from 'typeorm';
import { Country } from './country.entity';
import { User } from './user.entity';

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

  @Column({ nullable: true })
  affiliation: string;

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
