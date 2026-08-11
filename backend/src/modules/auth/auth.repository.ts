import { PrismaClient, Role, User } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { SignupBuyerInput } from './auth.types';

export class AuthRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  findUserByEmail(email: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { email } });
  }

  findUserById(id: string): Promise<User | null> {
    return this.db.user.findUnique({ where: { id } });
  }

  async createBuyerUser(input: SignupBuyerInput, passwordHash: string): Promise<User> {
    return this.db.user.create({
      data: {
        email: input.email,
        passwordHash,
        role: Role.BUYER,
        buyerProfile: {
          create: {
            contactName: input.contactName,
            country: input.country,
            companyName: input.companyName,
            phone: input.phone,
          },
        },
      },
    });
  }

  updateUserPassword(userId: string, passwordHash: string): Promise<User> {
    return this.db.user.update({ where: { id: userId }, data: { passwordHash } });
  }

  markEmailVerified(userId: string): Promise<User> {
    return this.db.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  }

  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.refreshToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findRefreshTokenById(id: string) {
    return this.db.refreshToken.findUnique({ where: { id } });
  }

  revokeRefreshToken(id: string) {
    return this.db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
  }

  revokeAllRefreshTokensForUser(userId: string) {
    return this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  createEmailVerificationToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.emailVerificationToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findEmailVerificationTokenById(id: string) {
    return this.db.emailVerificationToken.findUnique({ where: { id } });
  }

  markEmailVerificationTokenUsed(id: string) {
    return this.db.emailVerificationToken.update({ where: { id }, data: { usedAt: new Date() } });
  }

  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date) {
    return this.db.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  }

  findPasswordResetTokenById(id: string) {
    return this.db.passwordResetToken.findUnique({ where: { id } });
  }

  markPasswordResetTokenUsed(id: string) {
    return this.db.passwordResetToken.update({ where: { id }, data: { usedAt: new Date() } });
  }
}

export const authRepository = new AuthRepository();
