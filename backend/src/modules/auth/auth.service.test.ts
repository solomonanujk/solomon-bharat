import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role, UserStatus, User } from '@prisma/client';
import { hashPassword, hashToken } from '../../utils/bcrypt';
import { signRefreshToken } from '../../utils/jwt';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';

vi.mock('../../providers/mail', () => ({
  mailProvider: { sendMail: vi.fn().mockResolvedValue(undefined) },
}));

function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'buyer@example.com',
    passwordHash: 'hash',
    role: Role.BUYER,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildMockRepo(): AuthRepository {
  return {
    findUserByEmail: vi.fn(),
    findUserById: vi.fn(),
    createBuyerUser: vi.fn(),
    updateUserPassword: vi.fn(),
    markEmailVerified: vi.fn(),
    createRefreshToken: vi.fn(),
    findRefreshTokenById: vi.fn(),
    revokeRefreshToken: vi.fn(),
    revokeAllRefreshTokensForUser: vi.fn(),
    createEmailVerificationToken: vi.fn(),
    findEmailVerificationTokenById: vi.fn(),
    markEmailVerificationTokenUsed: vi.fn(),
    createPasswordResetToken: vi.fn(),
    findPasswordResetTokenById: vi.fn(),
    markPasswordResetTokenUsed: vi.fn(),
  } as unknown as AuthRepository;
}

