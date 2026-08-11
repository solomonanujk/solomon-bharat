import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sellersService } from '../services/sellers.service';

export function useSellerApplications() {
  return useQuery({ queryKey: ['sellers', 'applications'], queryFn: sellersService.listApplications });
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

export function useAdminSellers() {
  return useQuery({ queryKey: ['sellers', 'admin-list'], queryFn: sellersService.listSellers });
}

export function useAdminSeller(id: string) {
  return useQuery({
    queryKey: ['sellers', 'admin-detail', id],
    queryFn: () => sellersService.getSeller(id),
    enabled: Boolean(id),
  });
}
