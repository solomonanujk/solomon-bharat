import { useQuery } from '@tanstack/react-query';
import { productsService } from '../services/products.service';
import { ProductListFilter } from '../types';

export function useProducts(filter: ProductListFilter) {
  return useQuery({
    queryKey: ['products', 'list', filter],
    queryFn: () => productsService.listPublished(filter),
    enabled: Boolean(filter.categoryId || filter.collectionId),
  });
}