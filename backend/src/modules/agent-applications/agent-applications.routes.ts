import { Router } from 'express';
import { agentApplicationsController } from './agent-applications.controller';
import {
  addAgentNoteSchema,
  agentApplicationListQuerySchema,
  idParamSchema,
  rejectAgentApplicationSchema,
  requestAgentMoreInfoSchema,
  submitAgentApplicationSchema,
  updateAgentProfileSchema,
} from './agent-applications.validation';
import { paginationQuerySchema } from '../../utils/pagination';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAgent, requireAuth } from '../../middleware/auth';
import { authRateLimiter } from '../../middleware/rateLimiter';
import { asyncHandler } from '../../utils/asyncHandler';

export const agentApplicationsRouter = Router();

/**
 * @openapi
 * /agents/apply:
 *   post:
 *     summary: Submit an agent application (public)
 *     tags: [Agents]
 *     security: []
 *     requestBody: { required: true }
 *     responses:
 *       201: { description: Application submitted }
 */
agentApplicationsRouter.post(
  '/apply',
  authRateLimiter,
  validate(submitAgentApplicationSchema),
  asyncHandler(agentApplicationsController.submitApplication),
);

/**
 * @openapi
 * /agents/applications:
 *   get:
 *     summary: List agent applications (SUPER_ADMIN only)
 *     tags: [Agents]
 *     responses:
 *       200: { description: Applications list }
 */
agentApplicationsRouter.get(
  '/applications',
  requireAuth,
  requireAdmin,
  validate(agentApplicationListQuerySchema, 'query'),
  asyncHandler(agentApplicationsController.listApplications),
);

/**
 * @openapi
 * /agents/applications/{id}:
 *   get:
 *     summary: Get agent application detail (SUPER_ADMIN only)
 *     tags: [Agents]
 *     responses:
 *       200: { description: Application detail }
 */
agentApplicationsRouter.get(
  '/applications/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(agentApplicationsController.getApplication),
);

/**
 * @openapi
 * /agents/applications/{id}/approve:
 *   post:
 *     summary: Approve an agent application — creates the AGENT account (SUPER_ADMIN only)
 *     tags: [Agents]
 *     responses:
 *       200: { description: Application approved }
 */
agentApplicationsRouter.post(
  '/applications/:id/approve',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(agentApplicationsController.approveApplication),
);

/**
 * @openapi
 * /agents/applications/{id}/reject:
 *   post:
 *     summary: Reject an agent application (SUPER_ADMIN only)
 *     tags: [Agents]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Application rejected }
 */
agentApplicationsRouter.post(
  '/applications/:id/reject',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(rejectAgentApplicationSchema),
  asyncHandler(agentApplicationsController.rejectApplication),
);

/**
 * @openapi
 * /agents/applications/{id}/request-info:
 *   post:
 *     summary: Request more information from an applicant (SUPER_ADMIN only)
 *     tags: [Agents]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: More information requested }
 */
agentApplicationsRouter.post(
  '/applications/:id/request-info',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(requestAgentMoreInfoSchema),
  asyncHandler(agentApplicationsController.requestMoreInfo),
);

/**
 * @openapi
 * /agents/applications/{id}/notes:
 *   post:
 *     summary: Add an internal note to an agent application (SUPER_ADMIN only)
 *     tags: [Agents]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Note added }
 */
agentApplicationsRouter.post(
  '/applications/:id/notes',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  validate(addAgentNoteSchema),
  asyncHandler(agentApplicationsController.addNote),
);

/**
 * @openapi
 * /agents/me:
 *   get:
 *     summary: Get my own agent profile (AGENT only)
 *     tags: [Agents]
 *     responses:
 *       200: { description: Agent profile }
 */
agentApplicationsRouter.get('/me', requireAuth, requireAgent, asyncHandler(agentApplicationsController.getMyProfile));

/**
 * @openapi
 * /agents/me:
 *   patch:
 *     summary: Update my own agent profile (AGENT only)
 *     tags: [Agents]
 *     requestBody: { required: true }
 *     responses:
 *       200: { description: Profile updated }
 */
agentApplicationsRouter.patch(
  '/me',
  requireAuth,
  requireAgent,
  validate(updateAgentProfileSchema),
  asyncHandler(agentApplicationsController.updateMyProfile),
);

/**
 * @openapi
 * /agents:
 *   get:
 *     summary: List approved agents (SUPER_ADMIN only)
 *     tags: [Agents]
 *     responses:
 *       200: { description: Agents list }
 */
agentApplicationsRouter.get(
  '/',
  requireAuth,
  requireAdmin,
  validate(paginationQuerySchema, 'query'),
  asyncHandler(agentApplicationsController.listAgents),
);

/**
 * @openapi
 * /agents/{id}:
 *   get:
 *     summary: Get agent detail (SUPER_ADMIN only)
 *     tags: [Agents]
 *     responses:
 *       200: { description: Agent detail }
 */
agentApplicationsRouter.get(
  '/:id',
  requireAuth,
  requireAdmin,
  validate(idParamSchema, 'params'),
  asyncHandler(agentApplicationsController.getAgent),
);
