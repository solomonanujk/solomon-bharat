import { COMPANY, type LegalDocument } from './types'

export const TERMS: LegalDocument = {
  title: 'Terms of Service',
  updated: '13 October 2026',
  intro: `These terms govern your use of the Solomon Bharat wholesale marketplace (the "Platform"), operated by ${COMPANY.name}, ${COMPANY.city} ("Solomon Bharat", "we", "us"). By creating an account or placing an order you agree to them.`,
  sections: [
    {
      heading: 'Who can use the Platform',
      body: [
        'The Platform is for business buyers purchasing for resale or business use, approved agents, and approved sellers. You must be at least 18 and able to enter a binding contract on behalf of your business.',
        'You are responsible for keeping your login details secure and for everything done through your account.',
      ],
    },
    {
      heading: 'Two ways products are sold',
      body: [
        [
          '"Curated by Solomon" products: Solomon Bharat is the seller and merchant of record. Your contract of sale is with Solomon Bharat.',
          'Marketplace brand products: the brand named on the listing is the seller. Your contract of sale is with that brand. Solomon Bharat operates the Platform, collects payment on the brand\'s behalf and charges the brand a commission.',
        ],
        'Each product page and your order confirmation shows which applies.',
      ],
    },
    {
      heading: 'Prices, currency and minimums',
      body: [
        'Wholesale prices are visible after sign-up. Prices are set in Indian Rupees and shown in your local currency using a daily exchange rate. The amount payable is the one shown at checkout.',
        'Products have minimum order quantities, and marketplace brands may set a minimum order value. Orders below these cannot be placed.',
      ],
    },
    {
      heading: 'Payment',
      body: [
        'All orders are paid 100% in advance. Until online payment is available, we will send payment instructions after you place your order, and the order is confirmed once we receive your payment.',
      ],
    },
    {
      heading: 'Order acceptance and cancellation',
      body: [
        'Curated orders are accepted when we confirm them. Marketplace orders are accepted when the brand accepts them. A brand has 24 hours to accept; if it does not, the order is cancelled and refunded.',
        'You may cancel an order free of charge until it is confirmed or accepted. After that it cannot be cancelled.',
        'If a seller cannot fulfil an accepted order, it is cancelled and you receive a full refund for the affected items.',
      ],
    },
    {
      heading: 'Shipping, duties and delivery',
      body: [
        'Curated orders are collected by us, quality-checked at our Jaipur warehouse and shipped Delivered Duty Paid (DDP) to your address. The price at checkout includes import duties and taxes unless stated otherwise.',
        'Marketplace orders are shipped directly by the brand. Shipping charges are shown at checkout.',
        'Delivery dates are estimates. Lead times are shown on each product.',
      ],
    },
    {
      heading: 'Damage and claims',
      body: [
        'Inspect your delivery on arrival. Report damaged, missing or wrong items within 7 days of delivery with photos of the goods and packaging through your account or by email.',
        'Claims are assessed against the dispatch photos taken before shipping. Approved claims are settled by refund or replacement. We do not currently accept returns of non-faulty goods.',
      ],
    },
    {
      heading: 'Custom requirements',
      body: [
        'Custom or bespoke requests submitted through the "Custom requirement" form are enquiries only. A binding order is formed only when you accept a written quote.',
      ],
    },
    {
      heading: 'Acceptable use',
      body: [
        'Do not misuse the Platform, copy listings or images for use elsewhere, scrape data, attempt to contact marketplace brands to trade off-platform, or submit false information.',
      ],
    },
    {
      heading: 'Intellectual property',
      body: [
        'Product images and descriptions belong to the sellers or to Solomon Bharat. Approved agents may use product images and descriptions in their own catalogues to resell products bought from us.',
      ],
    },
    {
      heading: 'Liability',
      body: [
        'Nothing in these terms limits liability that cannot be limited by law. Otherwise, our total liability for any order is limited to the amount you paid for that order, and we are not liable for indirect or consequential loss such as loss of profit.',
      ],
    },
    {
      heading: 'Suspension',
      body: ['We may suspend or close accounts that breach these terms or are used fraudulently.'],
    },
    {
      heading: 'Governing law',
      body: [
        'These terms are governed by the laws of India, and the courts of Jaipur, Rajasthan have exclusive jurisdiction. If you are a consumer in the UK or EU, you keep any mandatory protections of your local law.',
      ],
    },
    {
      heading: 'Contact',
      body: [`${COMPANY.name}, ${COMPANY.city}. Email ${COMPANY.email}.`],
    },
  ],
}
