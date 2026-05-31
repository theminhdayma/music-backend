import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsNumber,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MultipartPartDto {
  @IsNumber()
  @IsNotEmpty()
  PartNumber: number;

  @IsString()
  @IsNotEmpty()
  ETag: string;
}

export class CompleteUploadDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MultipartPartDto)
  parts: MultipartPartDto[];

  @IsString()
  @IsNotEmpty()
  songId: string;
}
