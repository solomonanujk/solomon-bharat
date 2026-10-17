import { COMPANY, type LegalDocument } from './types'

export const PRIVACY: LegalDocument = {
  title: 'Privacy Policy',
  updated: '17 October 2026',
  intro: `${COMPANY.name} ("we") is the controller of the personal data collected through this Platform. This policy explains what we collect, why, and your rights, including under the UK GDPR, EU GDPR and India's Digital Personal Data Protection Act 2023.`,
  sections: [
    {
      heading: 'What we collect',
      body: [
        [
          'Account details: name, business name, email, phone, country, business type.',
          'Addresses for shipping and billing.',
          'Orders, payments and messages with our team.',
          'Seller and agent application details, including business and tax documents and bank details for payouts.',
          'Technical data: IP address, device and browser, and, only if you accept analytics cookies, how you use the site.',
        ],
      ],
    },
    {
      heading: 'Why we use it (and our legal basis)',
      body: [
        [
          'To run your account and fulfil orders (performance of a contract).',
          'To meet tax, customs, accounting and audit obligations (legal obligation).',
          'To prevent fraud and keep the Platform secure (legitimate interests).',
          'To send service emails and WhatsApp messages about your orders (performance of a contract).',
          'To send marketing, and to run analytics cookies (your consent, which you can withdraw at any time).',
        ],
      ],
    },
    {
      heading: 'Who we share it with',
      body: [
        [
          'Sellers receive only the products ordered, never buyer details.',
          'Logistics partners, payment providers, email and WhatsApp providers, cloud hosting and image storage, under contract.',
          'Authorities where the law requires it.',
        ],
        'We never sell your personal data.',
      ],
    },
    {
      heading: 'International transfers',
      body: [
        'We are based in India and some providers are in other countries. Where UK or EU data is transferred outside those regions we rely on approved safeguards such as the UK International Data Transfer Addendum or EU Standard Contractual Clauses.',
      ],
    },
    {
      heading: 'How long we keep it',
      body: [
        'Account data is kept while your account is open. Order, invoice and tax records are kept for 8 years to meet Indian tax and audit law. Analytics data is kept for up to 14 months.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can ask to access, correct, delete or export your data, object to or restrict processing, and withdraw consent. Email us and we will reply within one month. UK residents can also complain to the Information Commissioner\'s Office (ico.org.uk).',
      ],
    },
    {
      heading: 'Cookies',
      body: ['See our Cookie Policy. Non-essential cookies are only set after you accept them.'],
    },
    {
      heading: 'Contact',
      body: [`${COMPANY.name}, ${COMPANY.city}. Email ${COMPANY.privacyEmail}.`],
    },
  ],
}
