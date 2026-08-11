import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
  Address,
  AdminBuyerListRow,
  BuyerMessage,
  BuyerProfile,
  CreateAddressInput,
  UpdateBuyerProfileInput,
  WishlistEntry,
} from '../types';

export const buyersService = {
  async getMyProfile(): Promise<BuyerProfile> {
    const { data } = await apiClient.get<ApiResponse<BuyerProfile>>('/buyers/me');
    return data.data;
  },

  async updateMyProfile(input: UpdateBuyerProfileInput): Promise<BuyerProfile> {
    const { data } = await apiClient.patch<ApiResponse<BuyerProfile>>('/buyers/me', input);
    return data.data;
  },

  async listAddresses(): Promise<Address[]> {
    const { data } = await apiClient.get<ApiResponse<Address[]>>('/buyers/me/addresses');
    return data.data;
  },

  async createAddress(input: CreateAddressInput): Promise<Address> {
    const { data } = await apiClient.post<ApiResponse<Address>>('/buyers/me/addresses', input);
    return data.data;
  },

  async deleteAddress(id: string): Promise<void> {
    await apiClient.delete(`/buyers/me/addresses/${id}`);
  },

  async setDefaultAddress(id: string): Promise<Address> {
    const { data } = await apiClient.post<ApiResponse<Address>>(`/buyers/me/addresses/${id}/default`);
    return data.data;
  },

  async listWishlist(): Promise<WishlistEntry[]> {
    const { data } = await apiClient.get<ApiResponse<WishlistEntry[]>>('/buyers/me/wishlist');
    return data.data;
  },

  async addToWishlist(productId: string): Promise<void> {
    await apiClient.post('/buyers/me/wishlist', { productId });
  },

  async removeFromWishlist(productId: string): Promise<void> {
    await apiClient.delete(`/buyers/me/wishlist/${productId}`);
  },

  async getMyMessages(): Promise<BuyerMessage[]> {
    const { data } = await apiClient.get<ApiResponse<BuyerMessage[]>>('/buyers/me/messages');
    return data.data;
  },

  async sendMyMessage(body: string): Promise<BuyerMessage> {
    const { data } = await apiClient.post<ApiResponse<BuyerMessage>>('/buyers/me/messages', { body });
    return data.data;
  },

  async listBuyersAdmin(): Promise<{ data: AdminBuyerListRow[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<AdminBuyerListRow[]>>('/buyers/admin', { params: { limit: 100 } });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },
};
