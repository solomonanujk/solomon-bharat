/**
 * Rules-first parsing of seller messages. Everything here is plain string matching: commands
 * like "stock 2 20" or "status" never reach an AI model, so they cost nothing.
 */

export type Language = 'en' | 'hi' | 'hinglish';

/** A product is named either by its number in the seller's list or by words from its name. */
export type Target = { index: number } | { name: string };

export type Command =
  | { kind: 'help' }
  | { kind: 'list' }
  | { kind: 'cancel' }
  | { kind: 'add' }
  | { kind: 'done' }
  | { kind: 'confirm' }
  | { kind: 'stock'; target: Target; quantity: number }
  | { kind: 'outOfStock'; target: Target }
  | { kind: 'resubmit'; target: Target }
  | { kind: 'stockUsage' }
  | { kind: 'resubmitUsage' }
  | { kind: 'outOfStockUsage' }
  | { kind: 'unknown' };

const DEVANAGARI_DIGITS = '०१२३४५६७८९';

const HELP = new Set(['help', 'menu', 'hi', 'hii', 'hello', 'hey', 'start', 'namaste', 'madad', 'मदद', 'नमस्ते', '?']);
const LIST = new Set(['list', 'status', 'products', 'product', 'mylist', 'dikhao', 'सूची', 'स्थिति', 'प्रोडक्ट']);
const CANCEL = new Set(['cancel', 'stop', 'exit', 'ruko', 'band', 'रद्द', 'रुको']);
const STOCK = new Set(['stock', 'inventory', 'maal', 'स्टॉक', 'माल']);
const RESUBMIT = new Set(['resubmit', 'dobara', 'फिर', 'दोबारा']);
const ADD = new Set(['add', 'new', 'sell', 'naya', 'nayi', 'bechna', 'jodo', 'नया', 'जोड़ें']);
const DONE = new Set(['done', 'finish', 'finished', 'bas', 'पूरा', 'बस']);
const CONFIRM = new Set(['yes', 'y', 'haan', 'han', 'ha', 'ok', 'okay', 'confirm', 'submit', 'sahi', 'theek', 'हाँ', 'हां', 'ठीक', 'सही']);
const OUT_WORDS = new Set(['khatam', 'khatm', 'soldout', 'खत्म', 'खतम']);
/** Words that only appear in Hinglish/Hindi messages, used to pick the reply language. */
const HINGLISH = new Set([
  'madad', 'mere', 'meri', 'dikhao', 'khatam', 'khatm', 'bhejo', 'dobara', 'ruko', 'band', 'namaste', 'maal', 'kitna', 'hai', 'karo', 'chahiye',
  'naya', 'nayi', 'bechna', 'jodo', 'bas', 'haan', 'theek', 'sahi',
]);
/** Filler words dropped before reading a target ("resubmit my saree" → "saree"). */
const FILLER = new Set(['of', 'for', 'the', 'my', 'ka', 'ki', 'ko', 'me', 'mein', 'to', 'set', 'is', 'now', 'bhejo', 'karo', 'kar', 'do', 'दो', 'का', 'की', 'को']);

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/[^\p{L}\p{N}\p{M}\s?]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectLanguage(text: string): Language {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  const tokens = normalizeText(text).split(' ');
  return tokens.some((t) => HINGLISH.has(t)) ? 'hinglish' : 'en';
}

function isNumber(token: string): boolean {
  return /^\d{1,7}$/.test(token);
}

/** Reads "2" as list position 2, or the remaining words as part of a product name. */
function toTarget(tokens: string[]): Target | null {
  const words = tokens.filter((t) => !FILLER.has(t));
  if (words.length === 0) return null;
  if (words.length === 1 && isNumber(words[0])) return { index: Number(words[0]) };
  const name = words.join(' ');
  return name.length >= 2 ? { name } : null;
}

export function parseCommand(text: string): Command {
  const normalized = normalizeText(text);
  if (!normalized) return { kind: 'unknown' };
  const tokens = normalized.split(' ');
  const first = tokens[0];

  if (tokens.length <= 2 && HELP.has(first)) return { kind: 'help' };
  if (tokens.length <= 2 && CANCEL.has(first)) return { kind: 'cancel' };
  if (LIST.has(first) || (first === 'my' && LIST.has(tokens[1] ?? '')) || (first === 'mere' && LIST.has(tokens[1] ?? ''))) {
    return { kind: 'list' };
  }

  // "out of stock 2", "stock khatam saree", "sold out 3"
  const joined = ` ${normalized} `;
  const saysOut = joined.includes(' out of stock ') || joined.includes(' sold out ') || tokens.some((t) => OUT_WORDS.has(t));
  if (saysOut && (tokens.some((t) => STOCK.has(t)) || OUT_WORDS.has(first) || first === 'out' || first === 'sold')) {
    const rest = tokens.filter(
      (t) => !STOCK.has(t) && !OUT_WORDS.has(t) && !['out', 'of', 'sold'].includes(t),
    );
    const target = toTarget(rest);
    return target ? { kind: 'outOfStock', target } : { kind: 'outOfStockUsage' };
  }

  if (STOCK.has(first)) {
    const rest = tokens.slice(1);
    const numbers = rest.filter(isNumber);
    if (numbers.length === 0) return { kind: 'stockUsage' };
    // "stock 2 20": list position then quantity.
    if (numbers.length >= 2 && isNumber(rest[0])) {
      const target = toTarget([rest[0]]);
      return target ? { kind: 'stock', target, quantity: Number(numbers[numbers.length - 1]) } : { kind: 'stockUsage' };
    }
    // "stock banarasi saree 20": the quantity is the last number, the rest names the product.
    const quantity = Number(numbers[numbers.length - 1]);
    const lastIdx = rest.lastIndexOf(numbers[numbers.length - 1]);
    const target = toTarget([...rest.slice(0, lastIdx), ...rest.slice(lastIdx + 1)]);
    return target ? { kind: 'stock', target, quantity } : { kind: 'stockUsage' };
  }

  if (RESUBMIT.has(first) || (first === 'phir' && tokens.includes('bhejo'))) {
    const target = toTarget(tokens.slice(1).filter((t) => t !== 'bhejo' && t !== 'phir'));
    return target ? { kind: 'resubmit', target } : { kind: 'resubmitUsage' };
  }

  if (tokens.length <= 3 && ADD.has(first)) return { kind: 'add' };
  if ((tokens.length <= 2 && DONE.has(first)) || (tokens.length === 2 && first === 'ho' && tokens[1] === 'gaya')) {
    return { kind: 'done' };
  }
  if (tokens.length <= 2 && CONFIRM.has(first)) return { kind: 'confirm' };

  return { kind: 'unknown' };
}

/** Finds the product a seller meant. Returns the matches so the caller can say "which one?". */
export function resolveTarget<T extends { name: string }>(
  target: Target,
  products: T[],
): { product?: T; matches: T[] } {
  if ('index' in target) {
    const product = products[target.index - 1];
    return { product, matches: product ? [product] : [] };
  }
  const wanted = normalizeText(target.name).split(' ').filter(Boolean);
  const contains = products.filter((p) => {
    const name = normalizeText(p.name);
    return wanted.every((w) => name.includes(w));
  });
  const exact = contains.filter((p) => normalizeText(p.name) === wanted.join(' '));
  if (exact.length === 1) return { product: exact[0], matches: exact };
  if (contains.length === 1) return { product: contains[0], matches: contains };
  return { matches: contains };
}
