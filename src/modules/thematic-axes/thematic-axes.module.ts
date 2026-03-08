import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThematicAxesController } from './thematic-axes.controller';
import { ThematicAxesService } from './thematic-axes.service';
import { ThematicAxis } from '../../entities/thematic-axis.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ThematicAxis])],
  controllers: [ThematicAxesController],
  providers: [ThematicAxesService],
  exports: [ThematicAxesService],
})
export class ThematicAxesModule {}
