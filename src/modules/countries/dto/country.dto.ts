import { IsString, IsOptional, IsBoolean, Length } from 'class-validator';

export class CreateCountryDto {
  @IsString()
  name: string;

  @IsString()
  @Length(2, 2)
  isoCode: string;

  @IsString()
  @IsOptional()
  flagEmoji?: string;

  @IsString()
  @IsOptional()
  flagIconUrl?: string;
}

export class UpdateCountryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @Length(2, 2)
  @IsOptional()
  isoCode?: string;

  @IsString()
  @IsOptional()
  flagEmoji?: string;

  @IsString()
  @IsOptional()
  flagIconUrl?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
