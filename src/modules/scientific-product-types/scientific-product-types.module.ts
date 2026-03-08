import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScientificProductTypesController } from './scientific-product-types.controller';
import { ScientificProductTypesService } from './scientific-product-types.service';
import { ScientificProductType } from '../../entities/scientific-product-type.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ScientificProductType])],
  controllers: [ScientificProductTypesController],
  providers: [ScientificProductTypesService],
  exports: [ScientificProductTypesService],
})
export class ScientificProductTypesModule {}
