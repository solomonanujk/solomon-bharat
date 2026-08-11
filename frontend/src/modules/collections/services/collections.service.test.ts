import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { collectionsService } from './collections.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('collectionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listFeatured fetches featured collections', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'col1' }] } });

    const result = await collectionsService.listFeatured();

    expect(apiClient.get).toHaveBeenCalledWith('/collections/featured');
    expect(result).toEqual([{ id: 'col1' }]);
  });

  it('listPublished paginates and falls back total to data length when meta is missing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'col1' }, { id: 'col2' }] } });

    const result = await collectionsService.listPublished(2, 5);

    expect(apiClient.get).toHaveBeenCalledWith('/collections', { params: { page: 2, limit: 5 } });
    expect(result).toEqual({ data: [{ id: 'col1' }, { id: 'col2' }], total: 2 });
  });

  it('listPublished uses meta.total when present', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'col1' }], meta: { total: 40 } } });

    const result = await collectionsService.listPublished();

    expect(result.total).toBe(40);
  });

  it('getBySlug fetches a collection with pagination params', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'col1', products: [] } } });

    await collectionsService.getBySlug('monsoon', 1, 12);

    expect(apiClient.get).toHaveBeenCalledWith('/collections/monsoon', { params: { page: 1, limit: 12 } });
  });

  it('listAdmin fetches the admin collection list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'col1' }], meta: { total: 1 } } });

    const result = await collectionsService.listAdmin();

    expect(apiClient.get).toHaveBeenCalledWith('/collections/admin', { params: { limit: 100 } });
    expect(result).toEqual({ data: [{ id: 'col1' }], total: 1 });
  });

  it('getAdminDetail fetches a single admin collection', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'col1', products: [] } } });

    const result = await collectionsService.getAdminDetail('col1');

    expect(apiClient.get).toHaveBeenCalledWith('/collections/admin/col1');
    expect(result).toEqual({ id: 'col1', products: [] });
  });

  it('create posts a new collection', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'col1' } } });

    const result = await collectionsService.create({ name: 'Monsoon Edit', slug: 'monsoon' } as never);

    expect(apiClient.post).toHaveBeenCalledWith('/collections', { name: 'Monsoon Edit', slug: 'monsoon' });
    expect(result).toEqual({ id: 'col1' });
  });

  it('publish posts to the publish endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'col1', status: 'PUBLISHED' } } });

    await collectionsService.publish('col1');

    expect(apiClient.post).toHaveBeenCalledWith('/collections/col1/publish');
  });

  it('archive posts to the archive endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'col1', status: 'ARCHIVED' } } });

    await collectionsService.archive('col1');

    expect(apiClient.post).toHaveBeenCalledWith('/collections/col1/archive');
  });

  it('setFeatured posts to feature when true', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'col1', isFeatured: true } } });

    await collectionsService.setFeatured('col1', true);

    expect(apiClient.post).toHaveBeenCalledWith('/collections/col1/feature');
  });

  it('setFeatured posts to unfeature when false', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'col1', isFeatured: false } } });

    await collectionsService.setFeatured('col1', false);

    expect(apiClient.post).toHaveBeenCalledWith('/collections/col1/unfeature');
  });

  it('addProduct posts the product id and sort order', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await collectionsService.addProduct('col1', 'p1', 2);

    expect(apiClient.post).toHaveBeenCalledWith('/collections/col1/products', { productId: 'p1', sortOrder: 2 });
  });

  it('removeProduct deletes the membership', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

    await collectionsService.removeProduct('col1', 'p1');

    expect(apiClient.delete).toHaveBeenCalledWith('/collections/col1/products/p1');
  });

  it('reorderMembership patches the new sort order', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });

    const items = [{ productId: 'p1', sortOrder: 0 }, { productId: 'p2', sortOrder: 1 }];
    await collectionsService.reorderMembership('col1', items);

    expect(apiClient.patch).toHaveBeenCalledWith('/collections/col1/products/reorder', items);
  });
});
