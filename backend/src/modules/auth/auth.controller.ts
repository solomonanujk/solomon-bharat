import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { clearAuthCookies, REFRESH_COOKIE_NAME, setAuthCookies } from '../../utils/cookies';
import { AppError } from '../../utils/errors';
import { authService } from './auth.service';
import {
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  SignupBuyerDto,
  VerifyEmailQueryDto,
} from './auth.validation';

export const authController = {
  async signup(req: Request, res: Response): Promise<void> {
    const dto = req.body as SignupBuyerDto;
    const user = await authService.signupBuyer(dto);
    sendCreated(res, { user }, 'Account created. Please check your email to verify your address.');
  },

  async login(req: Request, res: Response): Promise<void> {
    const dto = req.body as LoginDto;
    const { user, tokens } = await authService.login(dto);
    setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    sendSuccess(res, { user, accessToken: tokens.accessToken }, 'Logged in successfully');
  },

  async refresh(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawRefreshToken) {
      throw AppError.unauthorized('Refresh token missing');
    }
    const { user, tokens } = await authService.refresh(rawRefreshToken);
    setAuthCookies(res, tokens.refreshToken, tokens.csrfToken);
    sendSuccess(res, { user, accessToken: tokens.accessToken }, 'Token refreshed');
  },

  async logout(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    await authService.logout(rawRefreshToken);
    clearAuthCookies(res);
    sendSuccess(res, null, 'Logged out successfully');
  },

  async verifyEmail(req: Request, res: Response): Promise<void> {
    const { id, token } = req.query as unknown as VerifyEmailQueryDto;
    await authService.verifyEmail(id, token);
    sendSuccess(res, null, 'Email verified successfully');
  },

  async forgotPassword(req: Request, res: Response): Promise<void> {
    const dto = req.body as ForgotPasswordDto;
    await authService.requestPasswordReset(dto.email);
    sendSuccess(res, null, 'If an account exists for this email, a reset link has been sent.');
  },

  async resetPassword(req: Request, res: Response): Promise<void> {
    const dto = req.body as ResetPasswordDto;
    await authService.resetPassword(dto.id, dto.token, dto.password);
    sendSuccess(res, null, 'Password reset successfully');
  },

  async me(req: Request, res: Response): Promise<void> {
    const user = await authService.getMe(req.user!.id);
    sendSuccess(res, { user }, 'Current user');
  },

  async session(req: Request, res: Response): Promise<void> {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!rawRefreshToken) {
      throw AppError.unauthorized('No active session');
    }
    const user = await authService.validateSession(rawRefreshToken);
    sendSuccess(res, { user });
  },
};
