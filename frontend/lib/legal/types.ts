/** A paragraph, or a bullet list when it's an array. */
export type LegalParagraph = string | string[]

export interface LegalDocument {
  title: string
  /** Shown as "Last updated"; omit for help pages. */
  updated?: string
  intro?: string
  sections: { heading: string; body: LegalParagraph[] }[]
}

export const COMPANY = {
  name: 'Solomon Bharat Private Limited',
  city: 'Jaipur, Rajasthan, India',
  // The inbox the team actually reads (same as the site footer).
  email: 'solomonbharat@gmail.com',
  privacyEmail: 'solomonbharat@gmail.com',
} as const
