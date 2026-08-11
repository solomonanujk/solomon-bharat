import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsService } from '../services/products.service';
import { UpdateProductInput } from '../types';

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProductInput }) => productsService.update(id, input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['products', 'mine'] });
      queryClient.invalidateQueries({ queryKey: ['products', 'mine', 'detail', variables.id] });
    },
  });
}
