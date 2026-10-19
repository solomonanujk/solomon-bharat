import { CategoryStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { CategoryNode } from '../categories/categories.types';
import { chooseOption, flattenLeaves, rankCategories, resolveCategory } from './whatsapp.category';

function node(name: string, level: 1 | 2 | 3, children: CategoryNode[] = [], status: CategoryStatus = CategoryStatus.ACTIVE): CategoryNode {
  return { id: name.toLowerCase().replace(/\s+/g, '-'), name, level, status, children, productCount: 0 } as unknown as CategoryNode;
}

const tree = [
  node('Textiles', 1, [
    node('Sarees', 2, [node('Cotton Sarees', 3), node('Silk Sarees', 3)]),
    node('Home Linen', 2, [node('Cushion Covers', 3)]),
  ]),
  node('Home Decor', 1, [
    node('Lighting', 2, [node('Brass Lamps', 3), node('Paper Lanterns', 3)]),
    node('Archived Things', 2, [node('Old Item', 3)], CategoryStatus.ARCHIVED),
  ]),
];

const leaves = flattenLeaves(tree);

describe('flattenLeaves', () => {
  it('returns active level-3 categories with their full path', () => {
    expect(leaves.map((l) => l.path)).toEqual([
      'Textiles > Sarees > Cotton Sarees',
      'Textiles > Sarees > Silk Sarees',
      'Textiles > Home Linen > Cushion Covers',
      'Home Decor > Lighting > Brass Lamps',
      'Home Decor > Lighting > Paper Lanterns',
    ]);
  });
});

describe('resolveCategory', () => {
  it('picks a clear match from the AI hint, ignoring plurals', () => {
    expect(resolveCategory('brass lamp', 'Brass Diya Lamp', leaves).match?.name).toBe('Brass Lamps');
    expect(resolveCategory('cushion cover', '', leaves).match?.name).toBe('Cushion Covers');
  });

  it('offers options when the hint fits several categories equally', () => {
    const result = resolveCategory('saree', 'Handloom Saree', leaves);
    expect(result.match).toBeUndefined();
    expect(result.options.map((o) => o.name).sort()).toEqual(['Cotton Sarees', 'Silk Sarees']);
  });

  it('uses the product name to break a tie the hint cannot', () => {
    expect(resolveCategory('saree', 'Pure Silk Saree', leaves).match?.name).toBe('Silk Sarees');
  });

  it('returns no options when nothing resembles the text', () => {
    expect(resolveCategory('rocket engine', 'Rocket', leaves)).toEqual({ options: [] });
    expect(resolveCategory('', '', leaves)).toEqual({ options: [] });
  });
});

describe('rankCategories', () => {
  it('ranks name matches above matches on the parent path', () => {
    const ranked = rankCategories('lighting lamp', leaves);
    expect(ranked[0].leaf.name).toBe('Brass Lamps');
  });
});

describe('chooseOption', () => {
  const options = leaves.slice(0, 2);

  it('picks by exact name, case-insensitively, with or without the letter', () => {
    expect(chooseOption('silk sarees', options)?.name).toBe('Silk Sarees');
    expect(chooseOption('a) Cotton Sarees', options)?.name).toBe('Cotton Sarees');
  });

  it('picks by position number', () => {
    expect(chooseOption('2', options)?.name).toBe('Silk Sarees');
    expect(chooseOption('3', options)).toBeUndefined();
  });

  it('returns nothing for an unknown answer', () => {
    expect(chooseOption('lamps', options)).toBeUndefined();
    expect(chooseOption(undefined, options)).toBeUndefined();
  });
});
