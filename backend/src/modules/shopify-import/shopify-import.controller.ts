import { Request, Response } from 'express';
import { sendCreated, sendSuccess } from '../../utils/response';
import { sellersService } from '../sellers/sellers.service';
import { shopifyImportService } from './shopify-import.service';
import {
  ConnectShopifyDto,
  ImportShopifyProductsDto,
  ListShopifyProductsQueryDto,
  ToggleShopifySyncDto,
} from './shopify-import.validation';

async function resolveSellerProfileId(userId: string): Promise<string> {
  const profile = await sellersService.getMyProfile(userId);
  return profile.id;
}

/** Builds the controller once per resolution strategy — self-service resolves
 *  the seller profile id from the authenticated user; admin resolves it
 *  straight from the `:sellerId` route param (already validated as a real
 *  UUID by the route's params schema). */
function buildController(resolveSellerId: (req: Request) => Promise<string>) {
  return {
    async connect(req: Request, res: Response): Promise<void> {
      const sellerProfileId = await resolveSellerId(req);
      const dto = req.body as ConnectShopifyDto;
      const status = await shopifyImportService.connect(sellerProfileId, dto);
      sendCreated(res, status, 'Shopify store connected');
    },

    async getConnection(req: Request, res: Response): Promise<void> {
      const sellerProfileId = await resolveSellerId(req);
      const status = await shopifyImportService.getConnectionStatus(sellerProfileId);
      sendSuccess(res, status);
    },

    async updateConnection(req: Request, res: Response): Promise<void> {
      const sellerProfileId = await resolveSellerId(req);
      const dto = req.body as ToggleShopifySyncDto;
      const status = await shopifyImportService.setSyncEnabled(sellerProfileId, dto.syncEnabled);
      sendSuccess(res, status, 'Sync setting updated');
    },

    async disconnect(req: Request, res: Response): Promise<void> {
      const sellerProfileId = await resolveSellerId(req);
      await shopifyImportService.disconnect(sellerProfileId);
      sendSuccess(res, null, 'Shopify store disconnected');
    },

    async sync(req: Request, res: Response): Promise<void> {
      const sellerProfileId = await resolveSellerId(req);
      await shopifyImportService.triggerSync(sellerProfileId);
      sendSuccess(res, null, 'Sync started');
    },

    async listProducts(req: Request, res: Response): Promise<void> {
      const sellerProfileId = await resolveSellerId(req);
      const query = req.query as unknown as ListShopifyProductsQueryDto;
      const result = await shopifyImportService.listShopifyProducts(sellerProfileId, query);
      sendSuccess(res, result.products, 'Shopify products retrieved', 200, { nextCursor: result.nextCursor });
    },

    async importProducts(req: Request, res: Response): Promise<void> {
      const sellerProfileId = await resolveSellerId(req);
      const dto = req.body as ImportShopifyProductsDto;
      const result = await shopifyImportService.importProducts(sellerProfileId, dto);
      sendCreated(res, result, `Imported ${result.imported.length} of ${dto.shopifyProductIds.length} products`);
    },
  };
}

export const shopifyImportSellerController = buildController((req) => resolveSellerProfileId(req.user!.id));
export const shopifyImportAdminController = buildController((req) => Promise.resolve(req.params.sellerId));
