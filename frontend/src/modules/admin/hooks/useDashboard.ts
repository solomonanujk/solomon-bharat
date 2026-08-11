import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';

export function useAdminDashboard() {
  return useQuery({ queryKey: ['admin', 'dashboard'], queryFn: adminService.getDashboard });
}
