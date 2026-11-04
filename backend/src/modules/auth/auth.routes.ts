import { Router } from 'express';
import { authController } from './auth.controller';
import {
  changePasswordSchema,
  checkEmailQuerySchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  sendSignupCodeSchema,
  signupBuyerSchema,
  verifyEmailQuerySchema,
  verifySignupCodeSchema,
} from './auth.validation';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';

export const authRouter = Router();

/**
 * @openapi
 * /auth/check-email:
 *   get:
 *     summary: Check whether an account already exists for an email — used by the signup email gate before starting the onboarding wizard
 *     tags: [Auth]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: email
 *         required: true
 *         schema: { type: string, format: email }
 *     responses:
 *       200:
 *         description: "{ exists: boolean }"
 */
authRouter.get(
  '/check-email',
  validate(checkEmailQuerySchema, 'query'),
  asyncHandler(authController.checkEmail),
);

/**
 * @openapi
 * /auth/signup/send-code:
 *   post:
 *     summary: Email a 6-digit verification code to a prospective buyer (signup step 1b). 409 if the email is registered, 429 if requested again within a minute.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: Code sent
 */
authRouter.post(
  '/signup/send-code',
  authRateLimiter,
  validate(sendSignupCodeSchema),
  asyncHandler(authController.sendSignupCode),
);

/**
 * @openapi
 * /auth/signup/verify-code:
 *   post:
 *     summary: Check the signup code; returns { signupToken } required by POST /auth/signup. Max 5 wrong attempts per code; codes expire after 10 minutes.
 *     tags: [Auth]
 *     security: []
 *     responses:
 *       200:
 *         description: "{ signupToken: string }"
 *       400:
 *         description: Incorrect, expired or exhausted code
 */
authRouter.post(
  '/signup/verify-code',
  authRateLimiter,
  validate(verifySignupCodeSchema),
  asyncHandler(authController.verifySignupCode),
);

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     summary: Buyer self-service signup — requires `signupToken` from /auth/signup/verify-code; the account is created with a verified email
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
 * /auth/change-password:
 *   post:
 *     summary: Change the signed-in user's password (current password not needed while a temporary one is in use)
 *     tags: [Auth]
 *     responses:
 *       200:
 *         description: Password changed
 */
authRouter.post(
  '/change-password',
  requireAuth,
  authRateLimiter,
  validate(changePasswordSchema),
  asyncHandler(authController.changePassword),
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
