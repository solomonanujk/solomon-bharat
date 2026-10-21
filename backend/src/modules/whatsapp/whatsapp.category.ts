import { CategoryStatus } from '@prisma/client';
import type { CategoryNode } from '../categories/categories.types';
import type { CategoryOption } from './whatsapp.listing';

/**
 * Finds the level-3 category for a seller's product type with plain word matching, so it costs
 * no AI tokens. Confident single matches are used; otherwise the closest few go back to the
 * seller to choose from.
 */

const STOPWORDS = new Set(['and', 'of', 'the', 'for', 'with', 'set', 'in', 'a', 'an', 'hand', 'handmade', 'made', 'indian', 'traditional', 'pure']);

function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => !STOPWORDS.has(w)).map(stem);
}

/** Active level-3 categories whose whole ancestor chain is active. */
export function flattenLeaves(tree: CategoryNode[]): CategoryOption[] {
  const leaves: CategoryOption[] = [];
  const walk = (nodes: CategoryNode[], trail: string[]): void => {
    for (const node of nodes) {
      if (node.status === CategoryStatus.ARCHIVED) continue;
      const names = [...trail, node.name];
      if (node.level === 3) leaves.push({ id: node.id, name: node.name, path: names.join(' > ') });
      else walk(node.children ?? [], names);
    }
  };
  walk(tree, []);
  return leaves;
}

function score(wanted: string[], leaf: CategoryOption): number {
  const nameTokens = new Set(tokens(leaf.name));
  const pathTokens = new Set(tokens(leaf.path.split(' > ').slice(0, -1).join(' ')));
  let total = 0;
  for (const w of new Set(wanted)) {
    if (nameTokens.has(w)) total += 3;
    else if (pathTokens.has(w)) total += 1;
  }
  if (wanted.length > 0 && nameTokens.size === wanted.length && wanted.every((w) => nameTokens.has(w))) total += 5;
  return total;
}

export function rankCategories(text: string, leaves: CategoryOption[], limit = 5): { leaf: CategoryOption; score: number }[] {
  const wanted = tokens(text);
  if (wanted.length === 0) return [];
  return leaves
    .map((leaf) => ({ leaf, score: score(wanted, leaf) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.leaf.name.localeCompare(b.leaf.name))
    .slice(0, limit);
}

function confident(ranked: { score: number }[]): boolean {
  if (ranked.length === 0 || ranked[0].score < 3) return false;
  return ranked.length === 1 || ranked[0].score >= ranked[1].score * 1.5;
}

/**
 * `hint` is the AI's short product type, `name` the product title. The hint alone is tried
 * first; the name is added only when the hint is not enough.
 */
export function resolveCategory(
  hint: string,
  name: string,
  leaves: CategoryOption[],
): { match?: CategoryOption; options: CategoryOption[] } {
  const byHint = rankCategories(hint, leaves);
  if (confident(byHint)) return { match: byHint[0].leaf, options: [] };
  const withName = rankCategories(`${hint} ${name}`, leaves);
  if (confident(withName)) return { match: withName[0].leaf, options: [] };
  // Offer only categories whose own name matches a word; fall back to the closest few when none does.
  const pool = withName.length > 0 ? withName : byHint;
  const named = pool.filter((r) => r.score >= 3);
  return { options: (named.length > 0 ? named : pool.slice(0, 3)).slice(0, 5).map((r) => r.leaf) };
}

/** Picks one of the offered options by the exact name the AI echoed back, or by its list number. */
export function chooseOption(answer: string | undefined, options: CategoryOption[]): CategoryOption | undefined {
  if (!answer) return undefined;
  const wanted = answer.trim().toLowerCase().replace(/^[a-e]\)\s*/, '');
  const number = /^\d$/.test(wanted) ? Number(wanted) : NaN;
  if (number >= 1 && number <= options.length) return options[number - 1];
  return options.find((o) => o.name.toLowerCase() === wanted || o.path.toLowerCase() === wanted);
}
