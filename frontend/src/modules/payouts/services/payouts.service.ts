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
      params: { limit: 20, ...filter },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  /**
   * Unlike `listAdmin`, the single-payout GET returns the raw Prisma `Payout` — no
   * `seller` relation attached (that's only joined in for the list read). Don't type
   * this as `AdminPayout`.
   */
  async getAdmin(id: string): Promise<Payout> {
    const { data } = await apiClient.get<ApiResponse<Payout>>(`/payouts/admin/${id}`);
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
