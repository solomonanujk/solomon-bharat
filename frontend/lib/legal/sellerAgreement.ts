import { COMPANY, type LegalDocument } from './types'

/** Bump when the text changes; the version a seller accepted is stored on their application. */
export const SELLER_AGREEMENT_VERSION = '2026-10-17'

export const SELLER_AGREEMENT: LegalDocument = {
  title: 'Seller Agreement',
  updated: '17 October 2026',
  intro: `This agreement is between ${COMPANY.name}, ${COMPANY.city} ("Solomon Bharat") and the business that applies to sell on the Platform (the "Seller"). It applies once Solomon Bharat approves the Seller.`,
  sections: [
    {
      heading: 'How selling works',
      body: [
        'Curated by Solomon: Solomon Bharat buys the Seller\'s products and resells them under the Solomon name. Solomon Bharat is the merchant of record and sets all buyer and agent prices.',
      ],
    },
    {
      heading: 'Eligibility and verification',
      body: [
        'The Seller confirms that all information supplied is true and that it holds the registrations needed to sell and export its goods (for example GSTIN, IEC, Udyam where applicable).',
        'Solomon Bharat may verify product quality, online and offline presence, and may visit the Seller\'s premises.',
      ],
    },
    {
      heading: 'Listings',
      body: [
        'The Seller must list accurate details for every product: title, description, material, craft technique, region of origin, dimensions, weight, colours and variants, MOQ, HSN code, lead time, whether made-to-order or ready stock, SKU, inventory and care instructions, with at least 2 high-quality photos that it owns or is licensed to use.',
        'Listings and every change to them require Solomon Bharat\'s approval. Solomon Bharat may remove any listing that breaches this agreement or the law.',
        'The Seller grants Solomon Bharat and its approved agents a non-exclusive, royalty-free licence to use listing content to market and resell the products.',
      ],
    },
    {
      heading: 'Prohibited goods',
      body: [
        'No counterfeit or infringing goods, goods made with child or forced labour, items from protected wildlife (including ivory, shahtoosh and certain corals), or any goods whose export or sale is restricted.',
      ],
    },
    {
      heading: 'Orders and fulfilment',
      body: [
        'The Seller must have the ordered goods ready for collection on the agreed date. Solomon Bharat collects, quality-checks and ships them.',
        'Goods must match the listing, be export-packed and be dispatched within the stated lead time.',
      ],
    },
    {
      heading: 'Pricing',
      body: [
        'Solomon Bharat pays the Seller its accepted price. No commission applies.',
        'Prices are set in INR. Buyers see them converted to their currency. Exchange-rate differences are borne by the Seller.',
      ],
    },
    {
      heading: 'Payouts',
      body: [
        'Payouts are made to the Seller\'s verified Indian bank account after dispatch, net of any refunds.',
        'Solomon Bharat may withhold payouts for an order under a damage or non-delivery claim until the claim is resolved.',
      ],
    },
    {
      heading: 'Claims and refunds',
      body: [
        'If a buyer\'s claim for damage, shortage or wrong goods is upheld (assessed against dispatch photos), the Seller bears the refund or replacement cost unless the damage was caused by Solomon Bharat\'s logistics.',
        'If the Seller cannot supply a confirmed order, the buyer is refunded in full and the Seller may be charged any payment costs incurred.',
      ],
    },
    {
      heading: 'Conduct',
      body: [
        'The Seller must not contact buyers it met through the Platform to trade outside the Platform. Solomon Bharat keeps an internal performance rating based on quality, dispatch time and claims.',
      ],
    },
    {
      heading: 'Tax and compliance',
      body: [
        'Each party is responsible for its own taxes. Solomon Bharat will collect and deposit any tax it is required to collect as an e-commerce operator (for example TCS under GST and TDS under section 194-O) and issue the related certificates.',
      ],
    },
    {
      heading: 'Data protection',
      body: [
        'Sellers do not receive buyer personal data. Any personal data the Seller receives in connection with the Platform must be protected, used only for that purpose and deleted when no longer needed.',
      ],
    },
    {
      heading: 'Liability and indemnity',
      body: [
        'The Seller is responsible for its products, including their safety, labelling and compliance with export and import law, and indemnifies Solomon Bharat against claims arising from them.',
      ],
    },
    {
      heading: 'Term and termination',
      body: [
        'Either party may end this agreement with 30 days\' written notice. Solomon Bharat may suspend or end it immediately for serious or repeated breach. Orders already accepted must still be fulfilled.',
      ],
    },
    {
      heading: 'Changes',
      body: ['Solomon Bharat may update this agreement with 15 days\' notice. Continuing to sell after that means accepting the change.'],
    },
    {
      heading: 'Governing law',
      body: ['This agreement is governed by the laws of India. The courts of Jaipur, Rajasthan have exclusive jurisdiction.'],
    },
  ],
}
