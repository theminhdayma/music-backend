import { IsOptional, IsString, MinLength } from 'class-validator';

export class GenerateRemixDto {
  @IsString()
  @MinLength(1)
  prompt: string;

  @IsString()
  @IsOptional()
  style?: string;

  @IsString()
  @IsOptional()
  title?: string;
}
