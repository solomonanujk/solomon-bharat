import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { AdminUserListFilter } from '../types';

export function useAdminUsers(filter: AdminUserListFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'users', filter],
    queryFn: () => adminService.listUsers(filter),
  });
}

export function useSuspendUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.suspendUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useReactivateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.reactivateUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function usePromoteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminService.promoteUser(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}
