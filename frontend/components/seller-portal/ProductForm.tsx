'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Upload, X, AlertTriangle, Sparkles, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { useAdminSellers } from '@/hooks/queries/useSellers'
import {
  useSubmitProduct,
  useUpdateMyProduct,
  useAdminUpdateProduct,
  useAdminCreateProduct,
  useResubmitProduct,
  usePolishField,
  type SubmitVariantInput,
} from '@/hooks/queries/useProducts'
import { CategoryCascadeSelect, categoryPathLabel } from '@/components/seller-portal/CategoryCascade'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { ListingScoreWidget } from '@/components/seller-portal/ListingScore'
import { getApiError } from '@/lib/getApiError'
import { cloudinaryFill } from '@/lib/cloudinaryImage'
import type { AdminProduct, MyProduct, ProductVariant } from '@/types'

const MIN_IMAGES = 2
const MAX_IMAGES = 10

const LEAD_TIME_PRESETS = ['1–3 days', '1–2 weeks', '2–4 weeks']

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed'

let _id = 0
function uid() { return `v-${++_id}` }

/** Two blank-price starter tiers (MOQ 20/30) so a fresh tier table shows what to fill
 *  in rather than an empty table — the seller can edit the MOQs or add more tiers. */
function defaultTierRows(): TierRow[] {
  return [
    { id: uid(), moq: '20', sellerPrice: '', adminPrice: '', agentPrice: '' },
    { id: uid(), moq: '30', sellerPrice: '', adminPrice: '', agentPrice: '' },
  ]
}

/** Same starter tiers for a variant combo, but with ids derived from the combo's own
 *  key instead of the uid() counter — deterministic and pure, so it's safe to compute
 *  fresh on every render (no ref/effect needed to keep row ids stable). */
function defaultComboTierRows(comboKey: string): TierRow[] {
  return [
    { id: `${comboKey}::tier-20`, moq: '20', sellerPrice: '', adminPrice: '', agentPrice: '' },
    { id: `${comboKey}::tier-30`, moq: '30', sellerPrice: '', adminPrice: '', agentPrice: '' },
  ]
}

/** Best-effort parse of a legacy "L x B x H cm" string back into the 3 input fields. */
function parseDimensions(dimensions: string | null | undefined): { length: string; breadth: string; height: string } | null {
  if (!dimensions) return null
  const match = dimensions.trim().match(/^(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*cm$/i)
  if (!match) return null
  return { length: match[1], breadth: match[2], height: match[3] }
}

/** Composes the 3 input fields back into a single "L x B x H cm" string for storage. */
function composeDimensions(length: string, breadth: string, height: string): string | undefined {
  const parts = [length, breadth, height].filter((p) => p.trim())
  if (parts.length === 0) return undefined
  return `${parts.join(' x ')} cm`
}

function cartesian<T>(arrays: T[][]): T[][] {
  if (!arrays.length) return []
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((combo) => arr.map((val) => [...combo, val])), [[]])
}

