import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../../entities/person.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionFile } from '../../entities/submission-file.entity';
import { Certificate } from '../../entities/certificate.entity';
import { User } from '../../entities/user.entity';
import { StorageModule } from '../storage/storage.module';
import { PersonsModule } from '../persons/persons.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { PortalService } from './portal.service';
import { PortalController } from './portal.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Person, SubmissionAuthor, Submission, SubmissionFile, Certificate, User]),
    StorageModule,
    PersonsModule,
    SubmissionsModule,
  ],
  providers: [PortalService],
  controllers: [PortalController],
})
export class PortalModule {}
