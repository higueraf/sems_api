import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateResearchGroupDto {
  @IsString()
  name: string;

  @IsUUID()
  universityId: string;
}

export class UpdateResearchGroupDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsUUID()
  @IsOptional()
  universityId?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
