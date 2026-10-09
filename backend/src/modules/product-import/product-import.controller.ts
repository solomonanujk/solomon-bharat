import { Request, Response } from 'express';
import { AppError } from '../../utils/errors';
import { sendCreated, sendSuccess } from '../../utils/response';
import { productImportService } from './product-import.service';
import { ProductImportPreview, ProductImportResult, SpreadsheetFile } from './product-import.types';
import { ImportProductsDto, SellerProfileIdParamDto } from './product-import.validation';

function requireFile(req: Request): SpreadsheetFile {
  if (!req.file) throw AppError.badRequest('Upload a .csv or .xlsx spreadsheet in the "file" field');
  return { buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype };
}

function sendPreview(res: Response, preview: ProductImportPreview): void {
  sendSuccess(res, preview, `Found ${preview.products.length} product(s) in the ${preview.source} export`);
}

function sendImportResult(res: Response, result: ProductImportResult): void {
  const message = `Imported ${result.created.length} of ${result.created.length + result.failed.length} product(s) as drafts`;
  if (result.created.length > 0) sendCreated(res, result, message);
  else sendSuccess(res, result, message);
}

export const productImportController = {
  async previewMine(req: Request, res: Response): Promise<void> {
    const preview = await productImportService.previewForSeller(req.user!.id, requireFile(req));
    sendPreview(res, preview);
  },

  async importMine(req: Request, res: Response): Promise<void> {
    const result = await productImportService.importForSeller(req.user!.id, req.body as ImportProductsDto);
    sendImportResult(res, result);
  },

  async previewForSeller(req: Request, res: Response): Promise<void> {
    const { sellerProfileId } = req.params as SellerProfileIdParamDto;
    const preview = await productImportService.previewForAdmin(sellerProfileId, requireFile(req));
    sendPreview(res, preview);
  },

  async importForSeller(req: Request, res: Response): Promise<void> {
    const { sellerProfileId } = req.params as SellerProfileIdParamDto;
    const result = await productImportService.importForAdmin(req.user!.id, sellerProfileId, req.body as ImportProductsDto);
    sendImportResult(res, result);
  },
};
