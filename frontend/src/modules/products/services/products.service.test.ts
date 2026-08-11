import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { productsService } from './products.service';
import type { CreateProductInput } from '../types';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function buildCreateInput(overrides: Partial<CreateProductInput> = {}): CreateProductInput {
  return {
    name: 'Brass Lamp',
    description: 'Hand-forged brass lamp',
    categoryId: 'cat-1',
    materials: 'brass',
    moq: 10,
    declaredStock: 100,
    sellerPrice: 20,
    images: [new File(['x'], 'lamp.png', { type: 'image/png' })],
    ...overrides,
  };
}

describe('productsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listPublished passes the filter as query params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'p1' }] } });

    const result = await productsService.listPublished({ categoryId: 'cat-1' } as never);

    expect(apiClient.get).toHaveBeenCalledWith('/products', { params: { categoryId: 'cat-1' } });
    expect(result).toEqual([{ id: 'p1' }]);
  });

  it('getBySlug fetches a single published product', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'p1', slug: 'brass-lamp' } } });

    const result = await productsService.getBySlug('brass-lamp');

    expect(apiClient.get).toHaveBeenCalledWith('/products/brass-lamp');
    expect(result).toEqual({ id: 'p1', slug: 'brass-lamp' });
  });

  it('listMine fetches the seller product list with total fallback', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'p1' }] } });

    const result = await productsService.listMine({} as never);

    expect(apiClient.get).toHaveBeenCalledWith('/products/me', { params: {} });
    expect(result).toEqual({ data: [{ id: 'p1' }], total: 1 });
  });

  it('getMine fetches a single seller product', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await productsService.getMine('p1');

    expect(apiClient.get).toHaveBeenCalledWith('/products/me/p1');
  });

  it('create builds multipart form data with all fields and images', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await productsService.create(buildCreateInput({ dimensions: '10x10', variants: [{ label: 'Red' } as never] }));

    expect(apiClient.post).toHaveBeenCalledWith('/products', expect.any(FormData), {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    const form = vi.mocked(apiClient.post).mock.calls[0]?.[1] as FormData;
    expect(form.get('name')).toBe('Brass Lamp');
    expect(form.get('moq')).toBe('10');
    expect(form.get('dimensions')).toBe('10x10');
    expect(form.get('variants')).toBe(JSON.stringify([{ label: 'Red' }]));
    expect(form.getAll('images')).toHaveLength(1);
  });

  it('resubmit posts to the resubmit endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await productsService.resubmit('p1');

    expect(apiClient.post).toHaveBeenCalledWith('/products/me/p1/resubmit');
  });

  it('listAdmin merges the filter with a fixed limit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'p1' }], meta: { total: 1 } } });

    await productsService.listAdmin({ status: 'PENDING' } as never);

    expect(apiClient.get).toHaveBeenCalledWith('/products/admin', { params: { status: 'PENDING', limit: 100 } });
  });

  it('getAdmin fetches a single admin product', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await productsService.getAdmin('p1');

    expect(apiClient.get).toHaveBeenCalledWith('/products/admin/p1');
  });

  it('approve posts the admin price', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await productsService.approve('p1', 55);

    expect(apiClient.post).toHaveBeenCalledWith('/products/admin/p1/approve', { adminPrice: 55 });
  });

  it('reject posts the rejection reason', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await productsService.reject('p1', 'Low quality images');

    expect(apiClient.post).toHaveBeenCalledWith('/products/admin/p1/reject', { reason: 'Low quality images' });
  });

  it('reassignCategory patches the product category', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await productsService.reassignCategory('p1', 'cat-2');

    expect(apiClient.patch).toHaveBeenCalledWith('/products/admin/p1/category', { categoryId: 'cat-2' });
  });
});
