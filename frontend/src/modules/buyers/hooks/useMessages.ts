import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { buyersService } from '../services/buyers.service';

const MESSAGES_KEY = ['buyers', 'messages'];

export function useMyMessages() {
  return useQuery({ queryKey: MESSAGES_KEY, queryFn: buyersService.getMyMessages });
}

export function useSendMyMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => buyersService.sendMyMessage(body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MESSAGES_KEY });
    },
  });
}
