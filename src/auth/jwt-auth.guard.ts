import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard that requires a valid JWT token in the Authorization header.
 * Apply with @UseGuards(JwtAuthGuard) on controllers or routes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
