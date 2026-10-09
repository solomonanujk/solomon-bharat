'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, BadgeCheck, ExternalLink, ImagePlus, Loader2, Wallet } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  useMyBrand,
  useSellerType,
  useUpdateMyBrand,
  useUploadBrandImage,
} from '@/hooks/queries/useBrandPortal'
import type { OwnBrand, UpdateOwnBrandInput } from '@/types/brand-portal'

const INPUT_CLS =
  'w-full h-11 px-3 rounded border border-line bg-white text-[14px] font-sans text-ink placeholder:text-muted/60 focus-visible:outline-2 focus-visible:outline-forest disabled:bg-ivory disabled:text-muted'
const TEXTAREA_CLS = INPUT_CLS.replace('h-11', 'py-2.5') + ' resize-y'
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-[14px] font-[600] font-sans text-ink mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[12px] font-sans text-muted mt-1">{hint}</p>}
    </div>
  )
}

function ImagePicker({ id, label, hint, url, onUrl, kind, shape }: {
  id: string
  label: string
  hint: string
  url: string
  onUrl: (url: string) => void
  kind: 'logo' | 'banner'
  shape: 'square' | 'wide'
}) {
  const upload = useUploadBrandImage(kind)
  const inputRef = useRef<HTMLInputElement>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!ACCEPTED.includes(file.type)) {
      toast.error('Only JPEG, PNG or WEBP images are supported.')
      return
    }
    try {
      onUrl(await upload.mutateAsync(file))
    } catch {
      // error toast is raised by the mutation
    }
  }

  return (
    <div>
      <p className="text-[14px] font-[600] font-sans text-ink mb-1.5">{label}</p>
      <div className="flex items-center gap-4">
        <div
          className={`${shape === 'square' ? 'w-24 h-24' : 'w-48 h-24'} rounded border border-line bg-ivory overflow-hidden flex items-center justify-center shrink-0`}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`${label} preview`} className="w-full h-full object-cover" />
          ) : (
            <ImagePlus size={22} className="text-muted" aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2 items-start">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <Button type="button" variant="secondary" size="sm" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
            {upload.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : null}
            {url ? 'Replace' : 'Upload'}
          </Button>
          {url && (
            <button type="button" onClick={() => onUrl('')} className="text-[12px] font-sans text-muted underline">
              Remove
            </button>
          )}
          <p className="text-[12px] font-sans text-muted">{hint} Save the profile to apply.</p>
        </div>
      </div>
    </div>
  )
}

interface FormState {
  logoUrl: string
  bannerUrl: string
  story: string
  country: string
  website: string
  instagram: string
  returnPolicy: string
  minOrderValueInr: string
  legalName: string
  gstin: string
}

function toForm(b: OwnBrand): FormState {
  return {
    logoUrl: b.logoUrl ?? '',
    bannerUrl: b.bannerUrl ?? '',
    story: b.story ?? '',
    country: b.country ?? '',
    website: b.website ?? '',
    instagram: b.instagram ?? '',
    returnPolicy: b.returnPolicy ?? '',
    minOrderValueInr: String(b.minOrderValueInr ?? 0),
    legalName: b.legalName ?? '',
    gstin: b.gstin ?? '',
  }
}

const nullable = (v: string): string | null => (v.trim() === '' ? null : v.trim())

