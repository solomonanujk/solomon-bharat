import { NextFunction, Request, Response, Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import { AppError } from '../../utils/errors';
import { buildPaginationMeta, paginationQuerySchema, PaginationQuery } from '../../utils/pagination';
import { sendCreated, sendSuccess } from '../../utils/response';
import { guideService } from './guide.service';

export const MAX_GUIDE_FILE_BYTES = 25 * 1024 * 1024; // 25MB (PDF request limit is 32MB)

const fileUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_GUIDE_FILE_BYTES, files: 1 } }).single('file');
function uploadGuideFile(req: Request, res: Response, next: NextFunction): void {
  fileUpload(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      next(AppError.badRequest(err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. The maximum is 25 MB.' : err.message));
      return;
    }
    next(err as Error | undefined);
  });
}

const startSchema = z.object({
  name: z.string().trim().min(2, 'Enter your name').max(120),
  email: z.string().trim().email('Enter a valid email address').max(200),
  phone: z.string().trim().min(6, 'Enter a valid phone number').max(30).regex(/^[+()\d\s-]+$/, 'Enter a valid phone number'),
  country: z.string().trim().max(100).optional(),
});
const chatSchema = z.object({
  token: z.string().min(20).max(100),
  message: z.string().trim().min(1, 'Type a message').max(2000, 'Keep messages under 2,000 characters'),
});
const tokenQuerySchema = z.object({ token: z.string().min(20).max(100) });
const textSchema = z.object({
  title: z.string().trim().min(1, 'Add a title').max(200),
  text: z.string().trim().min(1, 'Add some text').max(500_000),
});
const settingsSchema = z.object({ allowWebSearch: z.boolean() });
const idParamSchema = z.object({ id: z.string().uuid() });

export const guideRouter = Router();

// ─── Public: visitor chat (details required before chatting) ────────────────

guideRouter.post(
  '/start',
  validate(startSchema),
  asyncHandler(async (req, res) => {
    sendCreated(res, await guideService.start(req.body), 'Chat started');
  }),
);

guideRouter.get(
  '/history',
  validate(tokenQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await guideService.history(String(req.query.token)));
  }),
);

guideRouter.post(
  '/chat',
  validate(chatSchema),
  asyncHandler(async (req, res) => {
    sendSuccess(res, await guideService.chat(req.body.token, req.body.message));
  }),
);

// ─── Admin: knowledge, suggestions, settings, conversations ─────────────────

guideRouter.get('/admin/knowledge', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  sendSuccess(res, await guideService.listKnowledge());
}));

guideRouter.post('/admin/knowledge/text', requireAuth, requireAdmin, validate(textSchema), asyncHandler(async (req, res) => {
  sendCreated(res, await guideService.addText(req.user!.id, req.body.title, req.body.text), 'Added');
}));

guideRouter.post('/admin/knowledge/file', requireAuth, requireAdmin, uploadGuideFile, asyncHandler(async (req, res) => {
  if (!req.file) throw AppError.badRequest('Choose a file to upload');
  const title = typeof req.body?.title === 'string' ? req.body.title : undefined;
  sendCreated(res, await guideService.addFile(req.user!.id, req.file, title), 'Added');
}));

guideRouter.delete('/admin/knowledge', requireAuth, requireAdmin, asyncHandler(async (req, res) => {
  sendSuccess(res, await guideService.deleteAllKnowledge(req.user!.id), 'All items removed');
}));

guideRouter.get('/admin/knowledge/:id', requireAuth, requireAdmin, validate(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  sendSuccess(res, await guideService.getKnowledgeItem(req.params.id));
}));

guideRouter.delete('/admin/knowledge/:id', requireAuth, requireAdmin, validate(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  await guideService.deleteKnowledge(req.user!.id, req.params.id);
  sendSuccess(res, null, 'Deleted');
}));

guideRouter.get('/admin/suggestions', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  sendSuccess(res, await guideService.getSuggestions());
}));

guideRouter.post('/admin/suggestions/refresh', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  sendSuccess(res, await guideService.refreshSuggestions());
}));

guideRouter.get('/admin/settings', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  sendSuccess(res, await guideService.getSettings());
}));

guideRouter.put('/admin/settings', requireAuth, requireAdmin, validate(settingsSchema), asyncHandler(async (req, res) => {
  sendSuccess(res, await guideService.updateSettings(req.user!.id, req.body), 'Saved');
}));

const aiKeySchema = z.object({
  key: z.string().trim().min(20, 'Paste the full key').max(300),
  provider: z.enum(['gemini', 'openrouter']).default('gemini'),
});
const providerQuerySchema = z.object({ provider: z.enum(['gemini', 'openrouter']).default('gemini') });

guideRouter.get('/admin/ai-key', requireAuth, requireAdmin, asyncHandler(async (_req, res) => {
  sendSuccess(res, await guideService.getAiKeyStatus());
}));

guideRouter.put('/admin/ai-key', requireAuth, requireAdmin, validate(aiKeySchema), asyncHandler(async (req, res) => {
  sendSuccess(res, await guideService.saveAiKey(req.user!.id, req.body.key, req.body.provider), 'Connected');
}));

guideRouter.delete('/admin/ai-key', requireAuth, requireAdmin, validate(providerQuerySchema, 'query'), asyncHandler(async (req, res) => {
  sendSuccess(res, await guideService.removeAiKey(req.user!.id, String(req.query.provider) as 'gemini' | 'openrouter'), 'Removed');
}));

guideRouter.get('/admin/conversations', requireAuth, requireAdmin, validate(paginationQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const q = req.query as unknown as PaginationQuery;
  const { rows, total } = await guideService.listConversations(q.page, q.limit);
  sendSuccess(res, rows, 'Conversations', 200, buildPaginationMeta(total, q));
}));

guideRouter.get('/admin/conversations/:id', requireAuth, requireAdmin, validate(idParamSchema, 'params'), asyncHandler(async (req, res) => {
  sendSuccess(res, await guideService.getConversation(req.params.id));
}));
