export interface CatalogueItemInput {
  productId: string;
  /** Legacy — no longer printed; catalogues are white-label and carry no pricing. */
  price?: number;
  /** The agent's own MOQ for this product — may differ from the platform product's MOQ. */
  moq: number;
}

export interface CreateCatalogueInput {
  items: CatalogueItemInput[];
  title?: string;
  contact: CatalogueContact;
}

export interface CatalogueContact {
  companyName: string;
  phone: string;
  email: string;
}

export interface CatalogueSummary {
  id: string;
  title: string;
  fileUrl: string;
  createdAt: Date;
}
