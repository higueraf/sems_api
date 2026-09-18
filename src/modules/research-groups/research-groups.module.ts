import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ResearchGroupsController } from './research-groups.controller';
import { ResearchGroupsService } from './research-groups.service';
import { ResearchGroup } from '../../entities/research-group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ResearchGroup])],
  controllers: [ResearchGroupsController],
  providers: [ResearchGroupsService],
  exports: [ResearchGroupsService],
})
export class ResearchGroupsModule {}
