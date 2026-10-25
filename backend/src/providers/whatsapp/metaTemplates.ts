/**
 * Meta's message-template API for the WhatsApp Business Account (WABA): submit a template for
 * approval, read its verdict, delete it. Sending a template lives in `meta.ts`.
 *
 * Needs the WABA id (not the phone number id) and an access token with the
 * `whatsapp_business_management` permission.
 */

export interface TemplateButton {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone?: string;
}

export interface TemplateDefinition {
  /** Lowercase letters, digits and underscores. */
  name: string;
  category: 'MARKETING' | 'UTILITY';
  language: string;
  headerText?: string | null;
  /** Body with {{1}}, {{2}} ... placeholders. */
  body: string;
  footer?: string | null;
  buttons?: TemplateButton[] | null;
  /** One sample per placeholder, in order. Meta rejects a template without them. */
  variableExamples: string[];
}

/** Meta's limits for a text template. */
export const TEMPLATE_LIMITS = { header: 60, body: 1024, footer: 60, button: 25, buttons: 3 } as const;

/** The highest {{n}} used in the text, or 0. */
export function countPlaceholders(text: string): number {
  let max = 0;
  for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]));
  return max;
}

/** Meta's `components` array for a template definition. */
export function buildTemplateComponents(def: TemplateDefinition): unknown[] {
  const components: unknown[] = [];
  if (def.headerText) components.push({ type: 'HEADER', format: 'TEXT', text: def.headerText });

  const placeholders = countPlaceholders(def.body);
  components.push({
    type: 'BODY',
    text: def.body,
    ...(placeholders > 0 ? { example: { body_text: [def.variableExamples.slice(0, placeholders)] } } : {}),
  });

  if (def.footer) components.push({ type: 'FOOTER', text: def.footer });

  if (def.buttons && def.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: def.buttons.map((b) => {
        if (b.type === 'URL') return { type: 'URL', text: b.text, url: b.url };
        if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text, phone_number: b.phone };
        return { type: 'QUICK_REPLY', text: b.text };
      }),
    });
  }
  return components;
}

/** Meta refused the call; `message` is what Meta said, safe to show to an admin (never a token). */
export class MetaTemplateError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
  ) {
    super(message);
    this.name = 'MetaTemplateError';
  }
}

export interface MetaTemplateInfo {
  id: string;
  name?: string;
  language?: string;
  /** PENDING, APPROVED, REJECTED, PAUSED, DISABLED, IN_APPEAL ... */
  status: string;
  category?: string;
  rejectedReason?: string;
}

export interface MetaTemplateConfig {
  accessToken: string;
  wabaId: string;
  graphVersion: string;
}

/** A template as Meta lists it, before we decide whether our sender can send it. */
export interface MetaTemplateRaw {
  id?: string | number;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  rejected_reason?: string;
  parameter_format?: string;
  components?: unknown[];
}

export interface ImportableTemplate {
  metaTemplateId: string;
  status: string;
  rejectedReason?: string;
  definition: TemplateDefinition;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v : '');

/**
 * Turns a template Meta lists into one our sender can send, or says why not. Our sender fills text variables
 * in the body only, so templates with a media header, a variable in the header or a button link, named
 * variables, copy-code or flow buttons, or the authentication category are left out.
 */
