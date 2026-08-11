import { useQuery } from '@tanstack/react-query';
import { productsService } from '../services/products.service';

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['products', 'detail', slug],
    queryFn: () => productsService.getBySlug(slug),
    enabled: Boolean(slug),
  });
}