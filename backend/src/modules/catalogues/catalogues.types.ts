export interface CreateCatalogueInput {
  productIds: string[];
  title?: string;
}

export interface CatalogueSummary {
  id: string;
  title: string;
  fileUrl: string;
  createdAt: Date;
}
