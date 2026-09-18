import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { University } from './university.entity';

/** Semillero de investigación. */
@Entity('research_groups')
@Unique(['name', 'universityId'])
export class ResearchGroup {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => University, { eager: true, nullable: false })
  @JoinColumn({ name: 'universityId' })
  university: University;

  @Column()
  universityId: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
