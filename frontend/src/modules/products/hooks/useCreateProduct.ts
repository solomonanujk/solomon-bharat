import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsService } from '../services/products.service';
import { CreateProductInput } from '../types';

export function useCreateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProductInput) => productsService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'mine'] });
    },
  });
}
