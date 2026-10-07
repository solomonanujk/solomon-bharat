import { Router } from 'express';
import { shopifyImportAdminController, shopifyImportSellerController } from './shopify-import.controller';
import {
  connectShopifySchema,
  importShopifyProductsSchema,
  listShopifyProductsQuerySchema,
  sellerIdParamSchema,
  toggleShopifySyncSchema,
} from './shopify-import.validation';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireSeller } from '../../middleware/auth';
import { asyncHandler } from '../../utils/asyncHandler';

function buildRouter(controller: typeof shopifyImportSellerController) {
  const router = Router();
  router.post('/connect', validate(connectShopifySchema), asyncHandler(controller.connect));
  router.get('/connection', asyncHandler(controller.getConnection));
  router.patch('/connection', validate(toggleShopifySyncSchema), asyncHandler(controller.updateConnection));
  router.delete('/connection', asyncHandler(controller.disconnect));
  router.post('/sync', asyncHandler(controller.sync));
  router.get('/products', validate(listShopifyProductsQuerySchema, 'query'), asyncHandler(controller.listProducts));
  router.post('/import', validate(importShopifyProductsSchema), asyncHandler(controller.importProducts));
  return router;
}

// Self-service — mounted at /sellers/me/shopify, resolves the seller profile
// from the authenticated user.
export const shopifyImportSellerRouter = Router();
shopifyImportSellerRouter.use(requireAuth, requireSeller, buildRouter(shopifyImportSellerController));

// Admin on-behalf-of — mounted at /admin/sellers/:sellerId/shopify, resolves
// the seller profile straight from the validated route param.
export const shopifyImportAdminRouter = Router({ mergeParams: true });
shopifyImportAdminRouter.use(
  requireAuth,
  requireAdmin,
  validate(sellerIdParamSchema, 'params'),
  buildRouter(shopifyImportAdminController),
);
