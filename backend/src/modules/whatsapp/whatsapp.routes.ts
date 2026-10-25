import { Router } from 'express';
import { Role } from '@prisma/client';
import { whatsAppController } from './whatsapp.controller';
import { whatsAppLinkingController } from './whatsapp.linking.controller';
import { whatsAppAdminController } from './whatsapp.admin.controller';
import { adminProductsQuerySchema, adminSellersQuerySchema } from './whatsapp.admin.validation';
import { requestLinkSchema, verifyLinkSchema } from './whatsapp.validation';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireRole } from '../../middleware/auth';
import { paginationQuerySchema } from '../../utils/pagination';
import { asyncHandler } from '../../utils/asyncHandler';

export const whatsAppRouter = Router();

/**
 * @openapi
 * /whatsapp/webhook:
 *   get:
 *     summary: Meta webhook verification handshake (verify token, called by Meta only)
 *     tags: [WhatsApp]
 *     security: []
 *     responses:
 *       200: { description: Challenge echoed }
 *       403: { description: Wrong verify token }
 *   post:
 *     summary: Inbound WhatsApp webhook, Twilio form or Meta JSON (signature-verified, called by the provider only)
 *     tags: [WhatsApp]
 *     security: []
 *     responses:
 *       200: { description: Accepted }
 *       403: { description: Invalid signature }
 */
whatsAppRouter.post('/webhook', asyncHandler(whatsAppController.webhook));
whatsAppRouter.get('/webhook', asyncHandler(whatsAppController.challenge));

const seller = [requireAuth, requireRole(Role.SELLER)];

/**
 * @openapi
 * /whatsapp/link:
 *   get:
 *     summary: Is my WhatsApp number linked? (seller)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Link status }
 *   post:
 *     summary: Send a verification code to a WhatsApp number (seller)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Code sent }
 *   delete:
 *     summary: Unlink my WhatsApp number (seller)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Unlinked }
 */
whatsAppRouter.get('/link', ...seller, asyncHandler(whatsAppLinkingController.status));
whatsAppRouter.post('/link', ...seller, validate(requestLinkSchema), asyncHandler(whatsAppLinkingController.requestCode));
whatsAppRouter.delete('/link', ...seller, asyncHandler(whatsAppLinkingController.unlink));

/**
 * @openapi
 * /whatsapp/link/verify:
 *   post:
 *     summary: Confirm the 6-digit code and link the number (seller)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Linked }
 */
whatsAppRouter.post('/link/verify', ...seller, validate(verifyLinkSchema), asyncHandler(whatsAppLinkingController.verify));

const admin = [requireAuth, requireAdmin];

/**
 * @openapi
 * /whatsapp/admin/summary:
 *   get:
 *     summary: Counts for the admin WhatsApp tab (SUPER_ADMIN)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Pending WhatsApp products, live listings, linked sellers }
 * /whatsapp/admin/products:
 *   get:
 *     summary: Products sellers created by WhatsApp chat (SUPER_ADMIN)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Paginated products }
 * /whatsapp/admin/sessions:
 *   get:
 *     summary: Listings sellers are in the middle of right now (SUPER_ADMIN)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Paginated open listings }
 * /whatsapp/admin/sellers:
 *   get:
 *     summary: Sellers with a verified WhatsApp number (SUPER_ADMIN)
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: Paginated sellers }
 */
whatsAppRouter.get('/admin/summary', ...admin, asyncHandler(whatsAppAdminController.summary));
whatsAppRouter.get('/admin/products', ...admin, validate(adminProductsQuerySchema, 'query'), asyncHandler(whatsAppAdminController.products));
whatsAppRouter.get('/admin/sessions', ...admin, validate(paginationQuerySchema, 'query'), asyncHandler(whatsAppAdminController.sessions));
whatsAppRouter.get('/admin/sellers', ...admin, validate(adminSellersQuerySchema, 'query'), asyncHandler(whatsAppAdminController.sellers));
