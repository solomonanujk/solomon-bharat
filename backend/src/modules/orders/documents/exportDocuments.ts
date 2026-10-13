import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

/**
 * Basic export paperwork for one order: a commercial invoice and a packing list. Amounts are in
 * INR (the platform's base currency). These are working documents for the exporter and the
 * freight forwarder; they do not replace a GST tax invoice.
 */

export type ExportDocumentType = 'commercial-invoice' | 'packing-list';

export interface ExportDocumentParty {
  name: string;
  lines: string[];
}

export interface ExportDocumentLine {
  description: string;
  sku: string | null;
  hsnCode: string | null;
  origin: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Per unit, kg. */
  unitWeightKg: number | null;
  dimensions: string | null;
}

export interface ExportDocumentInput {
  orderRef: string;
  date: Date;
  exporter: ExportDocumentParty;
  consignee: ExportDocumentParty;
  destinationCountry: string;
  incoterm: string;
  trackingNumber: string | null;
  lines: ExportDocumentLine[];
}

const MARGIN = 40;
const PAGE_WIDTH = 595.28;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const inr = (n: number): string =>
  `Rs. ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)}`;

function drawParty(doc: PDFKit.PDFDocument, title: string, party: ExportDocumentParty, x: number, y: number, w: number): number {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#555').text(title.toUpperCase(), x, y, { width: w });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(party.name, x, doc.y + 2, { width: w });
  doc.font('Helvetica').fontSize(9);
  for (const line of party.lines.filter(Boolean)) doc.text(line, x, doc.y + 1, { width: w });
  return doc.y;
}

function drawTable(
  doc: PDFKit.PDFDocument,
  columns: { label: string; width: number; align?: 'left' | 'right' }[],
  rows: string[][],
  startY: number,
): number {
  let y = startY;
  const drawRow = (cells: string[], bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(8.5).fillColor('#000');
    let x = MARGIN;
    const heights = cells.map((c, i) => doc.heightOfString(c, { width: columns[i].width - 6 }));
    const h = Math.max(...heights) + 6;
    if (y + h > 800) {
      doc.addPage();
      y = MARGIN;
    }
    cells.forEach((c, i) => {
      doc.text(c, x + 3, y + 3, { width: columns[i].width - 6, align: columns[i].align ?? 'left' });
      x += columns[i].width;
    });
    doc.moveTo(MARGIN, y + h).lineTo(MARGIN + CONTENT_WIDTH, y + h).lineWidth(0.5).strokeColor('#ccc').stroke();
    y += h;
  };
  drawRow(columns.map((c) => c.label), true);
  rows.forEach((r) => drawRow(r, false));
  return y;
}

export async function buildExportDocument(type: ExportDocumentType, input: ExportDocumentInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: MARGIN });
  const stream = new PassThrough();
  doc.pipe(stream);
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    stream.on('data', (c: Buffer) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

  const title = type === 'commercial-invoice' ? 'COMMERCIAL INVOICE' : 'PACKING LIST';
  doc.font('Helvetica-Bold').fontSize(16).text(title, MARGIN, MARGIN, { width: CONTENT_WIDTH, align: 'center' });
  doc.font('Helvetica').fontSize(9).text(
    `No. ${input.orderRef}    Date: ${input.date.toISOString().slice(0, 10)}    Incoterm: ${input.incoterm}    Destination: ${input.destinationCountry}`,
    MARGIN,
    doc.y + 6,
    { width: CONTENT_WIDTH, align: 'center' },
  );
  if (input.trackingNumber) {
    doc.text(`Tracking: ${input.trackingNumber}`, { width: CONTENT_WIDTH, align: 'center' });
  }

  const partiesY = doc.y + 14;
  const half = CONTENT_WIDTH / 2 - 10;
  const y1 = drawParty(doc, 'Exporter / Shipper', input.exporter, MARGIN, partiesY, half);
  const y2 = drawParty(doc, 'Consignee', input.consignee, MARGIN + half + 20, partiesY, half);
  let y = Math.max(y1, y2) + 16;

  if (type === 'commercial-invoice') {
    const cols = [
      { label: 'Description', width: 170 },
      { label: 'SKU', width: 60 },
      { label: 'HSN', width: 55 },
      { label: 'Origin', width: 55 },
      { label: 'Qty', width: 35, align: 'right' as const },
      { label: 'Unit price', width: 70, align: 'right' as const },
      { label: 'Amount', width: CONTENT_WIDTH - 445, align: 'right' as const },
    ];
    y = drawTable(
      doc,
      cols,
      input.lines.map((l) => [
        l.description,
        l.sku ?? '-',
        l.hsnCode ?? '-',
        l.origin ?? 'India',
        String(l.quantity),
        inr(l.unitPrice),
        inr(l.lineTotal),
      ]),
      y,
    );
    const total = input.lines.reduce((s, l) => s + l.lineTotal, 0);
    doc.font('Helvetica-Bold').fontSize(10).text(`Total invoice value: ${inr(total)}`, MARGIN, y + 10, {
      width: CONTENT_WIDTH,
      align: 'right',
    });
    doc.font('Helvetica').fontSize(8.5).fillColor('#444').text(
      'Country of origin of goods: India. We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.',
      MARGIN,
      doc.y + 18,
      { width: CONTENT_WIDTH },
    );
  } else {
    const cols = [
      { label: 'Description', width: 200 },
      { label: 'SKU', width: 70 },
      { label: 'Qty', width: 45, align: 'right' as const },
      { label: 'Unit wt (kg)', width: 65, align: 'right' as const },
      { label: 'Net wt (kg)', width: 65, align: 'right' as const },
      { label: 'Dimensions', width: CONTENT_WIDTH - 445 },
    ];
    y = drawTable(
      doc,
      cols,
      input.lines.map((l) => [
        l.description,
        l.sku ?? '-',
        String(l.quantity),
        l.unitWeightKg !== null ? l.unitWeightKg.toFixed(2) : '-',
        l.unitWeightKg !== null ? (l.unitWeightKg * l.quantity).toFixed(2) : '-',
        l.dimensions ?? '-',
      ]),
      y,
    );
    const units = input.lines.reduce((s, l) => s + l.quantity, 0);
    const weight = input.lines.reduce((s, l) => s + (l.unitWeightKg ?? 0) * l.quantity, 0);
    doc.font('Helvetica-Bold').fontSize(10).text(`Total units: ${units}    Total net weight: ${weight.toFixed(2)} kg`, MARGIN, y + 10, {
      width: CONTENT_WIDTH,
      align: 'right',
    });
  }

  doc.end();
  return done;
}
