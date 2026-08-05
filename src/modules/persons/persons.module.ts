import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../../entities/person.entity';
import { SubmissionAuthor } from '../../entities/submission-author.entity';
import { PersonsService } from './persons.service';
import { PersonsController } from './persons.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Person, SubmissionAuthor])],
  providers: [PersonsService],
  controllers: [PersonsController],
  exports: [PersonsService],
})
export class PersonsModule {}
