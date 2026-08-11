import { Request, Response } from 'express';
import { sendSuccess } from '../../utils/response';
import { buildPaginationMeta } from '../../utils/pagination';
import { adminService } from './admin.service';
import { AuditLogQueryDto, ReportQueryDto, UpsertSettingDto, UserListQueryDto } from './admin.validation';

export const adminController = {
  async getDashboard(_req: Request, res: Response): Promise<void> {
    const summary = await adminService.getDashboard();
    sendSuccess(res, summary);
  },

  async getReport(req: Request, res: Response): Promise<void> {
    const { type, from, to, format } = req.query as unknown as ReportQueryDto;

    if (format === 'csv') {
      const csv = await adminService.getReportAsCsv(type, { from, to });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
      res.status(200).send(csv);
      return;
    }

    const rows = await adminService.getReport(type, { from, to });
    sendSuccess(res, rows);
  },

  async getAuditLog(req: Request, res: Response): Promise<void> {
    const { entityType, adminId, ...pagination } = req.query as unknown as AuditLogQueryDto;
    const { data, total } = await adminService.getAuditLog({ entityType, adminId }, pagination);
    sendSuccess(res, data, 'Audit log retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async listSettings(_req: Request, res: Response): Promise<void> {
    const settings = await adminService.listSettings();
    sendSuccess(res, settings);
  },

  async upsertSetting(req: Request, res: Response): Promise<void> {
    const dto = req.body as UpsertSettingDto;
    const setting = await adminService.upsertSetting(req.params.key, dto.value);
    sendSuccess(res, setting, 'Setting saved');
  },

  async listUsers(req: Request, res: Response): Promise<void> {
    const { role, ...pagination } = req.query as unknown as UserListQueryDto;
    const { data, total } = await adminService.listUsers({ role }, pagination);
    sendSuccess(res, data, 'Users retrieved', 200, buildPaginationMeta(total, pagination));
  },

  async suspendUser(req: Request, res: Response): Promise<void> {
    const user = await adminService.suspendUser(req.params.id, req.user!.id);
    sendSuccess(res, user, 'User suspended');
  },

  async reactivateUser(req: Request, res: Response): Promise<void> {
    const user = await adminService.reactivateUser(req.params.id, req.user!.id);
    sendSuccess(res, user, 'User reactivated');
  },

  async promoteToAdmin(req: Request, res: Response): Promise<void> {
    const user = await adminService.promoteToAdmin(req.params.id, req.user!.id);
    sendSuccess(res, user, 'User promoted to SUPER_ADMIN');
  },
};
