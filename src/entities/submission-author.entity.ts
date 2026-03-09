import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Submission } from './submission.entity';
import { Country } from './country.entity';

@Entity('submission_authors')
export class SubmissionAuthor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Submission, (s) => s.authors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submissionId' })
  submission: Submission;

  @Column()
  submissionId: string;

  @Column()
  fullName: string;

  @Column({ nullable: true })
  academicTitle: string;

  @Column({ nullable: true })
  affiliation: string;

  @Column()
  email: string;

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

  @Column({ default: false })
  isCorresponding: boolean;

  @Column({ default: 0 })
  authorOrder: number;

  /**
   * Foto del ponente — subida por admin/evaluador tras la aprobación
   * del trabajo, para publicarla en la agenda definitiva.
   */
  @Column({ nullable: true, type: 'text' })
  photoUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
