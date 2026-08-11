import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { sellersService } from './sellers.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('sellersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMyProfile fetches the seller profile', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 's1' } } });

    await sellersService.getMyProfile();

    expect(apiClient.get).toHaveBeenCalledWith('/sellers/me');
  });

  it('updateMyProfile patches the seller profile', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { id: 's1' } } });

    await sellersService.updateMyProfile({ companyName: 'Acme' } as never);

    expect(apiClient.patch).toHaveBeenCalledWith('/sellers/me', { companyName: 'Acme' });
  });

  it('listApplications fetches pending applications', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'app-1' }], meta: { total: 1 } } });

    const result = await sellersService.listApplications();

    expect(apiClient.get).toHaveBeenCalledWith('/sellers/applications', { params: { limit: 100 } });
    expect(result).toEqual({ data: [{ id: 'app-1' }], total: 1 });
  });

  it('approveApplication posts to the approve endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await sellersService.approveApplication('app-1');

    expect(apiClient.post).toHaveBeenCalledWith('/sellers/applications/app-1/approve');
  });

  it('rejectApplication posts the rejection reason', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await sellersService.rejectApplication('app-1', 'Incomplete docs');

    expect(apiClient.post).toHaveBeenCalledWith('/sellers/applications/app-1/reject', { reason: 'Incomplete docs' });
  });

  it('listSellers fetches all approved sellers', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 's1' }], meta: { total: 1 } } });

    const result = await sellersService.listSellers();

    expect(apiClient.get).toHaveBeenCalledWith('/sellers', { params: { limit: 100 } });
    expect(result).toEqual({ data: [{ id: 's1' }], total: 1 });
  });

  it('getSeller fetches a single seller by id', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 's1' } } });

    await sellersService.getSeller('s1');

    expect(apiClient.get).toHaveBeenCalledWith('/sellers/s1');
  });
});
