import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsNumber,
} from 'class-validator';

export class UpdateSongDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  genre?: string;

  @IsNumber()
  @IsOptional()
  bpm?: number;

  @IsString()
  @IsOptional()
  key?: string;

  @IsString()
  @IsOptional()
  mood?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsString()
  @IsOptional()
  lyrics?: string;

  @IsArray()
  @IsOptional()
  instruments?: string[];

  @IsString()
  @IsOptional()
  vocalType?: string;

  @IsString()
  @IsOptional()
  licenseType?: string;

  @IsBoolean()
  @IsOptional()
  remixAllowed?: boolean;

  @IsBoolean()
  @IsOptional()
  commercialAllowed?: boolean;

  @IsBoolean()
  @IsOptional()
  aiVoiceCloningAllowed?: boolean;

  @IsNumber()
  @IsOptional()
  royaltySplitRemixer?: number;

  @IsNumber()
  @IsOptional()
  royaltySplitPlatform?: number;

  @IsBoolean()
  @IsOptional()
  isPublished?: boolean;
}
