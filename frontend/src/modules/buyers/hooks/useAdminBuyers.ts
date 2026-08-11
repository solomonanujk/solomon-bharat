import { useQuery } from '@tanstack/react-query';
import { buyersService } from '../services/buyers.service';
import { AdminBuyerListFilter } from '../types';

export function useAdminBuyers(filter: AdminBuyerListFilter = {}) {
  return useQuery({ queryKey: ['buyers', 'admin-list', filter], queryFn: () => buyersService.listBuyersAdmin(filter) });
}
