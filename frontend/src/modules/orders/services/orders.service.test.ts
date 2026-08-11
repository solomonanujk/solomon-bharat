import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { ordersService } from './orders.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('ordersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMine paginates buyer orders', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'o1' }], meta: { total: 1 } } });

    const result = await ordersService.listMine(2, 10);

    expect(apiClient.get).toHaveBeenCalledWith('/orders/me', { params: { page: 2, limit: 10 } });
    expect(result).toEqual({ data: [{ id: 'o1' }], total: 1 });
  });

  it('getMine fetches a single buyer order', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'o1' } } });

    await ordersService.getMine('o1');

    expect(apiClient.get).toHaveBeenCalledWith('/orders/me/o1');
  });

  it('listSellerItems paginates seller order items', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'item-1' }] } });

    const result = await ordersService.listSellerItems();

    expect(apiClient.get).toHaveBeenCalledWith('/orders/seller/items', { params: { page: 1, limit: 20 } });
    expect(result).toEqual({ data: [{ id: 'item-1' }], total: 1 });
  });

  it('listAdmin merges the filter with a fixed limit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'o1' }], meta: { total: 1 } } });

    await ordersService.listAdmin({ status: 'CONFIRMED' } as never);

    expect(apiClient.get).toHaveBeenCalledWith('/orders/admin', { params: { status: 'CONFIRMED', limit: 100 } });
  });

  it('getAdmin fetches a single admin order', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'o1' } } });

    await ordersService.getAdmin('o1');

    expect(apiClient.get).toHaveBeenCalledWith('/orders/admin/o1');
  });

  it('confirm posts to the confirm transition', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'o1' } } });

    await ordersService.confirm('o1');

    expect(apiClient.post).toHaveBeenCalledWith('/orders/admin/o1/confirm');
  });

  it('procure posts an optional expected collection date', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'o1' } } });

    await ordersService.procure('o1', '2026-09-01');

    expect(apiClient.post).toHaveBeenCalledWith('/orders/admin/o1/procure', {
      expectedCollectionDate: '2026-09-01',
    });
  });

  it('collect posts to the collect transition', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'o1' } } });

    await ordersService.collect('o1');

    expect(apiClient.post).toHaveBeenCalledWith('/orders/admin/o1/collect');
  });

  it('ship posts an optional tracking number', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'o1' } } });

    await ordersService.ship('o1', 'TRACK123');

    expect(apiClient.post).toHaveBeenCalledWith('/orders/admin/o1/ship', { trackingNumber: 'TRACK123' });
  });

  it('deliver posts to the deliver transition', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'o1' } } });

    await ordersService.deliver('o1');

    expect(apiClient.post).toHaveBeenCalledWith('/orders/admin/o1/deliver');
  });
});
