import { OrderStatus } from '@prisma/client';
import { AppError } from '../../../utils/errors';
import { OrdersRepository, ordersRepository } from '../orders.repository';
import { buildExportDocument, ExportDocumentInput, ExportDocumentLine, ExportDocumentType } from './exportDocuments';

const SOLOMON_EXPORTER = {
  name: 'Solomon Bharat Private Limited',
  lines: ['Jaipur, Rajasthan, India'],
};

type DocumentOrder = NonNullable<Awaited<ReturnType<OrdersRepository['findForDocuments']>>>;

/** "0.3kg" / "300 g" / "0.3" → kg; null when unreadable. */
export function parseWeightKg(value: string | null | undefined, unit?: string | null): number | null {
  if (!value) return null;
  const n = parseFloat(String(value).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  const u = (unit ?? String(value).replace(/[\d.,\s]/g, '')).toLowerCase();
  return u.startsWith('g') ? n / 1000 : n;
}

function toLine(item: DocumentOrder['items'][number]): ExportDocumentLine {
  const v = item.variant;
  const dims =
    v && v.length && v.width && v.height
      ? `${Number(v.length)} x ${Number(v.width)} x ${Number(v.height)} ${v.dimensionUnit ?? 'cm'}`
      : item.product.dimensions;
  return {
    description: item.product.name,
    sku: v?.sku ?? null,
    hsnCode: v?.tariffCode ?? item.product.tariffCode ?? null,
    origin: item.product.placeOfOrigin ? `${item.product.placeOfOrigin}, India` : 'India',
    quantity: item.quantity,
    unitPrice: Number(item.unitAdminPrice),
    lineTotal: Number(item.lineAdminTotal),
    unitWeightKg: v?.weight != null ? parseWeightKg(String(v.weight), v.weightUnit) : parseWeightKg(item.product.weight),
    dimensions: dims ?? null,
  };
}

export function toDocumentInput(order: DocumentOrder): ExportDocumentInput {
  const brand = order.sellerProfile?.brand;
  const exporter = order.sellerProfile
    ? {
        name: brand?.legalName ?? brand?.name ?? order.sellerProfile.businessName,
        lines: [order.sellerProfile.businessAddress, brand?.gstin ? `GSTIN: ${brand.gstin}` : '', order.sellerProfile.phone],
      }
    : SOLOMON_EXPORTER;
  const a = order.shippingAddress;
  const consignee = {
    name: order.buyer.companyName || order.buyer.contactName,
    lines: a
      ? [order.buyer.companyName ? `Attn: ${order.buyer.contactName}` : '', a.line1, a.line2 ?? '', `${a.city}${a.state ? `, ${a.state}` : ''} ${a.postalCode}`, a.country, order.buyer.phone ?? '']
      : [order.buyer.country, order.buyer.phone ?? ''],
  };
  return {
    orderRef: order.id.slice(0, 8).toUpperCase(),
    date: order.paidAt ?? order.createdAt,
    exporter,
    consignee,
    destinationCountry: a?.country ?? order.buyer.country,
    // Curated orders are delivered duty paid by Solomon; brands ship under their own terms.
    incoterm: order.sellerProfileId ? 'DAP' : 'DDP',
    trackingNumber: order.trackingNumber,
    lines: order.items.map(toLine),
  };
}

export class ExportDocumentsService {
  constructor(private readonly repo: OrdersRepository = ordersRepository) {}

  /** Admin: any paid order. Brand: only its own paid orders. */
  async build(
    orderId: string,
    type: ExportDocumentType,
    actor: { kind: 'admin' } | { kind: 'brand'; sellerProfileId: string },
  ): Promise<{ filename: string; pdf: Buffer }> {
    const order = await this.repo.findForDocuments(orderId);
    if (!order || order.deletedAt || order.status === OrderStatus.PENDING_PAYMENT) {
      throw AppError.notFound('Order not found');
    }
    if (actor.kind === 'brand' && order.sellerProfileId !== actor.sellerProfileId) {
      throw AppError.forbidden('You do not have access to this order');
    }
    const input = toDocumentInput(order);
    return { filename: `${type}-${input.orderRef}.pdf`, pdf: await buildExportDocument(type, input) };
  }
}

export const exportDocumentsService = new ExportDocumentsService();
