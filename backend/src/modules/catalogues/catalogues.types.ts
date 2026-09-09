export interface CatalogueItemInput {
  productId: string;
  /** The agent's own resale price for this product — never the platform's adminPrice/agentPrice. */
  price: number;
  /** The agent's own MOQ for this product — may differ from the platform product's MOQ. */
  moq: number;
}

export interface CreateCatalogueInput {
  items: CatalogueItemInput[];
  title?: string;
}

export interface CatalogueSummary {
  id: string;
  title: string;
  fileUrl: string;
  createdAt: Date;
}
