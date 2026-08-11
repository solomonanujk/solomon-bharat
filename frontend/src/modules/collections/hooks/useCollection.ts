import { useQuery } from '@tanstack/react-query';
import { collectionsService } from '../services/collections.service';

export function useCollection(slug: string, page = 1, limit = 12) {
  return useQuery({
    queryKey: ['collections', 'detail', slug, page, limit],
    queryFn: () => collectionsService.getBySlug(slug, page, limit),
    enabled: Boolean(slug),
  });
}