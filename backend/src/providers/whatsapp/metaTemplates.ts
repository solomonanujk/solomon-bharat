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

  /** Deletes every language version of the template name. */
  async remove(name: string): Promise<void> {
    const res = await fetch(`${this.graph}/${this.config.wabaId}/message_templates?name=${encodeURIComponent(name)}`, {
      method: 'DELETE',
      headers: this.auth,
    });
    if (!res.ok) await this.fail(res, 'delete the template');
  }
}
