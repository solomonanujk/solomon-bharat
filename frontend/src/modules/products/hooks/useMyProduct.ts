import { useQuery } from '@tanstack/react-query';
import { productsService } from '../services/products.service';

export function useMyProduct(id: string) {
  return useQuery({
    queryKey: ['products', 'mine', 'detail', id],
    queryFn: () => productsService.getMine(id),
    enabled: Boolean(id),
  });
}
