import { logger } from '../../config/logger';
import { User } from '@prisma/client';
import { env } from '../../config/env';
import { AppError } from '../../utils/errors';
import { comparePassword, compareToken, hashPassword, hashToken } from '../../utils/bcrypt';
import {
  generateCsrfToken,
  generateOpaqueToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../utils/jwt';
import { SafeUser, toSafeUser } from '../../utils/safeUser';
import { toBrandSummary } from '../../utils/brandSummary';
import { mailProvider } from '../../providers/mail';
import { AuthRepository, authRepository } from './auth.repository';
import { AuthResult, LoginInput, SessionUser, SignupBuyerInput, TokenPair } from './auth.types';

const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1h
export const PASSWORD_SETUP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (welcome emails)

export class AuthService {
  constructor(private readonly repo: AuthRepository = authRepository) {}

  /** Adds sellerType + brand summary for SELLER accounts so the portal can pick its UI without a second call. */
  private async toSessionUser(user: User): Promise<SessionUser> {
    const safe = toSafeUser(user);
    if (user.role !== 'SELLER') return safe;
    const profile = await this.repo.findSellerProfileWithBrandByUserId(user.id);
    if (!profile) return safe;
    return { ...safe, sellerType: profile.sellerType, brand: profile.brand ? toBrandSummary(profile.brand) : null };
  }

  private async issueTokenPair(user: User): Promise<TokenPair> {
    const rawRefreshToken = generateOpaqueToken();
    const tokenHash = await hashToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const record = await this.repo.createRefreshToken(user.id, tokenHash, expiresAt);

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    const refreshToken = signRefreshToken({ sub: user.id, jti: record.id });

    return {
      accessToken,
      refreshToken: `${record.id}:${rawRefreshToken}:${refreshToken}`,
      csrfToken: generateCsrfToken(),
    };
  }

  /** Lets the signup email-gate check before walking someone through the whole
   *  onboarding wizard just to hit a conflict at the end. */
  async emailExists(email: string): Promise<boolean> {
    const existing = await this.repo.findUserByEmail(email);
    return !!existing;
  }

  async signupBuyer(input: SignupBuyerInput): Promise<SafeUser> {
    const existing = await this.repo.findUserByEmail(input.email);
    if (existing) {
      throw AppError.conflict('An account with this email already exists');
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.repo.createBuyerUser(input, passwordHash);

    // Brands may have emailed this address an invite before the account existed.
    if (user.buyerProfile?.id) {
      try {
        await this.repo.claimBrandEmailInvites(user.email, user.buyerProfile.id);
      } catch (err) {
        logger.error({ err, userId: user.id }, 'Failed to claim brand email invites');
      }
    }

    const rawToken = generateOpaqueToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const record = await this.repo.createEmailVerificationToken(user.id, tokenHash, expiresAt);

    const verifyUrl = `${env.APP_URL}/verify-email?id=${record.id}&token=${rawToken}`;
    await mailProvider.sendMail({
      to: user.email,
      subject: 'Verify your Solomon Bharat account',
      html: `<p>Welcome to Solomon Bharat. Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });

    return toSafeUser(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.repo.findUserByEmail(input.email);
    if (!user) {
      throw AppError.unauthorized('Invalid email or password');
    }

    const passwordMatches = await comparePassword(input.password, user.passwordHash);
    if (!passwordMatches) {
      throw AppError.unauthorized('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden('This account has been suspended');
    }

    const tokens = await this.issueTokenPair(user);
    return { user: await this.toSessionUser(user), tokens };
  }

  /**
   * Refresh token format is `${recordId}:${rawOpaqueToken}:${signedJwt}` (':' — not '.' — since
   * the JWT segment already contains dots). The JWT proves the token wasn't forged, recordId
   * locates the DB row without needing a hash-search index, and the opaque secret is what's
   * actually bcrypt-compared against the stored hash.
   */
  private parseRefreshToken(raw: string): { recordId: string; rawOpaqueToken: string; jwt: string } {
    const parts = raw.split(':');
    if (parts.length !== 3) {
      throw AppError.unauthorized('Invalid refresh token');
    }
    const [recordId, rawOpaqueToken, jwt] = parts;
    return { recordId, rawOpaqueToken, jwt };
  }

  /**
   * Shared by refresh() and validateSession() — verifies the refresh token's JWT signature,
   * looks up its DB record, and bcrypt-compares the opaque secret. Does NOT rotate anything,
   * so it's safe to call from a read-only context (e.g. middleware checking a session).
   */
  private async verifyRefreshTokenRecord(rawRefreshToken: string): Promise<{ userId: string; recordId: string }> {
    const { recordId, rawOpaqueToken, jwt } = this.parseRefreshToken(rawRefreshToken);

    let payload;
    try {
      payload = verifyRefreshToken(jwt);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    if (payload.jti !== recordId) {
      throw AppError.unauthorized('Invalid refresh token');
    }

    const record = await this.repo.findRefreshTokenById(recordId);
    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const matches = await compareToken(rawOpaqueToken, record.tokenHash);
    if (!matches) {
      // Presented secret doesn't match what we issued — treat as compromised and
      // revoke every outstanding session for this user rather than just this one.
      await this.repo.revokeAllRefreshTokensForUser(record.userId);
      throw AppError.unauthorized('Invalid refresh token');
    }

    return { userId: record.userId, recordId: record.id };
  }

  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const { userId, recordId } = await this.verifyRefreshTokenRecord(rawRefreshToken);
    await this.repo.revokeRefreshToken(recordId);

    const user = await this.repo.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw AppError.unauthorized('Account is no longer active');
    }

    const tokens = await this.issueTokenPair(user);
    return { user: await this.toSessionUser(user), tokens };
  }

  /**
   * Read-only session check — validates the refresh cookie without rotating it. Used by the
   * frontend's Next.js middleware to enforce server-side route protection (the access token
   * lives only in browser memory, so middleware has no other way to know who's logged in).
   */
  async validateSession(rawRefreshToken: string): Promise<SessionUser> {
    const { userId } = await this.verifyRefreshTokenRecord(rawRefreshToken);
    const user = await this.repo.findUserById(userId);
    if (!user || user.status !== 'ACTIVE') {
      throw AppError.unauthorized('Account is no longer active');
    }
    return this.toSessionUser(user);
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    try {
      const { recordId } = this.parseRefreshToken(rawRefreshToken);
      await this.repo.revokeRefreshToken(recordId);
    } catch {
      // logout is idempotent — an invalid/expired token is not an error
    }
  }

  async verifyEmail(id: string, token: string): Promise<void> {
    const record = await this.repo.findEmailVerificationTokenById(id);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw AppError.badRequest('Invalid or expired verification link');
    }

    const matches = await compareToken(token, record.tokenHash);
    if (!matches) {
      throw AppError.badRequest('Invalid or expired verification link');
    }

    await this.repo.markEmailVerificationTokenUsed(id);
    await this.repo.markEmailVerified(record.userId);
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) return; // don't leak account existence

    const rawToken = generateOpaqueToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    const record = await this.repo.createPasswordResetToken(user.id, tokenHash, expiresAt);

    const resetUrl = `${env.APP_URL}/reset-password?id=${record.id}&token=${rawToken}`;
    await mailProvider.sendMail({
      to: user.email,
      subject: 'Reset your Solomon Bharat password',
      html: `<p>We received a request to reset your password. This link expires in 1 hour:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
    });
  }

  /**
   * One-time "set your password" link for a newly approved account (seller / brand / agent).
   * Reuses the PasswordResetToken table with a 7-day expiry. The URL carries only the token
   * id + opaque secret, never the password. Using it clears mustChangePassword.
   */
  async createPasswordSetupUrl(userId: string): Promise<string> {
    const rawToken = generateOpaqueToken();
    const tokenHash = await hashToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_SETUP_TTL_MS);
    const record = await this.repo.createPasswordResetToken(userId, tokenHash, expiresAt);
    return `${env.APP_URL}/reset-password?id=${encodeURIComponent(record.id)}&token=${encodeURIComponent(rawToken)}&welcome=1`;
  }

  /** Returns the account email so the reset page can sign the user straight in. */
  async resetPassword(id: string, token: string, newPassword: string): Promise<{ email: string }> {
    const record = await this.repo.findPasswordResetTokenById(id);
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw AppError.badRequest('Invalid or expired reset link');
    }

    const matches = await compareToken(token, record.tokenHash);
    if (!matches) {
      throw AppError.badRequest('Invalid or expired reset link');
    }

    const passwordHash = await hashPassword(newPassword);
    const user = await this.repo.updateUserPassword(record.userId, passwordHash);
    await this.repo.markPasswordResetTokenUsed(id);
    await this.repo.revokeAllRefreshTokensForUser(record.userId);
    return { email: user.email };
  }

  /** Signed-in password change. Right after first login (temporary password) the current
   *  password is not asked again; otherwise it must match. */
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string): Promise<SessionUser> {
    const user = await this.repo.findUserById(userId);
    if (!user) throw AppError.notFound('User not found');
    if (!user.mustChangePassword) {
      if (!currentPassword || !(await comparePassword(currentPassword, user.passwordHash))) {
        throw AppError.badRequest('Your current password is incorrect');
      }
    }
    if (await comparePassword(newPassword, user.passwordHash)) {
      throw AppError.badRequest('Choose a password different from your current one');
    }
    const updated = await this.repo.updateUserPassword(userId, await hashPassword(newPassword));
    return this.toSessionUser(updated);
  }

  async getMe(userId: string): Promise<SessionUser> {
    const user = await this.repo.findUserById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }
    return this.toSessionUser(user);
  }
}

export const authService = new AuthService();
