import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/errors';

export interface DescriptionDraftInput {
  name: string;
  category?: string;
  materials?: string;
  craftTechnique?: string;
  placeOfOrigin?: string;
  dimensions?: string;
  careInstructions?: string;
  notes?: string;
}

const MODEL = 'claude-opus-5-5';

const SYSTEM = `You write product descriptions for Solomon Bharat, a B2B wholesale marketplace selling Indian handmade and artisan products to boutiques, gift shops and importers in the UK, Europe and beyond.
Write for a retail buyer deciding what to stock: what the product is, how it is made and where, materials, size, and why their customers will want it.
Use plain, warm British English. 80-140 words, two short paragraphs, no headings, no bullet points, no emojis, no prices.
Only state facts given in the input. Do not invent certifications, awards, delivery times or claims such as "eco-friendly" or "fair trade" unless provided.
Reply with the description text only.`;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new AppError(503, 'AI writing help is not configured');
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

/** Drafts a product description for the seller to review and edit. Never saved automatically. */
export async function draftProductDescription(input: DescriptionDraftInput): Promise<string> {
  const facts = Object.entries(input)
    .filter(([, v]) => typeof v === 'string' && v.trim())
    .map(([k, v]) => `${k}: ${String(v).trim()}`)
    .join('\n');

  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low' },
    // Re-run on a fallback model if a safety classifier declines.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SYSTEM,
    messages: [{ role: 'user', content: `Product details:\n${facts}` }],
  });

  if (response.stop_reason === 'refusal') {
    logger.warn({ name: input.name }, 'Description draft declined');
    throw AppError.badRequest('Could not draft a description for this product. Please write it yourself.');
  }
  const text = response.content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
  if (!text) {
    throw new AppError(502, 'The AI returned an empty draft. Try again.');
  }
  return text;
}
