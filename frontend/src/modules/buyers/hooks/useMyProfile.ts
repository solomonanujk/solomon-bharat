import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buyersService } from '../services/buyers.service';
import { UpdateBuyerProfileInput } from '../types';

const PROFILE_KEY = ['buyers', 'me'];

export function useMyProfile() {
  return useQuery({ queryKey: PROFILE_KEY, queryFn: buyersService.getMyProfile });
}

export function useUpdateMyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateBuyerProfileInput) => buyersService.updateMyProfile(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
    },
  });
}
