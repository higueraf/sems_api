import { IsOptional, IsString } from 'class-validator';

export class UpdateSubmissionDto {
  @IsOptional()
  @IsString()
  titleEs?: string;

  @IsOptional()
  @IsString()
  titleEn?: string;

  @IsOptional()
  @IsString()
  abstractEs?: string;

  @IsOptional()
  @IsString()
  abstractEn?: string;

  @IsOptional()
  @IsString()
  keywordsEs?: string;

  @IsOptional()
  @IsString()
  keywordsEn?: string;
}
