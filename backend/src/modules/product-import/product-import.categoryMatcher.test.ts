import { describe, it, expect } from 'vitest';
import type { CategoryNode } from '../categories/categories.types';
import { createCategoryMatcher } from './product-import.categoryMatcher';

function node(id: string, name: string, level: number, children: CategoryNode[] = [], status: 'ACTIVE' | 'ARCHIVED' = 'ACTIVE'): CategoryNode {
  return {
    id,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    level,
    parentId: null,
    description: null,
    heroImage: null,
    status,
    sortOrder: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    productCount: 0,
    children,
  } as CategoryNode;
}

const tree: CategoryNode[] = [
  node('t', 'Textiles', 1, [
    node('t-b', 'Bathrobes', 2, [node('t-b-baby', 'Baby', 3), node('t-b-adult', 'Adult', 3)]),
    node('t-r', 'Rugs', 2, [node('t-r-wool', 'Wool Rugs', 3), node('t-r-old', 'Old Rugs', 3, [], 'ARCHIVED')]),
  ]),
  node('h', 'Home', 1, [node('h-d', 'Decor', 2, [node('h-d-baby', 'Baby', 3), node('h-d-lamps', 'Lamps', 3)])]),
  node('x', 'Retired', 1, [node('x-a', 'Gone', 2, [node('x-a-1', 'Ghost', 3)])], 'ARCHIVED'),
];

describe('createCategoryMatcher', () => {
  const match = createCategoryMatcher(tree);

  it('matches the exact full path, case and whitespace insensitive', () => {
    expect(match([['textiles', ' Bathrobes ', 'baby']])).toEqual({ id: 't-b-baby', name: 'Baby', path: 'Textiles > Bathrobes > Baby' });
  });

  it('resolves an otherwise ambiguous name through its full path', () => {
    expect(match([['Home', 'Decor', 'Baby']])?.id).toBe('h-d-baby');
  });

  it('matches a single segment by slug', () => {
    expect(match([['wool-rugs']])?.id).toBe('t-r-wool');
  });

  it('falls back to the last segment when exactly one level-3 category has that name', () => {
    expect(match([['Everything', 'Lamps']])).toEqual({ id: 'h-d-lamps', name: 'Lamps', path: 'Home > Decor > Lamps' });
  });

  it('returns null for an ambiguous last segment', () => {
    expect(match([['Anything', 'Baby']])).toBeNull();
  });

  it('returns null when nothing matches or paths are missing', () => {
    expect(match([['Furniture']])).toBeNull();
    expect(match([])).toBeNull();
    expect(match(undefined)).toBeNull();
  });

  it('ignores archived categories, including under an archived ancestor', () => {
    expect(match([['Old Rugs']])).toBeNull();
    expect(match([['Ghost']])).toBeNull();
  });

  it('uses the first path that matches', () => {
    expect(match([['Nope'], ['Lamps'], ['Wool Rugs']])?.id).toBe('h-d-lamps');
  });
});
