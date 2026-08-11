import { apiClient } from '@/lib/axios';
import { SafeUser } from '@/modules/auth/types';
import { ApiResponse } from '@/types/api';
import {
  AdminUserListFilter,
  AuditLog,
  AuditLogFilter,
  DashboardSummary,
  PlatformSetting,
  ReportFilter,
  ReportType,
} from '../types';

export const adminService = {
  async getDashboard(): Promise<DashboardSummary> {
    const { data } = await apiClient.get<ApiResponse<DashboardSummary>>('/admin/dashboard');
    return data.data;
  },

  async getReport<T>(type: ReportType, filter: ReportFilter = {}): Promise<T[]> {
    const { data } = await apiClient.get<ApiResponse<T[]>>('/admin/reports', {
      params: { type, format: 'json', ...filter },
    });
    return data.data;
  },

  /** Triggers a browser download — the CSV endpoint is a raw file response, not the JSON envelope. */
  async downloadReportCsv(type: ReportType, filter: ReportFilter = {}): Promise<void> {
    const response = await apiClient.get('/admin/reports', {
      params: { type, format: 'csv', ...filter },
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${type}-report.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  async getAuditLog(filter: AuditLogFilter = {}): Promise<{ data: AuditLog[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<AuditLog[]>>('/admin/audit-log', {
      params: { limit: 20, ...filter },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async getSettings(): Promise<PlatformSetting[]> {
    const { data } = await apiClient.get<ApiResponse<PlatformSetting[]>>('/admin/settings');
    return data.data;
  },

  async updateSetting(key: string, value: unknown): Promise<PlatformSetting> {
    const { data } = await apiClient.put<ApiResponse<PlatformSetting>>(`/admin/settings/${key}`, { value });
    return data.data;
  },

  async listUsers(filter: AdminUserListFilter = {}): Promise<{ data: SafeUser[]; total: number }> {
    const { data } = await apiClient.get<ApiResponse<SafeUser[]>>('/admin/users', {
      params: { limit: 20, ...filter },
    });
    return { data: data.data, total: data.meta?.total ?? data.data.length };
  },

  async suspendUser(id: string): Promise<SafeUser> {
    const { data } = await apiClient.post<ApiResponse<SafeUser>>(`/admin/users/${id}/suspend`);
    return data.data;
  },

  async reactivateUser(id: string): Promise<SafeUser> {
    const { data } = await apiClient.post<ApiResponse<SafeUser>>(`/admin/users/${id}/reactivate`);
    return data.data;
  },

  async promoteUser(id: string): Promise<SafeUser> {
    const { data } = await apiClient.post<ApiResponse<SafeUser>>(`/admin/users/${id}/promote`);
    return data.data;
  },
};
