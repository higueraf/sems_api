import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, OneToMany, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';
import { Submission } from './submission.entity';
import { AgendaSlot } from './agenda-slot.entity';

@Entity('thematic_axes')
export class ThematicAxis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.thematicAxes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  @Column()
  name: string;

  @Column({ nullable: true, type: 'text' })
  description: string;

  @Column({ nullable: true })
  color: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: 0 })
  displayOrder: number;

  @Column({ default: true })
  isActive: boolean;

  @OneToMany(() => Submission, (s) => s.thematicAxis)
  submissions: Submission[];

  @OneToMany(() => AgendaSlot, (s) => s.thematicAxis)
  agendaSlots: AgendaSlot[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
