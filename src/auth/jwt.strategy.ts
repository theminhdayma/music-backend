import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ||
        'super_secret_jwt_key_for_stemverse_token_signing',
    });
  }

  validate(payload: JwtPayload): {
    userId: string;
    id: string;
    email: string;
    role: string;
  } {
    return {
      userId: payload.sub,
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  }
}
