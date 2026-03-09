import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { Submission } from '../../entities/submission.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, SubmissionStatusHistory, SubmissionAuthor])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
