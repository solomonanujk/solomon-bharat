import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sellersService } from '../services/sellers.service';
import { UpdateSellerProfileInput } from '../types';

const PROFILE_KEY = ['sellers', 'me'];

export function useMySellerProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: sellersService.getMyProfile });
}

export function useUpdateMySellerProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSellerProfileInput) => sellersService.updateMyProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}
