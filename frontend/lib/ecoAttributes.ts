/** Fixed vocab for the eco-friendly attribute tags — mirrored on the backend in
 *  `backend/src/modules/products/ecoAttributes.constants.ts`; keep both in sync. */
export const ECO_MATERIALS = ['Biodegradable', 'Compostable', 'Nontoxic', 'Organic', 'Plastic-free', 'Recycled', 'Reusable'] as const
export const ECO_PACKAGING = ['Biodegradable', 'Compostable', 'Plastic-free', 'Recyclable', 'Recycled', 'Zero waste'] as const
export const ECO_PRODUCTION = ['Carbon neutral', 'Ethically sourced', 'Fair trade', 'Sustainably sourced'] as const
