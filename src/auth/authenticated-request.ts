import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  userId: string;
  email: string;
  role: string;
}

export type AuthenticatedRequest = Request & {
  user: AuthenticatedUser;
};

export type AuthenticatedRawBodyRequest = RawBodyRequest<Request> & {
  user: AuthenticatedUser;
};
