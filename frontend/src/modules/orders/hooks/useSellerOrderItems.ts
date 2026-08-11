import { useQuery } from '@tanstack/react-query';
import { ordersService } from '../services/orders.service';

export function useSellerOrderItems(page = 1, limit = 20) {
  return useQuery({
    queryKey: ['orders', 'seller-items', page, limit],
    queryFn: () => ordersService.listSellerItems(page, limit),
  });
}
