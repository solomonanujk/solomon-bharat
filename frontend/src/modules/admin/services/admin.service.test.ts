import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { adminService } from './admin.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('adminService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDashboard fetches the dashboard summary', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { gmv: '1000' } } });

    const result = await adminService.getDashboard();

    expect(apiClient.get).toHaveBeenCalledWith('/admin/dashboard');
    expect(result).toEqual({ gmv: '1000' });
  });

  it('getReport fetches a report by type', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ status: 'CONFIRMED', count: 3 }] } });

    const result = await adminService.getReport('orders-by-status');

    expect(apiClient.get).toHaveBeenCalledWith('/admin/reports', {
      params: { type: 'orders-by-status', format: 'json' },
    });
    expect(result).toEqual([{ status: 'CONFIRMED', count: 3 }]);
  });
});
