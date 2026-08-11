import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { AdminOrder, AdminOrderListFilter, BuyerOrder, SellerOrderItem } from '../types';

export const ordersService = {
  async listMine(page = 1, limit = 20): Promise<{ data: BuyerOrder[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<BuyerOrder[]>>('/orders/me', { params: { page, limit } });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getMine(id: string): Promise<BuyerOrder> {
    const { data } = await apiClient.get<ApiResponse<BuyerOrder>>(`/orders/me/${id}`);
    return data.data;
  },

  async listSellerItems(page = 1, limit = 20): Promise<{ data: SellerOrderItem[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<SellerOrderItem[]>>('/orders/seller/items', {
      params: { page, limit },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async listAdmin(filter: AdminOrderListFilter = {}): Promise<{ data: AdminOrder[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<AdminOrder[]>>('/orders/admin', {
      params: { ...filter, limit: 100 },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getAdmin(id: string): Promise<AdminOrder> {
    const { data } = await apiClient.get<ApiResponse<AdminOrder>>(`/orders/admin/${id}`);
    return data.data;
  },

  async confirm(id: string): Promise<AdminOrder> {
    const { data } = await apiClient.post<ApiResponse<AdminOrder>>(`/orders/admin/${id}/confirm`);
    return data.data;
  },

  async procure(id: string, expectedCollectionDate?: string): Promise<AdminOrder> {
    const { data } = await apiClient.post<ApiResponse<AdminOrder>>(`/orders/admin/${id}/procure`, {
      expectedCollectionDate,
    });
    return data.data;
  },

  async collect(id: string): Promise<AdminOrder> {
    const { data } = await apiClient.post<ApiResponse<AdminOrder>>(`/orders/admin/${id}/collect`);
    return data.data;
  },

  async ship(id: string, trackingNumber?: string): Promise<AdminOrder> {
    const { data } = await apiClient.post<ApiResponse<AdminOrder>>(`/orders/admin/${id}/ship`, { trackingNumber });
    return data.data;
  },

  async deliver(id: string): Promise<AdminOrder> {
    const { data } = await apiClient.post<ApiResponse<AdminOrder>>(`/orders/admin/${id}/deliver`);
    return data.data;
  },
};
