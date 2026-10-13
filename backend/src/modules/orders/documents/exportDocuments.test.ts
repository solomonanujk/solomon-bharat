import { describe, it, expect, vi } from 'vitest';
import { OrderStatus } from '@prisma/client';
import { OrdersRepository } from '../orders.repository';
import { ExportDocumentsService, parseWeightKg, toDocumentInput } from './exportDocuments.service';

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: 'abcdef12-0000-0000-0000-000000000000',
    status: OrderStatus.CONFIRMED,
    deletedAt: null,
    paidAt: new Date('2026-10-13T00:00:00Z'),
    createdAt: new Date('2026-10-12T00:00:00Z'),
    trackingNumber: null,
    sellerProfileId: null,
    sellerProfile: null,
    buyer: { companyName: 'Corner Shop Ltd', contactName: 'Ann', phone: '+44 20', country: 'United Kingdom' },
    shippingAddress: { line1: '1 High St', line2: null, city: 'Bath', state: null, postalCode: 'BA1 1AA', country: 'United Kingdom' },
    items: [
      {
        quantity: 10,
        unitAdminPrice: 100,
        lineAdminTotal: 1000,
        product: { name: 'Block print cushion', tariffCode: '6304', weight: '0.3kg', dimensions: '45x45cm', placeOfOrigin: 'Jaipur' },
        variant: null,
      },
    ],
    ...overrides,
  };
}

describe('export documents', () => {
  it('parses weights in kg and grams', () => {
    expect(parseWeightKg('0.3kg')).toBe(0.3);
    expect(parseWeightKg('300 g')).toBe(0.3);
    expect(parseWeightKg('250', 'g')).toBe(0.25);
    expect(parseWeightKg(null)).toBeNull();
  });

  it('curated orders ship from Solomon under DDP; brand orders from the brand under DAP', () => {
    const curated = toDocumentInput(order() as never);
    expect(curated.exporter.name).toBe('Solomon Bharat Private Limited');
    expect(curated.incoterm).toBe('DDP');
    expect(curated.consignee.name).toBe('Corner Shop Ltd');
    expect(curated.lines[0]).toMatchObject({ hsnCode: '6304', unitWeightKg: 0.3, origin: 'Jaipur, India' });

    const brand = toDocumentInput(
      order({
        sellerProfileId: 'sp-1',
        sellerProfile: { businessName: 'Kala', businessAddress: 'Sanganer', phone: '9', brand: { name: 'Kala', legalName: 'Kala Pvt Ltd', gstin: '08ABC' } },
      }) as never,
    );
    expect(brand.exporter.name).toBe('Kala Pvt Ltd');
    expect(brand.exporter.lines).toContain('GSTIN: 08ABC');
    expect(brand.incoterm).toBe('DAP');
  });

  it('renders both PDFs and enforces brand ownership', async () => {
    const repo = { findForDocuments: vi.fn().mockResolvedValue(order({ sellerProfileId: 'sp-1', sellerProfile: { businessName: 'K', businessAddress: 'A', phone: '1', brand: null } })) } as unknown as OrdersRepository;
    const service = new ExportDocumentsService(repo);

    for (const type of ['commercial-invoice', 'packing-list'] as const) {
      const { pdf, filename } = await service.build('o', type, { kind: 'admin' });
      expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
      expect(filename).toBe(`${type}-ABCDEF12.pdf`);
    }
    await expect(service.build('o', 'packing-list', { kind: 'brand', sellerProfileId: 'other' })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('404s for unpaid orders', async () => {
    const repo = { findForDocuments: vi.fn().mockResolvedValue(order({ status: OrderStatus.PENDING_PAYMENT })) } as unknown as OrdersRepository;
    await expect(new ExportDocumentsService(repo).build('o', 'packing-list', { kind: 'admin' })).rejects.toMatchObject({ statusCode: 404 });
  });
});
