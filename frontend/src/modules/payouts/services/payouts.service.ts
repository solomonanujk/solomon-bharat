import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { AdminPayout, AdminPayoutListFilter, Payout, PayoutListFilter, SellerPayoutSummary } from '../types';

export const payoutsService = {
  async listMine(filter: PayoutListFilter = {}): Promise<{ data: Payout[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<Payout[]>>('/payouts/me', { params: filter });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getMySummary(): Promise<SellerPayoutSummary> {
    const { data } = await apiClient.get<ApiResponse<SellerPayoutSummary>>('/payouts/me/summary');
    return data.data;
  },

  async listAdmin(filter: AdminPayoutListFilter = {}): Promise<{ data: AdminPayout[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<AdminPayout[]>>('/payouts/admin', {
      params: { ...filter, limit: 100 },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getAdmin(id: string): Promise<AdminPayout> {
    const { data } = await apiClient.get<ApiResponse<AdminPayout>>(`/payouts/admin/${id}`);
    return data.data;
  },

  async markPaid(id: string, notes?: string): Promise<Payout> {
    const { data } = await apiClient.post<ApiResponse<Payout>>(`/payouts/admin/${id}/mark-paid`, { notes });
    return data.data;
  },

  async addNotes(id: string, notes: string): Promise<Payout> {
    const { data } = await apiClient.patch<ApiResponse<Payout>>(`/payouts/admin/${id}/notes`, { notes });
    return data.data;
  },
};
