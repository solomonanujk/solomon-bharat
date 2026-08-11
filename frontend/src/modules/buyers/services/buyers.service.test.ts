import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/lib/axios';
import { buyersService } from './buyers.service';

vi.mock('@/lib/axios', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('buyersService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getMyProfile fetches the buyer profile', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: { id: 'b1' } } });

    await buyersService.getMyProfile();

    expect(apiClient.get).toHaveBeenCalledWith('/buyers/me');
  });

  it('updateMyProfile patches the buyer profile', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { data: { id: 'b1' } } });

    await buyersService.updateMyProfile({ companyName: 'Acme' } as never);

    expect(apiClient.patch).toHaveBeenCalledWith('/buyers/me', { companyName: 'Acme' });
  });

  it('listAddresses fetches all addresses', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'addr-1' }] } });

    const result = await buyersService.listAddresses();

    expect(apiClient.get).toHaveBeenCalledWith('/buyers/me/addresses');
    expect(result).toEqual([{ id: 'addr-1' }]);
  });

  it('createAddress posts a new address', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'addr-1' } } });

    const input = { line1: '1 Main St', city: 'Mumbai', country: 'IN', postalCode: '400001' };
    const result = await buyersService.createAddress(input as never);

    expect(apiClient.post).toHaveBeenCalledWith('/buyers/me/addresses', input);
    expect(result).toEqual({ id: 'addr-1' });
  });

  it('deleteAddress deletes by id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

    await buyersService.deleteAddress('addr-1');

    expect(apiClient.delete).toHaveBeenCalledWith('/buyers/me/addresses/addr-1');
  });

  it('setDefaultAddress posts to the default endpoint', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'addr-1', isDefault: true } } });

    await buyersService.setDefaultAddress('addr-1');

    expect(apiClient.post).toHaveBeenCalledWith('/buyers/me/addresses/addr-1/default');
  });

  it('listWishlist fetches the wishlist', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });

    await buyersService.listWishlist();

    expect(apiClient.get).toHaveBeenCalledWith('/buyers/me/wishlist');
  });

  it('addToWishlist posts the product id', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: {} });

    await buyersService.addToWishlist('p1');

    expect(apiClient.post).toHaveBeenCalledWith('/buyers/me/wishlist', { productId: 'p1' });
  });

  it('removeFromWishlist deletes by product id', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: {} });

    await buyersService.removeFromWishlist('p1');

    expect(apiClient.delete).toHaveBeenCalledWith('/buyers/me/wishlist/p1');
  });

  it('getMyMessages fetches messages', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [] } });

    await buyersService.getMyMessages();

    expect(apiClient.get).toHaveBeenCalledWith('/buyers/me/messages');
  });

  it('sendMyMessage posts a message body', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { data: { id: 'm1' } } });

    await buyersService.sendMyMessage('Hello');

    expect(apiClient.post).toHaveBeenCalledWith('/buyers/me/messages', { body: 'Hello' });
  });

  it('listBuyersAdmin fetches the admin buyer list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { data: [{ id: 'b1' }], meta: { total: 1 } } });

    const result = await buyersService.listBuyersAdmin();

    expect(apiClient.get).toHaveBeenCalledWith('/buyers/admin', { params: { limit: 100 } });
    expect(result).toEqual({ data: [{ id: 'b1' }], total: 1 });
  });
});
