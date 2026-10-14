'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { NavBar } from '@/components/shared/NavBar'
import { Footer } from '@/components/shared/Footer'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/useAuthStore'
import { useCurrencyStore } from '@/lib/store/useCurrencyStore'
import { useCreateRfq } from '@/hooks/queries/useRfqs'

const FIELD = 'w-full h-11 px-3 rounded border border-line bg-white text-[14px] font-sans text-ink focus:outline-none focus:border-forest'
const LABEL = 'block text-[14px] font-[600] font-sans text-ink mb-1.5'

// Custom requirement / RFQ. Always goes to the Solomon team, who reply with a quote.
function CustomRequirementForm() {
  const params = useSearchParams()
  const productId = params.get('product') ?? undefined
  const productName = params.get('name')
  // ?sample=N: ordering a sample of the product, up to N units.
  const sampleMax = Number(params.get('sample')) || 0
  const isSample = sampleMax > 0 && !!productId
  const user = useAuthStore((s) => s.user)
  const openAuthModal = useAuthStore((s) => s.openAuthModal)
  const currency = useCurrencyStore((s) => s.currency)
  const createRfq = useCreateRfq()

  const [description, setDescription] = useState(isSample ? 'Sample order' : '')
  const [quantity, setQuantity] = useState(isSample ? '1' : '')
  const [targetPrice, setTargetPrice] = useState('')
  const [destinationCountry, setDestinationCountry] = useState('United Kingdom')
  const [deadline, setDeadline] = useState('')
  const [images, setImages] = useState<File[]>([])

  const canSubmitAs = user?.role === 'BUYER' || user?.role === 'AGENT'

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!user) {
      openAuthModal('signup')
      return
    }
    createRfq.mutate({
      productId,
      description: description.trim(),
      quantity: Number(quantity),
      targetPrice: targetPrice ? Number(targetPrice) : undefined,
      currency: targetPrice ? currency : undefined,
      destinationCountry: destinationCountry.trim(),
      deadline: deadline || undefined,
      isSample,
      images,
    })
  }

  if (createRfq.isSuccess) {
    return (
      <div className="max-w-[640px]">
        <h1 className="type-h1 text-ink">{isSample ? 'Sample order received' : 'Request received'}</h1>
        <p className="type-body text-muted mt-4">
          {isSample
            ? 'Thank you. We will email you the total with shipping and bank transfer details, and send your sample once paid.'
            : 'Thank you. Our sourcing team will review your requirement and reply by email with options and a quote.'}
        </p>
        <Link href="/" className="inline-block mt-6 underline underline-offset-4">Continue browsing</Link>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="max-w-[640px] space-y-5">
      <div>
        <h1 className="type-h1 text-ink">{isSample ? 'Order a sample' : 'Custom requirement'}</h1>
        <p className="type-body text-muted mt-3" hidden={isSample}>
          Tell us what you need: custom colours, sizes, materials, packaging or private label. Our team works with our
          makers and replies with a quote.
        </p>
        {productName && (
          <p className="text-[14px] font-sans text-ink mt-3">
            Based on: <strong>{productName}</strong>
          </p>
        )}
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>What do you need? *</label>
        <textarea id="description" required minLength={10} maxLength={5000} rows={6} value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Product, colours, sizes, materials, packaging, labelling…"
          className="w-full px-3 py-2 rounded border border-line bg-white text-[14px] font-sans text-ink focus:outline-none focus:border-forest" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="quantity" className={LABEL}>{isSample ? `Sample units (up to ${sampleMax}) *` : 'Quantity (units) *'}</label>
          <input id="quantity" type="number" required min={1} max={isSample ? sampleMax : undefined} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="targetPrice" className={LABEL}>Target price per unit ({currency}, optional)</label>
          <input id="targetPrice" type="number" min={0} step="0.01" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="country" className={LABEL}>Destination country *</label>
          <input id="country" required value={destinationCountry} onChange={(e) => setDestinationCountry(e.target.value)} className={FIELD} />
        </div>
        <div>
          <label htmlFor="deadline" className={LABEL}>Needed by (optional)</label>
          <input id="deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className={FIELD} />
        </div>
      </div>

      <div>
        <label htmlFor="images" className={LABEL}>Reference images (optional, up to 5)</label>
        <input id="images" type="file" accept="image/*" multiple
          onChange={(e) => setImages(Array.from(e.target.files ?? []).slice(0, 5))} className="text-[14px] font-sans" />
      </div>

      {user && !canSubmitAs ? (
        <p className="type-body text-muted">Custom requirements can be sent from a buyer or agent account.</p>
      ) : (
        <Button type="submit" variant="primary" size="lg" disabled={createRfq.isPending}>
          {!user ? 'Sign up to send request' : createRfq.isPending ? 'Sending…' : 'Send request'}
        </Button>
      )}
    </form>
  )
}

export default function CustomRequirementPage() {
  return (
    <div className="min-h-screen bg-ivory flex flex-col">
      <NavBar />
      <main className="flex-1">
        <div className="sb-container sb-section">
          <Suspense fallback={null}>
            <CustomRequirementForm />
          </Suspense>
        </div>
      </main>
      <Footer />
    </div>
  )
}
