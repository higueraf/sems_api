import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailLog } from './src/entities/email-log.entity';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const logRepo = app.get<Repository<EmailLog>>(getRepositoryToken(EmailLog));

  const errors = await logRepo.find({
    where: { success: false },
    order: { createdAt: 'DESC' },
    take: 10
  });

  console.log('Recent email errors:', JSON.stringify(errors, null, 2));
  await app.close();
}
bootstrap();