function Field({ label, required, hint, action, children }: {
  label: string; required?: boolean; hint?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[13px] font-[600] font-public-sans text-primary">
          {label}{required && <span className="text-error ml-0.5">*</span>}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[12px] font-public-sans text-muted-text">{hint}</p>}
    </div>
  )
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border-warm rounded p-6 space-y-5">
      <div className="pb-3 border-b border-border-warm">
        <h2 className="text-[16px] font-[600] font-public-sans text-primary">{title}</h2>
        {subtitle && <p className="text-[12px] font-public-sans text-muted-text mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function SellerSearchSelect({ sellers, value, onChange }: {
  sellers: { id: string; businessName: string; contactName: string }[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const selected = sellers.find((s) => s.id === value)
  const q = query.trim().toLowerCase()
  const filtered = q
    ? sellers.filter((s) => s.businessName.toLowerCase().includes(q) || s.contactName.toLowerCase().includes(q))
    : sellers

  function select(id: string) {
    onChange(id)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={INPUT_CLS + ' flex items-center justify-between gap-2 text-left'}
      >
        <span className={`truncate ${selected ? 'text-primary' : 'text-muted-text/40'}`}>
          {selected ? selected.businessName : 'Select a seller…'}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-30 w-full bg-surface border border-border-warm rounded shadow-lg overflow-hidden">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sellers…"
            className="w-full h-9 px-3 text-[13px] font-public-sans text-primary placeholder:text-muted-text/40 border-b border-border-warm focus:outline-none"
          />
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[13px] font-public-sans text-muted-text">No sellers match.</p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => select(s.id)}
                  className={`w-full text-left px-3 py-2 text-[13px] font-public-sans transition-colors ${
                    value === s.id ? 'bg-primary text-white' : 'text-primary hover:bg-muted-bg/60'
                  }`}
                >
                  {s.businessName}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function PolishButton({ loading, canUndo, disabled, onPolish, onUndo }: {
  loading: boolean; canUndo: boolean; disabled?: boolean; onPolish: () => void; onUndo: () => void
}) {
  if (canUndo) {
    return (
      <button type="button" onClick={onUndo} disabled={disabled}
        className="inline-flex items-center gap-1 text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary transition-colors shrink-0 disabled:opacity-40">
        <RotateCcw size={11} />Undo
      </button>
    )
  }
  return (
    <button type="button" onClick={onPolish} disabled={loading || disabled}
      className="inline-flex items-center gap-1 text-[12px] font-[500] font-public-sans text-accent hover:opacity-70 transition-opacity disabled:opacity-40 shrink-0">
      {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
      {loading ? 'Polishing…' : 'Polish'}
    </button>
  )
}

// adminPrice/agentPrice only ever get filled in for mode==='admin-create' (the
// TierTable's showAdminPricing prop) — every other mode leaves them blank strings
// and never sends them, matching that pricing for an already-submitted product only
// ever changes via the dedicated Edit Pricing / pricing-change-approval flows.
interface TierRow { id: string; moq: string; sellerPrice: string; adminPrice: string; agentPrice: string }

function TierTable({ tiers, onAdd, onRemove, onUpdate, disabled, showAdminPricing }: {
  tiers: TierRow[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: 'moq' | 'sellerPrice' | 'adminPrice' | 'agentPrice', value: string) => void
  disabled?: boolean
  showAdminPricing?: boolean
}) {
  return (
    <div className="space-y-2">
      {tiers.length > 0 && (
        <div className="rounded border border-border-warm overflow-hidden">
          <table className="w-full text-[13px] font-public-sans">
            <thead>
              <tr className="bg-muted-bg/40 border-b border-border-warm">
                <th className="text-left py-2 px-3 font-[600] text-muted-text">Min Order Qty</th>
                <th className="text-left py-2 px-3 font-[600] text-muted-text">Price per unit (₹)</th>
                {showAdminPricing && (
                  <>
                    <th className="text-left py-2 px-3 font-[600] text-muted-text">Buyer Price (₹)</th>
                    <th className="text-left py-2 px-3 font-[600] text-muted-text">Agent Price (₹)</th>
                  </>
                )}
                <th className="py-2 px-2 w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border-warm">
              {tiers.map((tier) => (
                <tr key={tier.id}>
                  <td className="px-3 py-1.5">
                    <input type="number" value={tier.moq} min="1" disabled={disabled}
                      onChange={(e) => onUpdate(tier.id, 'moq', e.target.value)}
                      placeholder="e.g. 50" className={INPUT_CLS + ' h-8'} />
                  </td>
                  <td className="px-3 py-1.5">
                    <input type="number" value={tier.sellerPrice} min="0" step="0.01" disabled={disabled}
                      onChange={(e) => onUpdate(tier.id, 'sellerPrice', e.target.value)}
                      placeholder="e.g. 400" className={INPUT_CLS + ' h-8'} />
                  </td>
                  {showAdminPricing && (
                    <>
                      <td className="px-3 py-1.5">
                        <input type="number" value={tier.adminPrice} min="0" step="0.01" disabled={disabled}
                          onChange={(e) => onUpdate(tier.id, 'adminPrice', e.target.value)}
                          placeholder="e.g. 550" className={INPUT_CLS + ' h-8'} />
                      </td>
                      <td className="px-3 py-1.5">
                        <input type="number" value={tier.agentPrice} min="0" step="0.01" disabled={disabled}
                          onChange={(e) => onUpdate(tier.id, 'agentPrice', e.target.value)}
                          placeholder="e.g. 480" className={INPUT_CLS + ' h-8'} />
                      </td>
                    </>
                  )}
                  <td className="px-2 py-1.5 text-center">
                    {!disabled && (
                      <button type="button" onClick={() => onRemove(tier.id)}
                        className="text-muted-text hover:text-error transition-colors" aria-label="Remove tier">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!disabled && (
        <button type="button" onClick={onAdd}
          className="inline-flex items-center gap-1 text-[12px] font-[500] font-public-sans text-muted-text hover:text-primary transition-colors">
          <Plus size={12} />Add price tier
        </button>
      )}
    </div>
  )
}

type Axis = 'size' | 'color' | 'material' | 'other'

interface VariantCombo { key: string; label: string; attributes: { name: string; value: string }[] }
// Stock isn't set per variant — every variant uses the single Declared Stock value from Trade Terms.
interface VariantPricing { sku: string; tiers: TierRow[] }

function AxisTagInput({ values, onChange, placeholder, disabled }: {
  values: string[]; onChange: (v: string[]) => void; placeholder: string; disabled?: boolean
}) {
  const [input, setInput] = useState('')
  function add() {
    const v = input.trim()
    if (!v || values.includes(v)) return
    onChange([...values, v])
    setInput('')
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {values.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border-warm bg-muted-bg/30 text-[13px] font-public-sans text-primary">
          {v}
          {!disabled && (
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}
              className="text-muted-text hover:text-error transition-colors" aria-label={`Remove ${v}`}>
              <X size={11} />
            </button>
          )}
        </span>
      ))}
      {!disabled && (
        <div className="flex items-center gap-1">
          <input type="text" value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder}
            className="h-8 px-2 w-28 rounded border border-dashed border-border-warm bg-transparent text-[13px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors" />
          <button type="button" onClick={add}
            className="h-8 w-8 flex items-center justify-center rounded border border-border-warm text-muted-text hover:text-primary hover:bg-muted-bg transition-colors">
            <Plus size={13} />
          </button>
        </div>
      )}
    </div>
  )
}

interface ProductFormProps {
  /** Omit for a create flow (seller-submit or admin-create); pass the loaded product to edit it. */
  product?: MyProduct | AdminProduct
  /**
   * 'seller' (default): the seller portal's create/edit flow. Once a product is
   * APPROVED, everything stays editable, but pricing/variants get staged for admin
   * re-review instead of applying directly — the pricing section itself locks while
   * one is already pending.
   * 'admin-edit': admin's full-detail edit of an EXISTING product — nothing is ever
   * staged (admin already mutates approved+published products elsewhere: pricing,
   * category, publish/feature), no create/resubmit path, and saving redirects back
   * to the admin product detail page instead.
   * 'admin-create': admin creates a brand-new product directly — on behalf of a real
   * seller or as admin's own (house) inventory — setting sellerPrice AND adminPrice
   * (buyer price) AND agentPrice per tier right here, skipping PENDING review
   * entirely (the product publishes immediately).
   */
  mode?: 'seller' | 'admin-edit' | 'admin-create'
}

/** Groups legacy (pre-SKU-system) variants by whether they can be safely reconstructed into axis tag lists. */
function hydrateVariants(variants: ProductVariant[] | undefined) {
  const all = variants ?? []
  const rich = all.filter((v) => v.sku)
  if (rich.length === 0 || rich.length !== all.length) {
    // Mixed or all-legacy — too ambiguous to safely reconstruct into combos (a legacy
    // variant list is an independent set of options, not one to cross-multiply).
    return { size: [] as string[], color: [] as string[], material: [] as string[], customAxisName: '', customValues: [] as string[], pricing: {} as Record<string, VariantPricing>, legacy: all }
  }

  const size = new Set<string>()
  const color = new Set<string>()
  const material = new Set<string>()
  const other = new Set<string>()
  let customAxisName = ''
  const pricing: Record<string, VariantPricing> = {}

  for (const v of rich) {
    const attrs = v.attributes?.length ? v.attributes : [{ name: v.type, value: v.value }]
    const key = attrs.map((a) => a.value).join('__')
    for (const a of attrs) {
      const lower = a.name.toLowerCase()
      if (lower === 'size') size.add(a.value)
      else if (lower === 'color') color.add(a.value)
      else if (lower === 'material') material.add(a.value)
      else { other.add(a.value); customAxisName = a.name }
    }
    pricing[key] = {
      sku: v.sku ?? '',
      tiers: (v.priceTiers ?? []).map((t) => ({
        id: uid(), moq: String(t.moq), sellerPrice: String(t.sellerPrice), adminPrice: '', agentPrice: '',
      })),
    }
  }

  return {
    size: Array.from(size), color: Array.from(color), material: Array.from(material),
    customAxisName, customValues: Array.from(other), pricing, legacy: [] as ProductVariant[],
  }
}

export function ProductForm({ product, mode = 'seller' }: ProductFormProps) {
  const router = useRouter()
  const { data: tree = [] } = useCategoryTree()
  const isAdminMode = mode !== 'seller'
  const isAdminCreate = mode === 'admin-create'

  const submitMutation = useSubmitProduct()
  const sellerUpdateMutation = useUpdateMyProduct()
  const adminUpdateMutation = useAdminUpdateProduct()
  const adminCreateMutation = useAdminCreateProduct()
  const updateMutation = mode === 'admin-edit' ? adminUpdateMutation : sellerUpdateMutation
  const resubmitMutation = useResubmitProduct()
  const polishMutation = usePolishField()

  const isEdit = !!product
  const isApproved = product?.approvalStatus === 'APPROVED'
  const isRejected = product?.approvalStatus === 'REJECTED'
  const pendingPricingChange = product?.pendingPricingChange ?? null
  // Once a product is APPROVED (live to buyers), a seller can still edit everything —
  // but pricing/variants specifically get staged for admin re-review instead of
  // applying directly, so the pricing section itself locks while one is already
  // pending (admin mode has no such restriction — it never stages anything).
  const pricingLocked = !isAdminMode && isApproved && !!pendingPricingChange
  const backHref = mode === 'seller' ? '/portal/products' : product ? `/admin/products/${product.id}` : '/admin/products'

  // ── Admin-create only: which seller this product is attributed to ──────────
  const [sellerMode, setSellerMode] = useState<'existing' | 'house'>('existing')
  const [selectedSellerId, setSelectedSellerId] = useState('')
  const { data: sellersPage } = useAdminSellers({ limit: 100, enabled: isAdminCreate })
  const sellers = sellersPage?.items ?? []

  // ── Core details ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '') // create-only, see below
  const [materials, setMaterials] = useState(product?.materials ?? '')
  const [tags, setTags] = useState(product?.tags?.length ? product.tags.join(', ') : '')
  const parsedDimensions = useMemo(() => parseDimensions(product?.dimensions), [product])
  const [lengthCm, setLengthCm] = useState(parsedDimensions?.length ?? '')
  const [breadthCm, setBreadthCm] = useState(parsedDimensions?.breadth ?? '')
  const [heightCm, setHeightCm] = useState(parsedDimensions?.height ?? '')
  const [weight, setWeight] = useState(product?.weight != null ? String(product.weight) : '')

  // ── Trade terms ──────────────────────────────────────────────────────────────
  // No standalone MOQ/Seller Price fields — pricing always comes from tiers (flat
  // tiers here, or each variant's own tiers when variants are enabled), and the
  // product-level moq/sellerPrice the backend requires are derived from the
  // cheapest tier on save.
  const [declaredStock, setDeclaredStock] = useState(product?.declaredStock != null ? String(product.declaredStock) : '')
  const [leadTime, setLeadTime] = useState(product?.leadTime ?? '')
  const [stepQty, setStepQty] = useState(product?.stepQty != null ? String(product.stepQty) : '1')
  const [priceTiers, setPriceTiers] = useState<TierRow[]>(
    product?.priceTiers?.length
      ? product.priceTiers.map((t) => ({
          id: uid(), moq: String(t.moq), sellerPrice: String(t.sellerPrice), adminPrice: '', agentPrice: '',
        }))
      : defaultTierRows()
  )

  // ── Product attributes / craft story ────────────────────────────────────────
  const [placeOfOrigin, setPlaceOfOrigin] = useState(product?.placeOfOrigin ?? '')
  const [isHandmade, setIsHandmade] = useState(product?.isHandmade ?? false)
  const [isGITagged, setIsGITagged] = useState(product?.isGITagged ?? false)
  const [howItIsMade, setHowItIsMade] = useState(product?.howItIsMade ?? '')
  const [artisanName, setArtisanName] = useState(product?.artisanName ?? '')

  // ── AI polish ────────────────────────────────────────────────────────────────
  type PolishableField = 'name' | 'description' | 'tags'
  const [polishing, setPolishing] = useState<Partial<Record<PolishableField, boolean>>>({})
  const [prevValues, setPrevValues] = useState<Partial<Record<PolishableField, string>>>({})
  const fieldValue: Record<PolishableField, string> = { name, description, tags }
  const fieldSetter: Record<PolishableField, (v: string) => void> = { name: setName, description: setDescription, tags: setTags }

  async function polishField(field: PolishableField) {
    const value = fieldValue[field]
    if (!value.trim()) return
    setPolishing((p) => ({ ...p, [field]: true }))
    try {
      const cleaned = await polishMutation.mutateAsync({ field, value })
      setPrevValues((p) => ({ ...p, [field]: value }))
      fieldSetter[field](cleaned)
    } finally {
      setPolishing((p) => ({ ...p, [field]: false }))
    }
  }
  function undoField(field: PolishableField) {
    const prev = prevValues[field]
    if (prev === undefined) return
    fieldSetter[field](prev)
    setPrevValues((p) => { const n = { ...p }; delete n[field]; return n })
  }

  // ── Images ───────────────────────────────────────────────────────────────────
  const [existingImages, setExistingImages] = useState(product?.images ?? [])
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { openLightbox, lightboxNode } = useImageLightbox()
  const totalImageCount = existingImages.length + newImages.length

  useEffect(() => {
    const urls = newImages.map((f) => URL.createObjectURL(f))
    setNewImagePreviews(urls)
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [newImages])

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    const accepted = Array.from(files).filter((f) => f.type.startsWith('image/'))
    const room = MAX_IMAGES - totalImageCount
    if (room <= 0) {
      toast.error(`You can have at most ${MAX_IMAGES} images.`)
      return
    }
    setNewImages((prev) => [...prev, ...accepted].slice(0, prev.length + room))
  }
  function removeNewImage(idx: number) {
    setNewImages((prev) => prev.filter((_, i) => i !== idx))
  }
  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((img) => img.id !== id))
    setRemoveImageIds((prev) => [...prev, id])
  }

  // ── Variants (Size / Color / Material / Other combo builder) ────────────────
  // Master toggle, mirroring solomon-bharat2: when on, per-variant price tiers are
  // the source of MOQ/Seller Price and the flat Trade Terms pricing is hidden —
  // when off, the flat MOQ/Seller Price/Volume Pricing fields are what's used and
  // no variants are sent at all.
  const hydrated = useMemo(() => hydrateVariants(product?.variants), [product])
  const hadExistingVariants =
    hydrated.size.length > 0 || hydrated.color.length > 0 || hydrated.material.length > 0 ||
    hydrated.customValues.length > 0 || hydrated.legacy.length > 0
  const [variantsEnabled, setVariantsEnabled] = useState(hadExistingVariants)
  const [activeVariantTab, setActiveVariantTab] = useState<Axis>('size')
  const [sizeValues, setSizeValues] = useState<string[]>(hydrated.size)
  const [colorValues, setColorValues] = useState<string[]>(hydrated.color)
  const [materialValues, setMaterialValues] = useState<string[]>(hydrated.material)
  const [customAxisName, setCustomAxisName] = useState(hydrated.customAxisName)
  const [customValues, setCustomValues] = useState<string[]>(hydrated.customValues)
  const [variantPricing, setVariantPricing] = useState<Record<string, VariantPricing>>(hydrated.pricing)
  const legacyVariants = hydrated.legacy

  function toggleVariantsMaster() {
    if (variantsEnabled) {
      setSizeValues([]); setColorValues([]); setMaterialValues([]); setCustomValues([]); setCustomAxisName('')
      setActiveVariantTab('size')
      setVariantPricing({})
    }
    setVariantsEnabled((v) => !v)
  }

  const variantCombos = useMemo((): VariantCombo[] => {
    const axes = [
      { name: 'Size', values: sizeValues },
      { name: 'Color', values: colorValues },
      { name: 'Material', values: materialValues },
      { name: customAxisName.trim() || 'Other', values: customValues },
    ].filter((a) => a.values.length > 0)
    if (axes.length === 0) return []
    return cartesian(axes.map((a) => a.values)).map((combo) => ({
      key: combo.join('__'),
      label: combo.join(' / '),
      attributes: axes.map((a, i) => ({ name: a.name, value: combo[i] })),
    }))
  }, [sizeValues, colorValues, materialValues, customValues, customAxisName])

  // A combo with no entry yet in `variantPricing` gets the same 2 blank-price
  // starter tiers as the flat table — deterministic ids keep them stable across
  // renders without needing a ref or effect — and are only committed to real state
  // on the seller's first edit; existing combos are never touched by this.
  function getDefaultVP(key: string): VariantPricing {
    return { sku: '', tiers: defaultComboTierRows(key) }
  }

  function getVP(combo: VariantCombo): VariantPricing {
    return variantPricing[combo.key] ?? getDefaultVP(combo.key)
  }
  function autoSku(combo: VariantCombo): string {
    const prefix = name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toUpperCase().slice(0, 12) || 'PROD'
    return `${prefix}-${combo.key.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}`
  }
  function setVPSku(key: string, value: string) {
    setVariantPricing((p) => ({ ...p, [key]: { ...(p[key] ?? getDefaultVP(key)), sku: value } }))
  }
  function addVPTier(key: string) {
    setVariantPricing((p) => {
      const vp = p[key] ?? getDefaultVP(key)
      return { ...p, [key]: { ...vp, tiers: [...vp.tiers, { id: uid(), moq: '', sellerPrice: '', adminPrice: '', agentPrice: '' }] } }
    })
  }
  function removeVPTier(key: string, tierId: string) {
    setVariantPricing((p) => {
      const vp = p[key] ?? getDefaultVP(key)
      return { ...p, [key]: { ...vp, tiers: vp.tiers.filter((t) => t.id !== tierId) } }
    })
  }
  function updateVPTier(key: string, tierId: string, field: 'moq' | 'sellerPrice' | 'adminPrice' | 'agentPrice', value: string) {
    setVariantPricing((p) => {
      const vp = p[key] ?? getDefaultVP(key)
      return { ...p, [key]: { ...vp, tiers: vp.tiers.map((t) => (t.id === tierId ? { ...t, [field]: value } : t)) } }
    })
  }

  function validTiersFor(combo: VariantCombo): TierRow[] {
    return getVP(combo).tiers.filter((t) => Number(t.moq) > 0 && Number(t.sellerPrice) > 0)
  }

  function buildVariantPayload(): SubmitVariantInput[] {
    // Stock and price/moq aren't stored per variant — stock always uses the single
    // Declared Stock value above, and price/moq live solely in each variant's own
    // priceTiers (its cheapest tier is used wherever "the" price is needed).
    return variantCombos.map((combo) => {
      const vp = getVP(combo)
      const validTiers = [...validTiersFor(combo)].sort((a, b) => Number(a.sellerPrice) - Number(b.sellerPrice))
      const primary = combo.attributes[0]
      return {
        type: primary.name,
        value: primary.value,
        sku: vp.sku.trim() || autoSku(combo),
        attributes: combo.attributes,
        priceTiers: validTiers.length
          ? validTiers.map((t) => ({
              moq: Number(t.moq),
              sellerPrice: Number(t.sellerPrice),
              ...(isAdminCreate ? {
                adminPrice: t.adminPrice ? Number(t.adminPrice) : undefined,
                agentPrice: t.agentPrice ? Number(t.agentPrice) : undefined,
              } : {}),
            }))
          : undefined,
      }
    })
  }

  /** Derives the product-level MOQ/Seller Price the backend requires from the
   *  cheapest tier — each variant's own tiers when variants are enabled, or the
   *  flat Volume Pricing tiers otherwise. There's no standalone MOQ/Seller Price
   *  field anymore; pricing always lives in a tier. */
  function computeBasePricing(): { moq: number; sellerPrice: number } | null {
    if (variantsEnabled) {
      if (variantCombos.length === 0) return null
      const cheapestPerCombo: (TierRow | undefined)[] = variantCombos.map(
        (combo) => [...validTiersFor(combo)].sort((a, b) => Number(a.sellerPrice) - Number(b.sellerPrice))[0]
      )
      if (cheapestPerCombo.some((t) => !t)) return null
      const valid = cheapestPerCombo as TierRow[]
      const cheapest = valid.reduce((min, t) => (Number(t.sellerPrice) < Number(min.sellerPrice) ? t : min))
      return { moq: Number(cheapest.moq), sellerPrice: Number(cheapest.sellerPrice) }
    }
    const validFlatTiers = priceTiers.filter((t) => Number(t.moq) > 0 && Number(t.sellerPrice) > 0)
    if (!validFlatTiers.length) return null
    const cheapest = [...validFlatTiers].sort((a, b) => Number(a.sellerPrice) - Number(b.sellerPrice))[0]
    return { moq: Number(cheapest.moq), sellerPrice: Number(cheapest.sellerPrice) }
  }

  // ── Base price tiers ─────────────────────────────────────────────────────────
  function addTier() { setPriceTiers((prev) => [...prev, { id: uid(), moq: '', sellerPrice: '', adminPrice: '', agentPrice: '' }]) }
  function removeTier(id: string) { setPriceTiers((prev) => prev.filter((t) => t.id !== id)) }
  function updateTier(id: string, field: 'moq' | 'sellerPrice' | 'adminPrice' | 'agentPrice', value: string) {
    setPriceTiers((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  // ── Listing score (informational only — admin review is the real quality gate) ──
  const scoreInput = useMemo(() => ({
    name, description, categoryId, tags, weight, placeOfOrigin, howItIsMade, artisanName,
    imageCount: totalImageCount,
    hasPricing: variantsEnabled
      ? variantCombos.length > 0 && variantCombos.every((c) => validTiersFor(c).length > 0)
      : priceTiers.some((t) => Number(t.moq) > 0 && Number(t.sellerPrice) > 0),
  // eslint-disable-next-line react-hooks/exhaustive-deps -- validTiersFor reads variantPricing, already listed
  }), [name, description, categoryId, tags, weight, placeOfOrigin, howItIsMade, artisanName, totalImageCount, priceTiers, variantsEnabled, variantCombos, variantPricing])

  // ── Validation + submit ──────────────────────────────────────────────────────
  function validate(): string | null {
    if (!name.trim()) return 'Product name is required.'
    if (!description.trim()) return 'Description is required.'
    if (!isEdit && !categoryId) return 'Select a category — all 3 levels.'
    if (!materials.trim()) return 'Materials is required.'
    if (!isEdit && (!weight || Number(weight) <= 0)) return 'Weight must be a positive number (kg).'
    if (!declaredStock || Number(declaredStock) < 0) return 'Declared stock must be 0 or more.'
    if (totalImageCount < MIN_IMAGES || totalImageCount > MAX_IMAGES) {
      return `Upload between ${MIN_IMAGES} and ${MAX_IMAGES} images (currently ${totalImageCount}).`
    }

    if (variantsEnabled) {
      if (variantCombos.length === 0) return 'Add at least one size, color, material, or other value, or turn off variants.'
      const uncosted = variantCombos.find((combo) => validTiersFor(combo).length === 0)
      if (uncosted) return `Set a price for "${uncosted.label}".`
    } else {
      const hasPricedTier = priceTiers.some((t) => Number(t.moq) > 0 && Number(t.sellerPrice) > 0)
      if (!hasPricedTier) return 'Set a price for at least one MOQ tier.'
    }

    if (isAdminCreate) {
      if (sellerMode === 'existing' && !selectedSellerId) return 'Select a seller.'
      const hasBuyerPrice = variantsEnabled
        ? variantCombos.some((combo) => validTiersFor(combo).some((t) => Number(t.adminPrice) > 0))
        : priceTiers.some((t) => Number(t.adminPrice) > 0)
      if (!hasBuyerPrice) return 'Set a Buyer Price for at least one tier.'
    }
    return null
  }

  function buildPayload() {
    const basePricing = computeBasePricing()
    return {
      name: name.trim(),
      description: description.trim(),
      materials: materials.trim(),
      dimensions: composeDimensions(lengthCm, breadthCm, heightCm),
      weight: weight ? Number(weight) : undefined,
      // validate() already guarantees a priced tier exists (flat or per-variant)
      // before submit is reachable, so basePricing is never null here in practice.
      moq: basePricing?.moq ?? 0,
      declaredStock: Number(declaredStock),
      sellerPrice: basePricing?.sellerPrice ?? 0,
      leadTime: leadTime.trim() || undefined,
      stepQty: Number(stepQty) || 1,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      placeOfOrigin: placeOfOrigin.trim() || undefined,
      isHandmade,
      isGITagged,
      howItIsMade: howItIsMade.trim() || undefined,
      artisanName: artisanName.trim() || undefined,
      // Volume tiers only apply to the flat price — per-variant tiers are what's used instead
      // once variants are enabled (mirrors solomon-bharat2 hiding this table in that mode).
      priceTiers: variantsEnabled
        ? []
        : priceTiers
            .filter((t) => Number(t.moq) > 0 && Number(t.sellerPrice) > 0)
            .map((t) => ({
              moq: Number(t.moq),
              sellerPrice: Number(t.sellerPrice),
              ...(isAdminCreate ? {
                adminPrice: t.adminPrice ? Number(t.adminPrice) : undefined,
                agentPrice: t.agentPrice ? Number(t.agentPrice) : undefined,
              } : {}),
            })),
      variants: variantsEnabled ? buildVariantPayload() : [],
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const error = validate()
    if (error) { toast.error(error); return }

    if (isAdminCreate) {
      adminCreateMutation.mutate(
        {
          ...buildPayload(),
          categoryId,
          images: newImages,
          sellerMode,
          sellerId: sellerMode === 'existing' ? selectedSellerId : undefined,
        },
        { onSuccess: (created) => router.push(`/admin/products/${created.id}`) }
      )
      return
    }

    if (isEdit && product) {
      updateMutation.mutate(
        {
          id: product.id,
          data: {
            ...buildPayload(),
            images: newImages.length ? newImages : undefined,
            removeImageIds: removeImageIds.length ? removeImageIds : undefined,
          },
        },
        { onSuccess: () => router.push(backHref) }
      )
    } else {
      submitMutation.mutate(
        { ...buildPayload(), categoryId, images: newImages },
        { onSuccess: () => router.push(backHref) }
      )
    }
  }

  async function handleResubmit() {
    if (!product) return
    const error = validate()
    if (error) { toast.error(error); return }
    try {
      await updateMutation.mutateAsync({
        id: product.id,
        data: {
          ...buildPayload(),
          images: newImages.length ? newImages : undefined,
          removeImageIds: removeImageIds.length ? removeImageIds : undefined,
        },
      })
      await resubmitMutation.mutateAsync(product.id)
      router.push(backHref)
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const saving = submitMutation.isPending || updateMutation.isPending || resubmitMutation.isPending || adminCreateMutation.isPending

  return (
    <form onSubmit={handleSave} noValidate>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="space-y-6">

        {isAdminCreate && (
          <Section title="Seller">
            <div className="flex gap-2">
              <button type="button" onClick={() => setSellerMode('existing')}
                className={`flex-1 h-10 rounded border text-[13px] font-[600] font-public-sans transition-colors ${sellerMode === 'existing' ? 'border-primary bg-primary text-white' : 'border-border-warm text-primary hover:border-primary'}`}>
                On behalf of an existing seller
              </button>
              <button type="button" onClick={() => setSellerMode('house')}
                className={`flex-1 h-10 rounded border text-[13px] font-[600] font-public-sans transition-colors ${sellerMode === 'house' ? 'border-primary bg-primary text-white' : 'border-border-warm text-primary hover:border-primary'}`}>
                My own product
              </button>
            </div>

            {sellerMode === 'existing' && (
              <Field label="Seller" required>
                <SellerSearchSelect sellers={sellers} value={selectedSellerId} onChange={setSelectedSellerId} />
              </Field>
            )}
          </Section>
        )}

        {!isAdminMode && isApproved && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded border border-border-warm bg-muted-bg/60">
            <AlertTriangle size={16} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              {pendingPricingChange ? (
                <>
                  <p className="text-[13px] font-[600] font-public-sans text-primary">Pricing change awaiting review</p>
                  <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                    A pricing/variant update for this product is pending admin approval — buyers still see the
                    current pricing until it&apos;s reviewed. Other edits below still save immediately.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] font-[600] font-public-sans text-primary">This product is live</p>
                  <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                    Edits here save immediately, except changes to pricing or variants — those need admin approval
                    before they go live.
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {isRejected && product?.rejectionReason && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded border border-error/30 bg-error/5">
            <AlertTriangle size={16} className="text-error shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-[600] font-public-sans text-error">Rejected — reason from Solomon Bharat</p>
              <p className="text-[13px] font-public-sans text-primary mt-0.5">{product.rejectionReason}</p>
            </div>
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-[600] font-public-sans text-muted-text uppercase tracking-[0.05em]">Status</span>
            <ApprovalStatusBadge status={product!.approvalStatus} />
          </div>
        )}

        {/* ── Photos ──────────────────────────────────────────────────────── */}
        <Section title="Photos">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = '' }}
          />
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border-warm rounded p-6 flex flex-col items-center gap-2 text-center cursor-pointer hover:border-accent hover:bg-accent/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-muted-bg flex items-center justify-center">
              <Upload size={18} className="text-muted-text" />
            </div>
            <p className="text-[14px] font-[500] font-public-sans text-primary">Click or drag photos here</p>
            <p className="text-[12px] font-public-sans text-muted-text">{MIN_IMAGES}–{MAX_IMAGES} images · JPG, PNG or WebP</p>
          </div>
          {(existingImages.length > 0 || newImages.length > 0) && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {existingImages.map((img, i) => (
                <div key={img.id} className="relative group aspect-square rounded overflow-hidden border border-border-warm bg-muted-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={cloudinaryFill(img.url, 400, 400)}
                    alt=""
                    onClick={() => openLightbox(img.url, 'Product image')}
                    className="w-full h-full object-contain cursor-zoom-in"
                  />
                  <button type="button" onClick={() => removeExistingImage(img.id)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image">
                    <X size={12} />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[10px] font-[600] font-public-sans bg-black/60 text-white px-1.5 py-0.5 rounded">Cover</span>
                  )}
                </div>
              ))}
              {newImages.map((_file, i) => (
                <div key={`new-${i}`} className="relative group aspect-square rounded overflow-hidden border border-border-warm bg-muted-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newImagePreviews[i]} alt="" className="w-full h-full object-contain" />
                  <button type="button" onClick={() => removeNewImage(i)}
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Remove image">
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] font-public-sans text-muted-text">
            {totalImageCount}/{MAX_IMAGES} selected — minimum {MIN_IMAGES} required
          </p>
        </Section>

        {/* ── Core details ────────────────────────────────────────────────── */}
        <Section title="Core Details">
          <Field label="Product Name" required
            action={<PolishButton loading={!!polishing.name} canUndo={!!prevValues.name} onPolish={() => polishField('name')} onUndo={() => undoField('name')} />}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Hand-Block Printed Cotton Table Runner" maxLength={200} className={INPUT_CLS} />
          </Field>

          <Field label="Description" required
            action={<PolishButton loading={!!polishing.description} canUndo={!!prevValues.description} onPolish={() => polishField('description')} onUndo={() => undoField('description')} />}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)}
              rows={5} placeholder="Describe the product — craftsmanship, use case, care instructions…" className={TEXTAREA_CLS} />
          </Field>

          <Field label="Category" required hint={isEdit ? 'Category can’t be changed after submission.' : 'Choose all 3 levels.'}>
            {isEdit ? (
              <p className="text-[14px] font-public-sans text-primary px-3 py-2.5 rounded border border-border-warm bg-muted-bg/30">
                {categoryPathLabel(tree, product?.categoryId)}
              </p>
            ) : (
              <CategoryCascadeSelect tree={tree} value={categoryId} onChange={setCategoryId} />
            )}
          </Field>

          <Field label="Materials" required>
            <input type="text" value={materials} onChange={(e) => setMaterials(e.target.value)}
              placeholder="e.g. 100% cotton, brass hardware" className={INPUT_CLS} />
          </Field>

          <Field label="Tags" hint="Comma-separated, up to 10"
            action={<PolishButton loading={!!polishing.tags} canUndo={!!prevValues.tags} onPolish={() => polishField('tags')} onUndo={() => undoField('tags')} />}>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="handmade, cotton, block print" className={INPUT_CLS} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Weight (kg)" required={!isEdit}>
              <input type="number" min="0" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)}
                placeholder="e.g. 0.4" className={INPUT_CLS} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Length (cm)">
              <input type="number" min="0" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)}
                placeholder="e.g. 30" className={INPUT_CLS} />
            </Field>
            <Field label="Breadth (cm)">
              <input type="number" min="0" value={breadthCm} onChange={(e) => setBreadthCm(e.target.value)}
                placeholder="e.g. 20" className={INPUT_CLS} />
            </Field>
            <Field label="Height (cm)">
              <input type="number" min="0" value={heightCm} onChange={(e) => setHeightCm(e.target.value)}
                placeholder="e.g. 10" className={INPUT_CLS} />
            </Field>
          </div>
          {isEdit && product?.dimensions && !parsedDimensions && (
            <p className="text-[12px] font-public-sans text-muted-text">Previously recorded as: {product.dimensions}</p>
          )}
        </Section>

        {/* ── Variants ─────────────────────────────────────────────────────── */}
        <div className="bg-surface border border-border-warm rounded p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-[600] font-public-sans text-primary">Variants</h2>
              <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                Does this product come in different sizes, colors, materials, or other options?
              </p>
            </div>
            <button type="button" role="switch" aria-checked={variantsEnabled} aria-label="Toggle variants" disabled={pricingLocked}
              onClick={toggleVariantsMaster}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${variantsEnabled ? 'bg-primary' : 'bg-border-warm'}`}>
              <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${variantsEnabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>

          {variantsEnabled && (
            <div className="space-y-4 pt-4 border-t border-border-warm">
              {legacyVariants.length > 0 && variantCombos.length === 0 && (
                <div className="px-3 py-2.5 rounded border border-border-warm bg-muted-bg/40">
                  <p className="text-[12px] font-public-sans text-muted-text">
                    Existing options: {legacyVariants.map((v) => `${v.type}: ${v.value}`).join(', ')}.
                    Add variants below to replace them with priced options.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                {(['size', 'color', 'material', 'other'] as const).map((axis) => {
                  const count = { size: sizeValues.length, color: colorValues.length, material: materialValues.length, other: customValues.length }[axis]
                  const label = axis === 'other' ? 'Other' : axis[0].toUpperCase() + axis.slice(1)
                  return (
                    <button key={axis} type="button" onClick={() => setActiveVariantTab(axis)}
                      className={`flex items-center gap-2 px-4 h-9 rounded border text-[13px] font-[500] font-public-sans transition-colors ${activeVariantTab === axis ? 'border-primary bg-primary text-white' : 'border-border-warm text-muted-text hover:border-primary hover:text-primary'}`}>
                      {label}
                      {count > 0 && (
                        <span className={`text-[11px] font-[600] px-1.5 py-0.5 rounded-full ${activeVariantTab === axis ? 'bg-white/20' : 'bg-muted-bg'}`}>{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {activeVariantTab === 'size' && (
                <div className="space-y-2">
                  <p className="text-[12px] font-public-sans text-muted-text">e.g. S, M, L, XL, Free Size — press Enter or click + to add</p>
                  <AxisTagInput values={sizeValues} onChange={setSizeValues} placeholder="Add size…" disabled={pricingLocked} />
                </div>
              )}
              {activeVariantTab === 'color' && (
                <div className="space-y-2">
                  <p className="text-[12px] font-public-sans text-muted-text">e.g. Red, Navy Blue, Ivory — press Enter or click + to add</p>
                  <AxisTagInput values={colorValues} onChange={setColorValues} placeholder="Add color…" disabled={pricingLocked} />
                </div>
              )}
              {activeVariantTab === 'material' && (
                <div className="space-y-2">
                  <p className="text-[12px] font-public-sans text-muted-text">e.g. Cotton, Brass, Terracotta — press Enter or click + to add</p>
                  <AxisTagInput values={materialValues} onChange={setMaterialValues} placeholder="Add material…" disabled={pricingLocked} />
                </div>
              )}
              {activeVariantTab === 'other' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-[500] font-public-sans text-primary">Attribute name</label>
                    <input type="text" value={customAxisName} onChange={(e) => setCustomAxisName(e.target.value)} disabled={pricingLocked}
                      placeholder="e.g. Fragrance, Pattern, Finish" className="h-9 px-3 w-full max-w-xs rounded border border-border-warm bg-muted-bg/30 text-[13px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors disabled:opacity-50" />
                  </div>
                  <p className="text-[12px] font-public-sans text-muted-text">e.g. Sandalwood, Rose — press Enter or click + to add</p>
                  <AxisTagInput values={customValues} onChange={setCustomValues} placeholder="Add value…" disabled={pricingLocked} />
                </div>
              )}

              {variantCombos.length > 0 && (
                <div className="space-y-4 pt-1">
                  <p className="text-[12px] font-public-sans text-muted-text">
                    Set a SKU (optional) for each variant, then edit the MOQs, add more tiers, or fill in
                    a price for each. Stock uses the Declared Stock value below for every variant.
                  </p>
                  {variantCombos.map((combo) => {
                    const vp = getVP(combo)
                    return (
                      <div key={combo.key} className="rounded border border-border-warm overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted-bg/40 px-3 py-2 border-b border-border-warm">
                          <span className="text-[13px] font-[600] font-public-sans text-primary">{combo.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-public-sans text-muted-text">SKU</span>
                            <input type="text" value={vp.sku} disabled={pricingLocked}
                              onChange={(e) => setVPSku(combo.key, e.target.value)}
                              placeholder={autoSku(combo)}
                              className="w-40 h-7 px-2 rounded border border-border-warm bg-surface text-[12px] font-public-sans text-primary focus:outline-none focus:border-accent transition-colors disabled:opacity-50" />
                          </div>
                        </div>
                        <div className="p-3">
                          <TierTable
                            tiers={vp.tiers}
                            onAdd={() => addVPTier(combo.key)}
                            onRemove={(tierId) => removeVPTier(combo.key, tierId)}
                            onUpdate={(tierId, field, value) => updateVPTier(combo.key, tierId, field, value)}
                            disabled={pricingLocked}
                            showAdminPricing={isAdminCreate}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Trade terms ─────────────────────────────────────────────────── */}
        <Section
          title="Trade Terms"
          subtitle={variantsEnabled
            ? 'Per-variant pricing is set above. Configure stock, order step, and lead time here.'
            : undefined}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Declared Stock" required hint="Self-reported — not system-tracked. Used for every variant too.">
              <input type="number" min="0" value={declaredStock} onChange={(e) => setDeclaredStock(e.target.value)}
                placeholder="e.g. 500" className={INPUT_CLS} />
            </Field>
            <Field label="Order Step (units)" hint="Buyers order in multiples of this">
              <input type="number" min="1" value={stepQty} onChange={(e) => setStepQty(e.target.value)}
                placeholder="e.g. 1" className={INPUT_CLS} />
            </Field>
          </div>

          {!variantsEnabled && (
            <Field label="Volume Pricing" required hint="What Solomon Bharat pays you per unit at each order quantity. Edit the MOQs, add more tiers, or fill in a price for each.">
              <TierTable tiers={priceTiers} onAdd={addTier} onRemove={removeTier} onUpdate={updateTier} disabled={pricingLocked} showAdminPricing={isAdminCreate} />
            </Field>
          )}

          <Field label="Lead Time" hint="Pick a preset or type your own.">
            <div className="flex flex-wrap gap-2 mb-2">
              {LEAD_TIME_PRESETS.map((preset) => (
                <button key={preset} type="button" onClick={() => setLeadTime(preset)}
                  className={`px-3 h-8 rounded border text-[12px] font-[500] font-public-sans transition-colors disabled:opacity-50 ${leadTime === preset ? 'border-primary bg-primary text-white' : 'border-border-warm text-muted-text hover:border-primary hover:text-primary'}`}>
                  {preset}
                </button>
              ))}
            </div>
            <input type="text" value={leadTime} onChange={(e) => setLeadTime(e.target.value)}
              placeholder="e.g. 2–3 weeks" className={INPUT_CLS} />
          </Field>
        </Section>

        {/* ── Product Attributes ─────────────────────────────────────────────── */}
        <Section title="Product Attributes">
          <Field label="Place of Origin" hint="State or region">
            <input type="text" value={placeOfOrigin} onChange={(e) => setPlaceOfOrigin(e.target.value)}
              placeholder="e.g. Jaipur, Rajasthan" className={INPUT_CLS} />
          </Field>
          <div className="flex flex-col gap-4 pt-1">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-[14px] font-[500] font-public-sans text-primary">Handmade</p>
                <p className="text-[12px] font-public-sans text-muted-text">Crafted by hand, not machine-made</p>
              </div>
              <button type="button" role="switch" aria-checked={isHandmade}
                onClick={() => setIsHandmade((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${isHandmade ? 'bg-primary' : 'bg-border-warm'}`}>
                <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${isHandmade ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </label>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-[14px] font-[500] font-public-sans text-primary">GI Tagged</p>
                <p className="text-[12px] font-public-sans text-muted-text">Has a Geographical Indication tag</p>
              </div>
              <button type="button" role="switch" aria-checked={isGITagged}
                onClick={() => setIsGITagged((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${isGITagged ? 'bg-primary' : 'bg-border-warm'}`}>
                <span className={`inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${isGITagged ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </label>
          </div>
        </Section>

        {/* ── How It's Made ──────────────────────────────────────────────────── */}
        <Section title="How It's Made">
          <Field label="Craft Process" hint="Describe the making process — materials, techniques, time taken. Aim for 20+ words.">
            <textarea value={howItIsMade} onChange={(e) => setHowItIsMade(e.target.value)}
              placeholder="e.g. This table runner is hand-woven on a traditional pit loom using organic cotton yarn…"
              rows={4} className={TEXTAREA_CLS} />
            <p className="text-[11px] font-public-sans text-muted-text">
              {howItIsMade.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </Field>
          <Field label="Artisan Name" hint="Name of the maker or lead artisan">
            <input type="text" value={artisanName} onChange={(e) => setArtisanName(e.target.value)}
              placeholder="e.g. Ramesh Kumar" className={INPUT_CLS} />
          </Field>
        </Section>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-10">
          {!isAdminMode && isRejected ? (
            <Button type="button" variant="accent" size="md" disabled={saving} onClick={handleResubmit}>
              {saving ? 'Resubmitting…' : 'Resubmit for Review'}
            </Button>
          ) : (
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {isAdminCreate
                ? (saving ? 'Publishing…' : 'Publish Product')
                : (saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit for Review')}
            </Button>
          )}
          <Button type="button" variant="ghost" size="md" onClick={() => router.push(backHref)}>
            Cancel
          </Button>
        </div>
      </div>{/* end left column */}

      {/* ── Listing score sidebar ───────────────────────────────────────── */}
      <div className="xl:sticky xl:top-24 xl:self-start">
        <ListingScoreWidget input={scoreInput} />
      </div>

      </div>{/* end grid */}
      {lightboxNode}
    </form>
  )
}
