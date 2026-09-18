import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { seed } from './initial-data.seed';
import { User } from '../../entities/user.entity';
import { Country } from '../../entities/country.entity';
import { Event } from '../../entities/event.entity';
import { EventPageSection } from '../../entities/event-page-section.entity';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';
import { ThematicAxis } from '../../entities/thematic-axis.entity';
import { Organizer } from '../../entities/organizer.entity';
import { Guideline } from '../../entities/guideline.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { SubmissionFile } from '../../entities/submission-file.entity';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { EmailLog } from '../../entities/email-log.entity';
import { EventVideo } from '../../entities/event-video.entity';
import { OrganizerMember } from '../../entities/organizer-member.entity';
import { Workshop } from '../../entities/workshop.entity';
import { Certificate } from '../../entities/certificate.entity';
import { Person } from '../../entities/person.entity';
import { University } from '../../entities/university.entity';
import { Faculty } from '../../entities/faculty.entity';
import { ResearchGroup } from '../../entities/research-group.entity';

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'sems_db',
  // Debe incluir TODAS las entidades registradas en app.module.ts — TypeORM
  // necesita la metadata de cualquier entidad referenciada por una relación,
  // aunque este script no la use directamente (si falta una, falla el build
  // de metadatos de relaciones inversas al iniciar el DataSource).
  entities: [
    User, Country, Event, EventVideo, EventPageSection, ScientificProductType,
    ThematicAxis, Organizer, OrganizerMember, Guideline, Submission, SubmissionAuthor,
    SubmissionStatusHistory, SubmissionFile, AgendaSlot, EmailLog, Workshop,
    Certificate, Person, University, Faculty, ResearchGroup,
  ],
  synchronize: true,
});

async function runSeed() {
  await dataSource.initialize();
  console.log('📦 Database connected. Running seed...\n');
  await seed(dataSource);
  await dataSource.destroy();
}

runSeed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
