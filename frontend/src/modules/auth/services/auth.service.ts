import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { AuthResult, LoginInput, SafeUser, SignupInput } from '../types';

export const authService = {
  async login(input: LoginInput): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', input);
    return data.data;
  },

  async signup(input: SignupInput): Promise<{ user: SafeUser }> {
    const { data } = await apiClient.post<ApiResponse<{ user: SafeUser }>>('/auth/signup', input);
    return data.data;
  },

  async logout(): Promise<void> {
    await apiClient.post('/auth/logout');
  },

  async getMe(): Promise<SafeUser> {
    const { data } = await apiClient.get<ApiResponse<{ user: SafeUser }>>('/auth/me');
    return data.data.user;
  },

  async refresh(): Promise<AuthResult> {
    const { data } = await apiClient.post<ApiResponse<AuthResult>>('/auth/refresh');
    return data.data;
  },
};
