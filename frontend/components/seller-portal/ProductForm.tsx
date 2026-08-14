'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, Trash2, Upload, X, AlertTriangle, Sparkles, RotateCcw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import {
  useSubmitProduct,
  useUpdateMyProduct,
  useResubmitProduct,
  usePolishField,
  type SubmitVariantInput,
} from '@/hooks/queries/useProducts'
import { CategoryCascadeSelect, categoryPathLabel } from '@/components/seller-portal/CategoryCascade'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { ListingScoreWidget } from '@/components/seller-portal/ListingScore'
import { getApiError } from '@/lib/getApiError'
import type { MyProduct, ProductVariant } from '@/types'

const MIN_IMAGES = 2
const MAX_IMAGES = 10

const LEAD_TIME_PRESETS = ['1–3 days', '1–2 weeks', '2–4 weeks']

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const TEXTAREA_CLS =
  'w-full px-3 py-2 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors resize-none disabled:opacity-50 disabled:cursor-not-allowed'

let _id = 0
function uid() { return `v-${++_id}` }

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

interface TierRow { id: string; moq: string; sellerPrice: string }

function TierTable({ tiers, onAdd, onRemove, onUpdate, disabled }: {
  tiers: TierRow[]
  onAdd: () => void
  onRemove: (id: string) => void
  onUpdate: (id: string, field: 'moq' | 'sellerPrice', value: string) => void
  disabled?: boolean
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
  /** Omit for the "Submit Product" create flow; pass the loaded product to edit it. */
  product?: MyProduct
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
      tiers: (v.priceTiers ?? []).map((t) => ({ id: uid(), moq: String(t.moq), sellerPrice: String(t.sellerPrice) })),
    }
  }

  return {
    size: Array.from(size), color: Array.from(color), material: Array.from(material),
    customAxisName, customValues: Array.from(other), pricing, legacy: [] as ProductVariant[],
  }
}

