import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { categoriesService } from './categories.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('categoriesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getTree fetches the category tree', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'c1' }] } });

    const result = await categoriesService.getTree();

    expect(apiClient.get).toHaveBeenCalledWith('/categories');
    expect(result).toEqual([{ id: 'c1' }]);
  });

  it('getBySlug fetches a single category by slug', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'c1', slug: 'textiles' } } });

    const result = await categoriesService.getBySlug('textiles');

    expect(apiClient.get).toHaveBeenCalledWith('/categories/textiles');
    expect(result).toEqual({ id: 'c1', slug: 'textiles' });
  });

  it('getAdminTree fetches the full tree including archived nodes', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'c1', status: 'ARCHIVED' }] } });

    const result = await categoriesService.getAdminTree();

    expect(apiClient.get).toHaveBeenCalledWith('/categories/admin/tree');
    expect(result).toEqual([{ id: 'c1', status: 'ARCHIVED' }]);
  });

  it('create posts a new category', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'c1' } } });

    const input = { name: 'Textiles', level: 1 as const };
    const result = await categoriesService.create(input);

    expect(apiClient.post).toHaveBeenCalledWith('/categories', input);
    expect(result).toEqual({ id: 'c1' });
  });

  it('update patches an existing category', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { id: 'c1', name: 'Renamed' } } });

    await categoriesService.update('c1', { name: 'Renamed' });

    expect(apiClient.patch).toHaveBeenCalledWith('/categories/c1', { name: 'Renamed' });
  });

  it('archive posts to the archive endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'c1', status: 'ARCHIVED' } } });

    await categoriesService.archive('c1');

    expect(apiClient.post).toHaveBeenCalledWith('/categories/c1/archive');
  });

  it('restore posts to the restore endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'c1', status: 'ACTIVE' } } });

    await categoriesService.restore('c1');

    expect(apiClient.post).toHaveBeenCalledWith('/categories/c1/restore');
  });

  it('reorder patches the new sort order', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: {} });

    const items = [{ id: 'c1', sortOrder: 0 }, { id: 'c2', sortOrder: 1 }];
    await categoriesService.reorder(items);

    expect(apiClient.patch).toHaveBeenCalledWith('/categories/reorder', items);
  });
});
