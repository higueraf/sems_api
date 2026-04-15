import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString, IsNumber, IsEmail,
} from 'class-validator';
import { EventFormat } from '../../../common/enums/submission-status.enum';

export class CreateEventDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  edition?: string;

  @IsString()
  @IsOptional()
  tagline?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsEnum(EventFormat)
  @IsOptional()
  format?: EventFormat;

  @IsString()
  @IsOptional()
  registrationUrl?: string;

  @IsString()
  @IsOptional()
  bannerImageUrl?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsNumber()
  @IsOptional()
  certifiedHours?: number;

  @IsNumber()
  @IsOptional()
  expectedAttendees?: number;

  @IsNumber()
  @IsOptional()
  maxPresentations?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsDateString()
  @IsOptional()
  submissionDeadline?: string;

  @IsDateString()
  @IsOptional()
  reviewDeadline?: string;

  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @IsString()
  @IsOptional()
  contactPhone?: string;
}

export class UpdateEventDto extends CreateEventDto {}

export class CreateEventVideoDto {
  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  youtubeUrl: string;

  @IsNumber()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateEventVideoDto extends CreateEventVideoDto {}
