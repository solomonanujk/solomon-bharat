import { useQuery } from '@tanstack/react-query';
import { collectionsService } from '../services/collections.service';

export function useCollections(page = 1, limit = 12) {
  return useQuery({
    queryKey: ['collections', 'list', page, limit],
    queryFn: () => collectionsService.listPublished(page, limit),
  });
}