import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { ReportType } from '../types';

export function useReport<T>(type: ReportType) {
  return useQuery({
    queryKey: ['admin', 'report', type],
    queryFn: () => adminService.getReport<T>(type),
  });
}
