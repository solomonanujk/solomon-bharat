import { useQuery } from '@tanstack/react-query';
import { ordersService } from '../services/orders.service';

export function useMyOrders(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['orders', 'mine', page, limit],
    queryFn: () => ordersService.listMine(page, limit),
  });
}
