import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { AdminSellerListRow, SellerApplication, SellerProfile, UpdateSellerProfileInput } from '../types';

export const sellersService = {
  async getMyProfile(): Promise<SellerProfile> {
    const { data } = await apiClient.get<ApiResponse<SellerProfile>>('/sellers/me');
    return data.data;
  },

  async updateMyProfile(input: UpdateSellerProfileInput): Promise<SellerProfile> {
    const { data } = await apiClient.patch<ApiResponse<SellerProfile>>('/sellers/me', input);
    return data.data;
  },

  async listApplications(): Promise<{ data: SellerApplication[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<SellerApplication[]>>('/sellers/applications', {
      params: { limit: 100 },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async approveApplication(id: string): Promise<void> {
    await apiClient.post(`/sellers/applications/${id}/approve`);
  },

  async rejectApplication(id: string, reason: string): Promise<void> {
    await apiClient.post(`/sellers/applications/${id}/reject`, { reason });
  },

  async listSellers(): Promise<{ data: AdminSellerListRow[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<AdminSellerListRow[]>>('/sellers', { params: { limit: 100 } });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getSeller(id: string): Promise<AdminSellerListRow> {
    const { data } = await apiClient.get<ApiResponse<AdminSellerListRow>>(`/sellers/${id}`);
    return data.data;
  },
};
