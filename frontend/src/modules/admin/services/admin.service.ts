import { apiClient } from '@/lib/axios';
import { ApiResponse } from '@/types/api';
import { DashboardSummary, ReportType } from '../types';

export const adminService = {
  async getDashboard(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<ApiResponse<DashboardSummary>>('/admin/dashboard');
    return data.data;
  },

  async getReport<T>(type: ReportType): Promise<T[]> {
    const { data } = await apiClient.get<ApiResponse<T[]>>('/admin/reports', { params: { type } });
    return data.data;
  },
};