export function parseMetaTemplate(raw: MetaTemplateRaw): { ok: true; value: ImportableTemplate } | { ok: false; reason: string } {
  const name = text(raw.name);
  const id = raw.id === undefined ? '' : String(raw.id);
  if (!name || !id) return { ok: false, reason: 'Meta sent no name or id' };
  if (raw.category !== 'MARKETING' && raw.category !== 'UTILITY') {
    return { ok: false, reason: `${(raw.category ?? 'unknown').toLowerCase()} templates are not supported` };
  }
  if (raw.parameter_format === 'NAMED') return { ok: false, reason: 'uses named variables' };

  let headerText: string | null = null;
  let body = '';
  let footer: string | null = null;
  let examples: string[] = [];
  let buttons: TemplateButton[] = [];

  for (const c of raw.components ?? []) {
    if (!isObj(c)) continue;
    const type = text(c.type).toUpperCase();
    if (type === 'HEADER') {
      if (text(c.format).toUpperCase() !== 'TEXT') return { ok: false, reason: `has a ${text(c.format).toLowerCase() || 'media'} header` };
      headerText = text(c.text) || null;
      if (headerText && headerText.includes('{{')) return { ok: false, reason: 'has a variable in the header' };
    } else if (type === 'BODY') {
      body = text(c.text);
      const sample = isObj(c.example) && Array.isArray(c.example.body_text) ? c.example.body_text[0] : undefined;
      examples = Array.isArray(sample) ? sample.map((e) => text(e)) : [];
    } else if (type === 'FOOTER') {
      footer = text(c.text) || null;
    } else if (type === 'BUTTONS') {
      const list = Array.isArray(c.buttons) ? c.buttons : [];
      for (const b of list) {
        if (!isObj(b)) continue;
        const bt = text(b.type).toUpperCase();
        if (bt === 'QUICK_REPLY') buttons.push({ type: 'QUICK_REPLY', text: text(b.text) });
        else if (bt === 'URL') {
          if (text(b.url).includes('{{')) return { ok: false, reason: 'has a button link with a variable' };
          buttons.push({ type: 'URL', text: text(b.text), url: text(b.url) });
        } else if (bt === 'PHONE_NUMBER') buttons.push({ type: 'PHONE_NUMBER', text: text(b.text), phone: text(b.phone_number) });
        else return { ok: false, reason: `has a ${bt.toLowerCase().replace(/_/g, ' ')} button` };
      }
    } else {
      return { ok: false, reason: `has a ${type.toLowerCase().replace(/_/g, ' ')} section` };
    }
  }
  if (!body) return { ok: false, reason: 'has no body text' };
  if (/\{\{\s*[a-zA-Z_]/.test(body)) return { ok: false, reason: 'uses named variables' };

  const count = countPlaceholders(body);
  examples = Array.from({ length: count }, (_, i) => examples[i]?.trim() || 'example');
  if (buttons.length === 0) buttons = [];

  return {
    ok: true,
    value: {
      metaTemplateId: id,
      status: text(raw.status).toUpperCase() || 'PENDING',
      rejectedReason: raw.rejected_reason && raw.rejected_reason !== 'NONE' ? raw.rejected_reason : undefined,
      definition: {
        name,
        category: raw.category,
        language: text(raw.language) || 'en',
        headerText,
        body,
        footer,
        buttons: buttons.length > 0 ? buttons : null,
        variableExamples: examples,
      },
    },
  };
}

export class MetaTemplateClient {
  constructor(private readonly config: MetaTemplateConfig) {}

  private get graph(): string {
    return `https://graph.facebook.com/${this.config.graphVersion}`;
  }

  private get auth(): Record<string, string> {
    return { Authorization: `Bearer ${this.config.accessToken}` };
  }

  private async fail(res: Response, what: string): Promise<never> {
    let detail = String(res.status);
    let code: number | undefined;
    try {
      const body = (await res.json()) as { error?: { message?: string; error_user_msg?: string; error_user_title?: string; code?: number } };
      code = body.error?.code;
      detail = body.error?.error_user_msg || body.error?.message || detail;
    } catch {
      // keep the bare status
    }
    throw new MetaTemplateError(`Meta could not ${what}: ${detail}`, res.status, code);
  }

  /** Submits a template for review. Meta answers PENDING (or sometimes APPROVED for utility copies). */
  async create(def: TemplateDefinition): Promise<MetaTemplateInfo> {
    const res = await fetch(`${this.graph}/${this.config.wabaId}/message_templates`, {
      method: 'POST',
      headers: { ...this.auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: def.name,
        language: def.language,
        category: def.category,
        components: buildTemplateComponents(def),
      }),
    });
    if (!res.ok) return this.fail(res, 'submit the template');
    const body = (await res.json()) as { id?: string; status?: string; category?: string };
    if (!body.id) throw new MetaTemplateError('Meta accepted the template but returned no id', res.status);
    return { id: body.id, status: (body.status ?? 'PENDING').toUpperCase(), category: body.category };
  }

  /** Current review status (and the reason when rejected). */
  async get(metaTemplateId: string): Promise<MetaTemplateInfo> {
    if (!/^\d+$/.test(metaTemplateId)) throw new MetaTemplateError('Invalid Meta template id', 400);
    const res = await fetch(
      `${this.graph}/${metaTemplateId}?fields=id,name,language,status,category,rejected_reason`,
      { headers: this.auth },
    );
    if (!res.ok) return this.fail(res, 'read the template status');
    const body = (await res.json()) as {
      id?: string;
      name?: string;
      language?: string;
      status?: string;
      category?: string;
      rejected_reason?: string;
    };
    return {
      id: body.id ?? metaTemplateId,
      name: body.name,
      language: body.language,
      status: (body.status ?? 'PENDING').toUpperCase(),
      category: body.category,
      rejectedReason: body.rejected_reason && body.rejected_reason !== 'NONE' ? body.rejected_reason : undefined,
    };
  }

  /** Every template on the account (all pages, up to 1,000), as Meta lists them. */
  async list(): Promise<MetaTemplateRaw[]> {
    const all: MetaTemplateRaw[] = [];
    let after = '';
    for (let page = 0; page < 10; page += 1) {
      const url =
        `${this.graph}/${this.config.wabaId}/message_templates` +
        `?fields=id,name,language,status,category,rejected_reason,parameter_format,components&limit=100` +
        (after ? `&after=${encodeURIComponent(after)}` : '');
      const res = await fetch(url, { headers: this.auth });
      if (!res.ok) return this.fail(res, 'list the templates');
      const body = (await res.json()) as { data?: MetaTemplateRaw[]; paging?: { cursors?: { after?: string }; next?: string } };
      all.push(...(body.data ?? []));
      after = body.paging?.next ? (body.paging.cursors?.after ?? '') : '';
      if (!after) break;
    }
    return all;
  }

  /** Deletes every language version of the template name. */
  async remove(name: string): Promise<void> {
    const res = await fetch(`${this.graph}/${this.config.wabaId}/message_templates?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: this.auth,
    });
    if (!res.ok) await this.fail(res, 'delete the template');
  }
}
