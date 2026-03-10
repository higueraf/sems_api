import {
  IsString, IsOptional, IsBoolean, IsEmail, IsArray, ValidateNested,
  IsUUID, ArrayMinSize, ArrayMaxSize, MaxLength, IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class SubmissionAuthorDto {
  @IsString()
  fullName: string;

  @IsString()
  @IsOptional()
  academicTitle?: string;

  @IsString()
  @IsOptional()
  affiliation?: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsOptional()
  orcid?: string;

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
  status?: string; // undefined = todos los estados
}

export class AssignEvaluatorDto {
  @IsUUID()
  evaluatorId: string;
}
