'use client'

import { useState } from 'react'
import { Store } from 'lucide-react'
import { useMyBrand, useUpdateMyBrand } from '@/hooks/queries/useBrandPortal'
import { Button } from '@/components/ui/button'

/** Shown to a marketplace brand until it sets its shop minimum order value (required
 *  before it can list products). It cannot be dismissed — the brand must fill it in. */
export function BrandMinimumOrderModal({ enabled }: { enabled: boolean }) {
  const { data: brand } = useMyBrand(enabled)
  const update = useUpdateMyBrand()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!enabled || !brand || Number(brand.minOrderValueInr) > 0) return null

  function save(e: React.FormEvent) {
    e.preventDefault()
    const amount = Number(value)
    if (!Number.isFinite(amount) || amount < 1) {
      setError('Enter an amount of at least ₹1.')
      return
    }
    setError(null)
    update.mutate({ minOrderValueInr: Math.round(amount) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4" role="dialog" aria-modal="true" aria-labelledby="brand-mov-title">
      <form onSubmit={save} className="w-full max-w-[440px] rounded-xl bg-white p-6 shadow-xl flex flex-col gap-4">
        <div className="w-11 h-11 rounded-full bg-ivory border border-line flex items-center justify-center text-forest">
          <Store size={20} aria-hidden="true" />
        </div>
        <div>
          <h2 id="brand-mov-title" className="type-h3 text-ink">Set your minimum order value</h2>
          <p className="mt-2 type-body text-muted">
            Buyers must spend at least this much with your shop in one order. You need to set it before you can add
            or publish products. You can change it later in Brand profile.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[14px] font-[600] text-ink">Minimum order value (₹) *</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            required
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. 10000"
            className="h-11 rounded-[4px] border border-line px-3 text-[16px] focus:outline-none focus:border-forest"
          />
          <span className="type-caption text-muted">In Indian rupees. Buyers see it in their own currency.</span>
        </label>
        {error && <p className="type-caption text-error" role="alert">{error}</p>}
        <Button type="submit" variant="primary" size="lg" disabled={update.isPending}>
          {update.isPending ? 'Saving…' : 'Save and continue'}
        </Button>
      </form>
    </div>
  )
}
