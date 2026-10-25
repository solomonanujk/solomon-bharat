import { Router } from 'express';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { bulkMessagesController as c } from './bulk-messages.controller';
import {
  audiencePreviewSchema,
  campaignInputSchema,
  campaignListQuerySchema,
  idParamSchema,
  recipientListQuerySchema,
  replyListQuerySchema,
  templateInputSchema,
  templateListQuerySchema,
  testSendSchema,
} from './bulk-messages.validation';

/** Admin-only: build WhatsApp templates, send them to registered sellers, watch delivery and replies. */
export const bulkMessagesRouter = Router();
bulkMessagesRouter.use(requireAuth, requireAdmin);

/**
 * @openapi
 * /admin/bulk-messages/templates:
 *   get:
 *     summary: List bulk-message templates (SUPER_ADMIN)
 *     tags: [Bulk Messages]
 *     responses:
 *       200: { description: Paginated templates }
 *   post:
 *     summary: Save a new template as a draft (SUPER_ADMIN)
 *     tags: [Bulk Messages]
 *     responses:
 *       201: { description: Draft created }
 * /admin/bulk-messages/templates/{id}/submit:
 *   post:
 *     summary: Submit a draft template to Meta for review (SUPER_ADMIN)
 *     tags: [Bulk Messages]
 *     responses:
 *       200: { description: Submitted }
 * /admin/bulk-messages/campaigns:
 *   get:
 *     summary: List campaigns with delivery counts (SUPER_ADMIN)
 *     tags: [Bulk Messages]
 *     responses:
 *       200: { description: Paginated campaigns }
 *   post:
 *     summary: Create a campaign; freezes the audience of registered sellers (SUPER_ADMIN)
 *     tags: [Bulk Messages]
 *     responses:
 *       201: { description: Campaign created }
 */
bulkMessagesRouter.get('/summary', asyncHandler(c.summary));

bulkMessagesRouter.get('/templates', validate(templateListQuerySchema, 'query'), asyncHandler(c.listTemplates));
bulkMessagesRouter.post('/templates', validate(templateInputSchema), asyncHandler(c.createTemplate));
bulkMessagesRouter.post('/templates/sync', asyncHandler(c.syncTemplates));
bulkMessagesRouter.get('/templates/:id', validate(idParamSchema, 'params'), asyncHandler(c.getTemplate));
bulkMessagesRouter.put('/templates/:id', validate(idParamSchema, 'params'), validate(templateInputSchema), asyncHandler(c.updateTemplate));
bulkMessagesRouter.post('/templates/:id/submit', validate(idParamSchema, 'params'), asyncHandler(c.submitTemplate));
bulkMessagesRouter.post('/templates/:id/refresh', validate(idParamSchema, 'params'), asyncHandler(c.refreshTemplate));
bulkMessagesRouter.delete('/templates/:id', validate(idParamSchema, 'params'), asyncHandler(c.deleteTemplate));

bulkMessagesRouter.post('/audience/preview', validate(audiencePreviewSchema), asyncHandler(c.previewAudience));
bulkMessagesRouter.post('/test-send', validate(testSendSchema), asyncHandler(c.testSend));

bulkMessagesRouter.get('/campaigns', validate(campaignListQuerySchema, 'query'), asyncHandler(c.listCampaigns));
bulkMessagesRouter.post('/campaigns', validate(campaignInputSchema), asyncHandler(c.createCampaign));
bulkMessagesRouter.get('/campaigns/:id', validate(idParamSchema, 'params'), asyncHandler(c.getCampaign));
bulkMessagesRouter.get('/campaigns/:id/recipients', validate(idParamSchema, 'params'), validate(recipientListQuerySchema, 'query'), asyncHandler(c.listRecipients));
bulkMessagesRouter.get('/campaigns/:id/export', validate(idParamSchema, 'params'), asyncHandler(c.exportCampaign));
bulkMessagesRouter.post('/campaigns/:id/start', validate(idParamSchema, 'params'), asyncHandler(c.start));
bulkMessagesRouter.post('/campaigns/:id/pause', validate(idParamSchema, 'params'), asyncHandler(c.pause));
bulkMessagesRouter.post('/campaigns/:id/resume', validate(idParamSchema, 'params'), asyncHandler(c.resume));
bulkMessagesRouter.post('/campaigns/:id/cancel', validate(idParamSchema, 'params'), asyncHandler(c.cancel));

bulkMessagesRouter.get('/replies', validate(replyListQuerySchema, 'query'), asyncHandler(c.listReplies));
bulkMessagesRouter.post('/replies/read-all', asyncHandler(c.markAllRead));
bulkMessagesRouter.post('/replies/:id/read', validate(idParamSchema, 'params'), asyncHandler(c.markReplyRead));
