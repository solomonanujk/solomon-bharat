/** An agent sees their own agentPrice (when set); every other viewer (buyer, guest,
 *  seller, admin) sees the plain adminPrice — used anywhere a shared buyer-facing
 *  component (ProductCard, ProductInfo) renders or adds-to-cart a unit price. */
export function displayUnitPrice(
  role: string | undefined,
  adminPrice: number,
  agentPrice?: number | null
): number {
  return role === 'AGENT' && agentPrice != null ? agentPrice : adminPrice
}
