/**
 * Pure commission / money helpers for marketplace brand orders. Kept free of any I/O so the
 * "when is commission locked" decision (currently: the paid transition) can move without
 * touching the math. All arithmetic is done in integer paise to avoid float drift.
 */

export interface CommissionRates {
  first: number;
  repeat: number;
}

export interface LineCommission {
  /** Commission in INR, 2dp. */
  commissionAmount: number;
  /** lineAdminTotal - commissionAmount, 2dp. Becomes the item's lineSellerTotal. */
  lineNet: number;
  /** lineNet / quantity, 2dp. Becomes the item's unitSellerPrice. */
  unitNet: number;
}

export const toPaise = (inr: number): number => Math.round(inr * 100);
export const fromPaise = (paise: number): number => paise / 100;

/** A buyer's first paid order with a brand gets `first`, every later one from that buyer `repeat`. */
export function pickRate(rates: CommissionRates, isFirstPaidOrderOfBuyer: boolean): number {
  return isFirstPaidOrderOfBuyer ? rates.first : rates.repeat;
}

/** `ratePercent` is a percent with up to 2dp (25 = 25%). Invariant: lineNet + commissionAmount == lineAdminTotal. */
export function computeLineCommission(
  lineAdminTotal: number,
  quantity: number,
  ratePercent: number,
): LineCommission {
  const linePaise = toPaise(lineAdminTotal);
  const ratePoints = Math.round(ratePercent * 100); // 25.00% -> 2500
  const commissionPaise = Math.round((linePaise * ratePoints) / 10000);
  const netPaise = linePaise - commissionPaise;
  return {
    commissionAmount: fromPaise(commissionPaise),
    lineNet: fromPaise(netPaise),
    unitNet: fromPaise(Math.round(netPaise / quantity)),
  };
}

/**
 * Splits `total` across `weights` pro-rata at 2dp; the rounding remainder lands on the LAST
 * share so the shares always sum exactly to `total`.
 */
export function splitProRata(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const totalPaise = toPaise(total);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const shares: number[] = [];
  let allocated = 0;
  weights.forEach((w, i) => {
    if (i === weights.length - 1) {
      shares.push(totalPaise - allocated);
      return;
    }
    const share = weightSum > 0 ? Math.round((totalPaise * w) / weightSum) : 0;
    shares.push(share);
    allocated += share;
  });
  return shares.map(fromPaise);
}
