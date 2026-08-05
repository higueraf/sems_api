import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { EmailLog } from '../../entities/email-log.entity';
import { Event } from '../../entities/event.entity';
import { ThematicAxis } from '../../entities/thematic-axis.entity';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailLog, Event, ThematicAxis])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
