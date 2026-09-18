import { IsString, IsOptional, IsBoolean, IsUUID } from 'class-validator';

export class CreateFacultyDto {
  @IsString()
  name: string;

  @IsUUID()
  universityId: string;
}

export class UpdateFacultyDto {
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
