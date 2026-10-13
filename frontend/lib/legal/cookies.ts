import { COMPANY, type LegalDocument } from './types'

export const COOKIES: LegalDocument = {
  title: 'Cookie Policy',
  updated: '13 October 2026',
  intro: 'Cookies are small files stored by your browser. We use as few as possible, and anything that is not strictly needed is only set after you click "Accept" on our cookie banner.',
  sections: [
    {
      heading: 'Strictly necessary (always on)',
      body: [
        'Keep you signed in, protect forms against forgery, remember your cart and your cookie choice. The site cannot work without these, so they do not need consent.',
      ],
    },
    {
      heading: 'Analytics (only with your consent)',
      body: [
        'Google Analytics helps us understand which pages are used so we can improve the site. It sets cookies such as _ga and _ga_*, which last up to 2 years. IP addresses are anonymised.',
      ],
    },
    {
      heading: 'Changing your choice',
      body: [
        'Use the "Cookie settings" link in the site footer at any time to accept or reject analytics cookies. Rejecting them does not affect how the site works.',
      ],
    },
    {
      heading: 'Contact',
      body: [`Questions: ${COMPANY.privacyEmail}.`],
    },
  ],
}
