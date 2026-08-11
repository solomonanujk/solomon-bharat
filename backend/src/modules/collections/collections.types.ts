import { Collection, CollectionStatus } from '@prisma/client';

export interface CreateCollectionInput {
  name: string;
  heroImage?: string;
  editorialIntro?: string;
  isFeatured?: boolean;
  status?: CollectionStatus;
  publishAt?: Date;
}

export interface UpdateCollectionInput {
  name?: string;
  slug?: string;
  heroImage?: string;
  editorialIntro?: string;
  publishAt?: Date | null;
}

export interface AddProductInput {
  productId: string;
  sortOrder?: number;
}

export interface ReorderMembershipItem {
  productId: string;
  sortOrder: number;
}

export interface AdminCollectionListFilter {
  status?: CollectionStatus;
}

export { Collection, CollectionStatus };
