import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { logger } from '../../config/logger';

export interface CatalogueProductInput {
  name: string;
  description: string;
  imageUrl?: string;
}

const PAGE_MARGIN = 50;
const IMAGE_MAX_WIDTH = 495; // page width (595 for A4) minus margins
const IMAGE_MAX_HEIGHT = 320;

/**
 * Fetches an image URL into a Buffer for embedding via pdfkit's doc.image().
 * Returns null (rather than throwing) on any failure — a single bad product
 * image must never abort the whole catalogue generation.
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      logger.warn({ url, status: res.status }, 'Catalogue: product image fetch failed, skipping image');
      return null;
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    logger.warn({ err, url }, 'Catalogue: product image fetch threw, skipping image');
    return null;
  }
}

/**
 * Builds a paginated PDF catalogue — one section per product with image, name,
 * and description only. Price is intentionally never included anywhere here.
 */
export async function buildCataloguePdf(products: CatalogueProductInput[]): Promise<Buffer> {
  const doc = new PDFDocument({ margin: PAGE_MARGIN, autoFirstPage: false });
  const stream = new PassThrough();
  doc.pipe(stream);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  for (const product of products) {
    doc.addPage();

    let cursorY = PAGE_MARGIN;

    if (product.imageUrl) {
      // eslint-disable-next-line no-await-in-loop
      const imageBuffer = await fetchImageBuffer(product.imageUrl);
      if (imageBuffer) {
        try {
          doc.image(imageBuffer, PAGE_MARGIN, cursorY, {
            fit: [IMAGE_MAX_WIDTH, IMAGE_MAX_HEIGHT],
            align: 'center',
          });
        } catch (err) {
          logger.warn({ err, url: product.imageUrl }, 'Catalogue: failed to embed product image, skipping');
        }
      }
    }

    cursorY += IMAGE_MAX_HEIGHT + 20;

    doc
      .fontSize(18)
      .font('Helvetica-Bold')
      .text(product.name, PAGE_MARGIN, cursorY, { width: IMAGE_MAX_WIDTH });

    doc.moveDown(0.5);

    doc
      .fontSize(11)
      .font('Helvetica')
      .text(product.description, { width: IMAGE_MAX_WIDTH });
  }

  if (products.length === 0) {
    doc.addPage();
    doc.fontSize(14).text('No products in this catalogue.', PAGE_MARGIN, PAGE_MARGIN);
  }

  doc.end();

  return done;
}
