import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { categoriesService } from '../services/categories.service';
import {
  useAdminCategoryTree,
  useArchiveCategory,
  useCreateCategory,
  useReorderCategories,
  useRestoreCategory,
  useUpdateCategory,
} from './useAdminCategories';
import type { CategoryNode } from '../types';

vi.mock('../services/categories.service', () => ({
  categoriesService: {
    getAdminTree: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    archive: vi.fn(),
    restore: vi.fn(),
    reorder: vi.fn(),
  },
}));

function buildNode(overrides: Partial<CategoryNode> = {}): CategoryNode {
  return {
    id: 'c1',
    name: 'Textiles',
    slug: 'textiles',
    level: 1,
    parentId: null,
    description: null,
    heroImage: null,
    sortOrder: 0,
    productCount: 0,
    children: [],
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAdminCategoryTree', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches the admin category tree', async () => {
    vi.mocked(categoriesService.getAdminTree).mockResolvedValue([buildNode()]);

    const { result } = renderHook(() => useAdminCategoryTree(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([buildNode()]);
  });
});

describe('useCreateCategory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a category via the service', async () => {
    vi.mocked(categoriesService.create).mockResolvedValue(buildNode());
    const { result } = renderHook(() => useCreateCategory(), { wrapper: createWrapper() });

    result.current.mutate({ name: 'Textiles', level: 1 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(categoriesService.create).toHaveBeenCalledWith({ name: 'Textiles', level: 1 });
  });
});

describe('useUpdateCategory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('updates a category via the service', async () => {
    vi.mocked(categoriesService.update).mockResolvedValue(buildNode({ name: 'Renamed' }));
    const { result } = renderHook(() => useUpdateCategory(), { wrapper: createWrapper() });

    result.current.mutate({ id: 'c1', input: { name: 'Renamed' } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(categoriesService.update).toHaveBeenCalledWith('c1', { name: 'Renamed' });
  });
});

describe('useArchiveCategory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('archives a category via the service', async () => {
    vi.mocked(categoriesService.archive).mockResolvedValue(buildNode({ status: 'ARCHIVED' }));
    const { result } = renderHook(() => useArchiveCategory(), { wrapper: createWrapper() });

    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(categoriesService.archive).toHaveBeenCalledWith('c1');
  });
});

describe('useRestoreCategory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('restores a category via the service', async () => {
    vi.mocked(categoriesService.restore).mockResolvedValue(buildNode({ status: 'ACTIVE' }));
    const { result } = renderHook(() => useRestoreCategory(), { wrapper: createWrapper() });

    result.current.mutate('c1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(categoriesService.restore).toHaveBeenCalledWith('c1');
  });
});

describe('useReorderCategories', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reorders categories via the service', async () => {
    vi.mocked(categoriesService.reorder).mockResolvedValue(undefined);
    const { result } = renderHook(() => useReorderCategories(), { wrapper: createWrapper() });

    const items = [{ id: 'c1', sortOrder: 0 }];
    result.current.mutate(items);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(categoriesService.reorder).toHaveBeenCalledWith(items);
  });
});
