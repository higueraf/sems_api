import { IsString, IsOptional, IsEnum, IsBoolean, IsEmail, IsNumber, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizerRole, OrganizerType } from '../../../common/enums/submission-status.enum';
import { MemberRole } from '../../../entities/organizer-member.entity';

// ── Organizer (institución) ──────────────────────────────────────────────────

export class CreateOrganizerDto {
  @IsUUID()
  eventId: string;

  @IsEnum(OrganizerType)
  @IsOptional()
  type?: OrganizerType;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  shortName?: string;

  @IsEnum(OrganizerRole)
  @IsOptional()
  role?: OrganizerRole;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  institutionalPosition?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID()
  @IsOptional()
  countryId?: string;

  @IsString()
  @IsOptional()
  website?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}

export class UpdateOrganizerDto extends CreateOrganizerDto {}

// ── OrganizerMember (persona vinculada a una institución) ────────────────────

export class CreateMemberDto {
  @IsString()
  fullName: string;

  @IsString()
  @IsOptional()
  academicTitle?: string;

  @IsString()
  @IsOptional()
  institutionalPosition?: string;

  @IsEnum(MemberRole)
  @IsOptional()
  role?: MemberRole;

  @IsString()
  @IsOptional()
  roleLabel?: string;

  @IsString()
  @IsOptional()
  bio?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsUUID()
  @IsOptional()
  countryId?: string;

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}

export class UpdateMemberDto extends CreateMemberDto {}
