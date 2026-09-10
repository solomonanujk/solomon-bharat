import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProductApprovalStatus } from '@prisma/client';
import { CataloguesService } from './catalogues.service';
import type { CataloguesRepository } from './catalogues.repository';
import type { ProductsRepository } from '../products/products.repository';
import type { ProductWithMedia } from '../products/products.types';

vi.mock('../../providers/storage', () => ({
  storageProvider: { uploadFile: vi.fn() },
}));
vi.mock('./pdfBuilder', () => ({
  buildCataloguePdf: vi.fn(),
}));

import { storageProvider } from '../../providers/storage';
import { buildCataloguePdf } from './pdfBuilder';

function buildProduct(overrides: Partial<ProductWithMedia> = {}): ProductWithMedia {
  return {
    id: 'prod-1',
    name: 'Table Runner',
    description: 'Handwoven cotton table runner',
    deletedAt: null,
    isPublished: true,
    approvalStatus: ProductApprovalStatus.APPROVED,
    images: [{ id: 'img-1', productId: 'prod-1', url: 'https://cdn.example/img.jpg', sortOrder: 0 }],
    ...overrides,
  } as ProductWithMedia;
}

function buildMockRepo(): CataloguesRepository {
  return {
    findAgentProfileByUserId: vi.fn(),
    create: vi.fn(),
    findByIdForAgent: vi.fn(),
    listForAgent: vi.fn(),
  } as unknown as CataloguesRepository;
}

function buildMockProducts(): ProductsRepository {
  return {
    findByIdWithMedia: vi.fn(),
  } as unknown as ProductsRepository;
}

describe('CataloguesService.generate', () => {
  let repo: CataloguesRepository;
  let products: ProductsRepository;
  let service: CataloguesService;

  beforeEach(() => {
    repo = buildMockRepo();
    products = buildMockProducts();
    service = new CataloguesService(repo, products);
    vi.mocked(repo.findAgentProfileByUserId).mockResolvedValue({ id: 'agent-1' } as never);
    vi.mocked(storageProvider.uploadFile).mockResolvedValue({ url: 'https://files/cat.pdf', publicId: 'pub-1' });
    vi.mocked(buildCataloguePdf).mockResolvedValue(Buffer.from('pdf'));
    vi.mocked(repo.create).mockResolvedValue({
      id: 'cat-1',
      title: 'My Catalogue',
      fileUrl: 'https://files/cat.pdf',
      publicId: 'pub-1',
      agentId: 'agent-1',
      items: [],
      createdAt: new Date(),
    } as never);
  });

  it('builds the PDF with the agent-supplied price/moq per item, not any platform price', async () => {
    vi.mocked(products.findByIdWithMedia).mockResolvedValue(buildProduct());

    await service.generate('user-1', {
      items: [{ productId: 'prod-1', price: 499, moq: 25 }],
      title: 'My Catalogue',
    });

    expect(buildCataloguePdf).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Table Runner', price: 499, moq: 25 }),
    ]);
    expect(storageProvider.uploadFile).toHaveBeenCalledWith(
      expect.any(Buffer),
      expect.any(String),
      'catalogues/agent-1',
    );
    expect(repo.create).toHaveBeenCalledWith('agent-1', {
      title: 'My Catalogue',
      items: [{ productId: 'prod-1', price: 499, moq: 25 }],
      fileUrl: 'https://files/cat.pdf',
      publicId: 'pub-1',
    });
  });

  it('excludes a product that is no longer shareable (unpublished/deleted/not approved)', async () => {
    vi.mocked(products.findByIdWithMedia)
      .mockResolvedValueOnce(buildProduct({ id: 'prod-1' }))
      .mockResolvedValueOnce(buildProduct({ id: 'prod-2', isPublished: false }));

    await service.generate('user-1', {
      items: [
        { productId: 'prod-1', price: 100, moq: 10 },
        { productId: 'prod-2', price: 200, moq: 20 },
      ],
    });

    const pdfArg = vi.mocked(buildCataloguePdf).mock.calls[0][0];
    expect(pdfArg).toHaveLength(1);
    expect(pdfArg[0]).toEqual(expect.objectContaining({ name: 'Table Runner' }));
  });

  it('rejects when none of the selected products are shareable', async () => {
    vi.mocked(products.findByIdWithMedia).mockResolvedValue(buildProduct({ deletedAt: new Date() }));

    await expect(
      service.generate('user-1', { items: [{ productId: 'prod-1', price: 100, moq: 10 }] })
    ).rejects.toThrow('None of the selected products are available to include in a catalogue');
  });
});
