import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { buyersService } from '../services/buyers.service';
import { useAddresses, useCreateAddress, useDeleteAddress, useSetDefaultAddress } from './useAddresses';
import type { Address } from '../types';

vi.mock('../services/buyers.service', () => ({
  buyersService: {
    listAddresses: vi.fn(),
    createAddress: vi.fn(),
    deleteAddress: vi.fn(),
    setDefaultAddress: vi.fn(),
  },
}));

function buildAddress(overrides: Partial<Address> = {}): Address {
  return {
    id: 'addr-1',
    buyerId: 'b1',
    label: null,
    line1: '1 Main St',
    line2: null,
    city: 'Mumbai',
    state: null,
    postalCode: '400001',
    country: 'IN',
    isDefault: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useAddresses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches the buyer address list', async () => {
    vi.mocked(buyersService.listAddresses).mockResolvedValue([buildAddress()]);

    const { result } = renderHook(() => useAddresses(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([buildAddress()]);
  });
});

describe('useCreateAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates an address via the service', async () => {
    const input = { line1: '1 Main St', city: 'Mumbai', postalCode: '400001', country: 'IN' };
    vi.mocked(buyersService.createAddress).mockResolvedValue(buildAddress());

    const { result } = renderHook(() => useCreateAddress(), { wrapper: createWrapper() });
    result.current.mutate(input);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(buyersService.createAddress).toHaveBeenCalledWith(input);
  });
});

describe('useDeleteAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes an address by id', async () => {
    vi.mocked(buyersService.deleteAddress).mockResolvedValue(undefined);

    const { result } = renderHook(() => useDeleteAddress(), { wrapper: createWrapper() });
    result.current.mutate('addr-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(buyersService.deleteAddress).toHaveBeenCalledWith('addr-1');
  });
});

describe('useSetDefaultAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets an address as default', async () => {
    vi.mocked(buyersService.setDefaultAddress).mockResolvedValue(buildAddress({ isDefault: true }));

    const { result } = renderHook(() => useSetDefaultAddress(), { wrapper: createWrapper() });
    result.current.mutate('addr-1');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(buyersService.setDefaultAddress).toHaveBeenCalledWith('addr-1');
  });
});
