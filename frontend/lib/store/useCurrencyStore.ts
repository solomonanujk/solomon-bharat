import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface CurrencyState {
  currency: string
  rates: Record<string, number>
  lastFetched: number | null
}

interface CurrencyActions {
  setCurrency: (currency: string) => void
  setRates: (rates: Record<string, number>) => void
  convertFromINR: (amountINR: number) => number
}

type CurrencyStore = CurrencyState & CurrencyActions

export const useCurrencyStore = create<CurrencyStore>()(
  persist(
    (set, get) => ({
  // ─── State ──────────────────────────────────────────────────────────────────
  currency: 'USD',
  rates: {},
  lastFetched: null,

  // ─── Actions ────────────────────────────────────────────────────────────────
  setCurrency: (currency: string) => set({ currency }),

  setRates: (rates: Record<string, number>) =>
    set({ rates, lastFetched: Date.now() }),

  /**
   * Convert an INR amount to the currently selected display currency.
   *
   * The `rates` object comes from the Frankfurter API with base=INR, so
   * rates[currency] is already the INR→currency rate (e.g. rates['USD'] ≈ 0.012).
   * If the target currency is INR, or rates are unavailable, return the original amount.
   */
  convertFromINR: (amountINR: number): number => {
    const { currency, rates } = get()

    if (currency === 'INR') return amountINR

    const targetRate = rates[currency]
    const inrRate = rates['INR']

    // If base is already INR, inrRate won't appear in the response.
    // Frankfurter base=INR → rates contains all other currencies relative to 1 INR.
    if (targetRate != null) {
      // rates[currency] = value of 1 INR in `currency`
      return amountINR * targetRate
    }

    // Fallback: attempt cross-rate conversion if both rates present
    if (inrRate != null && targetRate != null) {
      return (amountINR / inrRate) * targetRate
    }

    return amountINR
  },
    }),
    {
      name: 'sb_currency',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? localStorage : (null as never)
      ),
      partialize: (state) => ({ currency: state.currency }),
    }
  )
)
