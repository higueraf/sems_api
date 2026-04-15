import { IsString, IsOptional, IsEnum, IsBoolean, IsNumber, IsUUID } from 'class-validator';
import { GuidelineCategory } from '../../../common/enums/submission-status.enum';

export class CreateGuidelineDto {
  @IsUUID()
  eventId: string;

  @IsString()
  title: string;

  @IsString()
  content: string;

  @IsEnum(GuidelineCategory)
  @IsOptional()
  category?: GuidelineCategory;

  @IsString()
  @IsOptional()
  iconName?: string;

  @IsNumber()
  @IsOptional()
  displayOrder?: number;

  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;

  @IsUUID()
  @IsOptional()
  productTypeId?: string | null;
}

export class UpdateGuidelineDto extends CreateGuidelineDto {}
