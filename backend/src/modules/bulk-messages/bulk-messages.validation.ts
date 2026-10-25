import { z } from 'zod';
import { BulkCampaignStatus, BulkRecipientStatus, BulkTemplateCategory, BulkTemplateStatus, SellerType } from '@prisma/client';
import { TEMPLATE_LIMITS, countPlaceholders } from '../../providers/whatsapp/metaTemplates';
import { paginationQuerySchema } from '../../utils/pagination';

const MAX_PLACEHOLDERS = 10;

const buttonSchema = z
  .object({
    type: z.enum(['QUICK_REPLY', 'URL', 'PHONE_NUMBER']),
    text: z.string().trim().min(1).max(TEMPLATE_LIMITS.button),
    url: z.string().trim().url().max(2000).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/, 'Use an international number like +919812345678')
      .optional(),
  })
  .superRefine((b, ctx) => {
    if (b.type === 'URL' && (!b.url || !b.url.startsWith('https://'))) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'A URL button needs an https:// link' });
    }
    if (b.type === 'PHONE_NUMBER' && !b.phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'A call button needs a phone number' });
    }
  });

/** The text rules Meta applies, checked here so the admin sees the problem before submitting. */
export function templateContentIssues(t: {
  headerText?: string | null;
  body: string;
  variableExamples: string[];
}): string[] {
  const issues: string[] = [];
  if (t.headerText && /\{\{/.test(t.headerText)) issues.push('The header cannot contain variables');
  const used = new Set<number>();
  for (const m of t.body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) used.add(Number(m[1]));
  const count = countPlaceholders(t.body);
  if (count > MAX_PLACEHOLDERS) issues.push(`Use at most ${MAX_PLACEHOLDERS} variables`);
  for (let i = 1; i <= count; i += 1) {
    if (!used.has(i)) issues.push(`Variables must run {{1}}, {{2}} ... without gaps ({{${i}}} is missing)`);
  }
  if (/\{\{\s*\d+\s*\}\}\s*$/.test(t.body.trim()) || /^\s*\{\{\s*\d+\s*\}\}/.test(t.body)) {
    issues.push('The body cannot start or end with a variable; add some text before and after it');
  }
  if (/\{\{\s*\d+\s*\}\}\s*\{\{\s*\d+\s*\}\}/.test(t.body)) issues.push('Two variables cannot sit next to each other');
  if (/\n{3,}/.test(t.body) || /\s{5,}/.test(t.body.replace(/\n/g, ' '))) {
    issues.push('The body cannot have more than two blank lines or long runs of spaces in a row');
  }
  if (t.variableExamples.length !== count) {
    issues.push(`Give one example for each of the ${count} variable${count === 1 ? '' : 's'} (got ${t.variableExamples.length})`);
  } else if (t.variableExamples.some((e) => !e.trim())) {
    issues.push('Every variable needs a non-empty example');
  }
  return issues;
}

export const templateInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .regex(/^[a-z][a-z0-9_]{0,59}$/, 'Use lowercase letters, digits and underscores, starting with a letter'),
    category: z.nativeEnum(BulkTemplateCategory).default(BulkTemplateCategory.UTILITY),
    language: z
      .string()
      .trim()
      .regex(/^[a-z]{2}(_[A-Z]{2})?$/, 'Use a Meta language code like en, hi or en_GB')
      .default('en'),
    headerText: z.string().trim().max(TEMPLATE_LIMITS.header).optional().nullable(),
    body: z.string().trim().min(1).max(TEMPLATE_LIMITS.body),
    footer: z.string().trim().max(TEMPLATE_LIMITS.footer).optional().nullable(),
    buttons: z.array(buttonSchema).max(TEMPLATE_LIMITS.buttons).optional().nullable(),
    variableExamples: z.array(z.string().trim().max(200)).max(MAX_PLACEHOLDERS).default([]),
  })
  .superRefine((t, ctx) => {
    for (const message of templateContentIssues(t)) ctx.addIssue({ code: 'custom', message });
  });
export type TemplateInputDto = z.infer<typeof templateInputSchema>;

export const templateListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(BulkTemplateStatus).optional(),
});
export type TemplateListQueryDto = z.infer<typeof templateListQuerySchema>;

export const audienceSpecSchema = z
  .object({
    mode: z.enum(['ALL_LINKED', 'FILTERED', 'PICKED', 'CSV']),
    filters: z
      .object({
        sellerType: z.nativeEnum(SellerType).optional(),
        listedByChat: z.boolean().optional(),
        search: z.string().trim().max(200).optional(),
      })
      .optional(),
    sellerIds: z.array(z.string().uuid()).max(5000).optional(),
    /** One object per CSV row, keyed by the header. Parsed in the browser. */
    csvRows: z.array(z.record(z.string().max(500))).max(5000).optional(),
    /** The column that names the seller: a WhatsApp number, registered phone or email. */
    csvKeyColumn: z.string().trim().max(100).optional(),
  })
  .superRefine((a, ctx) => {
    if (a.mode === 'PICKED' && !(a.sellerIds && a.sellerIds.length > 0)) {
      ctx.addIssue({ code: 'custom', path: ['sellerIds'], message: 'Pick at least one seller' });
    }
    if (a.mode === 'CSV' && !(a.csvRows && a.csvRows.length > 0 && a.csvKeyColumn)) {
      ctx.addIssue({ code: 'custom', path: ['csvRows'], message: 'Upload a CSV and choose the column that identifies the seller' });
    }
  });
export type AudienceSpec = z.infer<typeof audienceSpecSchema>;

/** `seller.businessName`, `seller.contactName`, `fixed:<text>` or `csv:<column>`. */
export const variableSourceSchema = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => v === 'seller.businessName' || v === 'seller.contactName' || /^fixed:.+/.test(v) || /^csv:.+/.test(v),
    'Choose a seller field, fixed text or a CSV column',
  );

export const campaignInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  templateId: z.string().uuid(),
  audience: audienceSpecSchema,
  variableMapping: z.array(variableSourceSchema).max(MAX_PLACEHOLDERS).default([]),
});
export type CampaignInputDto = z.infer<typeof campaignInputSchema>;

export const audiencePreviewSchema = z.object({ audience: audienceSpecSchema });

export const campaignListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(BulkCampaignStatus).optional(),
});
export type CampaignListQueryDto = z.infer<typeof campaignListQuerySchema>;

export const recipientListQuerySchema = paginationQuerySchema.extend({
  status: z.nativeEnum(BulkRecipientStatus).optional(),
});
export type RecipientListQueryDto = z.infer<typeof recipientListQuerySchema>;

export const replyListQuerySchema = paginationQuerySchema.extend({
  campaignId: z.string().uuid().optional(),
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ReplyListQueryDto = z.infer<typeof replyListQuerySchema>;

export const testSendSchema = z.object({
  templateId: z.string().uuid(),
  phone: z.string().trim().min(8).max(25),
  variables: z.array(z.string().trim().max(200)).max(MAX_PLACEHOLDERS).default([]),
});
export type TestSendDto = z.infer<typeof testSendSchema>;

export const idParamSchema = z.object({ id: z.string().uuid() });
