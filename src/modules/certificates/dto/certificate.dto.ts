import { IsUUID, IsOptional, IsString, IsArray, IsIn } from 'class-validator';

export type CertificateStyle = 'diploma' | 'carta';

export class GenerateCertificatesDto {
  @IsUUID()
  submissionId: string;

  @IsUUID()
  productTypeId: string;
}

export class SendCertificatesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  certificateIds: string[];
}

export class BulkGenerateAndSendDto {
  @IsUUID()
  eventId: string;

  @IsUUID()
  @IsOptional()
  productTypeId?: string;
}

export class CertificateFiltersDto {
  @IsUUID()
  @IsOptional()
  eventId?: string;

  @IsUUID()
  @IsOptional()
  productTypeId?: string;

  @IsString()
  @IsOptional()
  sent?: string; // 'true' | 'false'

  @IsString()
  @IsOptional()
  submissionId?: string;
}
