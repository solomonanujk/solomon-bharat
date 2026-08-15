import { Category, CategoryStatus } from '@prisma/client';

export interface CategoryNode extends Category {
  productCount: number;
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
  heroImage?: string | null;
  sortOrder?: number;
}

export interface UploadedImageFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface ReorderItem {
  id: string;
  sortOrder: number;
}

export interface CategoryBreadcrumbEntry {
  id: string;
  name: string;
  slug: string;
  level: number;
}

export interface CategoryDetail extends Category {
  productCount: number;
  breadcrumb: CategoryBreadcrumbEntry[];
  children: (Category & { productCount: number })[];
}

export { CategoryStatus };