function BrandForm({ brand }: { brand: OwnBrand }) {
  const update = useUpdateMyBrand()
  const [form, setForm] = useState<FormState>(() => toForm(brand))
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  // Re-sync after a save/refetch returns fresh server data.
  useEffect(() => { setForm(toForm(brand)) }, [brand])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const min = Number(form.minOrderValueInr)
    if (!Number.isFinite(min) || min < 0) { setError('Minimum order value must be 0 or more.'); return }
    if (form.website.trim() && !/^https?:\/\//i.test(form.website.trim())) { setError('Website must start with http:// or https://'); return }
    setError(null)
    const body: UpdateOwnBrandInput = {
      logoUrl: nullable(form.logoUrl),
      bannerUrl: nullable(form.bannerUrl),
      story: nullable(form.story),
      country: nullable(form.country),
      website: nullable(form.website),
      instagram: nullable(form.instagram),
      returnPolicy: nullable(form.returnPolicy),
      minOrderValueInr: min,
      legalName: nullable(form.legalName),
      gstin: nullable(form.gstin),
    }
    update.mutate(body)
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6 max-w-3xl">
      <section className="rounded-xl border border-line bg-white p-6 space-y-5">
        <h2 className="type-h3 text-ink">Identity</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field id="brand-name" label="Brand name" hint="Name changes go through Solomon Bharat support.">
            <input id="brand-name" value={brand.name} disabled readOnly className={INPUT_CLS} />
          </Field>
          <Field id="brand-slug" label="Brand page address" hint="Fixed once created.">
            <input id="brand-slug" value={`/brands/${brand.slug}`} disabled readOnly className={INPUT_CLS} />
          </Field>
        </div>
        <ImagePicker id="brand-logo" label="Logo" hint="Square, JPEG/PNG/WEBP." url={form.logoUrl} onUrl={(u) => set('logoUrl', u)} kind="logo" shape="square" />
        <ImagePicker id="brand-banner" label="Banner" hint="Wide image shown on your brand page." url={form.bannerUrl} onUrl={(u) => set('bannerUrl', u)} kind="banner" shape="wide" />
        <Field id="brand-story" label="Brand story" hint={`${form.story.length}/1000`}>
          <textarea id="brand-story" rows={5} maxLength={1000} value={form.story} onChange={(e) => set('story', e.target.value)} className={TEXTAREA_CLS} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Field id="brand-country" label="Country">
            <input id="brand-country" value={form.country} maxLength={100} onChange={(e) => set('country', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field id="brand-website" label="Website">
            <input id="brand-website" type="url" value={form.website} maxLength={500} placeholder="https://" onChange={(e) => set('website', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field id="brand-instagram" label="Instagram">
            <input id="brand-instagram" value={form.instagram} maxLength={100} placeholder="@yourbrand" onChange={(e) => set('instagram', e.target.value)} className={INPUT_CLS} />
          </Field>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-white p-6 space-y-5">
        <h2 className="type-h3 text-ink">Selling terms</h2>
        <Field id="brand-min" label="Minimum order value (INR)" hint="Buyers must reach this total from your products in one checkout. Enforced at checkout.">
          <input id="brand-min" type="number" min={0} step="1" value={form.minOrderValueInr} onChange={(e) => set('minOrderValueInr', e.target.value)} className={INPUT_CLS + ' max-w-xs'} />
        </Field>
        <Field id="brand-returns" label="Return policy" hint="Shown to buyers as information only. Solomon Bharat does not process returns, refunds or disputes.">
          <textarea id="brand-returns" rows={4} maxLength={2000} value={form.returnPolicy} onChange={(e) => set('returnPolicy', e.target.value)} className={TEXTAREA_CLS} />
        </Field>
      </section>

      <section className="rounded-xl border border-line bg-white p-6 space-y-5">
        <div>
          <h2 className="type-h3 text-ink">Legal details</h2>
          <p className="text-[13px] font-sans text-muted mt-1">Private. Never shown to buyers.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <Field id="brand-legal" label="Legal name">
            <input id="brand-legal" value={form.legalName} maxLength={200} onChange={(e) => set('legalName', e.target.value)} className={INPUT_CLS} />
          </Field>
          <Field id="brand-gstin" label="GSTIN">
            <input id="brand-gstin" value={form.gstin} maxLength={20} onChange={(e) => set('gstin', e.target.value.toUpperCase())} className={INPUT_CLS} />
          </Field>
        </div>
      </section>

      {error && <p role="alert" className="text-[13px] font-sans text-error">{error}</p>}
      <Button type="submit" variant="primary" size="lg" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save brand profile'}
      </Button>
    </form>
  )
}

function rateLabel(override: number | string | null, fallback: number): string {
  return `${override === null || override === undefined ? fallback : Number(override)}%`
}

function CommissionCard({ brand }: { brand: OwnBrand }) {
  const custom = brand.commissionFirstOverride !== null || brand.commissionRepeatOverride !== null
  return (
    <section className="rounded-xl border border-line bg-white p-6">
      <h2 className="type-h3 text-ink mb-2">Commission terms</h2>
      <p className="text-[14px] font-sans text-ink">
        Solomon Bharat collects the buyer&apos;s payment and keeps{' '}
        <strong>{rateLabel(brand.commissionFirstOverride, 25)}</strong> of your first paid order and{' '}
        <strong>{rateLabel(brand.commissionRepeatOverride, 15)}</strong> of every later one. You are paid the rest once you
        mark the order delivered. Shipping is included in your prices.
      </p>
      <p className="text-[12px] font-sans text-muted mt-2">
        {custom
          ? 'Your brand has custom rates set by Solomon Bharat. Rates are read-only.'
          : 'These are the standard platform rates and are read-only here. Cancelled or unpaid orders never count as your first sale.'}
      </p>
    </section>
  )
}

function PayPalCard() {
  return (
    <section className="rounded-xl border border-dashed border-line bg-white p-6 flex items-start gap-4">
      <div className="w-10 h-10 rounded-lg bg-ivory flex items-center justify-center shrink-0">
        <Wallet size={18} className="text-forest" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="type-h3 text-ink">Connect PayPal</h2>
          <span className="text-[11px] font-[700] font-sans uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-selected text-forest">Coming soon</span>
        </div>
        <p className="text-[13px] font-sans text-muted mt-1">
          Automatic payouts to your PayPal account are on the way. Until then, Solomon Bharat pays you manually and records each payout under Payouts.
        </p>
        <Button type="button" variant="secondary" size="sm" disabled className="mt-3">Connect PayPal</Button>
      </div>
    </section>
  )
}

export default function BrandProfilePage() {
  const { isMarketplace, ready } = useSellerType()
  const { data: brand, isLoading, error } = useMyBrand(isMarketplace)

  if (!ready) return <p className="text-[14px] font-sans text-muted">Loading…</p>
  if (!isMarketplace) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 max-w-xl">
        <h1 className="type-h3 text-ink mb-1">Brand profile</h1>
        <p className="text-[14px] font-sans text-muted">Brand profiles are only available to marketplace brands.</p>
        <Link href="/portal" className="text-[13px] font-[600] text-forest underline mt-3 inline-block">Back to dashboard</Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="type-h2 text-ink flex items-center gap-2">
            Brand profile
            {brand?.isVerified && <BadgeCheck size={20} className="text-forest" aria-label="Verified brand" />}
          </h1>
          <p className="text-[13.5px] font-sans text-muted mt-0.5">
            {brand ? (brand.isVerified ? 'Verified by Solomon Bharat.' : 'Not verified yet. Solomon Bharat verifies brands after review.') : ' '}
          </p>
        </div>
        {brand && brand.status === 'ACTIVE' && (
          <Link
            href={`/brands/${brand.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[13px] font-[600] font-sans text-forest underline min-h-[44px]"
          >
            View public brand page <ExternalLink size={13} aria-hidden="true" />
          </Link>
        )}
      </div>

      {brand?.status === 'SUSPENDED' && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-error/40 bg-white p-4">
          <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-[13px] font-sans text-ink">
            <p className="font-[600]">Your brand is suspended</p>
            <p className="mt-0.5">
              Your products and brand page are hidden from buyers until Solomon Bharat reinstates your brand. You can still view orders and payouts. Contact support to resolve this.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4 animate-pulse max-w-3xl">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 rounded-xl border border-line bg-white" />)}
        </div>
      ) : error || !brand ? (
        <p role="alert" className="text-[14px] font-sans text-error">Could not load your brand profile.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-w-3xl">
            <CommissionCard brand={brand} />
            <PayPalCard />
          </div>
          <BrandForm brand={brand} />
        </>
      )}
    </div>
  )
}
