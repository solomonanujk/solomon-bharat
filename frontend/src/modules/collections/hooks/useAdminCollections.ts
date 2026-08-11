import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { collectionsService } from '../services/collections.service';
import { CreateCollectionInput } from '../types';

export function useAdminCollections() {
  return useQuery({ queryKey: ['collections', 'admin-list'], queryFn: collectionsService.listAdmin });
}

export function useAdminCollectionDetail(id: string) {
  return useQuery({
    queryKey: ['collections', 'admin-detail', id],
    queryFn: () => collectionsService.getAdminDetail(id),
    enabled: Boolean(id),
  });
}

export function useCreateCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCollectionInput) => collectionsService.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function usePublishCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionsService.publish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function useArchiveCollection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => collectionsService.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections'] }),
  });
}

export function useAddProductToCollection(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, sortOrder }: { productId: string; sortOrder?: number }) =>
      collectionsService.addProduct(collectionId, productId, sortOrder),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections', 'admin-detail', collectionId] }),
  });
}

export function useRemoveProductFromCollection(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: string) => collectionsService.removeProduct(collectionId, productId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections', 'admin-detail', collectionId] }),
  });
}

export function useReorderCollectionProducts(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { productId: string; sortOrder: number }[]) =>
      collectionsService.reorderMembership(collectionId, items),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['collections', 'admin-detail', collectionId] }),
  });
}
