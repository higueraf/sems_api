import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { Event } from '../../entities/event.entity';
import { EventVideo } from '../../entities/event-video.entity';
import { Workshop } from '../../entities/workshop.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Event, EventVideo, Workshop])],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
