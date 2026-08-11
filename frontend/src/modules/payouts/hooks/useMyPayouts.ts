import { useQuery } from '@tanstack/react-query';
import { payoutsService } from '../services/payouts.service';
import { PayoutListFilter } from '../types';

export function useMyPayouts(filter: PayoutListFilter = {}) {
  return useQuery({
    queryKey: ['payouts', 'mine', filter],
    queryFn: () => payoutsService.listMine(filter),
  });
}

export function useMyPayoutSummary() {
  return useQuery({ queryKey: ['payouts', 'mine', 'summary'], queryFn: payoutsService.getMySummary });
}
