import { useQuery } from '@tanstack/react-query';
import { collectionsService } from '../services/collections.service';

export function useFeaturedCollections() {
  return useQuery({
    queryKey: ['collections', 'featured'],
    queryFn: collectionsService.listFeatured,
  });
}