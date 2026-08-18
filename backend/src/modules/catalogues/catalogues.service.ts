import { Catalogue, ProductApprovalStatus } from '@prisma/client';
import { AppError } from '../../utils/errors';
import { storageProvider } from '../../providers/storage';
import { PaginationQuery } from '../../utils/pagination';
import { productsRepository, ProductsRepository } from '../products/products.repository';
import { ProductWithMedia } from '../products/products.types';
import { buildCataloguePdf, CatalogueProductInput } from './pdfBuilder';
import { CataloguesRepository, cataloguesRepository } from './catalogues.repository';
import { CatalogueSummary, CreateCatalogueInput } from './catalogues.types';

const CATALOGUE_STORAGE_FOLDER = 'catalogues';

function isShareable(product: ProductWithMedia | null): product is ProductWithMedia {
  return (
    product !== null &&
    product.deletedAt === null &&
    product.isPublished === true &&
    product.approvalStatus === ProductApprovalStatus.APPROVED
  );
}

function toSummary(catalogue: Catalogue): CatalogueSummary {
  return {
    id: catalogue.id,
    title: catalogue.title,
    fileUrl: catalogue.fileUrl,
    createdAt: catalogue.createdAt,
  };
}

function defaultTitle(): string {
  return `Catalogue - ${new Date().toISOString().slice(0, 10)}`;
}

export class CataloguesService {
  constructor(
    private readonly repo: CataloguesRepository = cataloguesRepository,
    private readonly products: ProductsRepository = productsRepository,
  ) {}

  private async resolveAgentProfileId(userId: string): Promise<string> {
    const profile = await this.repo.findAgentProfileByUserId(userId);
    if (!profile) {
      throw AppError.notFound('Agent profile not found');
    }
    return profile.id;
  }

  async generate(userId: string, input: CreateCatalogueInput): Promise<CatalogueSummary> {
    const agentId = await this.resolveAgentProfileId(userId);

    const fetched = await Promise.all(
      input.productIds.map((id) => this.products.findByIdWithMedia(id)),
    );
    const qualifyingProducts = fetched.filter(isShareable);

    if (qualifyingProducts.length === 0) {
      throw AppError.badRequest(
        'None of the selected products are available to include in a catalogue',
      );
    }

    const title = input.title?.trim() || defaultTitle();

    const pdfProducts: CatalogueProductInput[] = qualifyingProducts.map((product) => ({
      name: product.name,
      description: product.description,
      imageUrl: product.images[0]?.url,
    }));

    const pdfBuffer = await buildCataloguePdf(pdfProducts);

    const filename = `catalogue-${Date.now()}-${agentId}.pdf`;
    const uploaded = await storageProvider.uploadFile(pdfBuffer, filename, CATALOGUE_STORAGE_FOLDER);

    const catalogue = await this.repo.create(agentId, {
      title,
      productIds: qualifyingProducts.map((p) => p.id),
      fileUrl: uploaded.url,
      publicId: uploaded.publicId,
    });

    return toSummary(catalogue);
  }

  async listMine(
    userId: string,
    pagination: PaginationQuery,
  ): Promise<{ data: CatalogueSummary[]; total: number }> {
    const agentId = await this.resolveAgentProfileId(userId);
    const { data, total } = await this.repo.listForAgent(agentId, pagination);
    return { data: data.map(toSummary), total };
  }

  async getMine(userId: string, catalogueId: string): Promise<CatalogueSummary> {
    const agentId = await this.resolveAgentProfileId(userId);
    const catalogue = await this.repo.findByIdForAgent(agentId, catalogueId);
    if (!catalogue) {
      throw AppError.notFound('Catalogue not found');
    }
    return toSummary(catalogue);
  }
}

export const cataloguesService = new CataloguesService();
