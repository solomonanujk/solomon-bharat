import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { payoutsService } from './payouts.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('payoutsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMine fetches payouts with an optional filter', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'p1' }], meta: { total: 1 } } });

    const result = await payoutsService.listMine({ status: 'PAID' } as never);

    expect(apiClient.get).toHaveBeenCalledWith('/payouts/me', { params: { status: 'PAID' } });
    expect(result).toEqual({ data: [{ id: 'p1' }], total: 1 });
  });

  it('listMine defaults total to data length when meta is missing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'p1' }] } });

    const result = await payoutsService.listMine();

    expect(result.total).toBe(1);
  });

  it('getMySummary fetches the seller payout summary', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { totalPaid: '100.00' } } });

    const result = await payoutsService.getMySummary();

    expect(apiClient.get).toHaveBeenCalledWith('/payouts/me/summary');
    expect(result).toEqual({ totalPaid: '100.00' });
  });

  it('listAdmin merges the filter with a fixed limit', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'p1' }], meta: { total: 1 } } });

    const result = await payoutsService.listAdmin({ status: 'PENDING' });

    expect(apiClient.get).toHaveBeenCalledWith('/payouts/admin', { params: { status: 'PENDING', limit: 100 } });
    expect(result).toEqual({ data: [{ id: 'p1' }], total: 1 });
  });

  it('getAdmin fetches a single payout', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'p1' } } });

    await payoutsService.getAdmin('p1');

    expect(apiClient.get).toHaveBeenCalledWith('/payouts/admin/p1');
  });

  it('markPaid posts optional notes', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'p1', status: 'PAID' } } });

    await payoutsService.markPaid('p1', 'Wired via bank transfer');

    expect(apiClient.post).toHaveBeenCalledWith('/payouts/admin/p1/mark-paid', { notes: 'Wired via bank transfer' });
  });

  it('addNotes patches the payout notes', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { id: 'p1', notes: 'Follow up' } } });

    await payoutsService.addNotes('p1', 'Follow up');

    expect(apiClient.patch).toHaveBeenCalledWith('/payouts/admin/p1/notes', { notes: 'Follow up' });
  });
});
