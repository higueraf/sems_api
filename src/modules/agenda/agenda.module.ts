import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { AgendaSlot } from '../../entities/agenda-slot.entity';
import { Submission } from '../../entities/submission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AgendaSlot, Submission])],
  controllers: [AgendaController],
  providers: [AgendaService],
  exports: [AgendaService],
})
export class AgendaModule {}
