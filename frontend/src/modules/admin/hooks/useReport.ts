import { useMutation, useQuery } from '@tanstack/react-query';
import { adminService } from '../services/admin.service';
import { ReportFilter, ReportType } from '../types';

export function useReport<T>(type: ReportType, filter: ReportFilter = {}) {
  return useQuery({
    queryKey: ['admin', 'report', type, filter],
    queryFn: () => adminService.getReport<T>(type, filter),
  });
}

export function useDownloadReportCsv() {
  return useMutation({
    mutationFn: ({ type, filter }: { type: ReportType; filter?: ReportFilter }) =>
      adminService.downloadReportCsv(type, filter),
  });
}
