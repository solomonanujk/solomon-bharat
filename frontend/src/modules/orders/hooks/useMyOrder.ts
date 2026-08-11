import { useQuery } from '@tanstack/react-query';
import { ordersService } from '../services/orders.service';

export function useMyOrder(id: string) {
  return useQuery({
    queryKey: ['orders', 'mine', 'detail', id],
    queryFn: () => ordersService.getMine(id),
    enabled: Boolean(id),
  });
}
