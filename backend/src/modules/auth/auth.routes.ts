import { Router } from 'express';
import { authController } from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  signupBuyerSchema,
  verifyEmailQuerySchema,
} from './auth.validation';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';

export const authRouter = Router();

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     summary: Buyer self-service signup
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *     responses:
 *       201:
 *         description: Account created
 */
authRouter.post(
  '/signup',
  authRateLimiter,
  validate(signupBuyerSchema),
  asyncHandler(authController.signup),
);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Login with email and password
 *     tags: [Auth]
 *     security: []
 *     requestBody:
 *       required: true
 *     responses:
 *       200:
 *         description: Logged in
 */
authRouter.post('/login', authRateLimiter, validate(loginSchema), asyncHandler(authController.login));

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     summary: Rotate access/refresh tokens using the refresh cookie
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Token refreshed
 */
authRouter.post('/refresh', asyncHandler(authController.refresh));

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Revoke the current refresh token and clear auth cookies
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Logged out
 */
authRouter.post('/logout', asyncHandler(authController.logout));

/**
 * @openapi
 * /auth/verify-email:
 *   get:
 *     summary: Verify a buyer's email address
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Email verified
 */
authRouter.get(
  '/verify-email',
  validate(verifyEmailQuerySchema, 'query'),
  asyncHandler(authController.verifyEmail),
);

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Reset link sent if the account exists
 */
authRouter.post(
  '/forgot-password',
  authRateLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword),
);

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     summary: Reset password using a valid reset token
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Password reset
 */
authRouter.post(
  '/reset-password',
  authRateLimiter,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword),
);

/**
 * @openapi
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Current user
 */
authRouter.get('/me', requireAuth, asyncHandler(authController.me));

/**
 * @openapi
 * /auth/session:
 *   get:
 *     summary: Read-only session check from the refresh cookie, no token rotation — used by frontend middleware
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Active session
 *       401:
 *         description: No active session
 */
authRouter.get('/session', asyncHandler(authController.session));