export function ProductForm({ product }: ProductFormProps) {
  const router = useRouter()
  const { data: tree = [] } = useCategoryTree()

  const submitMutation = useSubmitProduct()
  const updateMutation = useUpdateMyProduct()
  const resubmitMutation = useResubmitProduct()
  const polishMutation = usePolishField()

  const isEdit = !!product
  const isApproved = product?.approvalStatus === 'APPROVED'
  const isRejected = product?.approvalStatus === 'REJECTED'
  const locked = isApproved // APPROVED products can't be edited — backend 400s on it

  // ── Core details ─────────────────────────────────────────────────────────────
  const [name, setName] = useState(product?.name ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '') // create-only, see below
  const [materials, setMaterials] = useState(product?.materials ?? '')
  const [tags, setTags] = useState(product?.tags?.length ? product.tags.join(', ') : '')
  const [lengthCm, setLengthCm] = useState(product?.lengthCm != null ? String(product.lengthCm) : '')
  const [breadthCm, setBreadthCm] = useState(product?.breadthCm != null ? String(product.breadthCm) : '')
  const [heightCm, setHeightCm] = useState(product?.heightCm != null ? String(product.heightCm) : '')
  const [weight, setWeight] = useState(product?.weight != null ? String(product.weight) : '')

  // ── Trade terms ──────────────────────────────────────────────────────────────
  const [moq, setMoq] = useState(product?.moq != null ? String(product.moq) : '')
  const [declaredStock, setDeclaredStock] = useState(product?.declaredStock != null ? String(product.declaredStock) : '')
  const [sellerPrice, setSellerPrice] = useState(product?.sellerPrice != null ? String(product.sellerPrice) : '')
  const [leadTime, setLeadTime] = useState(product?.leadTime ?? '')
  const [stepQty, setStepQty] = useState(product?.stepQty != null ? String(product.stepQty) : '1')
  const [priceTiers, setPriceTiers] = useState<TierRow[]>(
    product?.priceTiers?.length ? product.priceTiers.map((t) => ({ id: uid(), moq: String(t.moq), sellerPrice: String(t.sellerPrice) })) : []
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

  function getVP(combo: VariantCombo): VariantPricing {
    return variantPricing[combo.key] ?? { sku: '', tiers: [] }
  }
  function autoSku(combo: VariantCombo): string {
    const prefix = name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toUpperCase().slice(0, 12) || 'PROD'
    return `${prefix}-${combo.key.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}`
  }
  function setVPSku(key: string, value: string) {
    setVariantPricing((p) => ({ ...p, [key]: { ...(p[key] ?? { sku: '', tiers: [] }), sku: value } }))
  }
  function addVPTier(key: string) {
    setVariantPricing((p) => {
      const vp = p[key] ?? { sku: '', tiers: [] }
      return { ...p, [key]: { ...vp, tiers: [...vp.tiers, { id: uid(), moq: '', sellerPrice: '' }] } }
    })
  }
  function removeVPTier(key: string, tierId: string) {
    setVariantPricing((p) => {
      const vp = p[key]
      if (!vp) return p
      return { ...p, [key]: { ...vp, tiers: vp.tiers.filter((t) => t.id !== tierId) } }
    })
  }
  function updateVPTier(key: string, tierId: string, field: 'moq' | 'sellerPrice', value: string) {
    setVariantPricing((p) => {
      const vp = p[key]
      if (!vp) return p
      return { ...p, [key]: { ...vp, tiers: vp.tiers.map((t) => (t.id === tierId ? { ...t, [field]: value } : t)) } }
    })
  }

  function validTiersFor(combo: VariantCombo): TierRow[] {
    return getVP(combo).tiers.filter((t) => Number(t.moq) > 0 && Number(t.sellerPrice) > 0)
  }

  function buildVariantPayload(): SubmitVariantInput[] {
    // Stock isn't collected per variant — every variant carries the single Declared
    // Stock value from Trade Terms instead of its own figure.
    const sharedStock = declaredStock ? Number(declaredStock) : 0
    return variantCombos.map((combo) => {
      const vp = getVP(combo)
      const validTiers = [...validTiersFor(combo)].sort((a, b) => Number(a.sellerPrice) - Number(b.sellerPrice))
      const cheapest = validTiers[0]
      const primary = combo.attributes[0]
      return {
        type: primary.name,
        value: primary.value,
        sku: vp.sku.trim() || autoSku(combo),
        stock: sharedStock,
        attributes: combo.attributes,
        // The variant's own price/moq mirror its cheapest tier, same as its tier list —
        // gives a quick single price to show without recomputing from tiers.
        sellerPrice: cheapest ? Number(cheapest.sellerPrice) : undefined,
        moq: cheapest ? Number(cheapest.moq) : undefined,
        priceTiers: validTiers.length
          ? validTiers.map((t) => ({ moq: Number(t.moq), sellerPrice: Number(t.sellerPrice) }))
          : undefined,
      }
    })
  }

  /** Derives the product-level MOQ/Seller Price from each variant's cheapest tier —
   *  mirrors solomon-bharat2, which requires the base fields regardless of variants. */
  function computeVariantBasePricing(): { moq: number; sellerPrice: number } | null {
    if (variantCombos.length === 0) return null
    const cheapestPerCombo: (TierRow | undefined)[] = variantCombos.map(
      (combo) => [...validTiersFor(combo)].sort((a, b) => Number(a.sellerPrice) - Number(b.sellerPrice))[0]
    )
    if (cheapestPerCombo.some((t) => !t)) return null
    const valid = cheapestPerCombo as TierRow[]
    const cheapest = valid.reduce((min, t) => (Number(t.sellerPrice) < Number(min.sellerPrice) ? t : min))
    return { moq: Number(cheapest.moq), sellerPrice: Number(cheapest.sellerPrice) }
  }

  // ── Base price tiers ─────────────────────────────────────────────────────────
  function addTier() { setPriceTiers((prev) => [...prev, { id: uid(), moq: '', sellerPrice: '' }]) }
  function removeTier(id: string) { setPriceTiers((prev) => prev.filter((t) => t.id !== id)) }
  function updateTier(id: string, field: 'moq' | 'sellerPrice', value: string) {
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
      if (uncosted) return `Set a price and MOQ for "${uncosted.label}".`
    } else {
      if (!moq || Number(moq) <= 0) return 'MOQ must be a positive number.'
      if (!sellerPrice || Number(sellerPrice) <= 0) return 'Seller price must be a positive number.'
    }
    return null
  }

  function buildPayload() {
    const variantBase = variantsEnabled ? computeVariantBasePricing() : null
    return {
      name: name.trim(),
      description: description.trim(),
      materials: materials.trim(),
      lengthCm: lengthCm ? Number(lengthCm) : undefined,
      breadthCm: breadthCm ? Number(breadthCm) : undefined,
      heightCm: heightCm ? Number(heightCm) : undefined,
      weight: weight ? Number(weight) : undefined,
      moq: variantBase ? variantBase.moq : Number(moq),
      declaredStock: Number(declaredStock),
      sellerPrice: variantBase ? variantBase.sellerPrice : Number(sellerPrice),
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
            .map((t) => ({ moq: Number(t.moq), sellerPrice: Number(t.sellerPrice) })),
      variants: variantsEnabled ? buildVariantPayload() : [],
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const error = validate()
    if (error) { toast.error(error); return }

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
        { onSuccess: () => router.push('/portal/products') }
      )
    } else {
      submitMutation.mutate(
        { ...buildPayload(), categoryId, images: newImages },
        { onSuccess: () => router.push('/portal/products') }
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
      router.push('/portal/products')
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const saving = submitMutation.isPending || updateMutation.isPending || resubmitMutation.isPending

  return (
    <form onSubmit={handleSave} noValidate>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-6 items-start">
      <div className="space-y-6">

        {locked && (
          <div className="flex items-start gap-3 px-4 py-3.5 rounded border border-border-warm bg-muted-bg/60">
            <AlertTriangle size={16} className="text-accent shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-[13px] font-[600] font-public-sans text-primary">This product is approved and live</p>
              <p className="text-[12px] font-public-sans text-muted-text mt-0.5">
                Approved products can&apos;t be edited from the seller portal. Contact the Solomon Bharat team if something needs to change.
              </p>
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
            disabled={locked}
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = '' }}
          />
          {!locked && (
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
          )}
          {(existingImages.length > 0 || newImages.length > 0) && (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-3">
              {existingImages.map((img, i) => (
                <div key={img.id} className="relative group aspect-square rounded overflow-hidden border border-border-warm bg-muted-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    onClick={() => openLightbox(img.url, 'Product image')}
                    className="w-full h-full object-cover cursor-zoom-in"
                  />
                  {!locked && (
                    <button type="button" onClick={() => removeExistingImage(img.id)}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove image">
                      <X size={12} />
                    </button>
                  )}
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 text-[10px] font-[600] font-public-sans bg-black/60 text-white px-1.5 py-0.5 rounded">Cover</span>
                  )}
                </div>
              ))}
              {newImages.map((_file, i) => (
                <div key={`new-${i}`} className="relative group aspect-square rounded overflow-hidden border border-border-warm bg-muted-bg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newImagePreviews[i]} alt="" className="w-full h-full object-cover" />
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
            action={<PolishButton loading={!!polishing.name} canUndo={!!prevValues.name} disabled={locked} onPolish={() => polishField('name')} onUndo={() => undoField('name')} />}>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={locked}
              placeholder="e.g. Hand-Block Printed Cotton Table Runner" maxLength={200} className={INPUT_CLS} />
          </Field>

          <Field label="Description" required
            action={<PolishButton loading={!!polishing.description} canUndo={!!prevValues.description} disabled={locked} onPolish={() => polishField('description')} onUndo={() => undoField('description')} />}>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={locked}
              rows={5} placeholder="Describe the product — craftsmanship, use case, care instructions…" className={TEXTAREA_CLS} />
          </Field>

          <Field label="Category" required hint={isEdit ? 'Category can’t be changed after submission.' : 'Choose all 3 levels.'}>
            {isEdit ? (
              <p className="text-[14px] font-public-sans text-primary px-3 py-2.5 rounded border border-border-warm bg-muted-bg/30">
                {categoryPathLabel(tree, product?.categoryId)}
              </p>
            ) : (
              <CategoryCascadeSelect tree={tree} value={categoryId} onChange={setCategoryId} disabled={locked} />
            )}
          </Field>

          <Field label="Materials" required>
            <input type="text" value={materials} onChange={(e) => setMaterials(e.target.value)} disabled={locked}
              placeholder="e.g. 100% cotton, brass hardware" className={INPUT_CLS} />
          </Field>

          <Field label="Tags" hint="Comma-separated, up to 10"
            action={<PolishButton loading={!!polishing.tags} canUndo={!!prevValues.tags} disabled={locked} onPolish={() => polishField('tags')} onUndo={() => undoField('tags')} />}>
            <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} disabled={locked}
              placeholder="handmade, cotton, block print" className={INPUT_CLS} />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Weight (kg)" required={!isEdit}>
              <input type="number" min="0" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} disabled={locked}
                placeholder="e.g. 0.4" className={INPUT_CLS} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Length (cm)">
              <input type="number" min="0" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} disabled={locked}
                placeholder="e.g. 30" className={INPUT_CLS} />
            </Field>
            <Field label="Breadth (cm)">
              <input type="number" min="0" value={breadthCm} onChange={(e) => setBreadthCm(e.target.value)} disabled={locked}
                placeholder="e.g. 20" className={INPUT_CLS} />
            </Field>
            <Field label="Height (cm)">
              <input type="number" min="0" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} disabled={locked}
                placeholder="e.g. 10" className={INPUT_CLS} />
            </Field>
          </div>
          {isEdit && product?.dimensions && !lengthCm && !breadthCm && !heightCm && (
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
            <button type="button" role="switch" aria-checked={variantsEnabled} aria-label="Toggle variants" disabled={locked}
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
                  <AxisTagInput values={sizeValues} onChange={setSizeValues} placeholder="Add size…" disabled={locked} />
                </div>
              )}
              {activeVariantTab === 'color' && (
                <div className="space-y-2">
                  <p className="text-[12px] font-public-sans text-muted-text">e.g. Red, Navy Blue, Ivory — press Enter or click + to add</p>
                  <AxisTagInput values={colorValues} onChange={setColorValues} placeholder="Add color…" disabled={locked} />
                </div>
              )}
              {activeVariantTab === 'material' && (
                <div className="space-y-2">
                  <p className="text-[12px] font-public-sans text-muted-text">e.g. Cotton, Brass, Terracotta — press Enter or click + to add</p>
                  <AxisTagInput values={materialValues} onChange={setMaterialValues} placeholder="Add material…" disabled={locked} />
                </div>
              )}
              {activeVariantTab === 'other' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-[500] font-public-sans text-primary">Attribute name</label>
                    <input type="text" value={customAxisName} onChange={(e) => setCustomAxisName(e.target.value)} disabled={locked}
                      placeholder="e.g. Fragrance, Pattern, Finish" className="h-9 px-3 w-full max-w-xs rounded border border-border-warm bg-muted-bg/30 text-[13px] font-public-sans text-primary placeholder:text-muted-text/40 focus:outline-none focus:border-accent transition-colors disabled:opacity-50" />
                  </div>
                  <p className="text-[12px] font-public-sans text-muted-text">e.g. Sandalwood, Rose — press Enter or click + to add</p>
                  <AxisTagInput values={customValues} onChange={setCustomValues} placeholder="Add value…" disabled={locked} />
                </div>
              )}

              {variantCombos.length > 0 && (
                <div className="space-y-4 pt-1">
                  <p className="text-[12px] font-public-sans text-muted-text">
                    Set a SKU (optional) and at least one price tier for each variant. Stock uses the
                    Declared Stock value below for every variant.
                  </p>
                  {variantCombos.map((combo) => {
                    const vp = getVP(combo)
                    return (
                      <div key={combo.key} className="rounded border border-border-warm overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 bg-muted-bg/40 px-3 py-2 border-b border-border-warm">
                          <span className="text-[13px] font-[600] font-public-sans text-primary">{combo.label}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-public-sans text-muted-text">SKU</span>
                            <input type="text" value={vp.sku} disabled={locked}
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
                            disabled={locked}
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
              <input type="number" min="0" value={declaredStock} onChange={(e) => setDeclaredStock(e.target.value)} disabled={locked}
                placeholder="e.g. 500" className={INPUT_CLS} />
            </Field>
            <Field label="Order Step (units)" hint="Buyers order in multiples of this">
              <input type="number" min="1" value={stepQty} onChange={(e) => setStepQty(e.target.value)} disabled={locked}
                placeholder="e.g. 1" className={INPUT_CLS} />
            </Field>
          </div>

          {!variantsEnabled && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="MOQ (units)" required>
                  <input type="number" min="1" value={moq} onChange={(e) => setMoq(e.target.value)} disabled={locked}
                    placeholder="e.g. 50" className={INPUT_CLS} />
                </Field>
                <Field label="Seller Price (₹ per unit)" required hint="What Solomon Bharat pays you.">
                  <input type="number" min="0" step="0.01" value={sellerPrice} onChange={(e) => setSellerPrice(e.target.value)} disabled={locked}
                    placeholder="e.g. 450" className={INPUT_CLS} />
                </Field>
              </div>

              <Field label="Volume Pricing (optional)" hint="Offer a lower per-unit price at higher order quantities.">
                <TierTable tiers={priceTiers} onAdd={addTier} onRemove={removeTier} onUpdate={updateTier} disabled={locked} />
              </Field>
            </>
          )}

          <Field label="Lead Time" hint="Pick a preset or type your own.">
            <div className="flex flex-wrap gap-2 mb-2">
              {LEAD_TIME_PRESETS.map((preset) => (
                <button key={preset} type="button" disabled={locked} onClick={() => setLeadTime(preset)}
                  className={`px-3 h-8 rounded border text-[12px] font-[500] font-public-sans transition-colors disabled:opacity-50 ${leadTime === preset ? 'border-primary bg-primary text-white' : 'border-border-warm text-muted-text hover:border-primary hover:text-primary'}`}>
                  {preset}
                </button>
              ))}
            </div>
            <input type="text" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} disabled={locked}
              placeholder="e.g. 2–3 weeks" className={INPUT_CLS} />
          </Field>
        </Section>

        {/* ── Product Attributes ─────────────────────────────────────────────── */}
        <Section title="Product Attributes">
          <Field label="Place of Origin" hint="State or region">
            <input type="text" value={placeOfOrigin} onChange={(e) => setPlaceOfOrigin(e.target.value)} disabled={locked}
              placeholder="e.g. Jaipur, Rajasthan" className={INPUT_CLS} />
          </Field>
          <div className="flex flex-col gap-4 pt-1">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-[14px] font-[500] font-public-sans text-primary">Handmade</p>
                <p className="text-[12px] font-public-sans text-muted-text">Crafted by hand, not machine-made</p>
              </div>
              <button type="button" role="switch" aria-checked={isHandmade} disabled={locked}
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
              <button type="button" role="switch" aria-checked={isGITagged} disabled={locked}
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
            <textarea value={howItIsMade} onChange={(e) => setHowItIsMade(e.target.value)} disabled={locked}
              placeholder="e.g. This table runner is hand-woven on a traditional pit loom using organic cotton yarn…"
              rows={4} className={TEXTAREA_CLS} />
            <p className="text-[11px] font-public-sans text-muted-text">
              {howItIsMade.trim().split(/\s+/).filter(Boolean).length} words
            </p>
          </Field>
          <Field label="Artisan Name" hint="Name of the maker or lead artisan">
            <input type="text" value={artisanName} onChange={(e) => setArtisanName(e.target.value)} disabled={locked}
              placeholder="e.g. Ramesh Kumar" className={INPUT_CLS} />
          </Field>
        </Section>

        {/* ── Actions ─────────────────────────────────────────────────────── */}
        {!locked && (
          <div className="flex items-center gap-3 pb-10">
            {isRejected ? (
              <Button type="button" variant="accent" size="md" disabled={saving} onClick={handleResubmit}>
                {saving ? 'Resubmitting…' : 'Resubmit for Review'}
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="md" disabled={saving}>
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Submit for Review'}
              </Button>
            )}
            <Button type="button" variant="ghost" size="md" onClick={() => router.push('/portal/products')}>
              Cancel
            </Button>
          </div>
        )}
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
