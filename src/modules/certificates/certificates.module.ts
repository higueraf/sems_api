import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { Certificate } from '../../entities/certificate.entity';
import { Submission } from '../../entities/submission.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';
import { Organizer } from '../../entities/organizer.entity';
import { OrganizerMember } from '../../entities/organizer-member.entity';
import { Event } from '../../entities/event.entity';
import { SubmissionStatusHistory } from '../../entities/submission-status-history.entity';
import { User } from '../../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    Certificate,
    Submission,
    SubmissionAuthor,
    ScientificProductType,
    Organizer,
    OrganizerMember,
    Event,
    SubmissionStatusHistory,
    User,
  ])],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
