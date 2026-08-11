import request from 'supertest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Role } from '@prisma/client';

import { buildCatchAllMockPrisma } from '../../test-utils/mockPrisma';

vi.mock('../../middleware/rateLimiter', () => ({
  publicRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

// createApp() wires every module's real routes, which would otherwise instantiate a real
// PrismaClient/Redis connection at import time — sandbox controller tests from all real infra.
vi.mock('../../config/prisma', () => ({ prisma: buildCatchAllMockPrisma() }));
vi.mock('../../config/redis', () => ({
  redis: { on: vi.fn(), get: vi.fn(), set: vi.fn(), del: vi.fn(), incr: vi.fn(), call: vi.fn() },
}));

vi.mock('./auth.service', () => ({
  authService: {
    signupBuyer: vi.fn(),
    login: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn(),
    verifyEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    resetPassword: vi.fn(),
    getMe: vi.fn(),
    validateSession: vi.fn(),
  },
}));

import { createApp } from '../../app';
import { authHeader } from '../../test-utils/authToken';
import { AppError } from '../../utils/errors';
import { authService } from './auth.service';

const app = createApp();

describe('auth controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/auth/signup', () => {
    it('creates a buyer account and returns 201', async () => {
      vi.mocked(authService.signupBuyer).mockResolvedValue({ id: 'u1', email: 'a@b.com' } as never);

      const res = await request(app).post('/api/v1/auth/signup').send({
        email: 'a@b.com',
        password: 'password123',
        contactName: 'Ada Lovelace',
        country: 'US',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(authService.signupBuyer).toHaveBeenCalled();
    });

    it('rejects an invalid email with 422', async () => {
      const res = await request(app).post('/api/v1/auth/signup').send({
        email: 'not-an-email',
        password: 'password123',
        contactName: 'Ada',
        country: 'US',
      });

      expect(res.status).toBe(422);
      expect(authService.signupBuyer).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('logs in and sets auth cookies', async () => {
      vi.mocked(authService.login).mockResolvedValue({
        user: { id: 'u1', email: 'a@b.com', role: Role.BUYER },
        tokens: { accessToken: 'access-1', refreshToken: 'r1:secret:jwt', csrfToken: 'csrf-1' },
      } as never);

      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'a@b.com',
        password: 'password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBe('access-1');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('refresh_token='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('csrf_token='))).toBe(true);
    });

    it('returns 401 for invalid credentials', async () => {
      vi.mocked(authService.login).mockRejectedValue(AppError.unauthorized('Invalid email or password'));

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'a@b.com', password: 'wrong' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 when no refresh cookie is present', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('rotates tokens when a refresh cookie is present', async () => {
      vi.mocked(authService.refresh).mockResolvedValue({
        user: { id: 'u1', email: 'a@b.com', role: Role.BUYER },
        tokens: { accessToken: 'access-2', refreshToken: 'r2:secret:jwt', csrfToken: 'csrf-2' },
      } as never);

      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', ['refresh_token=r1:secret:jwt']);

      expect(res.status).toBe(200);
      expect(authService.refresh).toHaveBeenCalledWith('r1:secret:jwt');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears auth cookies and returns 200', async () => {
      const res = await request(app).post('/api/v1/auth/logout').set('Cookie', ['refresh_token=r1:secret:jwt']);

      expect(res.status).toBe(200);
      expect(authService.logout).toHaveBeenCalledWith('r1:secret:jwt');
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies.some((c) => c.startsWith('refresh_token=;'))).toBe(true);
    });
  });

  describe('GET /api/v1/auth/verify-email', () => {
    it('verifies with valid id/token query params', async () => {
      const res = await request(app)
        .get('/api/v1/auth/verify-email')
        .query({ id: '11111111-1111-1111-1111-111111111111', token: 'tok' });

      expect(res.status).toBe(200);
      expect(authService.verifyEmail).toHaveBeenCalledWith('11111111-1111-1111-1111-111111111111', 'tok');
    });

    it('rejects a non-uuid id with 422', async () => {
      const res = await request(app).get('/api/v1/auth/verify-email').query({ id: 'not-a-uuid', token: 'tok' });
      expect(res.status).toBe(422);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('always returns 200 regardless of whether the account exists', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password').send({ email: 'a@b.com' });
      expect(res.status).toBe(200);
      expect(authService.requestPasswordReset).toHaveBeenCalledWith('a@b.com');
    });
  });

  describe('POST /api/v1/auth/reset-password', () => {
    it('resets the password with a valid payload', async () => {
      const res = await request(app).post('/api/v1/auth/reset-password').send({
        id: '11111111-1111-1111-1111-111111111111',
        token: 'tok',
        password: 'newpassword123',
      });
      expect(res.status).toBe(200);
      expect(authService.resetPassword).toHaveBeenCalledWith(
        '11111111-1111-1111-1111-111111111111',
        'tok',
        'newpassword123',
      );
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 401 without a bearer token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns the current user with a valid bearer token', async () => {
      vi.mocked(authService.getMe).mockResolvedValue({ id: 'u1', email: 'a@b.com', role: Role.BUYER } as never);

      const res = await request(app).get('/api/v1/auth/me').set(authHeader(Role.BUYER, 'u1'));

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe('u1');
      expect(authService.getMe).toHaveBeenCalledWith('u1');
    });
  });

  describe('GET /api/v1/auth/session', () => {
    it('returns 401 when no refresh cookie is present', async () => {
      const res = await request(app).get('/api/v1/auth/session');
      expect(res.status).toBe(401);
      expect(authService.validateSession).not.toHaveBeenCalled();
    });

    it('returns the current user without rotating cookies when a valid refresh cookie is present', async () => {
      vi.mocked(authService.validateSession).mockResolvedValue({
        id: 'u1',
        email: 'a@b.com',
        role: Role.BUYER,
      } as never);

      const res = await request(app).get('/api/v1/auth/session').set('Cookie', ['refresh_token=r1:secret:jwt']);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe('u1');
      expect(authService.validateSession).toHaveBeenCalledWith('r1:secret:jwt');
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('propagates 401 from the service for an invalid refresh cookie', async () => {
      vi.mocked(authService.validateSession).mockRejectedValue(AppError.unauthorized('Invalid or expired refresh token'));

      const res = await request(app).get('/api/v1/auth/session').set('Cookie', ['refresh_token=bad']);

      expect(res.status).toBe(401);
    });
  });
});
