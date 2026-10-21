import { Language } from './whatsapp.commands';

/** Fixed reply texts. Written by hand (not AI generated), so replies cost nothing. */

export interface ProductLine {
  n: number;
  name: string;
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESUBMITTED';
  stock: number;
  rejectionReason?: string | null;
}

type Pick3 = { en: string; hi: string; hinglish: string };
const pick = (lang: Language, t: Pick3): string => t[lang];

const STATUS: Record<ProductLine['status'], Pick3> = {
  DRAFT: { en: 'Draft', hi: 'ड्राफ्ट', hinglish: 'Draft' },
  PENDING: { en: 'Waiting for approval', hi: 'अनुमोदन का इंतज़ार', hinglish: 'Approval ka intezaar' },
  APPROVED: { en: 'Approved', hi: 'स्वीकृत', hinglish: 'Approved' },
  REJECTED: { en: 'Rejected', hi: 'अस्वीकृत', hinglish: 'Rejected' },
  RESUBMITTED: { en: 'Resubmitted, under review', hi: 'दोबारा भेजा, समीक्षा में', hinglish: 'Dobara bheja, review mein' },
};

export const MAX_LISTED = 10;

export const messages = {
  help(lang: Language): string {
    return pick(lang, {
      en: [
        'Solomon Bharat seller help',
        '',
        '*list* - see your products and their status',
        '*stock 2 20* - set stock of product 2 to 20 (or *stock saree 20*)',
        '*out of stock 2* - mark product 2 out of stock',
        '*resubmit 2* - send a rejected product 2 for review again',
        '*add* - add a product: send 2 to 10 photos and describe it (then *done*)',
        '*help* - this message',
      ].join('\n'),
      hi: [
        'सोलोमन भारत विक्रेता सहायता',
        '',
        '*list* - अपने प्रोडक्ट और उनकी स्थिति देखें',
        '*stock 2 20* - प्रोडक्ट 2 का स्टॉक 20 करें (या *stock saree 20*)',
        '*out of stock 2* - प्रोडक्ट 2 का स्टॉक खत्म करें',
        '*resubmit 2* - अस्वीकृत प्रोडक्ट 2 को दोबारा भेजें',
        '*add* - प्रोडक्ट जोड़ें: 2 से 10 फोटो भेजें और उसके बारे में बताएं (फिर *done*)',
        '*help* - यह संदेश',
      ].join('\n'),
      hinglish: [
        'Solomon Bharat seller madad',
        '',
        '*list* - apne products aur unka status dekhein',
        '*stock 2 20* - product 2 ka stock 20 karein (ya *stock saree 20*)',
        '*out of stock 2* - product 2 ka stock khatam karein',
        '*resubmit 2* - rejected product 2 ko dobara bhejein',
        '*add* - product jodein: 2 se 10 photo bhejein aur uske baare mein bataiye (phir *done*)',
        '*help* - yeh message',
      ].join('\n'),
    });
  },

  unlinked(lang: Language, portalUrl: string): string {
    return pick(lang, {
      en: `This WhatsApp number is not linked to a Solomon Bharat seller account. Sign in at ${portalUrl} and link it under Settings > WhatsApp listing.`,
      hi: `यह WhatsApp नंबर किसी सोलोमन भारत विक्रेता खाते से जुड़ा नहीं है। ${portalUrl} पर साइन इन करें और Settings > WhatsApp listing में इसे जोड़ें।`,
      hinglish: `Yeh WhatsApp number kisi Solomon Bharat seller account se juda nahi hai. ${portalUrl} par sign in karein aur Settings > WhatsApp listing mein ise jodein.`,
    });
  },

  noProducts(lang: Language): string {
    return pick(lang, {
      en: 'You have no products yet. Add your first one on the website.',
      hi: 'आपके पास अभी कोई प्रोडक्ट नहीं है। वेबसाइट पर पहला प्रोडक्ट जोड़ें।',
      hinglish: 'Abhi aapke paas koi product nahi hai. Website par pehla product jodein.',
    });
  },

  list(lang: Language, lines: ProductLine[], total: number): string {
    const head = pick(lang, { en: 'Your products', hi: 'आपके प्रोडक्ट', hinglish: 'Aapke products' });
    const stockWord = pick(lang, { en: 'stock', hi: 'स्टॉक', hinglish: 'stock' });
    const reasonWord = pick(lang, { en: 'Reason', hi: 'कारण', hinglish: 'Karan' });
    const body = lines.map((l) => {
      const reason = l.status === 'REJECTED' && l.rejectionReason ? `\n   ${reasonWord}: ${l.rejectionReason}` : '';
      return `${l.n}. ${l.name}\n   ${pick(lang, STATUS[l.status])} | ${stockWord} ${l.stock}${reason}`;
    });
    const more =
      total > lines.length
        ? `\n\n${pick(lang, {
            en: `Showing ${lines.length} of ${total}. See all on the website.`,
            hi: `${total} में से ${lines.length} दिखाए। बाकी वेबसाइट पर देखें।`,
            hinglish: `${total} mein se ${lines.length} dikhaye. Baaki website par dekhein.`,
          })}`
        : '';
    return `${head}\n\n${body.join('\n')}${more}`;
  },

  stockUpdated(lang: Language, name: string, quantity: number): string {
    return pick(lang, {
      en: `Done: "${name}" stock is now ${quantity}.`,
      hi: `हो गया: "${name}" का स्टॉक अब ${quantity} है।`,
      hinglish: `Ho gaya: "${name}" ka stock ab ${quantity} hai.`,
    });
  },

  outOfStock(lang: Language, name: string): string {
    return pick(lang, {
      en: `Done: "${name}" is marked out of stock.`,
      hi: `हो गया: "${name}" का स्टॉक खत्म दिखाया गया है।`,
      hinglish: `Ho gaya: "${name}" out of stock mark ho gaya.`,
    });
  },

  resubmitted(lang: Language, name: string): string {
    return pick(lang, {
      en: `"${name}" was sent for review again.`,
      hi: `"${name}" को दोबारा समीक्षा के लिए भेज दिया गया।`,
      hinglish: `"${name}" dobara review ke liye bhej diya gaya.`,
    });
  },

  notFound(lang: Language): string {
    return pick(lang, {
      en: 'I could not find that product. Send *list* to see your products and their numbers.',
      hi: 'वह प्रोडक्ट नहीं मिला। अपने प्रोडक्ट और नंबर देखने के लिए *list* भेजें।',
      hinglish: 'Woh product nahi mila. Apne products aur unke number dekhne ke liye *list* bhejein.',
    });
  },

  ambiguous(lang: Language, names: string[]): string {
    const shown = names.slice(0, 5).map((n) => `- ${n}`).join('\n');
    return pick(lang, {
      en: `More than one product matches:\n${shown}\nSend the product number from *list*, or more of its name.`,
      hi: `एक से ज़्यादा प्रोडक्ट मिले:\n${shown}\n*list* वाला नंबर भेजें, या नाम के और शब्द लिखें।`,
      hinglish: `Ek se zyada products mile:\n${shown}\n*list* wala number bhejein, ya naam ke aur shabd likhein.`,
    });
  },

  notRejected(lang: Language, name: string): string {
    return pick(lang, {
      en: `"${name}" is not rejected, so there is nothing to resubmit.`,
      hi: `"${name}" अस्वीकृत नहीं है, इसलिए दोबारा भेजने की ज़रूरत नहीं।`,
      hinglish: `"${name}" rejected nahi hai, isliye dobara bhejne ki zaroorat nahi.`,
    });
  },

  stockUsage(lang: Language): string {
    return pick(lang, {
      en: 'Say it like this: *stock 2 20* (product 2, stock 20) or *stock saree 20*.',
      hi: 'ऐसे लिखें: *stock 2 20* (प्रोडक्ट 2, स्टॉक 20) या *stock saree 20*।',
      hinglish: 'Aise likhein: *stock 2 20* (product 2, stock 20) ya *stock saree 20*.',
    });
  },

  outOfStockUsage(lang: Language): string {
    return pick(lang, {
      en: 'Say it like this: *out of stock 2* or *out of stock saree*.',
      hi: 'ऐसे लिखें: *out of stock 2* या *out of stock saree*।',
      hinglish: 'Aise likhein: *out of stock 2* ya *out of stock saree*.',
    });
  },

  resubmitUsage(lang: Language): string {
    return pick(lang, {
      en: 'Say it like this: *resubmit 2* or *resubmit saree*. Send *list* to see what was rejected.',
      hi: 'ऐसे लिखें: *resubmit 2* या *resubmit saree*। क्या अस्वीकृत हुआ यह देखने के लिए *list* भेजें।',
      hinglish: 'Aise likhein: *resubmit 2* ya *resubmit saree*. Kya reject hua dekhne ke liye *list* bhejein.',
    });
  },

  cancelled(lang: Language): string {
    return pick(lang, {
      en: 'Okay. Nothing is pending. Send *help* to see what I can do.',
      hi: 'ठीक है। कुछ भी बाकी नहीं है। मैं क्या कर सकता हूँ यह देखने के लिए *help* भेजें।',
      hinglish: 'Theek hai. Kuch pending nahi hai. Main kya kar sakta hoon dekhne ke liye *help* bhejein.',
    });
  },

  photoListingSoon(lang: Language): string {
    return pick(lang, {
      en: 'Adding products from photos on WhatsApp is coming soon. For now please add the product on the website. Send *help* for what works today.',
      hi: 'WhatsApp पर फोटो से प्रोडक्ट जोड़ना जल्द आ रहा है। अभी कृपया वेबसाइट पर प्रोडक्ट जोड़ें। आज क्या काम करता है यह देखने के लिए *help* भेजें।',
      hinglish: 'WhatsApp par photo se product jodna jaldi aa raha hai. Abhi kripya website par product jodein. Aaj kya kaam karta hai dekhne ke liye *help* bhejein.',
    });
  },

  didNotUnderstand(lang: Language): string {
    return pick(lang, {
      en: 'Sorry, I did not understand. Send *help* to see what I can do.',
      hi: 'माफ़ कीजिए, मैं समझ नहीं पाया। मैं क्या कर सकता हूँ यह देखने के लिए *help* भेजें।',
      hinglish: 'Maaf kijiye, main samajh nahi paya. Main kya kar sakta hoon dekhne ke liye *help* bhejein.',
    });
  },

  failed(lang: Language, reason: string): string {
    return pick(lang, {
      en: `That did not work: ${reason}`,
      hi: `यह नहीं हो पाया: ${reason}`,
      hinglish: `Yeh nahi ho paya: ${reason}`,
    });
  },
};
