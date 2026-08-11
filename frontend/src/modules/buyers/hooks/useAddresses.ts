import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buyersService } from '../services/buyers.service';
import { CreateAddressInput } from '../types';

const ADDRESSES_KEY = ['buyers', 'addresses'];

export function useAddresses() {
  return useQuery({ queryKey: ADDRESSES_KEY, queryFn: buyersService.listAddresses });
}

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAddressInput) => buyersService.createAddress(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => buyersService.deleteAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => buyersService.setDefaultAddress(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADDRESSES_KEY });
    },
  });
}
