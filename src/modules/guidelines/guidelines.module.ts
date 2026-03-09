import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GuidelinesController } from './guidelines.controller';
import { GuidelinesService } from './guidelines.service';
import { Guideline } from '../../entities/guideline.entity';

// MulterModule eliminado — ya no usamos diskStorage
// StorageService viene del StorageModule global (@Global)

@Module({
  imports: [TypeOrmModule.forFeature([Guideline])],
  controllers: [GuidelinesController],
  providers: [GuidelinesService],
})
export class GuidelinesModule {}
