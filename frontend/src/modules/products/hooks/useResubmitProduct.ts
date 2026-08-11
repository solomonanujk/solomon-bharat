import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsService } from '../services/products.service';

export function useResubmitProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productsService.resubmit(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', 'mine'] });
    },
  });
}
