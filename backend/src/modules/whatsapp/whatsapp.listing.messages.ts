import { Language } from './whatsapp.commands';
import { CategoryOption, FieldKey, ListingDraft, MIN_PHOTOS, dimensionsString } from './whatsapp.listing';

/** Fixed texts for the listing conversation. Hand-written (not AI generated), so replies are free. */

type Pick3 = { en: string; hi: string; hinglish: string };
const pick = (lang: Language, t: Pick3): string => t[lang];

const ASK: Record<Exclude<FieldKey, 'category'>, Pick3> = {
  photos: {
    en: `At least ${MIN_PHOTOS} photos of the product (send them here)`,
    hi: `प्रोडक्ट की कम से कम ${MIN_PHOTOS} फोटो (यहीं भेजें)`,
    hinglish: `Product ki kam se kam ${MIN_PHOTOS} photo (yahin bhejein)`,
  },
  name: { en: 'Product name', hi: 'प्रोडक्ट का नाम', hinglish: 'Product ka naam' },
  price: { en: 'Price per piece in rupees', hi: 'एक पीस की कीमत (रुपये में)', hinglish: 'Ek piece ki keemat (rupaye mein)' },
  moq: { en: 'Minimum order quantity (pieces)', hi: 'न्यूनतम ऑर्डर मात्रा (पीस)', hinglish: 'Minimum order quantity (pieces)' },
  stock: {
    en: "Pieces in stock now, or say 'made to order'",
    hi: "अभी स्टॉक में कितने पीस हैं, या 'made to order' लिखें",
    hinglish: "Abhi stock mein kitne piece hain, ya 'made to order' likhein",
  },
  materials: { en: 'Material it is made of', hi: 'किस सामग्री से बना है', hinglish: 'Kis material se bana hai' },
  description: {
    en: 'A short description (how it looks, how it is used)',
    hi: 'छोटा विवरण (कैसा दिखता है, कैसे इस्तेमाल होता है)',
    hinglish: 'Chhota description (kaisa dikhta hai, kaise use hota hai)',
  },
  craftTechnique: {
    en: 'Craft technique (for example block print, hand carved)',
    hi: 'शिल्प तकनीक (जैसे ब्लॉक प्रिंट, हाथ की नक्काशी)',
    hinglish: 'Craft technique (jaise block print, hand carved)',
  },
  placeOfOrigin: {
    en: 'Place it is made (city or state)',
    hi: 'कहाँ बनता है (शहर या राज्य)',
    hinglish: 'Kahan banta hai (city ya state)',
  },
  weight: {
    en: 'Weight of one piece (kg or grams)',
    hi: 'एक पीस का वज़न (किलो या ग्राम)',
    hinglish: 'Ek piece ka weight (kg ya gram)',
  },
  dimensions: {
    en: 'Size: length x width x height (cm, inch or m)',
    hi: 'साइज़: लंबाई x चौड़ाई x ऊँचाई (cm, inch या m)',
    hinglish: 'Size: length x width x height (cm, inch ya m)',
  },
  leadTime: {
    en: 'Time to dispatch an order (for example 7-10 days)',
    hi: 'ऑर्डर भेजने में कितना समय (जैसे 7-10 दिन)',
    hinglish: 'Order bhejne mein kitna time (jaise 7-10 din)',
  },
  careInstructions: {
    en: 'Care instructions (how to clean or store it)',
    hi: 'देखभाल के निर्देश (कैसे साफ़ करें या रखें)',
    hinglish: 'Dekhbhal ke instructions (kaise saaf karein ya rakhein)',
  },
  hsn: {
    en: "HSN code, if you know it (say 'not sure' and I will suggest one)",
    hi: "HSN कोड, अगर पता हो (नहीं पता तो 'not sure' लिखें, मैं सुझाव दूँगा)",
    hinglish: "HSN code, agar pata ho (nahi pata to 'not sure' likhein, main suggest karunga)",
  },
};

const CATEGORY_ASK: Pick3 = {
  en: 'What type of product is this? (for example saree, brass lamp, wooden toy)',
  hi: 'यह किस तरह का प्रोडक्ट है? (जैसे साड़ी, पीतल का दीपक, लकड़ी का खिलौना)',
  hinglish: 'Yeh kis tarah ka product hai? (jaise saree, brass lamp, wooden toy)',
};

