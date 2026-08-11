import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import {
  AdminProduct,
  AdminProductListFilter,
  BuyerProduct,
  CreateProductInput,
  ProductActionResult,
  ProductDetailResult,
  ProductListFilter,
  SellerProduct,
  SellerProductListFilter,
  UpdateProductInput,
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

function toUpdateFormData(input: UpdateProductInput): FormData {
  const form = new FormData();
  if (input.name !== undefined) form.append('name', input.name);
  if (input.description !== undefined) form.append('description', input.description);
  if (input.materials !== undefined) form.append('materials', input.materials);
  if (input.dimensions !== undefined) form.append('dimensions', input.dimensions);
  if (input.weight !== undefined) form.append('weight', input.weight);
  if (input.moq !== undefined) form.append('moq', String(input.moq));
  if (input.declaredStock !== undefined) form.append('declaredStock', String(input.declaredStock));
  if (input.sellerPrice !== undefined) form.append('sellerPrice', String(input.sellerPrice));
  if (input.leadTime !== undefined) form.append('leadTime', input.leadTime);
  if (input.certifications !== undefined) form.append('certifications', input.certifications);
  if (input.variants) form.append('variants', JSON.stringify(input.variants));
  if (input.removeImageIds) form.append('removeImageIds', JSON.stringify(input.removeImageIds));
  input.images?.forEach((file) => form.append('images', file));
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

  async update(id: string, input: UpdateProductInput): Promise<SellerProduct> {
    const { data } = await apiClient.patch<ApiResponse<SellerProduct>>(`/products/me/${id}`, toUpdateFormData(input), {
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
      params: { limit: 20, ...filter },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getAdmin(id: string): Promise<AdminProduct> {
    const { data } = await apiClient.get<ApiResponse<AdminProduct>>(`/products/admin/${id}`);
    return data.data;
  },

  async approve(id: string, adminPrice: number): Promise<ProductActionResult> {
    const { data } = await apiClient.post<ApiResponse<ProductActionResult>>(`/products/admin/${id}/approve`, {
      adminPrice,
    });
    return data.data;
  },

  async reject(id: string, reason: string): Promise<ProductActionResult> {
    const { data } = await apiClient.post<ApiResponse<ProductActionResult>>(`/products/admin/${id}/reject`, {
      reason,
    });
    return data.data;
  },

  async reassignCategory(id: string, categoryId: string): Promise<ProductActionResult> {
    const { data } = await apiClient.patch<ApiResponse<ProductActionResult>>(`/products/admin/${id}/category`, {
      categoryId,
    });
    return data.data;
  },

  async publish(id: string): Promise<ProductActionResult> {
    const { data } = await apiClient.post<ApiResponse<ProductActionResult>>(`/products/admin/${id}/publish`);
    return data.data;
  },

  async unpublish(id: string): Promise<ProductActionResult> {
    const { data } = await apiClient.post<ApiResponse<ProductActionResult>>(`/products/admin/${id}/unpublish`);
    return data.data;
  },

  async feature(id: string): Promise<ProductActionResult> {
    const { data } = await apiClient.post<ApiResponse<ProductActionResult>>(`/products/admin/${id}/feature`);
    return data.data;
  },

  async unfeature(id: string): Promise<ProductActionResult> {
    const { data } = await apiClient.post<ApiResponse<ProductActionResult>>(`/products/admin/${id}/unfeature`);
    return data.data;
  },
};
