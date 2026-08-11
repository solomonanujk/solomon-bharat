import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { authService } from './auth.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login posts credentials and returns the auth result', async () => {
    const authResult = { user: { id: 'u1' }, accessToken: 'token-1' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: authResult } });

    const result = await authService.login({ email: 'a@b.com', password: 'secret123' });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/login', { email: 'a@b.com', password: 'secret123' });
    expect(result).toEqual(authResult);
  });

  it('signup posts the signup form', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { user: { id: 'u1' } } } });

    const result = await authService.signup({
      email: 'a@b.com',
      password: 'secret123',
      contactName: 'Ada',
      country: 'US',
    });

    expect(apiClient.post).toHaveBeenCalledWith('/auth/signup', {
      email: 'a@b.com',
      password: 'secret123',
      contactName: 'Ada',
      country: 'US',
    });
    expect(result).toEqual({ user: { id: 'u1' } });
  });

  it('logout posts to the logout endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await authService.logout();

    expect(apiClient.post).toHaveBeenCalledWith('/auth/logout');
  });

  it('getMe fetches the current user', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { user: { id: 'u1' } } } });

    const result = await authService.getMe();

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(result).toEqual({ id: 'u1' });
  });

  it('refresh posts to the refresh endpoint', async () => {
    const authResult = { user: { id: 'u1' }, accessToken: 'token-2' };
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: authResult } });

    const result = await authService.refresh();

    expect(apiClient.post).toHaveBeenCalledWith('/auth/refresh');
    expect(result).toEqual(authResult);
  });
});
