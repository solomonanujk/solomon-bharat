import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ordersService } from '../services/orders.service';
import { AdminOrderListFilter } from '../types';

export function useAdminOrders(filter: AdminOrderListFilter = {}) {
  return useQuery({
    queryKey: ['orders', 'admin', filter],
    queryFn: () => ordersService.listAdmin(filter),
  });
}

export function useAdminOrder(id: string) {
  return useQuery({
    queryKey: ['orders', 'admin', 'detail', id],
    queryFn: () => ordersService.getAdmin(id),
    enabled: Boolean(id),
  });
}

function useOrderTransition(fn: (id: string) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'admin'] }),
  });
}

export function useConfirmOrder() {
  return useOrderTransition((id) => ordersService.confirm(id));
}

export function useCollectOrder() {
  return useOrderTransition((id) => ordersService.collect(id));
}

export function useDeliverOrder() {
  return useOrderTransition((id) => ordersService.deliver(id));
}

export function useProcureOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedCollectionDate }: { id: string; expectedCollectionDate?: string }) =>
      ordersService.procure(id, expectedCollectionDate),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'admin'] }),
  });
}

export function useShipOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, trackingNumber }: { id: string; trackingNumber?: string }) =>
      ordersService.ship(id, trackingNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'admin'] }),
  });
}
