export type CategoryStatus = 'ACTIVE' | 'ARCHIVED';

export interface CategoryNode {
  id: string;
  name: string;
  slug: string;
  level: number;
  parentId: string | null;
  description: string | null;
  heroImage: string | null;
  sortOrder: number;
  productCount: number;
  status?: CategoryStatus;
  children: CategoryNode[];
}

export interface CreateCategoryInput {
  name: string;
  level: 1 | 2 | 3;
  parentId?: string;
  description?: string;
  heroImage?: string;
  sortOrder?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  description?: string;
  heroImage?: string;
  sortOrder?: number;
}

export interface ReorderCategoriesItem {
  id: string;
  sortOrder: number;
}

export interface CategoryBreadcrumbEntry {
  id: string;
  name: string;
  slug: string;
  level: number;
}

export interface CategoryChild {
  id: string;
  name: string;
  slug: string;
  level: number;
  heroImage: string | null;
  productCount: number;
}

export interface CategoryDetail {
  id: string;
  name: string;
  slug: string;
  level: number;
  description: string | null;
  heroImage: string | null;
  productCount: number;
  breadcrumb: CategoryBreadcrumbEntry[];
  children: CategoryChild[];
}