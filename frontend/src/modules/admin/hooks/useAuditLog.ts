import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { AuditLogFilter } from '../types';

export function useAuditLog(filter: AuditLogFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'audit-log', filter],
    queryFn: () => adminService.getAuditLog(filter),
  });
}
