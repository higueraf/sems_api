import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('workshops')
export class Workshop {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  /** Título del taller */
  @Column()
  title: string;

  /** Descripción del taller */
  @Column({ nullable: true, type: 'text' })
  description: string;

  /** Nombre del instructor/facilitador */
  @Column({ nullable: true })
  instructor: string;

  /** Duración en horas */
  @Column({ nullable: true })
  duration: number;

  /** Cupo máximo de participantes */
  @Column({ nullable: true })
  maxCapacity: number;

  /** Requisitos previos */
  @Column({ nullable: true, type: 'text' })
  prerequisites: string;

  /** URL de inscripción al taller */
  @Column({ nullable: true })
  registrationUrl: string;

  /** URL del material o recursos del taller */
  @Column({ nullable: true })
  materialsUrl: string;

  /**
   * URL completa del video de YouTube del taller.
   * Ej: https://www.youtube.com/watch?v=VIDEO_ID
   *     https://youtu.be/VIDEO_ID
   *     https://www.youtube.com/embed/VIDEO_ID
   */
  @Column({ nullable: true, type: 'text' })
  youtubeUrl: string;

  /** Orden de visualización */
  @Column({ default: 0 })
  displayOrder: number;

  /** Estado del taller: 'active', 'completed', 'cancelled' */
  @Column({ default: 'active' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
