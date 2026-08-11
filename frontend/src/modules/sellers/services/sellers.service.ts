import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
  AdminSellerListFilter,
  AdminSellerListRow,
  SellerApplication,
  SellerApplicationApprovalResult,
  SellerApplicationListFilter,
  SellerProfile,
  UpdateSellerProfileInput,
} from '../types';

export const sellersService = {
  async getMyProfile(): Promise<SellerProfile> {
    const { data } = await apiClient.get<ApiResponse<SellerProfile>>('/sellers/me');
    return data.data;
  },

  async updateMyProfile(input: UpdateSellerProfileInput): Promise<SellerProfile> {
    const { data } = await apiClient.patch<ApiResponse<SellerProfile>>('/sellers/me', input);
    return data.data;
  },

  async listApplications(filter: SellerApplicationListFilter = {}): Promise<{ data: SellerApplication[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<SellerApplication[]>>('/sellers/applications', {
      params: { limit: 20, ...filter },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async approveApplication(id: string): Promise<SellerApplicationApprovalResult> {
    const { data } = await apiClient.post<ApiResponse<SellerApplicationApprovalResult>>(
      `/sellers/applications/${id}/approve`,
    );
    return data.data;
  },

  async rejectApplication(id: string, reason: string): Promise<SellerApplication> {
    const { data } = await apiClient.post<ApiResponse<SellerApplication>>(`/sellers/applications/${id}/reject`, {
      reason,
    });
    return data.data;
  },

  async requestApplicationInfo(id: string, message: string): Promise<SellerApplication> {
    const { data } = await apiClient.post<ApiResponse<SellerApplication>>(
      `/sellers/applications/${id}/request-info`,
      { message },
    );
    return data.data;
  },

  async addApplicationNote(id: string, note: string): Promise<SellerApplication> {
    const { data } = await apiClient.post<ApiResponse<SellerApplication>>(`/sellers/applications/${id}/notes`, {
      note,
    });
    return data.data;
  },

  async listSellers(filter: AdminSellerListFilter = {}): Promise<{ data: AdminSellerListRow[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<AdminSellerListRow[]>>('/sellers', {
      params: { limit: 20, ...filter },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getSeller(id: string): Promise<AdminSellerListRow> {
    const { data } = await apiClient.get<ApiResponse<AdminSellerListRow>>(`/sellers/${id}`);
    return data.data;
  },
};
