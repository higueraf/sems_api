import {
  IsString, IsOptional, IsBoolean, IsEmail, IsArray, ValidateNested,
  IsUUID, ArrayMinSize, ArrayMaxSize, MaxLength, IsNumber, IsNotEmpty,
  IsUrl, Matches,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SubmissionAuthorDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es requerido' })
  fullName: string;

  // Título académico — select en frontend (Estudiante, Mg., PhD., etc.)
  @IsString()
  @IsNotEmpty({ message: 'El título académico es requerido' })
  academicTitle: string;

  @IsString()
  @IsOptional()
  affiliation?: string;

  // Tipo de correo: 'institutional' | 'personal'
  @IsString()
  @IsNotEmpty({ message: 'El tipo de correo es requerido' })
  emailType: string;

  // Email institucional o personal — obligatorio
  @IsEmail({}, { message: 'El email del autor no es válido' })
  email: string;

  // ORCID — obligatorio, debe ser URL completa
  @IsString()
  @IsNotEmpty({ message: 'El ORCID es requerido' })
  @IsUrl({}, { message: 'El ORCID debe ser una URL válida' })
  @Matches(/^https:\/\/orcid\.org\/\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/, { message: 'El ORCID debe tener el formato https://orcid.org/XXXX-XXXX-XXXX-XXXX' })
  orcid: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID()
  @IsOptional()
  countryId?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsBoolean()
  @IsOptional()
  isCorresponding?: boolean;

  @IsNumber()
  @IsOptional()
  authorOrder?: number;

  // Tipo: 'Cédula Nacional' | 'Cédula Internacional' | 'Pasaporte'
  @IsString()
  @IsNotEmpty({ message: 'El tipo de documento es requerido' })
  identityDocType: string;

  // Número del documento
  @IsString()
  @IsNotEmpty({ message: 'El número de documento es requerido' })
  identityDocNumber: string;
}

export class CreateSubmissionDto {
  @IsUUID()
  eventId: string;

  @IsUUID()
  thematicAxisId: string;

  @IsUUID()
  productTypeId: string;

  @IsString()
  titleEs: string;

  @IsString()
  @IsOptional()
  titleEn?: string;

  @IsString()
  @MaxLength(5000)
  abstractEs: string;

  @IsString()
  @IsOptional()
  abstractEn?: string;

  @IsString()
  @IsOptional()
  keywordsEs?: string;

  @IsString()
  @IsOptional()
  keywordsEn?: string;

  @IsString()
  @IsOptional()
  introduction?: string;

  @IsString()
  @IsOptional()
  methodology?: string;

  @IsString()
  @IsOptional()
  results?: string;

  @IsString()
  @IsOptional()
  discussion?: string;

  @IsString()
  @IsOptional()
  conclusions?: string;

  @IsString()
  @IsOptional()
  bibliography?: string;

  @IsUUID()
  @IsOptional()
  countryId?: string;

  @IsBoolean()
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  usesAi?: boolean;

  @IsString()
  @IsOptional()
  aiUsageDescription?: string;

  @IsNumber()
  @IsOptional()
  @Transform(({ value }) => (value !== undefined && value !== '' ? Number(value) : undefined))
  pageCount?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SubmissionAuthorDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  authors: SubmissionAuthorDto[];
}

export class UpdateSubmissionStatusDto {
  @IsString()
  newStatus: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  internalNotes?: string;

  @IsBoolean()
  @IsOptional()
  notifyApplicant?: boolean;
}

export class SendCustomEmailDto {
  @IsString()
  subject: string;

  @IsString()
  body: string;

  // Adjunto Word en base64 (para envío desde JSON body)
  @IsString()
  @IsOptional()
  attachmentBase64?: string;

  @IsString()
  @IsOptional()
  attachmentName?: string;
}

export class BulkEmailDto {
  @IsString()
  subject: string;

  @IsString()
  body: string;

  @IsUUID()
  eventId: string;

  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  attachmentBase64?: string;

  @IsString()
  @IsOptional()
  attachmentName?: string;
}

export class AssignEvaluatorDto {
  @IsUUID()
  evaluatorId: string;
}
