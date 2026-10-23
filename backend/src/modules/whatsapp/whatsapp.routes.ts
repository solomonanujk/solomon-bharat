import { Router } from 'express';
import { Role } from '@prisma/client';
import { whatsAppController } from './whatsapp.controller';
import { whatsAppLinkingController } from './whatsapp.linking.controller';
import { requestLinkSchema, verifyLinkSchema } from './whatsapp.validation';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
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
