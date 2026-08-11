import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buyersService } from '../services/buyers.service';

const WISHLIST_KEY = ['buyers', 'wishlist'];

export function useWishlist() {
  return useQuery({ queryKey: WISHLIST_KEY, queryFn: buyersService.listWishlist });
}

export function useRemoveFromWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => buyersService.removeFromWishlist(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_KEY });
    },
  });
}

export function useAddToWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => buyersService.addToWishlist(productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WISHLIST_KEY });
    },
  });
}
