import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { logger } from '../../config/logger';

export interface CatalogueProductInput {
  name: string;
  description: string;
  /** Every image for this product, in display order — all of them are laid
   *  out in a grid on the product's page, not just the first one. */
  imageUrls: string[];
  /** The agent's own resale price/MOQ for this product — set per-catalogue, never the platform's own pricing. */
  price: number;
  moq: number;
}

export interface CatalogueMeta {
  title: string;
  /** The agent's business name, shown on the cover page — omitted entirely if unknown. */
  preparedBy?: string;
}

// Design tokens mirrored from the site's own design system (see AGENTS.md
// "Design System") — kept in sync by hand, since PDFKit can't read the
// frontend's CSS variables directly.
const COLORS = {
  bg: '#F9F7F2',
  surface: '#FCFAFA',
  primary: '#1A1A1A',
  accent: '#A68B67',
  mutedText: '#444748',
  borderWarm: '#E5E1D8',
};

const PAGE_MARGIN = 50;
// A4 — a more internationally neutral default than US Letter for a platform
// that ships this PDF to buyers/agents across 40+ countries.
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
// Total budget for the image area, shared across however many images a
// product has — a single image fills it entirely; multiple images split it
// into a grid (see gridDimensions/drawProductPage).
const IMAGE_AREA_HEIGHT = 300;
const IMAGE_GRID_GAP = 8;
const HEADER_HEIGHT = 20;
const FOOTER_RESERVE = 36;

/** Column/row count for a product's image grid, favoring wide rows over tall
 *  ones so even a fully-loaded product (the platform caps at 10 images)
 *  stays legible. */
