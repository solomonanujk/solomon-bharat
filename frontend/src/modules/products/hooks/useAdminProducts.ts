import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productsService } from '../services/products.service';
import { AdminProductListFilter } from '../types';

export function useAdminProducts(filter: AdminProductListFilter = {}) {
  return useQuery({
    queryKey: ['products', 'admin', filter],
    queryFn: () => productsService.listAdmin(filter),
  });
}

export function useAdminProduct(id: string) {
  return useQuery({
    queryKey: ['products', 'admin', 'detail', id],
    queryFn: () => productsService.getAdmin(id),
    enabled: Boolean(id),
  });
}

export function useApproveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, adminPrice }: { id: string; adminPrice: number }) => productsService.approve(id, adminPrice),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', 'admin'] }),
  });
}

export function useRejectProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => productsService.reject(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products', 'admin'] }),
  });
}
