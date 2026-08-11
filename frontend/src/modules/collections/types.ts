import { BuyerProduct } from '../products/types';

export interface Collection {
  id: string;
  name: string;
  slug: string;
  heroImage: string | null;
  editorialIntro: string | null;
  isFeatured: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionPublicDetail {
  collection: Collection;
  products: BuyerProduct[];
  total: number;
  related: Collection[];
}

export interface CreateCollectionInput {
  name: string;
  heroImage?: string;
  editorialIntro?: string;
}

export interface AdminCollectionDetail extends Collection {
  products: (BuyerProduct & { sortOrder: number })[];
}