import { Router } from 'express';
import { productImportController } from './product-import.controller';
import { importProductsSchema, sellerProfileIdParamSchema } from './product-import.validation';
import { validate } from '../../middleware/validate';
import { requireAdmin, requireAuth, requireSeller } from '../../middleware/auth';
import { uploadSpreadsheet } from '../../middleware/upload';
import { asyncHandler } from '../../utils/asyncHandler';

export const productImportRouter = Router();

/**
 * @openapi
 * components:
 *   schemas:
 *     ImportCandidateVariant:
 *       type: object
 *       required: [name, options, sku, sellerPrice]
 *       properties:
 *         name: { type: string, maxLength: 100 }
 *         options: { type: object, additionalProperties: { type: string } }
 *         sku: { type: string, nullable: true, maxLength: 100 }
 *         sellerPrice: { type: number, nullable: true }
 *     ImportCandidate:
 *       type: object
 *       required: [key, name, description, imageUrls, sellerPrice, variants, materials, issues]
 *       properties:
 *         key: { type: string, description: 'Shopify Handle or WooCommerce ID/SKU — unique within the file' }
 *         name: { type: string, maxLength: 60 }
 *         description: { type: string, nullable: true, maxLength: 1000, description: Plain text }
 *         imageUrls: { type: array, maxItems: 10, items: { type: string, format: uri } }
 *         sellerPrice: { type: number, nullable: true, description: "The seller's own store price — becomes sellerPrice" }
 *         variants: { type: array, items: { $ref: '#/components/schemas/ImportCandidateVariant' } }
 *         materials: { type: string, nullable: true }
 *         issues: { type: array, items: { type: string } }
 *     ProductImportPreview:
 *       type: object
 *       properties:
 *         source: { type: string, enum: [shopify, woocommerce] }
 *         products: { type: array, items: { $ref: '#/components/schemas/ImportCandidate' } }
 *         warnings: { type: array, items: { type: string } }
 *     ProductImportRequest:
 *       type: object
 *       required: [categoryId, products]
 *       properties:
 *         categoryId: { type: string, format: uuid, description: Level 3 sub-subcategory }
 *         products: { type: array, minItems: 1, maxItems: 100, items: { $ref: '#/components/schemas/ImportCandidate' } }
 *     ProductImportResult:
 *       type: object
 *       properties:
 *         created:
 *           type: array
 *           items: { type: object, properties: { id: { type: string }, name: { type: string }, slug: { type: string } } }
 *         failed:
 *           type: array
 *           items: { type: object, properties: { key: { type: string }, name: { type: string }, error: { type: string } } }
 *     SpreadsheetUpload:
 *       type: object
 *       required: [file]
 *       properties:
 *         file: { type: string, format: binary, description: 'Shopify or WooCommerce product export, .csv or .xlsx, max 5 MB / 1000 products' }
 */

// ── Seller: own products ──────────────────────────────────────────────

/**
 * @openapi
 * /product-import/preview:
 *   post:
 *     summary: Parse a Shopify/WooCommerce product export into import candidates (SELLER only)
 *     description: Nothing is saved. Detects the format from the header row.
 *     tags: [Product Import]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/SpreadsheetUpload' }
 *     responses:
 *       200:
 *         description: Parsed candidates
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProductImportPreview' }
 *       400: { description: Missing/invalid file or over 5 MB }
 *       422: { description: Unrecognised format, no products, or more than 1000 products }
 */
productImportRouter.post(
  '/preview',
  requireAuth,
  requireSeller,
  uploadSpreadsheet,
  asyncHandler(productImportController.previewMine),
);

/**
 * @openapi
 * /product-import/import:
 *   post:
 *     summary: Create DRAFT products from previewed candidates (SELLER only)
 *     description: Images are downloaded and re-hosted; a failing product never aborts the others.
 *     tags: [Product Import]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProductImportRequest' }
 *     responses:
 *       201:
 *         description: At least one product created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProductImportResult' }
 *       200: { description: No product could be created — see failed[] }
 *       400: { description: Category is not a level 3 sub-subcategory }
 *       422: { description: Validation error }
 */
productImportRouter.post(
  '/import',
  requireAuth,
  requireSeller,
  validate(importProductsSchema),
  asyncHandler(productImportController.importMine),
);

// ── Admin: on behalf of a seller ──────────────────────────────────────

/**
 * @openapi
 * /product-import/sellers/{sellerProfileId}/preview:
 *   post:
 *     summary: Parse a product export on behalf of a seller (SUPER_ADMIN only)
 *     tags: [Product Import]
 *     parameters:
 *       - { in: path, name: sellerProfileId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/SpreadsheetUpload' }
 *     responses:
 *       200:
 *         description: Parsed candidates
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProductImportPreview' }
 *       404: { description: Seller not found }
 */
productImportRouter.post(
  '/sellers/:sellerProfileId/preview',
  requireAuth,
  requireAdmin,
  validate(sellerProfileIdParamSchema, 'params'),
  uploadSpreadsheet,
  asyncHandler(productImportController.previewForSeller),
);

/**
 * @openapi
 * /product-import/sellers/{sellerProfileId}/import:
 *   post:
 *     summary: Create DRAFT products for a seller from previewed candidates (SUPER_ADMIN only, audit-logged)
 *     tags: [Product Import]
 *     parameters:
 *       - { in: path, name: sellerProfileId, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ProductImportRequest' }
 *     responses:
 *       201:
 *         description: At least one product created
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ProductImportResult' }
 *       404: { description: Seller not found }
 */
productImportRouter.post(
  '/sellers/:sellerProfileId/import',
  requireAuth,
  requireAdmin,
  validate(sellerProfileIdParamSchema, 'params'),
  validate(importProductsSchema),
  asyncHandler(productImportController.importForSeller),
);
