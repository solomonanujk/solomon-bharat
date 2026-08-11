import { useQuery } from '@tanstack/react-query';
import { categoriesService } from '../services/categories.service';

export function useCategory(slug: string) {
  return useQuery({
    queryKey: ['categories', 'detail', slug],
    queryFn: () => categoriesService.getBySlug(slug),
    enabled: Boolean(slug),
  });
}