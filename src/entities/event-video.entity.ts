import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn,
} from 'typeorm';
import { Event } from './event.entity';

@Entity('event_videos')
export class EventVideo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (e) => e.videos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: Event;

  @Column()
  eventId: string;

  /** Título descriptivo del video */
  @Column()
  title: string;

  /** Descripción opcional */
  @Column({ nullable: true, type: 'text' })
  description: string;

  /**
   * URL completa del video de YouTube.
   * Ej: https://www.youtube.com/watch?v=VIDEO_ID
   *     https://youtu.be/VIDEO_ID
   *     https://www.youtube.com/embed/VIDEO_ID
   */
  @Column({ type: 'text' })
  youtubeUrl: string;

  /** Orden de visualización */
  @Column({ default: 0 })
  displayOrder: number;

  @CreateDateColumn()
  createdAt: Date;
}