describe('AuthService', () => {
  let repo: AuthRepository;
  let service: AuthService;

  beforeEach(() => {
    repo = buildMockRepo();
    service = new AuthService(repo);
  });

  describe('signupBuyer', () => {
    it('rejects when the email is already registered', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser());

      await expect(
        service.signupBuyer({
          email: 'buyer@example.com',
          password: 'password123',
          contactName: 'Jane Buyer',
          country: 'UK',
        }),
      ).rejects.toMatchObject({ statusCode: 409 });

      expect(repo.createBuyerUser).not.toHaveBeenCalled();
    });

    it('creates a BUYER account and issues an email verification token', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);
      vi.mocked(repo.createBuyerUser).mockResolvedValue(buildUser());
      vi.mocked(repo.createEmailVerificationToken).mockResolvedValue({
        id: 'evt-1',
        userId: 'user-1',
        tokenHash: 'x',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      const result = await service.signupBuyer({
        email: 'buyer@example.com',
        password: 'password123',
        contactName: 'Jane Buyer',
        country: 'UK',
      });

      expect(result.email).toBe('buyer@example.com');
      expect(result.role).toBe(Role.BUYER);
      expect(repo.createEmailVerificationToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('login', () => {
    it('rejects an unknown email without revealing whether the account exists', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'irrelevant' }),
      ).rejects.toMatchObject({ statusCode: 401, message: 'Invalid email or password' });
    });

    it('rejects an incorrect password', async () => {
      const passwordHash = await hashPassword('correct-password');
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        service.login({ email: 'buyer@example.com', password: 'wrong-password' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    it('rejects a suspended account even with the correct password', async () => {
      const passwordHash = await hashPassword('correct-password');
      vi.mocked(repo.findUserByEmail).mockResolvedValue(
        buildUser({ passwordHash, status: UserStatus.SUSPENDED }),
      );

      await expect(
        service.login({ email: 'buyer@example.com', password: 'correct-password' }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('issues a token pair on valid credentials', async () => {
      const passwordHash = await hashPassword('correct-password');
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser({ passwordHash }));
      vi.mocked(repo.createRefreshToken).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: 'x',
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.login({ email: 'buyer@example.com', password: 'correct-password' });

      expect(result.user.id).toBe('user-1');
      expect(result.tokens.accessToken).toBeTruthy();
      expect(result.tokens.refreshToken.split(':')).toHaveLength(3);
    });
  });

  describe('refresh', () => {
    it('rejects a malformed refresh token', async () => {
      await expect(service.refresh('not-a-valid-token')).rejects.toMatchObject({ statusCode: 401 });
    });

    it('revokes every session for the user if the opaque secret does not match the stored hash', async () => {
      const jwt = signRefreshToken({ sub: 'user-1', jti: 'rt-1' });
      const storedHash = await hashToken('the-real-secret');
      vi.mocked(repo.findRefreshTokenById).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: storedHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });

      await expect(service.refresh(`rt-1:wrong-secret:${jwt}`)).rejects.toMatchObject({
        statusCode: 401,
      });

      expect(repo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-1');
    });

    it('rotates the refresh token on success — old record revoked, new one issued', async () => {
      const rawSecret = 'the-real-secret';
      const jwt = signRefreshToken({ sub: 'user-1', jti: 'rt-1' });
      const storedHash = await hashToken(rawSecret);

      vi.mocked(repo.findRefreshTokenById).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: storedHash,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });
      vi.mocked(repo.findUserById).mockResolvedValue(buildUser());
      vi.mocked(repo.createRefreshToken).mockResolvedValue({
        id: 'rt-2',
        userId: 'user-1',
        tokenHash: 'x',
        expiresAt: new Date(),
        revokedAt: null,
        createdAt: new Date(),
      });

      const result = await service.refresh(`rt-1:${rawSecret}:${jwt}`);

      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('rt-1');
      expect(result.tokens.refreshToken.startsWith('rt-2:')).toBe(true);
    });
  });

  describe('validateSession', () => {
    it('rejects a malformed refresh token', async () => {
      await expect(service.validateSession('not-a-valid-token')).rejects.toMatchObject({ statusCode: 401 });
    });

    it('rejects when the token record is revoked', async () => {
      const jwt = signRefreshToken({ sub: 'user-1', jti: 'rt-1' });
      vi.mocked(repo.findRefreshTokenById).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: await hashToken('secret'),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
        createdAt: new Date(),
      });

      await expect(service.validateSession(`rt-1:secret:${jwt}`)).rejects.toMatchObject({ statusCode: 401 });
    });

    it('does NOT rotate the token — no revoke or new-token issuance on success', async () => {
      const rawSecret = 'the-real-secret';
      const jwt = signRefreshToken({ sub: 'user-1', jti: 'rt-1' });
      vi.mocked(repo.findRefreshTokenById).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: await hashToken(rawSecret),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });
      vi.mocked(repo.findUserById).mockResolvedValue(buildUser());

      const result = await service.validateSession(`rt-1:${rawSecret}:${jwt}`);

      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
      expect(repo.createRefreshToken).not.toHaveBeenCalled();
      expect(result).toMatchObject({ id: 'user-1', role: Role.BUYER });
    });

    it('rejects a suspended account', async () => {
      const rawSecret = 'the-real-secret';
      const jwt = signRefreshToken({ sub: 'user-1', jti: 'rt-1' });
      vi.mocked(repo.findRefreshTokenById).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        tokenHash: await hashToken(rawSecret),
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: null,
        createdAt: new Date(),
      });
      vi.mocked(repo.findUserById).mockResolvedValue(buildUser({ status: UserStatus.SUSPENDED }));

      await expect(service.validateSession(`rt-1:${rawSecret}:${jwt}`)).rejects.toMatchObject({ statusCode: 401 });
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid or expired token', async () => {
      vi.mocked(repo.findPasswordResetTokenById).mockResolvedValue(null);

      await expect(service.resetPassword('id-1', 'token', 'new-password123')).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it('updates the password and revokes all sessions on success', async () => {
      const rawToken = 'reset-secret';
      const tokenHash = await hashToken(rawToken);
      vi.mocked(repo.findPasswordResetTokenById).mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
      });

      await service.resetPassword('prt-1', rawToken, 'new-password123');

      expect(repo.updateUserPassword).toHaveBeenCalledWith('user-1', expect.any(String));
      expect(repo.markPasswordResetTokenUsed).toHaveBeenCalledWith('prt-1');
      expect(repo.revokeAllRefreshTokensForUser).toHaveBeenCalledWith('user-1');
    });
  });

  describe('verifyEmail', () => {
    it('rejects an expired token', async () => {
      vi.mocked(repo.findEmailVerificationTokenById).mockResolvedValue({
        id: 'evt-1',
        userId: 'user-1',
        tokenHash: 'x',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        createdAt: new Date(),
      });

      await expect(service.verifyEmail('evt-1', 'token')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('rejects a token that does not match the stored hash', async () => {
      const storedHash = await hashToken('the-real-token');
      vi.mocked(repo.findEmailVerificationTokenById).mockResolvedValue({
        id: 'evt-1',
        userId: 'user-1',
        tokenHash: storedHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
      });

      await expect(service.verifyEmail('evt-1', 'wrong-token')).rejects.toMatchObject({ statusCode: 400 });
      expect(repo.markEmailVerified).not.toHaveBeenCalled();
    });

    it('marks the token used and the user verified on a valid token', async () => {
      const rawToken = 'the-real-token';
      const storedHash = await hashToken(rawToken);
      vi.mocked(repo.findEmailVerificationTokenById).mockResolvedValue({
        id: 'evt-1',
        userId: 'user-1',
        tokenHash: storedHash,
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: null,
        createdAt: new Date(),
      });

      await service.verifyEmail('evt-1', rawToken);

      expect(repo.markEmailVerificationTokenUsed).toHaveBeenCalledWith('evt-1');
      expect(repo.markEmailVerified).toHaveBeenCalledWith('user-1');
    });
  });

  describe('logout', () => {
    it('is a no-op when no refresh token cookie was present', async () => {
      await service.logout(undefined);

      expect(repo.revokeRefreshToken).not.toHaveBeenCalled();
    });

    it('is idempotent — an invalid token does not throw', async () => {
      await expect(service.logout('not-a-valid-token')).resolves.toBeUndefined();
    });

    it('revokes the refresh token record referenced by a well-formed token', async () => {
      await service.logout('rt-1:secret:jwt-part');

      expect(repo.revokeRefreshToken).toHaveBeenCalledWith('rt-1');
    });
  });

  describe('requestPasswordReset', () => {
    it('does nothing when no account exists for the email (no enumeration)', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(null);

      await service.requestPasswordReset('nobody@example.com');

      expect(repo.createPasswordResetToken).not.toHaveBeenCalled();
    });

    it('creates a reset token and emails it when the account exists', async () => {
      vi.mocked(repo.findUserByEmail).mockResolvedValue(buildUser());
      vi.mocked(repo.createPasswordResetToken).mockResolvedValue({
        id: 'prt-1',
        userId: 'user-1',
        tokenHash: 'x',
        expiresAt: new Date(),
        usedAt: null,
        createdAt: new Date(),
      });

      await service.requestPasswordReset('buyer@example.com');

      expect(repo.createPasswordResetToken).toHaveBeenCalledWith('user-1', expect.any(String), expect.any(Date));
    });
  });

  describe('getMe', () => {
    it('throws 404 for a user that does not exist', async () => {
      vi.mocked(repo.findUserById).mockResolvedValue(null);

      await expect(service.getMe('missing')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('returns the safe projection, never the password hash', async () => {
      vi.mocked(repo.findUserById).mockResolvedValue(buildUser());

      const result = await service.getMe('user-1');

      expect(result).not.toHaveProperty('passwordHash');
      expect(result.email).toBe('buyer@example.com');
    });
  });
});
