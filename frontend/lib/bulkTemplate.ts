/**
 * The same text rules Meta applies to a WhatsApp template (and the server checks again), so the admin
 * sees a problem on the step where they can fix it. Keep in step with
 * backend/src/modules/bulk-messages/bulk-messages.validation.ts.
 */

export const LIMITS = { header: 60, body: 1024, footer: 60, button: 25, buttons: 3, examples: 10 } as const

export function countPlaceholders(text: string): number {
  let max = 0
  for (const m of text.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) max = Math.max(max, Number(m[1]))
  return max
}

/** A Meta-safe template name from whatever was typed: lowercase, spaces to underscores, no other symbols. */
export function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^[^a-z]+/, '')
    .slice(0, 60)
}

export const NAME_PATTERN = /^[a-z][a-z0-9_]{0,59}$/

export function bodyIssues(body: string, headerText: string | null | undefined): string[] {
  const issues: string[] = []
  if (!body.trim()) {
    issues.push('Write the message body')
    return issues
  }
  if (headerText && /\{\{/.test(headerText)) issues.push('The header cannot contain variables')
  const used = new Set<number>()
  for (const m of body.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) used.add(Number(m[1]))
  const count = countPlaceholders(body)
  if (count > LIMITS.examples) issues.push(`Use at most ${LIMITS.examples} variables`)
  for (let i = 1; i <= count; i += 1) {
    if (!used.has(i)) issues.push(`Variables must run {{1}}, {{2}} ... without gaps ({{${i}}} is missing)`)
  }
  if (/\{\{\s*\d+\s*\}\}\s*$/.test(body.trim()) || /^\s*\{\{\s*\d+\s*\}\}/.test(body)) {
    issues.push('The body cannot start or end with a variable; add some text before and after it')
  }
  if (/\{\{\s*\d+\s*\}\}\s*\{\{\s*\d+\s*\}\}/.test(body)) issues.push('Two variables cannot sit next to each other')
  if (/\n{3,}/.test(body)) issues.push('Use at most one blank line in a row')
  return issues
}

export function exampleIssues(body: string, examples: string[]): string[] {
  const count = countPlaceholders(body)
  if (count === 0) return []
  const filled = examples.slice(0, count)
  if (filled.length < count || filled.some((e) => !e.trim())) {
    return [`Give an example for each of the ${count} variable${count === 1 ? '' : 's'}`]
  }
  return []
}

/** The body with each {{n}} replaced by the matching value (or left as {{n}}). */
export function fillPlaceholders(body: string, values: string[]): string {
  return body.replace(/\{\{\s*(\d+)\s*\}\}/g, (match, n: string) => values[Number(n) - 1]?.trim() || match)
}

export const LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'en_GB', label: 'English (UK)' },
  { code: 'en_US', label: 'English (US)' },
]
