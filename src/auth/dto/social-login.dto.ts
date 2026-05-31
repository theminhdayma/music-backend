import { IsEmail, IsString, IsOptional, MaxLength } from 'class-validator';

export class SocialLoginDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsString()
  avatarUrl?: string;

  @IsOptional()
  @IsString()
  role?: string;
}
