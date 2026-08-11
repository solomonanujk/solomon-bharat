import { Router } from 'express';
import { adminController } from './admin.controller';
import {
  auditLogQuerySchema,
  idParamSchema,
  keyParamSchema,
  reportQuerySchema,
  upsertSettingSchema,
  userListQuerySchema,
} from './admin.validation';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

/**
 * @openapi
 * /admin/dashboard:
 *   get:
 *     summary: Get admin dashboard KPI summary (SUPER_ADMIN only)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Dashboard summary }
 */
adminRouter.get('/dashboard', asyncHandler(adminController.getDashboard));

/**
 * @openapi
 * /admin/reports:
 *   get:
 *     summary: Get a report (revenue, orders-by-status, orders-by-country, sellers/products/categories/collections performance), JSON or CSV (SUPER_ADMIN only)
 *     tags: [Admin]
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, csv] }
 *     responses:
 *       200: { description: Report data }
 */
adminRouter.get('/reports', validate(reportQuerySchema, 'query'), asyncHandler(adminController.getReport));

/**
 * @openapi
 * /admin/audit-log:
 *   get:
 *     summary: List sensitive admin action audit log entries (SUPER_ADMIN only)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Audit log entries }
 */
adminRouter.get(
  '/audit-log',
  validate(auditLogQuerySchema, 'query'),
  asyncHandler(adminController.getAuditLog),
);

/**
 * @openapi
 * /admin/settings:
 *   get:
 *     summary: List platform settings (SUPER_ADMIN only)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Settings list }
 */
adminRouter.get('/settings', asyncHandler(adminController.listSettings));

/**
 * @openapi
 * /admin/settings/{key}:
 *   put:
 *     summary: Create or update a platform setting (SUPER_ADMIN only)
 *     tags: [Admin]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Setting saved }
 */
adminRouter.put(
  '/settings/:key',
  validate(keyParamSchema, 'params'),
  validate(upsertSettingSchema),
  asyncHandler(adminController.upsertSetting),
);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     summary: List all platform users (SUPER_ADMIN only)
 *     tags: [Admin]
 *     responses:
 *       200: { description: Users list }
 */
adminRouter.get('/users', validate(userListQuerySchema, 'query'), asyncHandler(adminController.listUsers));

/**
 * @openapi
 * /admin/users/{id}/suspend:
 *   post:
 *     summary: Suspend a user account (SUPER_ADMIN only)
 *     tags: [Admin]
 *     responses:
 *       200: { description: User suspended }
 */
adminRouter.post(
  '/users/:id/suspend',
  validate(idParamSchema, 'params'),
  asyncHandler(adminController.suspendUser),
);

/**
 * @openapi
 * /admin/users/{id}/reactivate:
 *   post:
 *     summary: Reactivate a suspended user account (SUPER_ADMIN only)
 *     tags: [Admin]
 *     responses:
 *       200: { description: User reactivated }
 */
adminRouter.post(
  '/users/:id/reactivate',
  validate(idParamSchema, 'params'),
  asyncHandler(adminController.reactivateUser),
);

/**
 * @openapi
 * /admin/users/{id}/promote:
 *   post:
 *     summary: Promote a user to SUPER_ADMIN (SUPER_ADMIN only) — role escalation, cannot be self-service
 *     tags: [Admin]
 *     responses:
 *       200: { description: User promoted }
 */
adminRouter.post(
  '/users/:id/promote',
  validate(idParamSchema, 'params'),
  asyncHandler(adminController.promoteToAdmin),
);
