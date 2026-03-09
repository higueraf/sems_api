import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizersController } from './organizers.controller';
import { OrganizersService } from './organizers.service';
import { Organizer } from '../../entities/organizer.entity';
import { OrganizerMember } from '../../entities/organizer-member.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Organizer, OrganizerMember])],
  controllers: [OrganizersController],
  providers: [OrganizersService],
})
export class OrganizersModule {}
