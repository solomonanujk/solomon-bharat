import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/**
 * Cross-cutting audit trail for sensitive admin actions (approvals, price changes,
 * payout marking). Lives outside the admin module so every module can log directly
 * without depending on admin's dashboard/report logic (built later, in Stage 3).
 */
export function writeAuditLog(
  adminId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
): Promise<unknown> {
  return prisma.auditLog.create({
    data: { adminId, action, entityType, entityId, metadata: metadata as Prisma.InputJsonValue },
  });
}
