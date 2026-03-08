import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizersController } from './organizers.controller';
import { OrganizersService } from './organizers.service';
import { Organizer } from '../../entities/organizer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organizer])],
  controllers: [OrganizersController],
  providers: [OrganizersService],
})
export class OrganizersModule {}
