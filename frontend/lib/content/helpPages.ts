import { COMPANY, type LegalDocument } from '@/lib/legal/types'

// Buyer and seller help content. Grounded in docs/BUSINESS_DECISIONS.md; keep the two in step.

export const HELP: LegalDocument = {
  title: 'Help Center',
  intro: `Everything you need to buy wholesale from Indian makers on Solomon Bharat. Can't find an answer? Email ${COMPANY.email} and our team will reply within one working day.`,
  sections: [
    {
      heading: 'Getting started',
      body: [
        [
          'Sign up with your business details to see wholesale prices.',
          'Prices are shown in your local currency, converted daily from Indian Rupees.',
          'Every product shows its minimum order quantity (MOQ). Some brands also have a minimum order value for their shop.',
        ],
      ],
    },
    {
      heading: 'Two ways to buy',
      body: [
        [
          'Curated by Solomon: Solomon Bharat is the seller. We collect the goods from our makers, quality-check them at our Jaipur warehouse with photos, and deliver them duty paid to your door.',
          'Independent brands: the brand named on the product is the seller and ships directly to you. Solomon Bharat runs the marketplace and handles payment.',
        ],
        'You can buy from both in one checkout. Each product card shows which one it is.',
      ],
    },
    {
      heading: 'Paying for your order',
      body: [
        'Every order is paid 100% in advance. After you place an order we email you bank transfer details. Your order is confirmed as soon as your payment arrives, and you can follow it under Orders.',
      ],
    },
    {
      heading: 'After you order',
      body: [
        [
          'You can cancel free of charge until the order is confirmed (curated) or accepted by the brand.',
          'Brands accept or decline new orders within 24 hours. If they do not, the order is cancelled and refunded.',
          'Dispatch photos and tracking details appear on your order page once it ships.',
        ],
      ],
    },
    {
      heading: 'Damaged or missing items',
      body: [
        'Report damaged, missing or wrong items within 7 days of delivery, with photos of the goods and the packaging. We compare them with the dispatch photos and settle approved claims with a refund or replacement.',
      ],
    },
    {
      heading: 'Custom orders',
      body: [
        'Need different colours, sizes, packaging or your own label? Send a custom request from any product page or from the Custom order link in the menu. Our sourcing team replies with options and a quote.',
      ],
    },
    {
      heading: 'For makers and brands',
      body: [
        'Apply once from Sell with us. Our team reviews every application and decides with you whether you sell Curated by Solomon or as an independent brand. See the Seller Agreement for full terms.',
      ],
    },
  ],
}

export const FAQS: LegalDocument = {
  title: 'Frequently Asked Questions',
  sections: [
    {
      heading: 'Who can buy on Solomon Bharat?',
      body: ['Boutiques, gift shops, concept stores, importers and other businesses buying to resell. Sign up to see wholesale prices.'],
    },
    {
      heading: 'Which currency do I pay in?',
      body: ['Prices are shown and charged in your local currency (for example GBP in the UK), using a daily exchange rate. Change it any time from the currency menu.'],
    },
    {
      heading: 'How do I pay?',
      body: ['By bank transfer, 100% in advance. We email the details after you place your order and confirm the order once the payment arrives.'],
    },
    {
      heading: 'Do I pay import duty?',
      body: ['Curated by Solomon orders are delivered duty paid (DDP): duties and taxes are included and we deliver to your door. Independent brands ship directly and show their shipping terms at checkout.'],
    },
    {
      heading: 'Is there a minimum order?',
      body: ['Each product has a minimum order quantity. Some independent brands also set a minimum order value for their shop, shown on their page and in your cart.'],
    },
    {
      heading: 'How long does delivery take?',
      body: ['Each product shows its lead time and whether it is ready stock or made to order. Shipping time comes on top of that and depends on your country.'],
    },
    {
      heading: 'Can I cancel my order?',
      body: ['Yes, free of charge until it is confirmed (curated) or accepted by the brand. After that it is being prepared and cannot be cancelled.'],
    },
    {
      heading: 'What if something arrives damaged?',
      body: ['Report it within 7 days of delivery with photos. We check it against the dispatch photos and refund or replace approved claims.'],
    },
    {
      heading: 'Can I order samples?',
      body: ['Not through the website yet. Send a custom request and our team will help.'],
    },
    {
      heading: 'Can I get a product customised?',
      body: ['Yes. Use Custom order to tell us what you need (colours, sizes, packaging, your own label) and we will come back with a quote.'],
    },
    {
      heading: 'I am a maker. How do I sell here?',
      body: ['Apply from Sell with us. Our team reviews your products and presence, then sets you up either Curated by Solomon or as an independent brand with your own shop.'],
    },
  ],
}

export const EXPORT_GUIDE: LegalDocument = {
  title: 'Export Guide for Sellers',
  intro: 'What Indian makers and brands need to sell to international buyers through Solomon Bharat.',
  sections: [
    {
      heading: 'Documents to keep ready',
      body: [
        [
          'GSTIN (independent brands; individual artisans without GST can sell Curated by Solomon).',
          'IEC (Importer Exporter Code) if you ship exports yourself.',
          'Bank account in your business name for payouts.',
          'HSN code for every product: it goes on the commercial invoice.',
        ],
      ],
    },
    {
      heading: 'Listing a product',
      body: [
        'Every product needs: title, description, material, craft technique, region, dimensions, weight, colours and variants, MOQ, HSN code, lead time, made to order or ready stock, SKU, inventory and care instructions, with at least 2 high-quality photos. A short video and the story of the craft are recommended. Use Draft with AI to get a first description.',
      ],
    },
    {
      heading: 'Packing for export',
      body: [
        [
          'Pack every item to survive a long journey: wrap fragile pieces individually and use strong outer cartons.',
          'Take clear photos of the packed goods before dispatch. They are used to judge any damage claim.',
          'Download the commercial invoice and packing list for each order from your portal.',
        ],
      ],
    },
    {
      heading: 'Curated by Solomon',
      body: ['Have the ordered goods ready on the collection date. We collect them, quality-check them at our Jaipur warehouse and ship them. You are paid when the order is dispatched.'],
    },
    {
      heading: 'Independent brands',
      body: [
        'Accept each order within 24 hours, then ship directly to the buyer with tracking and dispatch photos. You are paid on dispatch, net of commission. Buyers who join through your own invite link carry 0% commission and are paid as soon as they pay.',
      ],
    },
  ],
}

export const CONTACT: LegalDocument = {
  title: 'Contact us',
  intro: 'We are a small team in Jaipur and we read every message.',
  sections: [
    {
      heading: 'Buyers',
      body: [`Questions about products, orders, payments or deliveries: email ${COMPANY.email}. If you are signed in, you can also message us from Messages in your account.`],
    },
    {
      heading: 'Custom orders',
      body: ['Use the Custom order form so our sourcing team gets every detail in one place.'],
    },
    {
      heading: 'Makers and brands',
      body: [`Apply from Sell with us, or email ${COMPANY.email} with a link to your work.`],
    },
    {
      heading: 'Company',
      body: [`${COMPANY.name}, ${COMPANY.city}.`],
    },
  ],
}

export const CAREERS: LegalDocument = {
  title: 'Careers',
  intro: "We're building the bridge between Indian craft and the world's independent retailers.",
  sections: [
    {
      heading: 'Work with us',
      body: [`We have no open roles listed right now. If you care about Indian craft, sourcing, logistics or building great software, email ${COMPANY.email} with a few lines about you.`],
    },
  ],
}
