/** A paragraph, or a bullet list when it's an array. */
export type LegalParagraph = string | string[]

export interface LegalDocument {
  title: string
  updated: string
  intro?: string
  sections: { heading: string; body: LegalParagraph[] }[]
}

export const COMPANY = {
  name: 'Solomon Bharat Private Limited',
  city: 'Jaipur, Rajasthan, India',
  email: 'support@solomonbharat.com',
  privacyEmail: 'privacy@solomonbharat.com',
} as const
