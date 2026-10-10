import { CategoryStatus } from '@prisma/client';
import type { CategoryNode } from '../categories/categories.types';
import type { SuggestedCategory } from './product-import.types';

/** Case/whitespace-insensitive comparison key. */
function norm(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

interface Leaf {
  id: string;
  name: string;
  slug: string;
  /** Names from level 1 down to this level-3 category. */
  names: string[];
}

/** Active level-3 categories whose whole ancestor chain is active. */
function collectLeaves(tree: CategoryNode[]): Leaf[] {
  const leaves: Leaf[] = [];
  const walk = (nodes: CategoryNode[], trail: string[]): void => {
    for (const node of nodes) {
      if (node.status === CategoryStatus.ARCHIVED) continue;
      const names = [...trail, node.name];
      if (node.level === 3) leaves.push({ id: node.id, name: node.name, slug: node.slug, names });
      else walk(node.children ?? [], names);
    }
  };
  walk(tree, []);
  return leaves;
}

/**
 * Suggests a level-3 category for a WooCommerce `Categories` value.
 * Rule 1: the full path equals a level-3 category's full path (names, case-insensitive),
 *         or the path is a single segment equal to a level-3 slug.
 * Rule 2: otherwise the LAST segment equals exactly one active level-3 name.
 * Several paths: the first that matches wins. Ambiguous or unmatched -> null.
 */
export function createCategoryMatcher(tree: CategoryNode[]): (paths: string[][] | undefined) => SuggestedCategory | null {
  const leaves = collectLeaves(tree);
  const byFullPath = new Map<string, Leaf>();
  const bySlug = new Map<string, Leaf>();
  const byName = new Map<string, Leaf[]>();
  for (const leaf of leaves) {
    byFullPath.set(leaf.names.map(norm).join('>'), leaf);
    bySlug.set(norm(leaf.slug), leaf);
    const key = norm(leaf.name);
    byName.set(key, [...(byName.get(key) ?? []), leaf]);
  }
  const toSuggestion = (leaf: Leaf): SuggestedCategory => ({ id: leaf.id, name: leaf.name, path: leaf.names.join(' > ') });

  return (paths) => {
    for (const path of paths ?? []) {
      const segments = path.map(norm).filter(Boolean);
      if (segments.length === 0) continue;
      const exact = byFullPath.get(segments.join('>')) ?? (segments.length === 1 ? bySlug.get(segments[0]) : undefined);
      if (exact) return toSuggestion(exact);
      const named = byName.get(segments[segments.length - 1]);
      if (named?.length === 1) return toSuggestion(named[0]);
    }
    return null;
  };
}
