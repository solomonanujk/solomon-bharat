import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sellersService } from '../services/sellers.service';
import { AdminSellerListFilter, SellerApplicationListFilter } from '../types';

export function useSellerApplications(filter: SellerApplicationListFilter = {}) {
  return useQuery({
    queryKey: ['sellers', 'applications', filter],
    queryFn: () => sellersService.listApplications(filter),
  });
}

export function useApproveApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sellersService.approveApplication(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sellers'] }),
  });
}

export function useRejectApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => sellersService.rejectApplication(id, reason),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sellers'] }),
  });
}

export function useRequestApplicationInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message: string }) =>
      sellersService.requestApplicationInfo(id, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sellers'] }),
  });
}

export function useAddApplicationNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => sellersService.addApplicationNote(id, note),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sellers'] }),
  });
}

export function useAdminSellers(filter: AdminSellerListFilter = {}) {
  return useQuery({ queryKey: ['sellers', 'admin-list', filter], queryFn: () => sellersService.listSellers(filter) });
}

export function useAdminSeller(id: string) {
  return useQuery({
    queryKey: ['sellers', 'admin-detail', id],
    queryFn: () => sellersService.getSeller(id),
    enabled: Boolean(id),
  });
}
