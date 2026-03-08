import { IsString, IsOptional, IsEnum, IsBoolean, IsEmail, IsNumber, IsUUID } from 'class-validator';
import { OrganizerRole, OrganizerType } from '../../../common/enums/submission-status.enum';

export class CreateOrganizerDto {
  @IsUUID()
  eventId: string;

  @IsEnum(OrganizerType)
  type: OrganizerType;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  shortName?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsEnum(OrganizerRole)
  role: OrganizerRole;

  @IsUUID()
  @IsOptional()
  countryId?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsString()
  @IsOptional()
  logoUrl?: string;

  @IsString()
  @IsOptional()
  photoUrl?: string;

  @IsNumber()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}

export class UpdateOrganizerDto extends CreateOrganizerDto {}
