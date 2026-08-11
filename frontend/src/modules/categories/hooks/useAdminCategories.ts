import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesService } from '../services/categories.service';
import { CreateCategoryInput, ReorderCategoriesItem, UpdateCategoryInput } from '../types';

const ADMIN_TREE_KEY = ['categories', 'admin-tree'];

export function useAdminCategoryTree() {
  return useQuery({ queryKey: ADMIN_TREE_KEY, queryFn: categoriesService.getAdminTree });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCategoryInput) => categoriesService.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) => categoriesService.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
    },
  });
}

export function useArchiveCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesService.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
    },
  });
}

export function useRestoreCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
    },
  });
}

export function useReorderCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: ReorderCategoriesItem[]) => categoriesService.reorder(items),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_TREE_KEY });
      queryClient.invalidateQueries({ queryKey: ['categories', 'tree'] });
    },
  });
}
