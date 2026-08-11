import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { AdminCollectionDetail, Collection, CollectionPublicDetail, CreateCollectionInput } from '../types';

export const collectionsService = {
  async listFeatured(): Promise<Collection[]> {
    const { data } = await apiClient.get<ApiResponse<Collection[]>>('/collections/featured');
    return data.data;
  },

  async listPublished(page = 1, limit = 12): Promise<{ data: Collection[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<Collection[]>>('/collections', {
      params: { page, limit },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getBySlug(slug: string, page = 1, limit = 12): Promise<CollectionPublicDetail> {
    const { data } = await apiClient.get<ApiResponse<CollectionPublicDetail>>(`/collections/${slug}`, {
      params: { page, limit },
    });
    return data.data;
  },

  async listAdmin(): Promise<{ data: Collection[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<Collection[]>>('/collections/admin', { params: { limit: 100 } });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getAdminDetail(id: string): Promise<AdminCollectionDetail> {
    const { data } = await apiClient.get<ApiResponse<AdminCollectionDetail>>(`/collections/admin/${id}`);
    return data.data;
  },

  async create(input: CreateCollectionInput): Promise<Collection> {
    const { data } = await apiClient.post<ApiResponse<Collection>>('/collections', input);
    return data.data;
  },

  async publish(id: string): Promise<Collection> {
    const { data } = await apiClient.post<ApiResponse<Collection>>(`/collections/${id}/publish`);
    return data.data;
  },

  async archive(id: string): Promise<Collection> {
    const { data } = await apiClient.post<ApiResponse<Collection>>(`/collections/${id}/archive`);
    return data.data;
  },

  async setFeatured(id: string, isFeatured: boolean): Promise<Collection> {
    const { data } = await apiClient.post<ApiResponse<Collection>>(`/collections/${id}/${isFeatured ? 'feature' : 'unfeature'}`);
    return data.data;
  },

  async addProduct(id: string, productId: string, sortOrder?: number): Promise<void> {
    await apiClient.post(`/collections/${id}/products`, { productId, sortOrder });
  },

  async removeProduct(id: string, productId: string): Promise<void> {
    await apiClient.delete(`/collections/${id}/products/${productId}`);
  },

  async reorderMembership(id: string, items: { productId: string; sortOrder: number }[]): Promise<void> {
    await apiClient.patch(`/collections/${id}/products/reorder`, items);
  },
};
