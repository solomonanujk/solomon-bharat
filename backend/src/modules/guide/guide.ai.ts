import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam, BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/errors';

const MODEL = 'claude-opus-5-5';

/** Gemini key saved by the admin in Solomon AI settings (used when the server has no GEMINI_API_KEY). */
let adminGeminiKey = '';
export function setAdminGeminiKey(key: string): void {
  adminGeminiKey = key;
}
const geminiKey = (): string => env.GEMINI_API_KEY || adminGeminiKey;
/** Solomon AI uses Google Gemini when a Gemini key is available (free tier), otherwise Claude. */
const useGemini = (): boolean => Boolean(geminiKey());

/** Checks a Gemini key with Google before it is saved. */
export async function verifyGeminiKey(key: string): Promise<boolean> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) throw new AppError(503, 'Solomon AI is not configured yet');
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

function textOf(content: BetaContentBlock[]): string {
  return content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
}

// ─── Chat ────────────────────────────────────────────────────────────────────

const PERSONA = `You are Solomon AI, the business guide of Solomon Bharat Private Limited (Jaipur, India).
You help people abroad - often NRIs and first-time importers in the UK, US, Canada, Australia, Singapore, the Netherlands, South Africa, Thailand and Scandinavia - who want to source Indian handmade products and start a retail, online or wholesale business.

How you work:
- Talk like an experienced, friendly India export consultant. Most people are beginners: explain any term (HS code, MOQ, landed cost, duty, VAT, EORI) the first time you use it.
- Ask one or two short questions when you need details (their country, budget, goal, product interest, experience) instead of assuming.
- The SOLOMON KNOWLEDGE below is what you have learned from the Solomon Bharat team. It is your foundation: understand its ideas and apply them to this person's situation in your own words. Combine points from different parts, work out the numbers for their case, and give advice. Do not paste or recite passages from it, and do not mention file names or "the documents".
- Prefer the knowledge whenever it covers the question.{{WEB}}
- Never invent facts or numbers. If neither the knowledge{{WEBOR}} gives an answer, say so plainly and offer to connect them with the Solomon Bharat team.
- Show costs as a simple breakdown: product price in India, shipping, duty, VAT/GST, total landed cost per unit, suggested selling price and margin. Say which figures are estimates.
- When it helps, suggest the next practical step, and mention that Solomon Bharat can source, quality-check in Jaipur and ship the products for them.
- Keep replies focused: short paragraphs and simple lists. No tables wider than 4 columns.
- You only discuss sourcing, importing and running a business with Indian handmade products. Politely decline unrelated requests.`;

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

/** One guide reply, grounded in the admin's knowledge base, with web search as a fallback. */
const WEB_RULE =
  ' Search the web whenever it is needed: for current figures (duty and VAT rates, shipping prices, exchange rates, marketplace fees), regulations, trends and competitor prices, or anything the knowledge does not cover. Say which points come from a web search and name the source.';

export async function guideReply(
  knowledge: string,
  visitor: string,
  history: ChatTurn[],
  allowWebSearch: boolean,
): Promise<string> {
  if (useGemini()) {
    const systemText = `${PERSONA.replace('{{WEB}}', allowWebSearch ? WEB_RULE : '').replace('{{WEBOR}}', allowWebSearch ? ' nor a web search' : '')}\n\n${
      knowledge ? `SOLOMON KNOWLEDGE:\n\n${knowledge}` : 'SOLOMON KNOWLEDGE: nothing has been added yet. Rely on careful reasoning and web search, and say where figures come from.'
    }`;
    const turns = history.map((t, i) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: i === 0 ? `[Visitor: ${visitor}]\n\n${t.content}` : t.content }],
    }));
    return geminiGenerate(systemText, turns, allowWebSearch);
  }
  const system = [
    { type: 'text' as const, text: PERSONA.replace('{{WEB}}', allowWebSearch ? WEB_RULE : '').replace('{{WEBOR}}', allowWebSearch ? ' nor a web search' : '') },
    {
      type: 'text' as const,
      text: knowledge
        ? `SOLOMON KNOWLEDGE:\n\n${knowledge}`
        : 'SOLOMON KNOWLEDGE: nothing has been added yet. Rely on careful reasoning and web search, and say where figures come from.',
      cache_control: { type: 'ephemeral' as const },
    },
  ];
  const messages: BetaMessageParam[] = history.map((t) => ({ role: t.role, content: t.content }));
  // Who the visitor is goes after the cached prefix so it never invalidates the cache.
  messages[0] = { role: 'user', content: `[Visitor: ${visitor}]\n\n${history[0].content}` };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await getClient().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      ...FALLBACK,
      system,
      ...(allowWebSearch ? { tools: [{ type: 'web_search_20260209' as const, name: 'web_search' as const, max_uses: 5 }] } : {}),
      messages,
    });
    if (response.stop_reason === 'refusal') {
      logger.warn('Guide reply declined');
      return "Sorry, I can't help with that. I can help you plan sourcing and selling Indian handmade products.";
    }
    if (response.stop_reason === 'pause_turn') {
      // A long web search paused the turn: send it back so the model can finish.
      messages.push({ role: 'assistant', content: response.content });
      continue;
    }
    const text = textOf(response.content);
    if (text) return text;
    break;
  }
  throw new AppError(502, 'Solomon AI could not answer just now. Please try again.');
}

