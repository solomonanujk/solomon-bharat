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

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => ordersService.cancel(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'admin'] }),
  });
}

export function useUpdateOrderTracking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, trackingNumber }: { id: string; trackingNumber: string }) =>
      ordersService.updateTracking(id, trackingNumber),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'admin'] }),
  });
}

export function useExportOrderDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documents }: { id: string; documents: string[] }) =>
      ordersService.exportDocuments(id, documents),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orders', 'admin'] }),
  });
}
