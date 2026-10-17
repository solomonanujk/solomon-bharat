import Anthropic from '@anthropic-ai/sdk';
import type { BetaMessageParam, BetaContentBlock } from '@anthropic-ai/sdk/resources/beta/messages/messages';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../utils/errors';

const MODEL = 'claude-opus-5-5';
/** Visitor chat: fast, natural and affordable for a public chat. */
const CHAT_MODEL = 'claude-sonnet-5-5';

/** Anthropic key saved by the admin (wins over the server's ANTHROPIC_API_KEY). With it, Claude answers visitors first. */
let adminAnthropicKey = '';
export function setAdminAnthropicKey(key: string): void {
  adminAnthropicKey = key;
}
const anthropicKey = (): string => adminAnthropicKey || env.ANTHROPIC_API_KEY;

/** Checks an Anthropic key before it is saved. */
export async function verifyAnthropicKey(key: string): Promise<boolean> {
  const res = await fetch('https://api.anthropic.com/v1/models?limit=1', {
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Gemini key saved by the admin in Solomon AI settings (used when the server has no GEMINI_API_KEY). */
let adminGeminiKey = '';
export function setAdminGeminiKey(key: string): void {
  adminGeminiKey = key;
}
// The key entered in Admin → Solomon AI wins over the server's GEMINI_API_KEY.
const geminiKey = (): string => adminGeminiKey || env.GEMINI_API_KEY;
let adminOpenRouterKey = '';
export function setAdminOpenRouterKey(key: string): void {
  adminOpenRouterKey = key;
}
const openRouterKey = (): string => adminOpenRouterKey || env.OPENROUTER_API_KEY;
/** OpenRouter (free models) is tried first when its key is set; Gemini, then Claude, back it up. */
const useOpenRouter = (): boolean => Boolean(openRouterKey());

/** Checks an OpenRouter key before it is saved. */
export async function verifyOpenRouterKey(key: string): Promise<boolean> {
  const res = await fetch('https://openrouter.ai/api/v1/key', {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Solomon AI uses Google Gemini when a Gemini key is available (free tier), otherwise Claude. */
const useGemini = (): boolean => Boolean(geminiKey());
const hasBackup = (): boolean => useGemini() || Boolean(anthropicKey());

/** Runs the OpenRouter version first; if OpenRouter is out of free requests or busy and
 *  Gemini or Claude is configured, the existing path answers instead. */
async function viaOpenRouter(primary: () => Promise<string>, backup: () => Promise<string>): Promise<string> {
  if (!useOpenRouter()) return backup();
  try {
    return await primary();
  } catch (err) {
    if (!hasBackup()) throw err;
    logger.warn({ err: err instanceof Error ? err.message : err }, 'OpenRouter failed; using the backup AI');
    return backup();
  }
}

/** Checks a Gemini key with Google before it is saved. */
export async function verifyGeminiKey(key: string): Promise<boolean> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1', {
    headers: { 'x-goog-api-key': key },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

let client: { key: string; sdk: Anthropic } | null = null;
function getClient(): Anthropic {
  const key = anthropicKey();
  if (!key) throw new AppError(503, 'Solomon AI is not configured yet');
  if (client?.key !== key) client = { key, sdk: new Anthropic({ apiKey: key }) };
  return client.sdk;
}

function textOf(content: BetaContentBlock[]): string {
  return content
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('')
    .trim();
}

// ─── Chat ────────────────────────────────────────────────────────────────────

const PERSONA = `You are Solomon AI, a sourcing advisor who helps people abroad decide which Indian handmade products to sell, and how to sell them. You talk like a sharp, friendly merchant who has done this for years: simple words, clear direction, no fluff.

HOW THE CHAT WORKS
- The visitor's first message is usually a short profile from a tap-through intake: what they do, where they live, who they want to sell to, the categories they like and the price they want to sell at. Treat it as everything you need. Do not ask those things again.
- If the profile is missing something important, ask ONE short question, then recommend.
- Your goal: by the end of the chat the visitor knows exactly which products to sell, what they cost to land, what to sell them for, who to sell them to and how to position them.

WHEN YOU RECOMMEND (the first reply after the profile, and whenever they ask for more):
1. One short line that shows you understood them (e.g. "Eco-minded shoppers in Paris at €20 to €50, got it. Here's where I'd start.").
2. Exactly 3 products as <<PICK>> lines (described below). Prefer products from the SOLOMON CATALOGUE that fit their categories and price point; fill the rest with product ideas.
3. Then a short "how to sell it" note in plain sentences, at most 3: who exactly to target, how to position it (the angle or story that makes it sell), and where to sell it (their shop, Etsy, Instagram, markets, wholesale to boutiques...).
4. Never repeat the product details in the text: the cards show them.
- When they ask for more products, give 3 different ones in the same way. Use what they liked or saved to pick better ones.

<<PICK>> FORMAT: one line per product, the marker followed by a single-line JSON object:
<<PICK>> {"code":"catalogue-code-if-from-catalogue","name":"Product name (only for ideas)","photo":"2-4 word photo search (only for ideas)","story":"1-2 sentences: who makes it, where, how, what makes it special","why":"one sentence on why it fits THIS visitor","cost":"India price per piece","shipping":"shipping per piece to their country","duty":"duty + VAT per piece","landed":"total landed cost per piece","sell":"suggested retail price range"}
- Use the visitor's currency for shipping, duty, landed and sell (keep cost in INR with a rough conversion, e.g. "₹450 (about €5)").
- For catalogue products use the buyer price shown in the catalogue as the India price. For ideas give a realistic India wholesale estimate.
- Shipping: ALWAYS work it out from the shipping rates in the SOLOMON KNOWLEDGE (the team's rate sheet, by destination country and weight). Use the product's weight from the catalogue (for ideas, a realistic weight for that product), find the rate for the visitor's country and that weight slab, and divide by the pieces when the rate is per shipment. Show the basis in the value, e.g. "~€1.30 (0.4 kg at €3.20/kg)". Only if the rate sheet has nothing for their country, estimate and say so.
- Duty and VAT: use the duty and VAT rates in the SOLOMON KNOWLEDGE for their country and product type{{WEBDUTY}}. Mark estimates by starting the values with "~".
- Keep each value short (e.g. "~€1.80"). Never invent catalogue codes.

STYLE
- Every message under 80 words of visible text (the PICK lines don't count). Plain text only: no asterisks, bold, headings, bullet or numbered lists, dividers or hashtags. Write like a person texting a client.
- Be direct and confident. Give direction, not options lists. Don't explain what you are about to do.
- Do NOT promote or pitch Solomon Bharat or any company.

YOUR KNOWLEDGE
- The SOLOMON KNOWLEDGE below is your background understanding. Use its ideas in your own words. Never paste passages or mention files or "the documents".{{WEB}}
- If neither the knowledge{{WEBOR}} gives an answer, say so plainly. Never invent facts.
- You only discuss sourcing, importing and selling Indian handmade products. Politely steer back if asked about anything else.

AT THE END OF EVERY REPLY add these hidden lines (they become buttons):
<<FOLLOWUPS>> 2 or 3 short next replies in the visitor's voice, separated by " | ". After recommendations always include "Show me more products".
<<WHATSAPP>> add this line ONLY when the visitor shows clear buying intent: they like or save products, ask about ordering, samples, MOQ or suppliers, or say they are ready. When you add it, end your message with one friendly sentence such as: "If you want help actually sourcing these, chat with Pranjal, founder of Solomon Bharat, on WhatsApp. Solomon Bharat helps buyers like you source unique Indian products from just 5 pieces, delivered to your door in about 7 days."`;

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
  // With an Anthropic key, Claude answers first; the free models only step in if it fails.
  if (anthropicKey()) {
    try {
      return await claudeGuideReply(knowledge, visitor, history, allowWebSearch, CHAT_MODEL);
    } catch (err) {
      if (!useOpenRouter() && !useGemini()) throw err;
      logger.warn({ err: err instanceof Error ? err.message : err }, 'Claude failed; using the free models');
      return freeGuideReply(knowledge, visitor, history, allowWebSearch);
    }
  }
  return freeGuideReply(knowledge, visitor, history, allowWebSearch);
}

function freeGuideReply(knowledge: string, visitor: string, history: ChatTurn[], allowWebSearch: boolean): Promise<string> {
  return viaOpenRouter(
    () => {
      // OpenRouter's free models have no web search: the persona says so by leaving the rule out.
      const systemText = `${PERSONA.replace('{{WEB}}', '').replace('{{WEBOR}}', '').replace('{{WEBDUTY}}', '')}\n\n${
        knowledge ? `SOLOMON KNOWLEDGE:\n\n${knowledge}` : 'SOLOMON KNOWLEDGE: nothing has been added yet. Explain that the guide is still being set up and offer to connect them with the Solomon Bharat team.'
      }`;
      const messages = history.map((t, i) => ({ role: t.role, content: i === 0 ? `[Visitor: ${visitor}]\n\n${t.content}` : t.content }));
      return openRouterChat(systemText, messages);
    },
    () => guideReplyBackup(knowledge, visitor, history, allowWebSearch),
  );
}

async function guideReplyBackup(knowledge: string, visitor: string, history: ChatTurn[], allowWebSearch: boolean): Promise<string> {
  if (useGemini()) {
    const systemText = `${PERSONA.replace('{{WEB}}', allowWebSearch ? WEB_RULE : '').replace('{{WEBOR}}', allowWebSearch ? ' nor a web search' : '').replace('{{WEBDUTY}}', allowWebSearch ? ', or search the web for the current rate' : '')}\n\n${
      knowledge ? `SOLOMON KNOWLEDGE:\n\n${knowledge}` : 'SOLOMON KNOWLEDGE: nothing has been added yet. Rely on careful reasoning and web search, and say where figures come from.'
    }`;
    const turns = history.map((t, i) => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: i === 0 ? `[Visitor: ${visitor}]\n\n${t.content}` : t.content }],
    }));
    return geminiGenerate(systemText, turns, allowWebSearch);
  }
  return claudeGuideReply(knowledge, visitor, history, allowWebSearch, MODEL);
}

async function claudeGuideReply(knowledge: string, visitor: string, history: ChatTurn[], allowWebSearch: boolean, model: string): Promise<string> {
  const system = [
    { type: 'text' as const, text: PERSONA.replace('{{WEB}}', allowWebSearch ? WEB_RULE : '').replace('{{WEBOR}}', allowWebSearch ? ' nor a web search' : '').replace('{{WEBDUTY}}', allowWebSearch ? ', or search the web for the current rate' : '') },
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
      model,
      max_tokens: 4000,
      output_config: { effort: 'low' },
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

/** Text from a PDF's own text layer, read on the server (no AI, no cost). Empty for scanned PDFs. */
async function pdfTextLayer(buffer: Buffer): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    try {
      const { text, totalPages } = await extractText(pdf, { mergePages: false });
      const pages = text as string[];
      const letters = pages.join('').replace(/\s/g, '').length;
      // Scanned PDFs have little or no text layer: let the AI read those instead.
      if (letters < 200 || letters / Math.max(1, totalPages) < 120) return '';
      return pages
        .map((page, i) => `--- Page ${i + 1} ---\n${page.trim()}`)
        .join('\n\n')
        .trim();
    } finally {
      await pdf.loadingTask.destroy().catch(() => undefined);
    }
  } catch (err) {
    logger.warn({ err }, 'Could not read the PDF text layer; falling back to AI reading');
    return '';
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const local = await pdfTextLayer(buffer);
  if (local) return local;
  if (!hasBackup()) {
    throw AppError.badRequest('This looks like a scanned PDF (no text inside). Add a Gemini key to read scanned PDFs, or upload a text version of the file.');
  }
  if (useGemini() && buffer.length > 18 * 1024 * 1024) {
    throw AppError.badRequest('PDFs must be under 18 MB. Split it into smaller files and upload them one by one.');
  }
  if (useGemini()) return geminiGenerate('', [{ role: 'user', parts: [{ inline_data: { mime_type: 'application/pdf', data: buffer.toString('base64') } }, { text: EXTRACT_PROMPT }] }], false, { fast: true });
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
  const ask = `${EXTRACT_PROMPT}\nIf the image is a photo of a product or place rather than a document, describe what it shows that would help a buyer (product type, materials, technique, colours, finish).`;
  return viaOpenRouter(
    () => openRouterChat('', [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${mediaType};base64,${buffer.toString('base64')}` } }, { type: 'text', text: ask }] }], { vision: true }),
    () => extractTextFromImageBackup(buffer, mediaType),
  );
}

async function extractTextFromImageBackup(buffer: Buffer, mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'): Promise<string> {
  if (useGemini()) {
    return geminiGenerate('', [{ role: 'user', parts: [{ inline_data: { mime_type: mediaType, data: buffer.toString('base64') } }, { text: `${EXTRACT_PROMPT}\nIf the image is a photo of a product or place rather than a document, describe what it shows that would help a buyer (product type, materials, technique, colours, finish).` }] }], false, { fast: true });
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

// ─── Summary of what was learned ─────────────────────────────────────────────

/** Short list of the key points the guide learned from one item (shown to the admin). */
export async function summarizeKnowledge(title: string, content: string): Promise<string> {
  const ask = `This is "${title}", added to the knowledge of an AI export guide for people who want to source Indian handmade products and sell them abroad.\n\n${content.slice(0, 120_000)}\n\nIn 5 to 10 short "- " bullets, list the most useful things the guide learned from it: key facts, figures (with units), rules, countries, products and recommendations. Plain English, no headings, no preamble.`;
  return viaOpenRouter(
    () => openRouterChat('', [{ role: 'user', content: ask }]),
    () => summarizeKnowledgeBackup(ask),
  );
}

async function summarizeKnowledgeBackup(ask: string): Promise<string> {
  if (useGemini()) return geminiGenerate('', [{ role: 'user', parts: [{ text: ask }] }], false, { fast: true });
  const response = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 3000,
    output_config: { effort: 'low' },
    ...FALLBACK,
    messages: [{ role: 'user', content: ask }],
  });
  return response.stop_reason === 'refusal' ? '' : textOf(response.content);
}

// ─── What to upload next ─────────────────────────────────────────────────────

const COVERAGE = `The guide must answer, for 9 countries (UK, US, Canada, Australia, Singapore, Netherlands, South Africa, Thailand, Scandinavia) and 12 categories (home decor, textiles and scarves, jewellery, rugs and carpets, art and paintings, eco/bamboo, leather, pottery and ceramics, food and spices, wooden handicrafts, brassware and metal craft, embroidery):
trend / India export data by HS code; India product cost and MOQ; shipping rates India to each country by weight; customs duty and VAT/GST by category and country; landed cost and selling prices; where to sell (marketplaces and their fees); who buys (consumer profiles); how to market; supplier cities and lead times; business registration steps per country; licences, certifications and labelling rules; documents (India export side and import side); payment methods and terms; competitors and their prices; Solomon Bharat's own services, process and pricing.`;

const SUGGEST_SYSTEM =
  'You help a non-technical founder build the knowledge base for an AI business guide. Be specific and practical. Write in plain English for someone who is not technical.';

export async function suggestUploads(overview: string): Promise<string> {
  const ask = `${COVERAGE}\n\nHere is what has been uploaded so far (title, type and the start of each item):\n\n${overview || '(nothing yet)'}\n\nList the 6 to 8 most valuable things to upload next, most important first, so the guide can answer more from Solomon's own material and needs web search less. For each: one line saying exactly what to upload (and a likely place to get it, e.g. DGFT, UK Trade Tariff, a courier rate card), then one short line on why it helps. Start with one sentence on what is already well covered. Use "- " bullets, no headings, no tables.`;
  return viaOpenRouter(
    () => openRouterChat(SUGGEST_SYSTEM, [{ role: 'user', content: ask }]),
    () => suggestUploadsBackup(ask),
  );
}

async function suggestUploadsBackup(ask: string): Promise<string> {
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

/** Models tried in order: each has its own free daily allowance, so when one is used up
 *  (or busy, or retired) the next one answers. GEMINI_MODEL, if set, goes first. */
function geminiModels(): string[] {
  const list = [env.GEMINI_MODEL, 'gemini-3.5-flash', 'gemini-2.5-flash', 'gemini-3.5-flash-lite'].filter(Boolean) as string[];
  return [...new Set(list)];
}

type GeminiData = {
  error?: { code?: number; message?: string };
  candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
};

async function geminiCall(model: string, body: unknown): Promise<{ status: number; data: GeminiData }> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': geminiKey() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(240_000),
  }).catch((err: unknown) => {
    logger.error({ err, model }, 'Gemini request did not complete');
    return null;
  });
  const data = (res ? await res.json().catch(() => ({})) : {}) as GeminiData;
  return { status: res?.status ?? 0, data };
}

async function geminiGenerate(system: string, contents: GeminiTurn[], webSearch: boolean, opts: { fast?: boolean } = {}): Promise<string> {
  const base = {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
    generationConfig: {
      maxOutputTokens: 65536,
      // Reading a file needs no reasoning: skip "thinking" so it is faster and lighter on the quota.
      ...(opts.fast ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    },
  };
  let lastStatus = 0;
  let lastMessage = '';
  for (const model of geminiModels()) {
    // With web search first; if Google refuses the search (its own free limit), answer without it.
    const variants = webSearch ? [true, false] : [false];
    for (const withSearch of variants) {
      // eslint-disable-next-line no-await-in-loop
      const { status, data } = await geminiCall(model, withSearch ? { ...base, tools: [{ google_search: {} }] } : base);
      if (status === 200 && !data.error) {
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
        if (text) return text;
        logger.warn({ model, finishReason: data.candidates?.[0]?.finishReason, block: data.promptFeedback?.blockReason }, 'Gemini returned no text');
        throw new AppError(502, 'Solomon AI could not read or answer this. Try rephrasing, or for a file, try a smaller or clearer copy.');
      }
      lastStatus = status;
      lastMessage = data.error?.message ?? '';
      logger.warn({ model, withSearch, status, error: lastMessage.slice(0, 300) }, 'Gemini request failed');
      if (status === 400) throw AppError.badRequest(`Google could not process this: ${lastMessage.slice(0, 200)}`);
      // 429 with search on: retry the same model without search. Anything else: next model.
      if (!(status === 429 && withSearch)) break;
    }
  }
  if (lastStatus === 429) {
    throw new AppError(503, "Solomon AI has used today's free Google allowance. It resets daily; to remove the limit, turn on billing for the Gemini key in Google AI Studio.");
  }
  throw new AppError(503, 'Google is busy right now. Please try again in a few minutes.');
}

// ─── OpenRouter (free models, OpenAI-style chat API) ─────────────────────────

// Inkling's free tier is limited to agent apps on OpenRouter, so it is not used here.
const OPENROUTER_TEXT_MODELS = ['nvidia/nemotron-3-super-120b-a12b:free', 'dots-studio/dots-3-note-preview:free', 'google/gemma-4-31b-it:free'];
const OPENROUTER_VISION_MODELS = ['dots-studio/dots-3-note-preview:free', 'google/gemma-4-31b-it:free', 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'];

type OpenRouterContent = string | ({ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } })[];
interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: OpenRouterContent;
}

async function openRouterChat(system: string, messages: OpenRouterMessage[], opts: { vision?: boolean } = {}): Promise<string> {
  const configured = (env.OPENROUTER_MODELS || '').split(',').map((m) => m.trim()).filter(Boolean);
  // OpenRouter tries these in order when one is busy, rate-limited or unavailable.
  const models = (configured.length ? configured : opts.vision ? OPENROUTER_VISION_MODELS : OPENROUTER_TEXT_MODELS).slice(0, 3);
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${openRouterKey()}`,
      'HTTP-Referer': env.APP_URL,
      'X-Title': 'Solomon Bharat - Solomon AI',
    },
    body: JSON.stringify({
      models,
      messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      max_tokens: 8000,
    }),
    signal: AbortSignal.timeout(240_000),
  }).catch((err: unknown) => {
    logger.error({ err }, 'OpenRouter request did not complete');
    return null;
  });
  const data = (res ? await res.json().catch(() => ({})) : {}) as {
    error?: { code?: number; message?: string };
    model?: string;
    choices?: { message?: { content?: string | null }; finish_reason?: string; error?: { message?: string } }[];
  };
  const status = res?.status ?? 0;
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  if (status === 200 && !data.error && text) return text;
  const reason = data.error?.message ?? data.choices?.[0]?.error?.message ?? '';
  logger.warn({ status, model: data.model, reason: reason.slice(0, 300) }, 'OpenRouter request failed');
  if (status === 429 || /rate limit|free-models-per-day/i.test(reason)) {
    throw new AppError(503, "Solomon AI has used today's free OpenRouter requests. Adding $10 of credit on OpenRouter once raises the free limit to about 1,000 a day.");
  }
  if (status === 401 || status === 403) throw new AppError(503, 'The OpenRouter key was not accepted. Add it again in Admin → Solomon AI.');
  if (status === 200) throw new AppError(502, 'Solomon AI could not answer that. Please rephrase and try again.');
  throw new AppError(503, 'The free AI models are busy right now. Please try again in a minute.');
}
