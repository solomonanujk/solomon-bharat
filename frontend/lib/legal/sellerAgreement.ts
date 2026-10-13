import { COMPANY, type LegalDocument } from './types'

/** Bump when the text changes; the version a seller accepted is stored on their application. */
export const SELLER_AGREEMENT_VERSION = '2026-10-13'

export const SELLER_AGREEMENT: LegalDocument = {
  title: 'Seller Agreement',
  updated: '13 October 2026',
  intro: `This agreement is between ${COMPANY.name}, ${COMPANY.city} ("Solomon Bharat") and the business that applies to sell on the Platform (the "Seller"). It applies once Solomon Bharat approves the Seller and assigns a seller type.`,
  sections: [
    {
      heading: 'Seller types',
      body: [
        'Solomon Bharat assigns each Seller one type at approval:',
        [
          'Curated by Solomon: Solomon Bharat buys the Seller\'s products and resells them under the Solomon name. Solomon Bharat is the merchant of record and sets all buyer and agent prices.',
          'Marketplace brand: the Seller sells under its own brand name, sets its own prices and is the seller of record to the buyer. Solomon Bharat operates the Platform and collects payment on the Seller\'s behalf.',
        ],
        'One Seller account may operate one brand only.',
      ],
    },
    {
      heading: 'Eligibility and verification',
      body: [
        'The Seller confirms that all information supplied is true and that it holds the registrations needed to sell and export its goods (for example GSTIN, IEC, Udyam where applicable). Individual artisans without GST may sell only as Curated.',
        'Solomon Bharat may verify product quality, online and offline presence, and may visit the Seller\'s premises.',
      ],
    },
    {
      heading: 'Listings',
      body: [
        'The Seller must list accurate details for every product: title, description, material, craft technique, region of origin, dimensions, weight, colours and variants, MOQ, HSN code, lead time, whether made-to-order or ready stock, SKU, inventory and care instructions, with at least 2 high-quality photos that it owns or is licensed to use.',
        'Curated listings and every change to them require Solomon Bharat\'s approval. Marketplace listings go live without approval, but Solomon Bharat may remove any listing that breaches this agreement or the law.',
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
        'Marketplace: the Seller must accept or decline each order within 24 hours. Orders not accepted in time are cancelled and refunded. The Seller ships directly to the buyer, using its own rates or the Solomon Bharat shipping service, and must upload dispatch photos and tracking details.',
        'Curated: the Seller must have the ordered goods ready for collection on the agreed date. Solomon Bharat collects, quality-checks and ships them.',
        'Goods must match the listing, be export-packed and be dispatched within the stated lead time.',
      ],
    },
    {
      heading: 'Commission and pricing',
      body: [
        'Curated: Solomon Bharat pays the Seller its accepted price. No commission applies.',
        'Marketplace: Solomon Bharat charges commission on the order value excluding shipping: 25% on a buyer\'s first order with the brand and 15% on that buyer\'s later orders. No commission is charged on orders from buyers the Seller invited to the Platform through its own invite link. Solomon Bharat may agree different rates in writing.',
        'Prices are set in INR. Buyers see them converted to their currency. Exchange-rate differences are borne by the Seller.',
      ],
    },
    {
      heading: 'Payouts',
      body: [
        'Payouts are made to the Seller\'s verified Indian bank account after dispatch, net of commission and any refunds. Orders from the Seller\'s own invited buyers are paid out without holding.',
        'Solomon Bharat may withhold payouts for an order under a damage or non-delivery claim until the claim is resolved.',
      ],
    },
    {
      heading: 'Claims and refunds',
      body: [
        'If a buyer\'s claim for damage, shortage or wrong goods is upheld (assessed against dispatch photos), the Seller bears the refund or replacement cost unless the damage was caused by Solomon Bharat\'s logistics.',
        'If the Seller cancels an accepted order, the buyer is refunded in full and the Seller may be charged any payment costs incurred.',
      ],
    },
    {
      heading: 'Conduct',
      body: [
        'The Seller must not contact buyers it met through the Platform to trade outside the Platform, and must not message marketplace buyers other than through the Platform\'s order tools. Solomon Bharat keeps an internal performance rating based on quality, dispatch time and claims.',
      ],
    },
    {
      heading: 'Tax and compliance',
      body: [
        'Each party is responsible for its own taxes. Solomon Bharat will collect and deposit any tax it is required to collect as a marketplace operator (for example TCS under GST and TDS under section 194-O) and issue the related certificates.',
      ],
    },
    {
      heading: 'Data protection',
      body: [
        'Marketplace Sellers receive buyer personal data only to fulfil orders and must protect it, not use it for any other purpose, and delete it when no longer needed.',
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