function gridDimensions(count: number): { cols: number; rows: number } {
  if (count <= 1) return { cols: 1, rows: 1 };
  if (count === 2) return { cols: 2, rows: 1 };
  if (count === 3) return { cols: 3, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  const cols = 3;
  return { cols, rows: Math.ceil(count / cols) };
}

// PDFKit's standard base-14 fonts (Helvetica, Times) use WinAnsi/Standard
// encoding, which has no ₹ glyph — it silently renders as a mojibake
// superscript-1 instead of throwing, so this must never use the ₹ symbol
// directly. "Rs." reads correctly in every PDF viewer with zero font embedding.
const formatInr = (amount: number): string =>
  `Rs. ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;

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

/** Draws one framed, rounded cell of the image grid — a filled placeholder
 *  background (so a transparent or missing photo never looks like a gap),
 *  the clipped+fitted image if one loaded, and a border on top either way. */
function drawImageCell(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, buffer: Buffer | null): void {
  doc.roundedRect(x, y, w, h, 6).fill(COLORS.surface);
  if (buffer) {
    doc.save();
    doc.roundedRect(x, y, w, h, 6).clip();
    try {
      doc.image(buffer, x, y, { fit: [w, h], align: 'center', valign: 'center' });
    } catch (err) {
      logger.warn({ err }, 'Catalogue: failed to embed product image, skipping');
    }
    doc.restore();
  } else {
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLORS.mutedText)
      .text('Image not available', x + 4, y + h / 2 - 5, { width: w - 8, align: 'center' });
  }
  doc.roundedRect(x, y, w, h, 6).lineWidth(1).strokeColor(COLORS.borderWarm).stroke();
}

function drawWordmark(doc: PDFKit.PDFDocument, x: number, y: number, fontSize: number): number {
  doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(COLORS.primary);
  const solomon = 'SOLOMON ';
  doc.text(solomon, x, y, { continued: true, characterSpacing: 1.2 });
  doc.fillColor(COLORS.accent).text('BHARAT', { characterSpacing: 1.2 });
  return doc.widthOfString(solomon) + doc.widthOfString('BHARAT');
}

function drawCoverPage(doc: PDFKit.PDFDocument, meta: CatalogueMeta, productCount: number): void {
  doc.addPage();
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.bg);

  const centerX = PAGE_WIDTH / 2;

  // Small centered thin rule above the wordmark, purely decorative.
  doc.moveTo(centerX - 30, 230).lineTo(centerX + 30, 230).lineWidth(1).strokeColor(COLORS.accent).stroke();

  doc.font('Times-Bold').fontSize(34).fillColor(COLORS.primary);
  const wSolomon = doc.widthOfString('SOLOMON ');
  const wBharat = doc.widthOfString('BHARAT');
  const wordmarkX = centerX - (wSolomon + wBharat) / 2;
  doc.text('SOLOMON ', wordmarkX, 260, { continued: true, characterSpacing: 1.5 });
  doc.fillColor(COLORS.accent).text('BHARAT', { characterSpacing: 1.5 });

  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.accent)
    .text('WHOLESALE CATALOGUE', PAGE_MARGIN, 320, { width: CONTENT_WIDTH, align: 'center', characterSpacing: 2 });

  doc
    .font('Times-Bold')
    .fontSize(20)
    .fillColor(COLORS.primary)
    .text(meta.title, PAGE_MARGIN, 370, { width: CONTENT_WIDTH, align: 'center' });

  const dateLabel = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const subtitleLines = [meta.preparedBy ? `Prepared by ${meta.preparedBy}` : null, dateLabel, `${productCount} product${productCount === 1 ? '' : 's'}`]
    .filter((line): line is string => line !== null)
    .join('  ·  ');

  doc
    .font('Helvetica')
    .fontSize(11)
    .fillColor(COLORS.mutedText)
    .text(subtitleLines, PAGE_MARGIN, 410, { width: CONTENT_WIDTH, align: 'center' });

  doc.moveTo(centerX - 30, PAGE_HEIGHT - 90).lineTo(centerX + 30, PAGE_HEIGHT - 90).lineWidth(1).strokeColor(COLORS.borderWarm).stroke();
  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.mutedText)
    .text('solomonbharat.com', PAGE_MARGIN, PAGE_HEIGHT - 75, { width: CONTENT_WIDTH, align: 'center' });
}

function drawRunningHeader(doc: PDFKit.PDFDocument, pageLabel: string): void {
  drawWordmark(doc, PAGE_MARGIN, PAGE_MARGIN - 6, 10);

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor(COLORS.mutedText)
    .text(pageLabel, PAGE_MARGIN, PAGE_MARGIN - 4, { width: CONTENT_WIDTH, align: 'right' });

  doc
    .moveTo(PAGE_MARGIN, PAGE_MARGIN + HEADER_HEIGHT)
    .lineTo(PAGE_WIDTH - PAGE_MARGIN, PAGE_MARGIN + HEADER_HEIGHT)
    .lineWidth(0.75)
    .strokeColor(COLORS.borderWarm)
    .stroke();
}

function drawFooter(doc: PDFKit.PDFDocument): void {
  const y = PAGE_HEIGHT - PAGE_MARGIN - FOOTER_RESERVE + 10;
  doc
    .moveTo(PAGE_MARGIN, y)
    .lineTo(PAGE_WIDTH - PAGE_MARGIN, y)
    .lineWidth(0.75)
    .strokeColor(COLORS.borderWarm)
    .stroke();
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLORS.mutedText)
    .text('This price is set independently by the agent — not Solomon Bharat’s own selling price.', PAGE_MARGIN, y + 10, {
      width: CONTENT_WIDTH,
      align: 'center',
    });
}

async function drawProductPage(
  doc: PDFKit.PDFDocument,
  product: CatalogueProductInput,
  pageLabel: string,
): Promise<void> {
  doc.addPage();
  drawRunningHeader(doc, pageLabel);

  let cursorY = PAGE_MARGIN + HEADER_HEIGHT + 24;
  const imageAreaY = cursorY;
  const imageAreaX = PAGE_MARGIN;

  const images = product.imageUrls;
  const { cols, rows } = gridDimensions(Math.max(images.length, 1));
  const cellWidth = (CONTENT_WIDTH - (cols - 1) * IMAGE_GRID_GAP) / cols;
  const cellHeight = (IMAGE_AREA_HEIGHT - (rows - 1) * IMAGE_GRID_GAP) / rows;

  // Fetched in parallel (independent of each other) — only the pages
  // themselves are drawn sequentially, so a slow image never reorders them.
  const buffers = images.length > 0 ? await Promise.all(images.map((url) => fetchImageBuffer(url))) : [null];

  buffers.forEach((buffer, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cellX = imageAreaX + col * (cellWidth + IMAGE_GRID_GAP);
    const cellY = imageAreaY + row * (cellHeight + IMAGE_GRID_GAP);
    drawImageCell(doc, cellX, cellY, cellWidth, cellHeight, buffer);
  });

  cursorY = imageAreaY + IMAGE_AREA_HEIGHT + 26;

  doc.font('Times-Bold').fontSize(19).fillColor(COLORS.primary).text(product.name, PAGE_MARGIN, cursorY, { width: CONTENT_WIDTH });
  cursorY = doc.y + 10;

  const priceStr = formatInr(product.price);
  doc.font('Times-Bold').fontSize(22).fillColor(COLORS.accent);
  const priceWidth = doc.widthOfString(priceStr);
  doc.text(priceStr, PAGE_MARGIN, cursorY);

  const moqStr = `MOQ: ${product.moq} units`;
  doc.font('Helvetica-Bold').fontSize(9);
  const moqTextWidth = doc.widthOfString(moqStr);
  const pillPaddingX = 10;
  const pillWidth = moqTextWidth + pillPaddingX * 2;
  const pillHeight = 20;
  const pillX = PAGE_MARGIN + priceWidth + 16;
  const pillY = cursorY + 7;
  doc.roundedRect(pillX, pillY, pillWidth, pillHeight, pillHeight / 2).lineWidth(1).strokeColor(COLORS.borderWarm).stroke();
  doc
    .fillColor(COLORS.mutedText)
    .text(moqStr, pillX + pillPaddingX, pillY + 5.5, { width: moqTextWidth });

  cursorY += 22 + 22;

  doc
    .moveTo(PAGE_MARGIN, cursorY)
    .lineTo(PAGE_WIDTH - PAGE_MARGIN, cursorY)
    .lineWidth(0.75)
    .strokeColor(COLORS.borderWarm)
    .stroke();
  cursorY += 16;

  const descriptionMaxHeight = PAGE_HEIGHT - PAGE_MARGIN - FOOTER_RESERVE - cursorY;
  doc
    .font('Helvetica')
    .fontSize(10.5)
    .fillColor(COLORS.mutedText)
    .text(product.description, PAGE_MARGIN, cursorY, {
      width: CONTENT_WIDTH,
      height: Math.max(descriptionMaxHeight, 0),
      ellipsis: true,
      lineGap: 2,
    });

  drawFooter(doc);
}

/**
 * Builds a branded, paginated PDF catalogue — a cover page followed by one
 * page per product (image, name, the agent's own resale price/MOQ, and
 * description), styled to match the site's own design tokens.
 */
export async function buildCataloguePdf(products: CatalogueProductInput[], meta: CatalogueMeta): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, autoFirstPage: false });
  const stream = new PassThrough();
  doc.pipe(stream);

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  drawCoverPage(doc, meta, products.length);

  if (products.length === 0) {
    doc.addPage();
    drawRunningHeader(doc, '');
    doc.font('Helvetica').fontSize(13).fillColor(COLORS.mutedText).text('No products in this catalogue.', PAGE_MARGIN, PAGE_MARGIN + HEADER_HEIGHT + 24);
  } else {
    for (let i = 0; i < products.length; i += 1) {
      // Sequential, one page at a time — each page awaits its own image fetch,
      // so a slow/failing image never blocks or reorders the others.
      // eslint-disable-next-line no-await-in-loop
      await drawProductPage(doc, products[i], `${i + 1} / ${products.length}`);
    }
  }

  doc.end();

  return done;
}
