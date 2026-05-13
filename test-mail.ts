import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MailService } from './src/modules/mail/mail.service';
import * as fs from 'fs';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const mailService = app.get(MailService);

  const testPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n111\n%%EOF');

  try {
    const success = await mailService.sendCertificateEmail(
      'franciscohiguera@gmail.com', // Replace with a test email or the developer's email
      'Test User',
      'Test Certificate Email',
      '<p>Test</p>',
      'sub-uuid',
      'user-uuid',
      [{ buffer: testPdf, fileName: 'test-diploma.pdf' }]
    );
    console.log('Success:', success);
  } catch (err) {
    console.error('Error sending:', err);
  }

  await app.close();
}
bootstrap();
