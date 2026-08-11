import { useQuery } from '@tanstack/react-query';
import { productsService } from '../services/products.service';
import { SellerProductListFilter } from '../types';

export function useMyProducts(filter: SellerProductListFilter = {}) {
  return useQuery({
    queryKey: ['products', 'mine', filter],
    queryFn: () => productsService.listMine(filter),
  });
}
