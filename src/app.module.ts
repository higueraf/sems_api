import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD, APP_FILTER } from '@nestjs/core';
import configuration from './config/configuration';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CountriesModule } from './modules/countries/countries.module';
import { EventsModule } from './modules/events/events.module';
import { PageSectionsModule } from './modules/page-sections/page-sections.module';
import { ThematicAxesModule } from './modules/thematic-axes/thematic-axes.module';
import { OrganizersModule } from './modules/organizers/organizers.module';
import { GuidelinesModule } from './modules/guidelines/guidelines.module';
import { ScientificProductTypesModule } from './modules/scientific-product-types/scientific-product-types.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { AgendaModule } from './modules/agenda/agenda.module';
import { MailModule } from './modules/mail/mail.module';
import { HealthModule } from './modules/health/health.module';
import { StorageModule } from './modules/storage/storage.module';

import { User } from './entities/user.entity';
import { Country } from './entities/country.entity';
import { Event } from './entities/event.entity';
import { EventPageSection } from './entities/event-page-section.entity';
import { ScientificProductType } from './entities/scientific-product-type.entity';
import { ThematicAxis } from './entities/thematic-axis.entity';
import { Organizer } from './entities/organizer.entity';
import { OrganizerMember } from './entities/organizer-member.entity';
import { Guideline } from './entities/guideline.entity';
import { Submission } from './entities/submission.entity';
import { SubmissionAuthor } from './entities/submission-author.entity';
import { SubmissionStatusHistory } from './entities/submission-status-history.entity';
import { SubmissionFile } from './entities/submission-file.entity';
import { AgendaSlot } from './entities/agenda-slot.entity';
import { EmailLog } from './entities/email-log.entity';
import { EventVideo } from './entities/event-video.entity';
import { Workshop } from './entities/workshop.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        //ssl: config.get<boolean>('database.ssl')
          //? { rejectUnauthorized: false }
          //: false,
        entities: [
          User, Country, Event, EventVideo, EventPageSection, ScientificProductType,
          ThematicAxis, Organizer, OrganizerMember, Guideline, Submission,
          SubmissionAuthor, SubmissionStatusHistory, SubmissionFile,
          AgendaSlot, EmailLog, Workshop,
        ],
        synchronize: true,
        logging: false,
      }),
      inject: [ConfigService],
    }),
    StorageModule,
    HealthModule,
    MailModule,
    AuthModule,
    UsersModule,
    CountriesModule,
    EventsModule,
    PageSectionsModule,
    ThematicAxesModule,
    OrganizersModule,
    GuidelinesModule,
    ScientificProductTypesModule,
    SubmissionsModule,
    AgendaModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
