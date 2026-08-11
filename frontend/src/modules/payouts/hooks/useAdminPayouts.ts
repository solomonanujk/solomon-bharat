import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { payoutsService } from '../services/payouts.service';
import { AdminPayoutListFilter } from '../types';

export function useAdminPayouts(filter: AdminPayoutListFilter = {}) {
  return useQuery({
    queryKey: ['payouts', 'admin', filter],
    queryFn: () => payoutsService.listAdmin(filter),
  });
}

export function useAdminPayout(id: string) {
  return useQuery({
    queryKey: ['payouts', 'admin', 'detail', id],
    queryFn: () => payoutsService.getAdmin(id),
    enabled: Boolean(id),
  });
}

export function useMarkPayoutPaid() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => payoutsService.markPaid(id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payouts', 'admin'] }),
  });
}

export function useAddPayoutNotes() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes: string }) => payoutsService.addNotes(id, notes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payouts', 'admin'] }),
  });
}
