import { describe, it, expect, beforeEach } from 'vitest';
import { buildMockPrismaClient, mockModel, MockPrismaClient } from '../../test-utils/mockPrisma';
import { AuthRepository } from './auth.repository';

describe('AuthRepository', () => {
  let db: MockPrismaClient;
  let repo: AuthRepository;

  beforeEach(() => {
    db = buildMockPrismaClient({
      user: mockModel(),
      refreshToken: mockModel(),
      emailVerificationToken: mockModel(),
      passwordResetToken: mockModel(),
    });
    repo = new AuthRepository(db as never);
  });

  it('findUserByEmail queries by email', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1' });
    const result = await repo.findUserByEmail('a@b.com');
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'a@b.com' } });
    expect(result).toEqual({ id: 'u1' });
  });

  it('findUserById queries by id', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'u1' });
    await repo.findUserById('u1');
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { id: 'u1' } });
  });

  it('createBuyerUser creates a BUYER user with a nested buyerProfile', async () => {
    db.user.create.mockResolvedValue({ id: 'u1' });
    await repo.createBuyerUser(
      { email: 'a@b.com', password: 'irrelevant-here', contactName: 'Ada', country: 'US', companyName: 'Acme', phone: '123' },
      'hashed',
    );
    expect(db.user.create).toHaveBeenCalledWith({
      data: {
        email: 'a@b.com',
        passwordHash: 'hashed',
        role: 'BUYER',
        buyerProfile: {
          create: { contactName: 'Ada', country: 'US', companyName: 'Acme', phone: '123' },
        },
      },
    });
  });

  it('updateUserPassword updates the passwordHash field', async () => {
    db.user.update.mockResolvedValue({ id: 'u1' });
    await repo.updateUserPassword('u1', 'newhash');
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'u1' }, data: { passwordHash: 'newhash' } });
  });

  it('markEmailVerified sets emailVerifiedAt', async () => {
    db.user.update.mockResolvedValue({ id: 'u1' });
    await repo.markEmailVerified('u1');
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it('createRefreshToken creates a record with userId, tokenHash, expiresAt', async () => {
    const expiresAt = new Date();
    db.refreshToken.create.mockResolvedValue({ id: 'rt1' });
    await repo.createRefreshToken('u1', 'hash', expiresAt);
    expect(db.refreshToken.create).toHaveBeenCalledWith({
      data: { userId: 'u1', tokenHash: 'hash', expiresAt },
    });
  });

  it('findRefreshTokenById queries by id', async () => {
    db.refreshToken.findUnique.mockResolvedValue({ id: 'rt1' });
    await repo.findRefreshTokenById('rt1');
    expect(db.refreshToken.findUnique).toHaveBeenCalledWith({ where: { id: 'rt1' } });
  });

  it('revokeRefreshToken sets revokedAt', async () => {
    db.refreshToken.update.mockResolvedValue({ id: 'rt1' });
    await repo.revokeRefreshToken('rt1');
    expect(db.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokeAllRefreshTokensForUser revokes only currently-active tokens for that user', async () => {
    db.refreshToken.updateMany.mockResolvedValue({ count: 2 });
    await repo.revokeAllRefreshTokensForUser('u1');
    expect(db.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('createEmailVerificationToken creates a record', async () => {
    const expiresAt = new Date();
    db.emailVerificationToken.create.mockResolvedValue({ id: 'evt1' });
    await repo.createEmailVerificationToken('u1', 'hash', expiresAt);
    expect(db.emailVerificationToken.create).toHaveBeenCalledWith({
      data: { userId: 'u1', tokenHash: 'hash', expiresAt },
    });
  });

  it('findEmailVerificationTokenById queries by id', async () => {
    db.emailVerificationToken.findUnique.mockResolvedValue({ id: 'evt1' });
    await repo.findEmailVerificationTokenById('evt1');
    expect(db.emailVerificationToken.findUnique).toHaveBeenCalledWith({ where: { id: 'evt1' } });
  });

  it('markEmailVerificationTokenUsed sets usedAt', async () => {
    db.emailVerificationToken.update.mockResolvedValue({ id: 'evt1' });
    await repo.markEmailVerificationTokenUsed('evt1');
    expect(db.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 'evt1' },
      data: { usedAt: expect.any(Date) },
    });
  });

  it('createPasswordResetToken creates a record', async () => {
    const expiresAt = new Date();
    db.passwordResetToken.create.mockResolvedValue({ id: 'prt1' });
    await repo.createPasswordResetToken('u1', 'hash', expiresAt);
    expect(db.passwordResetToken.create).toHaveBeenCalledWith({
      data: { userId: 'u1', tokenHash: 'hash', expiresAt },
    });
  });

  it('findPasswordResetTokenById queries by id', async () => {
    db.passwordResetToken.findUnique.mockResolvedValue({ id: 'prt1' });
    await repo.findPasswordResetTokenById('prt1');
    expect(db.passwordResetToken.findUnique).toHaveBeenCalledWith({ where: { id: 'prt1' } });
  });

  it('markPasswordResetTokenUsed sets usedAt', async () => {
    db.passwordResetToken.update.mockResolvedValue({ id: 'prt1' });
    await repo.markPasswordResetTokenUsed('prt1');
    expect(db.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'prt1' },
      data: { usedAt: expect.any(Date) },
    });
  });
});
