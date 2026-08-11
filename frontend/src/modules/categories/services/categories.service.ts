import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { CategoryDetail, CategoryNode, CreateCategoryInput, ReorderCategoriesItem, UpdateCategoryInput } from '../types';

export const categoriesService = {
  async getTree(): Promise<CategoryNode[]> {
    const { data } = await apiClient.get<ApiResponse<CategoryNode[]>>('/categories');
    return data.data;
  },

  async getBySlug(slug: string): Promise<CategoryDetail> {
    const { data } = await apiClient.get<ApiResponse<CategoryDetail>>(`/categories/${slug}`);
    return data.data;
  },

  async getAdminTree(): Promise<CategoryNode[]> {
    const { data } = await apiClient.get<ApiResponse<CategoryNode[]>>('/categories/admin/tree');
    return data.data;
  },

  async create(input: CreateCategoryInput): Promise<CategoryNode> {
    const { data } = await apiClient.post<ApiResponse<CategoryNode>>('/categories', input);
    return data.data;
  },

  async update(id: string, input: UpdateCategoryInput): Promise<CategoryNode> {
    const { data } = await apiClient.patch<ApiResponse<CategoryNode>>(`/categories/${id}`, input);
    return data.data;
  },

  async archive(id: string): Promise<CategoryNode> {
    const { data } = await apiClient.post<ApiResponse<CategoryNode>>(`/categories/${id}/archive`);
    return data.data;
  },

  async restore(id: string): Promise<CategoryNode> {
    const { data } = await apiClient.post<ApiResponse<CategoryNode>>(`/categories/${id}/restore`);
    return data.data;
  },

  async reorder(items: ReorderCategoriesItem[]): Promise<void> {
    await apiClient.patch('/categories/reorder', items);
  },
};