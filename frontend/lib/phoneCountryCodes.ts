/** Country name + dialing code for the mobile-number country picker — same
 *  country set and order as `lib/countries.ts`, kept in sync by hand. */
export interface PhoneCountryCode {
  name: string
  iso2: string
  dialCode: string
}

export const PHONE_COUNTRY_CODES: PhoneCountryCode[] = [
  { name: 'Australia', iso2: 'AU', dialCode: '+61' },
  { name: 'Austria', iso2: 'AT', dialCode: '+43' },
  { name: 'Bahrain', iso2: 'BH', dialCode: '+973' },
  { name: 'Belgium', iso2: 'BE', dialCode: '+32' },
  { name: 'Brazil', iso2: 'BR', dialCode: '+55' },
  { name: 'Bulgaria', iso2: 'BG', dialCode: '+359' },
  { name: 'Canada', iso2: 'CA', dialCode: '+1' },
  { name: 'China', iso2: 'CN', dialCode: '+86' },
  { name: 'Croatia', iso2: 'HR', dialCode: '+385' },
  { name: 'Cyprus', iso2: 'CY', dialCode: '+357' },
  { name: 'Czech Republic', iso2: 'CZ', dialCode: '+420' },
  { name: 'Denmark', iso2: 'DK', dialCode: '+45' },
  { name: 'Egypt', iso2: 'EG', dialCode: '+20' },
  { name: 'Estonia', iso2: 'EE', dialCode: '+372' },
  { name: 'Finland', iso2: 'FI', dialCode: '+358' },
  { name: 'France', iso2: 'FR', dialCode: '+33' },
  { name: 'Germany', iso2: 'DE', dialCode: '+49' },
  { name: 'Greece', iso2: 'GR', dialCode: '+30' },
  { name: 'Hong Kong', iso2: 'HK', dialCode: '+852' },
  { name: 'Hungary', iso2: 'HU', dialCode: '+36' },
  { name: 'Iceland', iso2: 'IS', dialCode: '+354' },
  { name: 'India', iso2: 'IN', dialCode: '+91' },
  { name: 'Indonesia', iso2: 'ID', dialCode: '+62' },
  { name: 'Ireland', iso2: 'IE', dialCode: '+353' },
  { name: 'Israel', iso2: 'IL', dialCode: '+972' },
  { name: 'Italy', iso2: 'IT', dialCode: '+39' },
  { name: 'Japan', iso2: 'JP', dialCode: '+81' },
  { name: 'Jordan', iso2: 'JO', dialCode: '+962' },
  { name: 'Kenya', iso2: 'KE', dialCode: '+254' },
  { name: 'Kuwait', iso2: 'KW', dialCode: '+965' },
  { name: 'Latvia', iso2: 'LV', dialCode: '+371' },
  { name: 'Lithuania', iso2: 'LT', dialCode: '+370' },
  { name: 'Luxembourg', iso2: 'LU', dialCode: '+352' },
  { name: 'Malaysia', iso2: 'MY', dialCode: '+60' },
  { name: 'Malta', iso2: 'MT', dialCode: '+356' },
  { name: 'Mexico', iso2: 'MX', dialCode: '+52' },
  { name: 'Morocco', iso2: 'MA', dialCode: '+212' },
  { name: 'Netherlands', iso2: 'NL', dialCode: '+31' },
  { name: 'New Zealand', iso2: 'NZ', dialCode: '+64' },
  { name: 'Nigeria', iso2: 'NG', dialCode: '+234' },
  { name: 'Norway', iso2: 'NO', dialCode: '+47' },
  { name: 'Oman', iso2: 'OM', dialCode: '+968' },
  { name: 'Philippines', iso2: 'PH', dialCode: '+63' },
  { name: 'Poland', iso2: 'PL', dialCode: '+48' },
  { name: 'Portugal', iso2: 'PT', dialCode: '+351' },
  { name: 'Qatar', iso2: 'QA', dialCode: '+974' },
  { name: 'Romania', iso2: 'RO', dialCode: '+40' },
  { name: 'Saudi Arabia', iso2: 'SA', dialCode: '+966' },
  { name: 'Singapore', iso2: 'SG', dialCode: '+65' },
  { name: 'Slovakia', iso2: 'SK', dialCode: '+421' },
  { name: 'Slovenia', iso2: 'SI', dialCode: '+386' },
  { name: 'South Africa', iso2: 'ZA', dialCode: '+27' },
  { name: 'South Korea', iso2: 'KR', dialCode: '+82' },
  { name: 'Spain', iso2: 'ES', dialCode: '+34' },
  { name: 'Sri Lanka', iso2: 'LK', dialCode: '+94' },
  { name: 'Sweden', iso2: 'SE', dialCode: '+46' },
  { name: 'Switzerland', iso2: 'CH', dialCode: '+41' },
  { name: 'Taiwan', iso2: 'TW', dialCode: '+886' },
  { name: 'Thailand', iso2: 'TH', dialCode: '+66' },
  { name: 'Turkey', iso2: 'TR', dialCode: '+90' },
  { name: 'United Arab Emirates', iso2: 'AE', dialCode: '+971' },
  { name: 'United Kingdom', iso2: 'GB', dialCode: '+44' },
  { name: 'United States', iso2: 'US', dialCode: '+1' },
  { name: 'Vietnam', iso2: 'VN', dialCode: '+84' },
]

export const DEFAULT_PHONE_COUNTRY: PhoneCountryCode = PHONE_COUNTRY_CODES.find((c) => c.iso2 === 'IN')!

/** National numbers are validated by plain digit-count (6–14, the practical
 *  range across real-world numbering plans), not a full per-country format —
 *  this is deliberately simple rather than pulling in a phone-number library
 *  for one field. */
export const MIN_NATIONAL_NUMBER_LENGTH = 6
export const MAX_NATIONAL_NUMBER_LENGTH = 14
