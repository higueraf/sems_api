import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { CertificatesService } from './src/modules/certificates/certificates.service';
import { Submission } from './src/entities/submission.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const certService = app.get(CertificatesService);
  const submissionRepo = app.get<Repository<Submission>>(getRepositoryToken(Submission));

  const submissions = await submissionRepo.find({ relations: ['authors'] });
  const submission = submissions[0];
  if (!submission) {
    console.log('No submissions found');
    await app.close();
    return;
  }

  try {
    const res = await certService.generateAndSend({
      submissionId: submission.id,
      productTypeId: submission.productTypeId,
    }, { id: 'admin' } as any);
    console.log('Generate and send result:', res);
  } catch (err) {
    console.error('Error:', err);
  }

  await app.close();
}
bootstrap();
