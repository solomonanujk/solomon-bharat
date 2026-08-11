import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
  AdminProduct,
  AdminProductListFilter,
  BuyerProduct,
  CreateProductInput,
  ProductDetailResult,
  ProductListFilter,
  SellerProduct,
  SellerProductListFilter,
} from '../types';

function toFormData(input: CreateProductInput): FormData {
  const form = new FormData();
  form.append('name', input.name);
  form.append('description', input.description);
  form.append('categoryId', input.categoryId);
  form.append('materials', input.materials);
  if (input.dimensions) form.append('dimensions', input.dimensions);
  if (input.weight) form.append('weight', input.weight);
  form.append('moq', String(input.moq));
  form.append('declaredStock', String(input.declaredStock));
  form.append('sellerPrice', String(input.sellerPrice));
  if (input.leadTime) form.append('leadTime', input.leadTime);
  if (input.certifications) form.append('certifications', input.certifications);
  if (input.variants && input.variants.length > 0) form.append('variants', JSON.stringify(input.variants));
  input.images.forEach((file) => form.append('images', file));
  return form;
}

export const productsService = {
  async listPublished(filter: ProductListFilter): Promise<BuyerProduct[]> {
    const { data } = await apiClient.get<ApiResponse<BuyerProduct[]>>('/products', { params: filter });
    return data.data;
  },

  async getBySlug(slug: string): Promise<ProductDetailResult> {
    const { data } = await apiClient.get<ApiResponse<ProductDetailResult>>(`/products/${slug}`);
    return data.data;
  },

  async listMine(filter: SellerProductListFilter): Promise<{ data: SellerProduct[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<SellerProduct[]>>('/products/me', { params: filter });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getMine(id: string): Promise<SellerProduct> {
    const { data } = await apiClient.get<ApiResponse<SellerProduct>>(`/products/me/${id}`);
    return data.data;
  },

  async create(input: CreateProductInput): Promise<SellerProduct> {
    const { data } = await apiClient.post<ApiResponse<SellerProduct>>('/products', toFormData(input), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  async resubmit(id: string): Promise<SellerProduct> {
    const { data } = await apiClient.post<ApiResponse<SellerProduct>>(`/products/me/${id}/resubmit`);
    return data.data;
  },

  async listAdmin(filter: AdminProductListFilter): Promise<{ data: AdminProduct[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<AdminProduct[]>>('/products/admin', {
      params: { ...filter, limit: 100 },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getAdmin(id: string): Promise<AdminProduct> {
    const { data } = await apiClient.get<ApiResponse<AdminProduct>>(`/products/admin/${id}`);
    return data.data;
  },

  async approve(id: string, adminPrice: number): Promise<AdminProduct> {
    const { data } = await apiClient.post<ApiResponse<AdminProduct>>(`/products/admin/${id}/approve`, { adminPrice });
    return data.data;
  },

  async reject(id: string, reason: string): Promise<AdminProduct> {
    const { data } = await apiClient.post<ApiResponse<AdminProduct>>(`/products/admin/${id}/reject`, { reason });
    return data.data;
  },

  async reassignCategory(id: string, categoryId: string): Promise<AdminProduct> {
    const { data } = await apiClient.patch<ApiResponse<AdminProduct>>(`/products/admin/${id}/category`, {
      categoryId,
    });
    return data.data;
  },
};
