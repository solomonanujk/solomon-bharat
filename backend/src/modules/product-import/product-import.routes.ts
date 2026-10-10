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
 *         stock: { type: integer, nullable: true, minimum: 0, description: "Declared stock for this variant" }
 *         weightKg: { type: number, nullable: true, description: Kilograms }
 *         dimensions:
 *           type: object
 *           nullable: true
 *           required: [length, width, height, unit]
 *           properties:
 *             length: { type: number }
 *             width: { type: number }
 *             height: { type: number }
 *             unit: { type: string, enum: [cm, in] }
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
 *         published: { type: string, nullable: true, enum: [published, private, draft], description: "WooCommerce Published column: 1 is published, 0 is private, -1 is draft" }
 *         weightKg: { type: number, nullable: true, description: "Kilograms. For products with variants, the first variant that has a weight" }
 *         dimensions: { type: string, nullable: true, description: "Format: 'L x W x H cm' or 'L x W x H in'" }
 *         stock: { type: integer, nullable: true, minimum: 0, description: "Declared stock. For products with variants, the sum of the variants' stock" }
 *         tags: { type: array, maxItems: 20, items: { type: string, minLength: 1, maxLength: 50 } }
 *         categoryPath: { type: array, description: "Each WooCommerce Categories entry split on '>'", items: { type: array, items: { type: string } } }
 *         suggestedCategory:
 *           type: object
 *           nullable: true
 *           description: "Filled by the preview when the file's category path matches exactly one active level 3 category"
 *           properties:
 *             id: { type: string, format: uuid }
 *             name: { type: string }
 *             path: { type: string, description: "For example: Textiles > Bathrobes > Baby" }
 *         categoryId: { type: string, format: uuid, nullable: true, description: "Level 3 category for this product. Wins over the request-level categoryId" }
 *     ProductImportPreview:
 *       type: object
 *       properties:
 *         source: { type: string, enum: [shopify, woocommerce] }
 *         products: { type: array, items: { $ref: '#/components/schemas/ImportCandidate' } }
 *         warnings: { type: array, items: { type: string } }
 *     ProductImportRequest:
 *       type: object
 *       required: [products]
 *       properties:
 *         categoryId: { type: string, format: uuid, description: "Optional fallback level 3 sub-subcategory for products without their own categoryId. A product with neither fails with 'Choose a category for this product'" }
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
 *       200: { description: "No product could be created - see failed[]" }
 *       400: { description: "A category id (batch or per product) is not a level 3 sub-subcategory" }
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
