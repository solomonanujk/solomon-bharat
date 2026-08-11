import { useQuery } from '@tanstack/react-query';
import { categoriesService } from '../services/categories.service';

export function useCategories() {
  return useQuery({
    queryKey: ['categories', 'tree'],
    queryFn: categoriesService.getTree,
  });
}