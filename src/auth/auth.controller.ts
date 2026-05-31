import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService, AuthResponse, SafeUser } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './authenticated-request';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * Register a new user with email/password.
   */
  @Post('register')
  async register(@Body() dto: RegisterDto): Promise<AuthResponse> {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/login
   * Authenticate and receive JWT access token.
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<AuthResponse> {
    return this.authService.login(dto);
  }

  /**
   * POST /auth/social-login
   * Authenticate or register a user via social login (Google).
   */
  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  async socialLogin(@Body() dto: SocialLoginDto): Promise<AuthResponse> {
    return this.authService.socialLogin(dto);
  }

  /**
   * GET /auth/me
   * Get current authenticated user's profile.
   * Requires valid JWT in Authorization header.
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: AuthenticatedRequest): Promise<SafeUser> {
    return this.authService.getProfile(req.user.userId);
  }
}
