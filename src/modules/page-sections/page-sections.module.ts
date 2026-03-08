import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PageSectionsController } from './page-sections.controller';
import { PageSectionsService } from './page-sections.service';
import { EventPageSection } from '../../entities/event-page-section.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EventPageSection])],
  controllers: [PageSectionsController],
  providers: [PageSectionsService],
})
export class PageSectionsModule {}
