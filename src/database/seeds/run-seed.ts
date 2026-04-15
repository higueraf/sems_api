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

dotenv.config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'sems_db',
  entities: [
    User, Country, Event, EventVideo, EventPageSection, ScientificProductType,
    ThematicAxis, Organizer, Guideline, Submission, SubmissionAuthor,
    SubmissionStatusHistory, SubmissionFile, AgendaSlot, EmailLog,
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
