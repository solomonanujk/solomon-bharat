// Controlled vocabulary for the Faire-parity eco-attribute multiselects (PRD §8.5).
// Frontend mirrors these exact literals in frontend/lib/ecoAttributes.ts.
export const ECO_MATERIALS = [
  'Biodegradable',
  'Compostable',
  'Nontoxic',
  'Organic',
  'Plastic-free',
  'Recycled',
  'Reusable',
] as const;

export const ECO_PACKAGING = [
  'Biodegradable',
  'Compostable',
  'Plastic-free',
  'Recyclable',
  'Recycled',
  'Zero waste',
] as const;

export const ECO_PRODUCTION = [
  'Carbon neutral',
  'Ethically sourced',
  'Fair trade',
  'Sustainably sourced',
] as const;
