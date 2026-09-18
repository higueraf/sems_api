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
import { Country } from './country.entity';

@Entity('universities')
@Unique(['name', 'countryId'])
export class University {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @ManyToOne(() => Country, { eager: true, nullable: false })
  @JoinColumn({ name: 'countryId' })
  country: Country;

  @Column()
  countryId: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  email: string;

  /** Dirección física — usada para ubicar la universidad en Google Maps. */
  @Column({ nullable: true, type: 'text' })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Column({ nullable: true, type: 'text' })
  logoUrl: string;

  /** Institución organizadora/sede del evento (ej. UMAYOR) — activa reglas y campos especiales para sus estudiantes. */
  @Column({ default: false })
  isHostInstitution: boolean;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
