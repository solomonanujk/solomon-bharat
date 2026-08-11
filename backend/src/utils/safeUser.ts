import { Role, User, UserStatus } from '@prisma/client';

export interface SafeUser {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Strips passwordHash (and any other sensitive fields) before a User ever reaches a response body. */
export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
