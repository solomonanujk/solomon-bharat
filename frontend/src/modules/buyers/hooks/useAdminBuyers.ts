import { useQuery } from '@tanstack/react-query';
import { buyersService } from '../services/buyers.service';

export function useAdminBuyers() {
  return useQuery({ queryKey: ['buyers', 'admin-list'], queryFn: buyersService.listBuyersAdmin });
}