// ─── Reading uploads ─────────────────────────────────────────────────────────

const EXTRACT_PROMPT = `Transcribe everything useful in this file into plain text for a knowledge base about sourcing Indian handmade products and exporting them.
Keep every number, price, rate, percentage, unit, code, name, place and date exactly as written. Write tables as rows with "|" between columns.
Do not summarise away details and do not add anything that is not in the file. Reply with the transcription only.`;

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (useGemini() && buffer.length > 18 * 1024 * 1024) {
    throw AppError.badRequest('PDFs must be under 18 MB. Split it into smaller files and upload them one by one.');
  }
  if (useGemini()) return geminiGenerate('', [{ role: 'user', parts: [{ inline_data: { mime_type: 'application/pdf', data: buffer.toString('base64') } }, { text: EXTRACT_PROMPT }] }], false);
  const message = await getClient()
    .beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      output_config: { effort: 'low' },
      ...FALLBACK,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: buffer.toString('base64') } },
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        },
      ],
    })
    .finalMessage();
  return textOf(message.content);
}

export async function extractTextFromImage(buffer: Buffer, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'): Promise<string> {
  if (useGemini()) {
    return geminiGenerate('', [{ role: 'user', parts: [{ inline_data: { mime_type: mediaType, data: buffer.toString('base64') } }, { text: `${EXTRACT_PROMPT}\nIf the image is a photo of a product or place rather than a document, describe what it shows that would help a buyer (product type, materials, technique, colours, finish).` }] }], false);
  }
  const message = await getClient()
    .beta.messages.stream({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: 'low' },
      ...FALLBACK,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') } },
            {
              type: 'text',
              text: `${EXTRACT_PROMPT}\nIf the image is a photo of a product or place rather than a document, describe what it shows that would help a buyer (product type, materials, technique, colours, finish).`,
            },
          ],
        },
      ],
    })
    .finalMessage();
  return textOf(message.content);
}

// ─── What to upload next ─────────────────────────────────────────────────────

const COVERAGE = `The guide must answer, for 9 countries (UK, US, Canada, Australia, Singapore, Netherlands, South Africa, Thailand, Scandinavia) and 12 categories (home decor, textiles and scarves, jewellery, rugs and carpets, art and paintings, eco/bamboo, leather, pottery and ceramics, food and spices, wooden handicrafts, brassware and metal craft, embroidery):
trend / India export data by HS code; India product cost and MOQ; shipping rates India to each country by weight; customs duty and VAT/GST by category and country; landed cost and selling prices; where to sell (marketplaces and their fees); who buys (consumer profiles); how to market; supplier cities and lead times; business registration steps per country; licences, certifications and labelling rules; documents (India export side and import side); payment methods and terms; competitors and their prices; Solomon Bharat's own services, process and pricing.`;

const SUGGEST_SYSTEM =
  'You help a non-technical founder build the knowledge base for an AI business guide. Be specific and practical. Write in plain English for someone who is not technical.';

export async function suggestUploads(overview: string): Promise<string> {
  const ask = `${COVERAGE}\n\nHere is what has been uploaded so far (title, type and the start of each item):\n\n${overview || '(nothing yet)'}\n\nList the 6 to 8 most valuable things to upload next, most important first, so the guide can answer more from Solomon's own material and needs web search less. For each: one line saying exactly what to upload (and a likely place to get it, e.g. DGFT, UK Trade Tariff, a courier rate card), then one short line on why it helps. Start with one sentence on what is already well covered. Use "- " bullets, no headings, no tables.`;
  if (useGemini()) return geminiGenerate(SUGGEST_SYSTEM, [{ role: 'user', parts: [{ text: ask }] }], false);
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: 'medium' },
    ...FALLBACK,
    system: SUGGEST_SYSTEM,
    messages: [{ role: 'user', content: ask }],
  });
  if (response.stop_reason === 'refusal') return '';
  return textOf(response.content);
}

// ─── Google Gemini (REST) ────────────────────────────────────────────────────

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
interface GeminiTurn {
  role: string;
  parts: GeminiPart[];
}

async function geminiGenerate(system: string, contents: GeminiTurn[], webSearch: boolean): Promise<string> {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
    body: JSON.stringify({
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
      contents,
      ...(webSearch ? { tools: [{ google_search: {} }] } : {}),
    }),
    signal: AbortSignal.timeout(170_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: { code?: number; message?: string };
    candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  };
  if (!res.ok || data.error) {
    logger.error({ status: res.status, error: data.error?.message }, 'Gemini request failed');
    if (res.status === 429) throw new AppError(503, 'Solomon AI is very busy right now. Please try again in a minute.');
    throw new AppError(502, 'Solomon AI could not answer just now. Please try again.');
  }
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) {
    logger.warn({ finishReason: data.candidates?.[0]?.finishReason }, 'Gemini returned no text');
    throw new AppError(502, 'Solomon AI could not answer that. Please rephrase and try again.');
  }
  return text;
}
