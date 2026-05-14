import {
  IsString, IsOptional, IsBoolean, IsEnum, IsDateString, IsUUID, IsNumber, IsArray,
} from 'class-validator';
import { AgendaSlotType } from '../../../common/enums/submission-status.enum';

export class CreateAgendaSlotDto {
  @IsUUID()
  eventId: string;

  @IsEnum(AgendaSlotType)
  type: AgendaSlotType;

  @IsDateString()
  day: string;

  @IsString()
  startTime: string;

  @IsString()
  endTime: string;

  @IsString()
  @IsOptional()
  room?: string;

  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsUUID()
  @IsOptional()
  submissionId?: string;

  @IsUUID()
  @IsOptional()
  thematicAxisId?: string;

  @IsString()
  @IsOptional()
  speakerName?: string;

  @IsString()
  @IsOptional()
  speakerAffiliation?: string;

  @IsString()
  @IsOptional()
  moderatorName?: string;

  @IsNumber()
  @IsOptional()
  displayOrder?: number;
}

export class UpdateAgendaSlotDto extends CreateAgendaSlotDto {
  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}

export class ReorderSlotsDto {
  @IsArray()
  @IsUUID('all', { each: true })
  orderedIds: string[];
}

export class DeleteAgendaSlotDto {
  @IsString()
  reason: string;

  @IsString()
  @IsOptional()
  revertStatus?: string; // defaults to 'approved' in service
}

