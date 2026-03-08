import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { GuidelinesController } from './guidelines.controller';
import { GuidelinesService } from './guidelines.service';
import { Guideline } from '../../entities/guideline.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Guideline]),
    MulterModule.register({
      dest: join(process.cwd(), 'uploads', 'guidelines'),
    }),
  ],
  controllers: [GuidelinesController],
  providers: [GuidelinesService],
})
export class GuidelinesModule {}
