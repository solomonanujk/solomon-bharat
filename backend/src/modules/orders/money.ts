/**
 * Pure money helpers. All arithmetic is done in integer paise to avoid float drift.
 */

export const toPaise = (inr: number): number => Math.round(inr * 100);
export const fromPaise = (paise: number): number => paise / 100;

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
