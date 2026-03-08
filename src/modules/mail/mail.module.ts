import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { MailService } from './mail.service';
import { EmailLog } from '../../entities/email-log.entity';

@Global()
@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailLog])],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
