export interface FxRates {
  base: string;
  date: string;
  rates: Record<string, number>;
}

export interface FxProvider {
  /** Live rates converting FROM INR (the platform's single source-of-truth currency) TO every other currency. */
  getRatesFromInr(): Promise<FxRates>;
}