export const listingMessages = {
  started(lang: Language): string {
    return pick(lang, {
      en: [
        `Let's add a product. Send ${MIN_PHOTOS} to 10 photos and tell me about it: name, material, price per piece, minimum order, stock, size and weight.`,
        'You can write in English, Hindi or Hinglish. Voice notes do not work yet, please type.',
        'Send *done* when you have sent everything. I will ask for anything missing. Send *cancel* to stop.',
      ].join('\n'),
      hi: [
        `चलिए प्रोडक्ट जोड़ते हैं। ${MIN_PHOTOS} से 10 फोटो भेजें और बताएं: नाम, सामग्री, एक पीस की कीमत, न्यूनतम ऑर्डर, स्टॉक, साइज़ और वज़न।`,
        'आप अंग्रेज़ी, हिंदी या हिंग्लिश में लिख सकते हैं। वॉइस नोट अभी काम नहीं करते, कृपया टाइप करें।',
        'सब भेजने के बाद *done* भेजें। जो कुछ छूटेगा मैं पूछूँगा। रोकने के लिए *cancel* भेजें।',
      ].join('\n'),
      hinglish: [
        `Chaliye product jodte hain. ${MIN_PHOTOS} se 10 photo bhejein aur bataiye: naam, material, ek piece ki keemat, minimum order, stock, size aur weight.`,
        'Aap English, Hindi ya Hinglish mein likh sakte hain. Voice note abhi kaam nahi karte, kripya type karein.',
        'Sab bhejne ke baad *done* bhejein. Jo chhoot jayega main poochunga. Rokne ke liye *cancel* bhejein.',
      ].join('\n'),
    });
  },

  questions(lang: Language, keys: FieldKey[], options: CategoryOption[]): string {
    const head = pick(lang, {
      en: 'Thanks. I still need these. Please answer all in one message:',
      hi: 'धन्यवाद। मुझे ये चीज़ें चाहिए। कृपया सभी के जवाब एक ही संदेश में दें:',
      hinglish: 'Dhanyavaad. Mujhe yeh cheezein chahiye. Kripya sabke jawab ek hi message mein dein:',
    });
    const lines = keys.map((key, i) => {
      if (key !== 'category') return `${i + 1}. ${pick(lang, ASK[key])}`;
      const choose = options.length
        ? `\n${options.map((o, j) => `   ${String.fromCharCode(97 + j)}) ${o.name}`).join('\n')}\n   ${pick(lang, {
            en: 'Write the category name from the list, or describe the product again.',
            hi: 'सूची में से श्रेणी का नाम लिखें, या प्रोडक्ट के बारे में फिर बताएं।',
            hinglish: 'List mein se category ka naam likhein, ya product ke baare mein phir bataiye.',
          })}`
        : '';
      return `${i + 1}. ${pick(lang, CATEGORY_ASK)}${choose}`;
    });
    const photoNote = keys.includes('photos')
      ? `\n\n${pick(lang, {
          en: 'Photos can be sent as separate messages.',
          hi: 'फोटो अलग संदेशों में भेज सकते हैं।',
          hinglish: 'Photo alag messages mein bhej sakte hain.',
        })}`
      : '';
    return `${head}\n\n${lines.join('\n')}${photoNote}`;
  },

  summary(lang: Language, draft: ListingDraft, photos: number, videos: number): string {
    const L = (en: string, hi: string, hinglish: string) => pick(lang, { en, hi, hinglish });
    const lines: string[] = [];
    lines.push(`${L('Name', 'नाम', 'Naam')}: ${draft.name}`);
    if (draft.categoryPath) {
      const guess = draft.categorySuggested
        ? ` (${L('my best guess, tell me if it is wrong', 'मेरा अनुमान, गलत हो तो बताएं', 'mera andaza, galat ho to bataiye')})`
        : '';
      lines.push(`${L('Category', 'श्रेणी', 'Category')}: ${draft.categoryPath}${guess}`);
    }
    lines.push(`${L('Price', 'कीमत', 'Keemat')}: ₹${draft.price} ${L('per piece', 'प्रति पीस', 'per piece')}`);
    lines.push(
      `${L('Minimum order', 'न्यूनतम ऑर्डर', 'Minimum order')}: ${draft.moq} | ${L('Stock', 'स्टॉक', 'Stock')}: ${
        draft.madeToOrder ? L('made to order', 'made to order', 'made to order') : draft.stock
      }`,
    );
    lines.push(`${L('Material', 'सामग्री', 'Material')}: ${draft.materials}`);
    if (draft.craftTechnique) lines.push(`${L('Craft', 'शिल्प', 'Craft')}: ${draft.craftTechnique}`);
    if (draft.placeOfOrigin) lines.push(`${L('Made in', 'कहाँ बना', 'Kahan bana')}: ${draft.placeOfOrigin}`);
    lines.push(
      `${L('Weight', 'वज़न', 'Weight')}: ${draft.weightKg} kg | ${L('Size', 'साइज़', 'Size')}: ${dimensionsString(draft)}`,
    );
    if (draft.leadTime) lines.push(`${L('Dispatch time', 'भेजने का समय', 'Bhejne ka time')}: ${draft.leadTime}`);
    if (draft.careInstructions) lines.push(`${L('Care', 'देखभाल', 'Dekhbhal')}: ${draft.careInstructions}`);
    if (draft.hsn) {
      const note = draft.hsnSuggested
        ? ` (${L('my suggestion, please check', 'मेरा सुझाव, कृपया जाँचें', 'mera suggestion, kripya check karein')})`
        : '';
      lines.push(`HSN: ${draft.hsn}${note}`);
    }
    lines.push(`${L('Photos', 'फोटो', 'Photos')}: ${photos} | ${L('Videos', 'वीडियो', 'Videos')}: ${videos}`);

    const head = L('Please check your listing:', 'कृपया अपनी लिस्टिंग जाँचें:', 'Kripya apni listing check karein:');
    const foot = L(
      'Reply *yes* to send it for approval, or tell me what to change. Solomon Bharat sets the buyer price. Send *cancel* to stop.',
      'अनुमोदन के लिए भेजने को *yes* लिखें, या बताएं क्या बदलना है। खरीदार की कीमत सोलोमन भारत तय करता है। रोकने के लिए *cancel* भेजें।',
      'Approval ke liye bhejne ko *yes* likhein, ya bataiye kya badalna hai. Buyer ki keemat Solomon Bharat tay karta hai. Rokne ke liye *cancel* bhejein.',
    );
    return `${head}\n\n${lines.join('\n')}\n\n${L('Description', 'विवरण', 'Description')}: ${draft.description}\n\n${foot}`;
  },

  submitted(lang: Language, name: string): string {
    return pick(lang, {
      en: `Submitted: "${name}" is waiting for approval. Solomon Bharat will review it and set the buyer price. Send *list* to see its status.`,
      hi: `भेज दिया: "${name}" अनुमोदन का इंतज़ार कर रहा है। सोलोमन भारत इसकी समीक्षा करेगा और खरीदार की कीमत तय करेगा। स्थिति देखने के लिए *list* भेजें।`,
      hinglish: `Bhej diya: "${name}" approval ka intezaar kar raha hai. Solomon Bharat review karke buyer ki keemat tay karega. Status dekhne ke liye *list* bhejein.`,
    });
  },

  serviceBusy(lang: Language): string {
    return pick(lang, {
      en: 'The assistant is not available right now. Your message is saved: send *done* a little later to try again.',
      hi: 'सहायक अभी उपलब्ध नहीं है। आपका संदेश सुरक्षित है: थोड़ी देर बाद फिर कोशिश करने के लिए *done* भेजें।',
      hinglish: 'Assistant abhi available nahi hai. Aapka message save hai: thodi der baad phir koshish ke liye *done* bhejein.',
    });
  },

  joinedOld(lang: Language, name: string): string {
    return pick(lang, {
      en: `These photos were added to your unfinished listing "${name}". To start a different product instead, send *add*.`,
      hi: `ये फोटो आपकी अधूरी लिस्टिंग "${name}" में जोड़ दी गईं। दूसरा प्रोडक्ट शुरू करने के लिए *add* भेजें।`,
      hinglish: `Yeh photos aapki adhoori listing "${name}" mein jod di gayi. Doosra product shuru karne ke liye *add* bhejein.`,
    });
  },

  discardedOld(lang: Language): string {
    return pick(lang, {
      en: 'Your earlier unfinished listing was discarded.',
      hi: 'आपकी पहले की अधूरी लिस्टिंग हटा दी गई।',
      hinglish: 'Aapki pehle ki adhoori listing hata di gayi.',
    });
  },

  answerFirst(lang: Language): string {
    return pick(lang, {
      en: 'Please answer the questions above first, or send *cancel* to stop.',
      hi: 'कृपया पहले ऊपर के सवालों के जवाब दें, या रोकने के लिए *cancel* भेजें।',
      hinglish: 'Kripya pehle upar ke sawalon ke jawab dein, ya rokne ke liye *cancel* bhejein.',
    });
  },

  cancelled(lang: Language): string {
    return pick(lang, {
      en: 'Listing cancelled and the photos were discarded. Send *add* to start again.',
      hi: 'लिस्टिंग रद्द कर दी गई और फोटो हटा दी गईं। फिर शुरू करने के लिए *add* भेजें।',
      hinglish: 'Listing cancel ho gayi aur photos hata di gayi. Phir shuru karne ke liye *add* bhejein.',
    });
  },

  nothingYet(lang: Language): string {
    return pick(lang, {
      en: 'I have no details or photos yet. Send photos and a short description, then *done*.',
      hi: 'अभी मेरे पास कोई जानकारी या फोटो नहीं है। फोटो और छोटा विवरण भेजें, फिर *done*।',
      hinglish: 'Abhi mere paas koi jaankari ya photo nahi hai. Photo aur chhota description bhejein, phir *done*.',
    });
  },

  audioNotSupported(lang: Language): string {
    return pick(lang, {
      en: 'Voice notes do not work yet. Please type the details.',
      hi: 'वॉइस नोट अभी काम नहीं करते। कृपया विवरण टाइप करें।',
      hinglish: 'Voice note abhi kaam nahi karte. Kripya details type karein.',
    });
  },

  mediaFailed(lang: Language): string {
    return pick(lang, {
      en: 'I could not save that file. Photos must be JPEG, PNG or WEBP up to 5 MB. Videos must be MP4 or MOV up to 16 MB.',
      hi: 'मैं वह फ़ाइल सेव नहीं कर पाया। फोटो JPEG, PNG या WEBP और 5 MB तक होनी चाहिए। वीडियो MP4 या MOV और 16 MB तक।',
      hinglish: 'Main woh file save nahi kar paya. Photo JPEG, PNG ya WEBP aur 5 MB tak honi chahiye. Video MP4 ya MOV aur 16 MB tak.',
    });
  },

  aiUnavailable(lang: Language): string {
    return pick(lang, {
      en: 'I cannot read listings in chat right now. Please add the product on the website.',
      hi: 'मैं अभी चैट में लिस्टिंग नहीं पढ़ पा रहा। कृपया वेबसाइट पर प्रोडक्ट जोड़ें।',
      hinglish: 'Main abhi chat mein listing nahi padh pa raha. Kripya website par product jodein.',
    });
  },

  aiLimit(lang: Language): string {
    return pick(lang, {
      en: "You have reached today's limit for chat listings. Please finish on the website or try again tomorrow.",
      hi: 'आज की चैट लिस्टिंग की सीमा पूरी हो गई। कृपया वेबसाइट पर पूरा करें या कल फिर कोशिश करें।',
      hinglish: 'Aaj ki chat listing ki limit poori ho gayi. Kripya website par poora karein ya kal phir koshish karein.',
    });
  },

  tooManyRounds(lang: Language): string {
    return pick(lang, {
      en: 'This is taking too many rounds. Please finish the product on the website.',
      hi: 'इसमें बहुत ज़्यादा बार पूछना पड़ रहा है। कृपया प्रोडक्ट वेबसाइट पर पूरा करें।',
      hinglish: 'Isme bahut zyada baar poochna pad raha hai. Kripya product website par poora karein.',
    });
  },

  extractFailed(lang: Language): string {
    return pick(lang, {
      en: 'I could not understand that. Please write the details again in one short message.',
      hi: 'मैं यह समझ नहीं पाया। कृपया विवरण एक छोटे संदेश में फिर से लिखें।',
      hinglish: 'Main yeh samajh nahi paya. Kripya details ek chhote message mein phir se likhein.',
    });
  },
};
