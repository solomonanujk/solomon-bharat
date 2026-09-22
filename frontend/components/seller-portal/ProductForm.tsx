'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ChevronDown, Eye, EyeOff, Film, GripVertical, Lightbulb, Search, SlidersHorizontal, Trash2, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCategoryTree } from '@/hooks/queries/useCategories'
import { useAdminSellers } from '@/hooks/queries/useSellers'
import {
  useSubmitProduct,
  useUpdateMyProduct,
  useAdminUpdateProduct,
  useAdminCreateProduct,
  useResubmitProduct,
  useSaveDraft,
  type SubmitVariantInput,
} from '@/hooks/queries/useProducts'
import { CategoryTypeahead, categoryPathLabel } from '@/components/seller-portal/CategoryTypeahead'
import { ColorSwatchModal, correctedSwatchFocus, DEFAULT_SWATCH_ZOOM, newImageRef, parseNewImageRef } from '@/components/seller-portal/ColorSwatchModal'
import { ProductOptionsModal } from '@/components/seller-portal/ProductOptionsModal'
import { ColorSwatchPromptModal } from '@/components/seller-portal/ColorSwatchPromptModal'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { getApiError } from '@/lib/getApiError'
import { cloudinaryFill, cloudinaryFit } from '@/lib/cloudinaryImage'
import { ECO_MATERIALS, ECO_PACKAGING, ECO_PRODUCTION } from '@/lib/ecoAttributes'
import { INDIAN_PLACES } from '@/lib/indianPlaces'
import type { AdminProduct, MyProduct, VariantStatus } from '@/types'

const MIN_IMAGES = 2
const MAX_IMAGES = 10
const MAX_VIDEOS = 3

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-surface text-[14px] font-sans text-primary placeholder:text-muted-text/50 focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const TEXTAREA_CLS = INPUT_CLS.replace('h-10', 'py-2.5') + ' resize-y'

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]])
}

interface VariantPricing {
  sku: string
  price: string
  inventory: string
  weight: string
  weightUnit: 'kg' | 'lb'
  length: string
  width: string
  height: string
  dimensionUnit: 'cm' | 'in'
  tariffCode: string
  status: VariantStatus
}
function defaultVP(): VariantPricing {
  return { sku: '', price: '', inventory: '', weight: '', weightUnit: 'kg', length: '', width: '', height: '', dimensionUnit: 'cm', tariffCode: '', status: 'ACTIVE' }
}
interface VariantCombo { key: string; label: string; attributes: { name: string; value: string }[] }

function Field({ label, required, hint, action, children }: {
  label: string; required?: boolean; hint?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-[14px] font-[600] font-sans text-primary">
          {label}{required && <span className="text-error ml-0.5">*</span>}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="text-[12px] font-sans text-muted-text mt-1">{hint}</p>}
    </div>
  )
}

/** Controlled-vocabulary multiselect for the eco-attribute fields, dropdown + pills. */
function MultiSelectDropdown({ label, options, values, onChange, disabled }: {
  label: string; options: readonly string[]; values: string[]; onChange: (v: string[]) => void; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])
  const remaining = options.filter((o) => !values.includes(o))
  return (
    <div>
      <label className="text-[14px] font-[600] font-sans text-primary block mb-1.5">{label}</label>
      <div ref={ref} className="relative">
        <button type="button" disabled={disabled} onClick={() => setOpen((o) => !o)}
          className={INPUT_CLS + ' flex items-center justify-between text-left'}>
          <span className="text-muted-text/60">Select all that apply</span>
          <ChevronDown size={14} className="text-muted-text" />
        </button>
        {open && remaining.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-border-warm rounded shadow-lg max-h-56 overflow-y-auto py-1">
            {remaining.map((o) => (
              <button key={o} type="button" onClick={() => { onChange([...values, o]); setOpen(false) }}
                className="w-full text-left px-4 py-2.5 text-[14px] font-sans text-primary hover:bg-muted-bg/60 transition-colors">
                {o}
              </button>
            ))}
          </div>
        )}
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {values.map((v) => (
            <span key={v} className="inline-flex items-center gap-2 bg-primary text-white rounded-full pl-3.5 pr-1.5 py-1.5 text-[13px] font-sans">
              {v}
              <button type="button" onClick={() => onChange(values.filter((x) => x !== v))} aria-label={`Remove ${v}`}
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                <X size={11} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** "Made in" typeahead — searches Indian states/UTs and known artisan/manufacturing
 *  hub cities (Solomon Bharat sources exclusively from Indian sellers), but still
 *  accepts and displays a free-text value that isn't in the list. */
function MadeInCombobox({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])
  const q = value.trim().toLowerCase()
  const filtered = q ? INDIAN_PLACES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8) : []
  return (
    <div ref={ref} className="relative max-w-md">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text/50" />
        <input type="text" value={value} disabled={disabled}
          onChange={(e) => { onChange(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Select place in India" className={INPUT_CLS + ' pl-9'} />
      </div>
      {open && filtered.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-surface border border-border-warm rounded shadow-lg max-h-56 overflow-y-auto py-1">
          {filtered.map((c) => (
            <button key={c} type="button" onClick={() => { onChange(c); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 text-[14px] font-sans text-primary hover:bg-muted-bg/60 transition-colors">
              {c}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface ProductFormProps {
  /** Omit for a create flow (seller-submit or admin-create); pass the loaded product to edit it. */
  product?: MyProduct | AdminProduct
  mode?: 'seller' | 'admin-edit' | 'admin-create'
}

function parseDimensions(dimensions: string | null | undefined) {
  if (!dimensions) return null
  const m = dimensions.match(/^([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*(cm|in)$/i)
  if (!m) return null
  return { length: m[1], width: m[2], height: m[3], unit: (m[4].toLowerCase() as 'cm' | 'in') }
}

/** Reconstructs the Size + one-other-axis rows from an existing product's variants,
 *  matching this form's simplified 2-axis model. */
function hydrateVariants(product: MyProduct | AdminProduct | undefined) {
  const variants = product?.variants ?? []
  const size = new Set<string>()
  let axisType = ''
  const axisValues = new Set<string>()
  const pricing: Record<string, VariantPricing> = {}
  const colorSwatches: Record<string, string> = {}

  for (const v of variants) {
    const attrs = v.attributes?.length ? v.attributes : [{ name: v.type, value: v.value }]
    const key = attrs.map((a) => a.value).join('__')
    for (const a of attrs) {
      if (a.name.toLowerCase() === 'size') size.add(a.value)
      else {
        axisType = a.name
        axisValues.add(a.value)
        if (a.name === 'Color' && v.imageUrl) colorSwatches[a.value] = v.imageUrl
      }
    }
    const tier = v.priceTiers?.[0]
    pricing[key] = {
      sku: v.sku ?? '',
      price: tier ? String(tier.sellerPrice) : '',
      inventory: v.inventory != null ? String(v.inventory) : '',
      weight: v.weight != null ? String(v.weight) : '',
      weightUnit: v.weightUnit ?? 'kg',
      length: v.length != null ? String(v.length) : '',
      width: v.width != null ? String(v.width) : '',
      height: v.height != null ? String(v.height) : '',
      dimensionUnit: v.dimensionUnit ?? 'cm',
      tariffCode: v.tariffCode ?? '',
      status: v.status ?? 'ACTIVE',
    }
  }

  const hasOptions: '' | 'yes' | 'no' = variants.length > 0 ? 'yes' : product ? 'no' : ''
  const dims = parseDimensions(product?.dimensions)
  const singlePricing: Record<string, VariantPricing> | null =
    variants.length === 0 && product
      ? {
          single: {
            sku: '', price: String(product.sellerPrice), inventory: String(product.declaredStock),
            weight: product.weight ?? '', weightUnit: 'kg',
            length: dims?.length ?? '', width: dims?.width ?? '', height: dims?.height ?? '',
            dimensionUnit: dims?.unit ?? 'cm', tariffCode: product.tariffCode ?? '', status: 'ACTIVE',
          },
        }
      : null

  return {
    size: Array.from(size), axisType, axisValues: Array.from(axisValues),
    pricing: singlePricing ?? pricing, colorSwatches, hasOptions, optionsSaved: hasOptions !== '',
  }
}

export function ProductForm({ product, mode = 'seller' }: ProductFormProps) {
  const router = useRouter()
  const { data: tree = [] } = useCategoryTree()
  const isAdminMode = mode !== 'seller'
  const isAdminCreate = mode === 'admin-create'
  const isEdit = !!product

  const submitMutation = useSubmitProduct()
  const sellerUpdateMutation = useUpdateMyProduct()
  const adminUpdateMutation = useAdminUpdateProduct()
  const adminCreateMutation = useAdminCreateProduct()
  const updateMutation = mode === 'admin-edit' ? adminUpdateMutation : sellerUpdateMutation
  const resubmitMutation = useResubmitProduct()
  const saveDraftMutation = useSaveDraft()

  const isApproved = product?.approvalStatus === 'APPROVED'
  const isRejected = product?.approvalStatus === 'REJECTED'
  const pendingPricingChange = product?.pendingPricingChange ?? null
  const pricingLocked = !isAdminMode && isApproved && !!pendingPricingChange
  const backHref = mode === 'seller' ? '/portal/products' : product ? `/admin/products/${product.id}` : '/admin/products'

  const [sellerMode, setSellerMode] = useState<'existing' | 'house'>('existing')
  const [selectedSellerId, setSelectedSellerId] = useState('')
  const { data: sellersPage } = useAdminSellers({ limit: 100, enabled: isAdminCreate })
  const sellers = sellersPage?.items ?? []

  // ── Basic information ──────────────────────────────────────────────────────
  const [name, setName] = useState(product?.name ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [materials, setMaterials] = useState(product?.materials ?? '')

  // ── Additional details ─────────────────────────────────────────────────────
  const [placeOfOrigin, setPlaceOfOrigin] = useState(product?.placeOfOrigin ?? '')
  const [isBestseller, setIsBestseller] = useState(product?.isBestseller ?? false)
  const [ecoMaterials, setEcoMaterials] = useState<string[]>(product?.ecoMaterials ?? [])
  const [ecoPackaging, setEcoPackaging] = useState<string[]>(product?.ecoPackaging ?? [])
  const [ecoProduction, setEcoProduction] = useState<string[]>(product?.ecoProduction ?? [])

  // ── Images & videos ─────────────────────────────────────────────────────────
  const [existingImages, setExistingImages] = useState(product?.images ?? [])
  const [removeImageIds, setRemoveImageIds] = useState<string[]>([])
  const [newImages, setNewImages] = useState<File[]>([])
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Blob URLs are a real external-resource side effect (must be paired with
  // revokeObjectURL on cleanup) — genuinely can't be derived during render.
  useEffect(() => {
    const urls = newImages.map((f) => URL.createObjectURL(f))
    setNewImagePreviews(urls)
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [newImages])
  const totalImageCount = existingImages.length + newImages.length
  const [manageImagesMode, setManageImagesMode] = useState(false)

  const [existingVideos, setExistingVideos] = useState(product?.videos ?? [])
  const [removeVideoIds, setRemoveVideoIds] = useState<string[]>([])
  const [newVideos, setNewVideos] = useState<File[]>([])
  const [newVideoPreviews, setNewVideoPreviews] = useState<string[]>([])
  const videoInputRef = useRef<HTMLInputElement>(null)
  // Same justified exception as the image-preview effect above.
  useEffect(() => {
    const urls = newVideos.map((f) => URL.createObjectURL(f))
    setNewVideoPreviews(urls)
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [newVideos])
  const totalVideoCount = existingVideos.length + newVideos.length
  const [manageVideosMode, setManageVideosMode] = useState(false)

  const { openLightbox, lightboxNode } = useImageLightbox()

  // Faire-style guided slots — the first 7 real images fill these labeled positions
  // in order (any beyond that just render as plain unlabeled tiles, up to MAX_IMAGES).
  const FIXED_IMAGE_SLOT_LABELS = ['Featured image (Required)', 'Detail', 'Detail', 'Detail', 'Detail', 'Detail', 'Variations']
  type ImageTile = { key: string; url: string; onRemove: () => void }
  const imageTiles: ImageTile[] = [
    ...existingImages.map((img): ImageTile => ({ key: img.id, url: img.url, onRemove: () => removeExistingImage(img.id) })),
    ...newImagePreviews.map((src, i): ImageTile => ({ key: src, url: src, onRemove: () => removeNewImage(i) })),
  ]

  /** A stored swatch value is either a real URL or a new:<index> reference to a
   *  not-yet-uploaded photo — resolves either to something actually displayable. */
  function resolveSwatchDisplayUrl(value: string | undefined): string | undefined {
    const newIndex = parseNewImageRef(value)
    if (newIndex === null) return value
    return newImagePreviews[newIndex]
  }

  const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  function handleFiles(files: FileList | null) {
    if (!files) return
    const room = MAX_IMAGES - totalImageCount
    if (room <= 0) { toast.error(`You can have at most ${MAX_IMAGES} images.`); return }
    // A file the browser's accept filter let through anyway (e.g. an iPhone HEIC
    // photo, or "All files" on some pickers) would otherwise silently fail to
    // decode as an <img> — reject it here with a clear reason instead.
    const all = Array.from(files)
    const accepted = all.filter((f) => ACCEPTED_IMAGE_TYPES.includes(f.type))
    const rejected = all.length - accepted.length
    if (rejected > 0) {
      toast.error(`${rejected} file${rejected > 1 ? 's' : ''} skipped — only JPEG, PNG, or WEBP images are supported (not HEIC/PDF/etc).`)
    }
    if (accepted.length === 0) return
    setNewImages((prev) => [...prev, ...accepted.slice(0, room)])
  }
  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((i) => i.id !== id))
    setRemoveImageIds((prev) => [...prev, id])
  }
  function removeNewImage(index: number) {
    setNewImages((prev) => prev.filter((_, i) => i !== index))
    // A color swatch referencing this not-yet-uploaded image by index needs to
    // either clear (it was removed) or shift down (indices after it moved back one).
    setColorSwatches((prev) => {
      const next: Record<string, string> = {}
      for (const [color, value] of Object.entries(prev)) {
        const refIndex = parseNewImageRef(value)
        if (refIndex === null) { next[color] = value; continue }
        if (refIndex === index) continue
        next[color] = newImageRef(refIndex > index ? refIndex - 1 : refIndex)
      }
      return next
    })
  }
  function handleVideoFiles(files: FileList | null) {
    if (!files) return
    const room = MAX_VIDEOS - totalVideoCount
    if (room <= 0) { toast.error(`You can have at most ${MAX_VIDEOS} videos.`); return }
    setNewVideos((prev) => [...prev, ...Array.from(files).slice(0, room)])
  }
  function removeExistingVideo(id: string) {
    setExistingVideos((prev) => prev.filter((v) => v.id !== id))
    setRemoveVideoIds((prev) => [...prev, id])
  }
  function removeNewVideo(index: number) {
    setNewVideos((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Product options ────────────────────────────────────────────────────────
  const hydrated = useMemo(() => hydrateVariants(product), [product])
  const [hasOptions, setHasOptions] = useState<'' | 'yes' | 'no'>(hydrated.hasOptions)
  const [optionsSaved, setOptionsSaved] = useState(hydrated.optionsSaved)
  const [sizeValues, setSizeValues] = useState<string[]>(hydrated.size)
  const [axisType, setAxisType] = useState(hydrated.axisType)
  const [axisValues, setAxisValues] = useState<string[]>(hydrated.axisValues)
  const [variantPricing, setVariantPricing] = useState<Record<string, VariantPricing>>(hydrated.pricing)
  const [colorSwatches, setColorSwatches] = useState<Record<string, string>>(hydrated.colorSwatches)
  // Where each color's swatch is cropped (0-100%) — lifted up here (not local to
  // the modal) so it survives closing/reopening the modal and also drives the
  // table's own Photo column thumbnail, not just the modal's nav dots.
  const [swatchFocus, setSwatchFocus] = useState<Record<string, { x: number; y: number; zoom: number }>>({})
  const [excludedCombos, setExcludedCombos] = useState<Set<string>>(new Set())

  const [optionsModalOpen, setOptionsModalOpen] = useState(false)
  const [swatchPromptOpen, setSwatchPromptOpen] = useState(false)
  const [swatchModalOpen, setSwatchModalOpen] = useState(false)
  const [swatchInitialColor, setSwatchInitialColor] = useState<string | undefined>()

  function chooseYes() {
    setHasOptions('yes')
    setOptionsModalOpen(true)
  }
  function chooseNo() {
    setHasOptions('no')
    setOptionsSaved(false)
  }
  function saveOptionsModal(result: { size: string[]; axisType: string; axisValues: string[] }) {
    setSizeValues(result.size)
    setAxisType(result.axisType)
    setAxisValues(result.axisValues)
    const willHaveColor = result.axisType === 'Color' && result.axisValues.length > 0
    setOptionsModalOpen(false)
    setOptionsSaved(!willHaveColor)
    setSwatchPromptOpen(willHaveColor)
  }
  function setColorSwatch(color: string, url: string | undefined) {
    setColorSwatches((prev) => {
      const next = { ...prev }
      if (url) next[color] = url
      else delete next[color]
      return next
    })
  }

  const variantCombos = useMemo((): VariantCombo[] => {
    if (hasOptions !== 'yes') return [{ key: 'single', label: 'Default', attributes: [] }]
    const axes: { name: string; values: string[] }[] = []
    if (sizeValues.length > 0) axes.push({ name: 'Size', values: sizeValues })
    if (axisType && axisValues.length > 0) axes.push({ name: axisType, values: axisValues })
    if (axes.length === 0) return [{ key: 'single', label: 'Default', attributes: [] }]
    return cartesian(axes.map((a) => a.values)).map((combo) => ({
      key: combo.join('__'),
      label: combo.join(' / '),
      attributes: axes.map((a, i) => ({ name: a.name, value: combo[i] })),
    }))
  }, [hasOptions, sizeValues, axisType, axisValues])

  const activeCombos = useMemo(() => variantCombos.filter((c) => !excludedCombos.has(c.key)), [variantCombos, excludedCombos])
  const showOptionsTable = hasOptions === 'no' || (hasOptions === 'yes' && optionsSaved)
  // "Yes" with no size/axis values actually chosen collapses to the same single
  // fallback row as "No" — treat it as a flat (non-variant) product, since a combo
  // with no real attribute value would fail the backend's non-empty `value` check.
  const usingSingleRow = activeCombos.length === 1 && activeCombos[0].key === 'single'

  function getVP(key: string): VariantPricing {
    return variantPricing[key] ?? defaultVP()
  }
  function setVPField(key: string, field: keyof VariantPricing, value: string) {
    setVariantPricing((p) => ({ ...p, [key]: { ...(p[key] ?? defaultVP()), [field]: value } }))
  }
  function toggleVPStatus(key: string) {
    const current = variantPricing[key]?.status ?? 'ACTIVE'
    setVariantPricing((p) => ({ ...p, [key]: { ...(p[key] ?? defaultVP()), status: current === 'INACTIVE' ? 'ACTIVE' : 'INACTIVE' } }))
  }
  function removeCombo(key: string) {
    setExcludedCombos((prev) => new Set(prev).add(key))
  }
  function autoSku(combo: VariantCombo): string {
    const prefix = name.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').toUpperCase().slice(0, 12) || 'PROD'
    return `${prefix}-${combo.key.replace(/[^a-zA-Z0-9]/g, '-').toUpperCase()}`
  }

  // ── Publish confirmation ─────────────────────────────────────────────────────
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const savingDraft = saveDraftMutation.isPending
  const saving = submitMutation.isPending || updateMutation.isPending || adminCreateMutation.isPending || resubmitMutation.isPending

  function validate(): string | null {
    if (!name.trim()) return 'Enter a product name.'
    if (!categoryId) return 'Select a product category.'
    if (!description.trim()) return 'Enter a description.'
    if (!materials.trim()) return 'Enter the product materials.'
    if (totalImageCount < MIN_IMAGES || totalImageCount > MAX_IMAGES) {
      return `Upload between ${MIN_IMAGES} and ${MAX_IMAGES} images (currently ${totalImageCount}).`
    }
    if (totalVideoCount > MAX_VIDEOS) return `You can have at most ${MAX_VIDEOS} videos.`
    if (!hasOptions) return 'Select whether this product comes in multiple options.'
    if (hasOptions === 'yes' && !optionsSaved) return 'Finish adding product options, or choose No.'
    if (activeCombos.length === 0) return 'Add at least one product option, or choose No.'
    const uncosted = activeCombos.find((c) => !(Number(getVP(c.key).price) > 0))
    if (uncosted) return `Set a price for "${uncosted.label === 'Default' ? 'this product' : uncosted.label}".`
    const unweighted = activeCombos.find((c) => !(Number(getVP(c.key).weight) > 0))
    if (unweighted) return `Set a weight for "${unweighted.label === 'Default' ? 'this product' : unweighted.label}".`
    const uninventoried = activeCombos.find((c) => {
      const inv = getVP(c.key).inventory
      return !inv.trim() || Number(inv) < 0
    })
    if (uninventoried) return `Set inventory for "${uninventoried.label === 'Default' ? 'this product' : uninventoried.label}".`
    if (isAdminCreate && sellerMode === 'existing' && !selectedSellerId) return 'Select a seller.'
    return null
  }

  function computeBase(): { sellerPrice: number; weight: number } | null {
    const rows = activeCombos.map((c) => getVP(c.key))
    const prices = rows.map((r) => Number(r.price)).filter((n) => n > 0)
    if (prices.length !== rows.length) return null
    const weightsKg = rows
      .map((r) => (Number(r.weight) > 0 ? (r.weightUnit === 'lb' ? Number(r.weight) * 0.453592 : Number(r.weight)) : null))
      .filter((n): n is number => n !== null)
    if (weightsKg.length === 0) return null
    return { sellerPrice: Math.min(...prices), weight: weightsKg[0] }
  }

  /** Declared Stock is derived from the table's own per-row Inventory — the flat
   *  (single-row) case sums to just that one row; the backend re-derives the same
   *  total server-side from variant inventory too (see deriveDeclaredStock), so this
   *  is really just keeping the client's own required-field value consistent with it. */
  function totalInventory(): number {
    return activeCombos.reduce((sum, c) => sum + (Number(getVP(c.key).inventory) || 0), 0)
  }

  function buildVariantPayload(): SubmitVariantInput[] {
    if (hasOptions !== 'yes' || usingSingleRow) return []
    return activeCombos.map((combo) => {
      const vp = getVP(combo.key)
      const primary = combo.attributes[0]
      const colorAttr = combo.attributes.find((a) => a.name === 'Color')
      const swatchValue = colorAttr ? colorSwatches[colorAttr.value] : undefined
      const newImageIndex = parseNewImageRef(swatchValue) ?? undefined
      return {
        type: primary?.name ?? 'Option',
        value: primary?.value ?? '',
        sku: vp.sku.trim() || autoSku(combo),
        status: vp.status,
        attributes: combo.attributes,
        // A swatch picked from a photo added this session (not yet uploaded) has
        // no real URL — send its index instead, the backend resolves it once the
        // images in this same submission are uploaded (see newImageIndex server-side).
        imageUrl: newImageIndex === undefined ? swatchValue : undefined,
        newImageIndex,
        priceTiers: [{ moq: 1, sellerPrice: Number(vp.price) }],
        inventory: vp.inventory ? Number(vp.inventory) : undefined,
        weight: vp.weight ? Number(vp.weight) : undefined,
        weightUnit: vp.weight ? vp.weightUnit : undefined,
        length: vp.length ? Number(vp.length) : undefined,
        width: vp.width ? Number(vp.width) : undefined,
        height: vp.height ? Number(vp.height) : undefined,
        dimensionUnit: (vp.length || vp.width || vp.height) ? vp.dimensionUnit : undefined,
        tariffCode: vp.tariffCode.trim() || undefined,
      }
    })
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const error = validate()
    if (error) { toast.error(error); return }
    const base = computeBase()
    if (!base) { toast.error('Set a price and weight for every option.'); return }

    const single = usingSingleRow ? getVP('single') : null
    const dimensions = single && (single.length || single.width || single.height)
      ? `${single.length || 0} x ${single.width || 0} x ${single.height || 0} ${single.dimensionUnit}`
      : undefined

    const commonFields = {
      name: name.trim(),
      description: description.trim(),
      materials: materials.trim(),
      dimensions,
      weight: base.weight,
      moq: 1,
      declaredStock: totalInventory(),
      sellerPrice: base.sellerPrice,
      variants: buildVariantPayload(),
      tags: [],
      isHandmade: false,
      placeOfOrigin: placeOfOrigin.trim() || undefined,
      isGITagged: false,
      ecoMaterials, ecoPackaging, ecoProduction,
      isBestseller,
      tariffCode: single ? (single.tariffCode.trim() || undefined) : undefined,
    }

    try {
      if (isEdit && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          data: {
            ...commonFields,
            // Publishing an existing draft (its only ever-false→true transition) —
            // a normal edit of a non-draft product ignores this field entirely.
            publish: product.approvalStatus === 'DRAFT',
            removeImageIds, images: newImages,
            removeVideoIds, videos: newVideos,
          },
        })
        router.push(backHref)
      } else if (isAdminCreate) {
        await adminCreateMutation.mutateAsync({
          ...commonFields,
          categoryId,
          images: newImages,
          videos: newVideos,
          sellerMode,
          sellerId: sellerMode === 'existing' ? selectedSellerId : undefined,
        })
        setPublishModalOpen(true)
      } else {
        await submitMutation.mutateAsync({
          ...commonFields,
          categoryId,
          images: newImages,
          videos: newVideos,
        })
        setPublishModalOpen(true)
      }
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  async function handleResubmit() {
    if (!product) return
    try {
      await resubmitMutation.mutateAsync(product.id)
      router.push(backHref)
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  /** Saves whatever's filled in so far without requiring the full publish checklist —
   *  only name + category are real requirements. Variant pricing/weight only goes
   *  along for the ride once every option row is actually priced (computeBase()
   *  succeeds); a half-filled options table just isn't included yet. Doesn't touch
   *  images/videos on first save (no id to attach them to) — add those on a later
   *  draft save once the product exists. */
  async function handleSaveDraft() {
    if (!name.trim()) { toast.error('Enter a product name to save a draft.'); return }
    if (!categoryId) { toast.error('Select a product category to save a draft.'); return }

    const base = computeBase()
    const single = usingSingleRow ? getVP('single') : null
    const dimensions = single && (single.length || single.width || single.height)
      ? `${single.length || 0} x ${single.width || 0} x ${single.height || 0} ${single.dimensionUnit}`
      : undefined

    const draftFields = {
      name: name.trim(),
      description: description.trim() || undefined,
      materials: materials.trim() || undefined,
      dimensions,
      weight: base?.weight,
      declaredStock: totalInventory(),
      sellerPrice: base?.sellerPrice,
      variants: base ? buildVariantPayload() : undefined,
      placeOfOrigin: placeOfOrigin.trim() || undefined,
      ecoMaterials, ecoPackaging, ecoProduction,
      isBestseller,
      tariffCode: single ? (single.tariffCode.trim() || undefined) : undefined,
    }

    try {
      if (isEdit && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          data: {
            ...draftFields,
            publish: false,
            removeImageIds, images: newImages,
            removeVideoIds, videos: newVideos,
          },
        })
      } else {
        const created = await saveDraftMutation.mutateAsync({ ...draftFields, categoryId })
        router.push(`/portal/products/${created.id}/edit`)
      }
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const selectedCategoryPath = categoryId ? categoryPathLabel(tree, categoryId) : ''

  return (
    <form onSubmit={handleSave} noValidate className="max-w-[1100px]">
      {isEdit && (
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[12px] font-[600] font-sans text-muted-text uppercase tracking-[0.05em]">Status</span>
          <ApprovalStatusBadge status={product!.approvalStatus} />
        </div>
      )}

      {isAdminCreate && (
        <div className="border border-border-warm rounded-xl p-8 mb-6">
          <h2 className="text-[20px] font-[700] font-sans text-primary mb-1">Seller</h2>
          <p className="text-[13px] font-sans text-muted-text mb-4">Attribute this product to a seller, or create it as house inventory.</p>
          <div className="flex gap-3 mb-4">
            <button type="button" onClick={() => setSellerMode('existing')}
              className={`choice-box-like h-10 px-4 rounded border text-[14px] font-[600] font-sans transition-colors ${sellerMode === 'existing' ? 'border-primary bg-primary text-white' : 'border-border-warm text-primary'}`}>
              Existing seller
            </button>
            <button type="button" onClick={() => setSellerMode('house')}
              className={`h-10 px-4 rounded border text-[14px] font-[600] font-sans transition-colors ${sellerMode === 'house' ? 'border-primary bg-primary text-white' : 'border-border-warm text-primary'}`}>
              House inventory
            </button>
          </div>
          {sellerMode === 'existing' && (
            <select value={selectedSellerId} onChange={(e) => setSelectedSellerId(e.target.value)} className={INPUT_CLS}>
              <option value="">Select a seller…</option>
              {sellers.map((s) => <option key={s.id} value={s.id}>{s.businessName} — {s.contactName}</option>)}
            </select>
          )}
        </div>
      )}

      {/* ── Basic information ────────────────────────────────────────────── */}
      <div className="border border-border-warm rounded-xl p-8 mb-6">
        <h2 className="text-[20px] font-[700] font-sans text-primary mb-5">Basic information</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div>
            <p className="text-[14px] font-[600] font-sans text-primary">Product details<span className="text-error ml-0.5">*</span></p>
            <p className="text-[13px] font-sans text-muted-text mb-3.5">Add a name and description to help retailers learn more about your product.</p>
            <Field label="Name">
              <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="Give your product a clear, concise name." maxLength={60} className={INPUT_CLS} />
              <p className="text-right text-[12px] font-sans text-muted-text mt-1">{name.length}/60</p>
            </Field>
          </div>

          <div>
            <p className="text-[14px] font-[600] font-sans text-primary">Product category<span className="text-error ml-0.5">*</span></p>
            <p className="text-[13px] font-sans text-muted-text mb-3.5">Provide additional information to help us categorize your products.</p>
            <Field label="Product type">
              {isEdit ? (
                <p className="h-10 flex items-center px-3 rounded border border-border-warm bg-muted-bg/30 text-[14px] font-sans text-primary">
                  {categoryPathLabel(tree, product?.categoryId)}
                </p>
              ) : (
                <CategoryTypeahead tree={tree} value={categoryId} onChange={setCategoryId} className={INPUT_CLS} />
              )}
            </Field>
          </div>
        </div>

        {categoryId && (
          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-10">
            <Field label="Description" required>
              <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                rows={4} maxLength={1000}
                placeholder="Include information about details like materials, durability, use, and more."
                className={TEXTAREA_CLS} />
              <p className="text-right text-[12px] font-sans text-muted-text mt-1">{description.length}/1000</p>
              {selectedCategoryPath && (
                <p className="text-[13px] font-sans text-primary mt-3">
                  This product will appear in:<br /><span className="font-[700]">{selectedCategoryPath}</span>
                </p>
              )}
            </Field>
            <Field label="Materials" required>
              <input type="text" value={materials} onChange={(e) => setMaterials(e.target.value)}
                placeholder="e.g. 100% cotton, brass hardware" className={INPUT_CLS} />
            </Field>
          </div>
        )}
      </div>

      {categoryId && (
        <>
          {/* ── Additional details ────────────────────────────────────────── */}
          <div className="border border-border-warm rounded-xl p-8 mb-6">
            <h2 className="text-[20px] font-[700] font-sans text-primary mb-1">Additional details</h2>
            <p className="text-[13px] font-sans text-muted-text mb-5">Include additional details to help retailers make better buying decisions.</p>

            <Field label="Made in">
              <MadeInCombobox value={placeOfOrigin} onChange={setPlaceOfOrigin} />
            </Field>

            <label className="flex items-center gap-2.5 cursor-pointer mt-5">
              <input type="checkbox" checked={isBestseller} onChange={(e) => setIsBestseller(e.target.checked)}
                className="w-4 h-4 rounded border-border-warm accent-primary" />
              <span className="text-[14px] font-sans text-primary">Mark as bestseller</span>
            </label>

            <div className="border-t border-border-warm mt-7 pt-6">
              <h3 className="text-[16px] font-[700] font-sans text-primary mb-1">Attribute tags</h3>
              <p className="text-[14px] font-[600] font-sans text-primary mt-4">Eco-friendly information</p>
              <p className="text-[13px] font-sans text-muted-text mb-5">Add eco-friendly materials, packaging, and production practices.</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <MultiSelectDropdown label="Product Materials" options={ECO_MATERIALS} values={ecoMaterials} onChange={setEcoMaterials} />
                <MultiSelectDropdown label="Packaging" options={ECO_PACKAGING} values={ecoPackaging} onChange={setEcoPackaging} />
                <MultiSelectDropdown label="Production" options={ECO_PRODUCTION} values={ecoProduction} onChange={setEcoProduction} />
              </div>
            </div>
          </div>

          {/* ── Images & videos ───────────────────────────────────────────── */}
          <div className="border border-border-warm rounded-xl p-8 mb-6">
            <h2 className="text-[20px] font-[700] font-sans text-primary mb-5">Images &amp; videos</h2>

            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <p className="text-[15px] font-[600] font-sans text-primary">Product images<span className="text-error ml-0.5">*</span></p>
                <p className="text-[13px] font-sans text-muted-text">Add a minimum of {MIN_IMAGES} high-quality images that are at least 1,050 by 1,050 pixels in size.</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <button type="button" onClick={() => setManageImagesMode((v) => !v)}
                  className={`inline-flex items-center gap-1.5 text-[12px] font-[500] font-sans transition-colors ${manageImagesMode ? 'text-primary' : 'text-muted-text hover:text-primary'}`}>
                  <SlidersHorizontal size={13} />Manage images
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-[12px] font-[500] font-sans text-muted-text hover:text-primary transition-colors">
                  <Upload size={13} />Upload image
                </button>
              </div>
            </div>

            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden"
              onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = '' }} />

            <div className="flex flex-col lg:flex-row gap-4">
              <div className="lg:w-[220px] flex-shrink-0 rounded-lg bg-muted-bg/50 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <span className="w-7 h-7 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                    <Lightbulb size={14} className="text-primary" />
                  </span>
                  <p className="text-[13px] font-sans text-primary leading-snug">
                    High-quality product images increase sales by up to 2x. Try these tips to get the best photo:
                  </p>
                </div>
                <ul className="text-[12px] font-sans text-muted-text list-disc pl-8 space-y-1">
                  <li>Upload {MIN_IMAGES}+ images.</li>
                  <li>Use a white or neutral background.</li>
                  <li>Include images of each product option.</li>
                </ul>
                <a href="#" onClick={(e) => e.preventDefault()}
                  className="inline-block text-[12px] font-[500] font-sans text-primary underline hover:text-accent transition-colors">
                  Review photography guidelines
                </a>
              </div>

              <div className="flex-1 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3.5 content-start">
                {totalImageCount < MAX_IMAGES && (
                  <button type="button" onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border border-dashed border-border-warm bg-muted-bg/30 flex flex-col items-center justify-center gap-2 text-muted-text hover:border-accent hover:text-primary transition-colors text-[13px] font-sans">
                    <Upload size={18} />Upload image
                  </button>
                )}
                {Array.from({ length: Math.max(FIXED_IMAGE_SLOT_LABELS.length, imageTiles.length) }).map((_, i) => {
                  const tile = imageTiles[i]
                  if (tile) {
                    return (
                      <div key={tile.key} className="relative aspect-square rounded-lg overflow-hidden border border-border-warm group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={cloudinaryFill(tile.url, 300, 300)} alt="" className="w-full h-full object-cover cursor-pointer"
                          onClick={() => openLightbox(tile.url)} />
                        {i === 0 && <span className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-sans px-1.5 py-0.5 rounded">Featured</span>}
                        <button type="button" onClick={tile.onRemove} aria-label="Remove image"
                          className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center transition-opacity ${manageImagesMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                          <X size={12} />
                        </button>
                      </div>
                    )
                  }
                  if (i >= FIXED_IMAGE_SLOT_LABELS.length) return null
                  return (
                    <div key={`placeholder-${i}`}
                      className="aspect-square rounded-lg border border-border-warm flex items-center justify-center text-center px-2 text-[13px] font-sans text-muted-text/60">
                      {FIXED_IMAGE_SLOT_LABELS[i]}
                    </div>
                  )
                })}
              </div>
            </div>
            <p className="text-[12px] font-sans text-muted-text mt-3 flex items-center gap-1.5">
              <GripVertical size={12} />Drag and drop images to rearrange their order.
            </p>

            <div className="border-t border-border-warm my-6" />

            <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
              <div>
                <h3 className="text-[16px] font-[700] font-sans text-primary mb-1">Product videos</h3>
                <p className="text-[13px] font-sans text-muted-text">Add up to {MAX_VIDEOS} videos to show your product in motion. Each video should be 2 GB or smaller. ({totalVideoCount}/{MAX_VIDEOS})</p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <button type="button" onClick={() => setManageVideosMode((v) => !v)}
                  className={`inline-flex items-center gap-1.5 text-[12px] font-[500] font-sans transition-colors ${manageVideosMode ? 'text-primary' : 'text-muted-text hover:text-primary'}`}>
                  <SlidersHorizontal size={13} />Manage videos
                </button>
                <button type="button" onClick={() => videoInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 text-[12px] font-[500] font-sans text-muted-text hover:text-primary transition-colors">
                  <Upload size={13} />Upload video
                </button>
              </div>
            </div>

            <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm" multiple className="hidden"
              onChange={(e) => { handleVideoFiles(e.target.files); if (videoInputRef.current) videoInputRef.current.value = '' }} />

            <div className="flex flex-wrap gap-3.5">
              {totalVideoCount < MAX_VIDEOS && (
                <button type="button" onClick={() => videoInputRef.current?.click()}
                  className="w-[160px] aspect-[16/10] rounded-lg bg-muted-bg/50 flex flex-col items-center justify-center gap-2 text-muted-text hover:text-primary transition-colors text-[13px] font-sans">
                  <Upload size={18} />Upload video
                </button>
              )}
              {existingVideos.map((v) => (
                <div key={v.id} className="relative w-[160px] aspect-[16/10] rounded-lg overflow-hidden border border-border-warm bg-black/80 flex items-center justify-center group">
                  <Film size={22} className="text-white/70" />
                  <button type="button" onClick={() => removeExistingVideo(v.id)} aria-label="Remove video"
                    className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center transition-opacity ${manageVideosMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <X size={12} />
                  </button>
                </div>
              ))}
              {newVideoPreviews.map((src, i) => (
                <div key={src} className="relative w-[160px] aspect-[16/10] rounded-lg overflow-hidden border border-border-warm bg-black group">
                  <video src={src} className="w-full h-full object-cover" muted />
                  <button type="button" onClick={() => removeNewVideo(i)} aria-label="Remove video"
                    className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center transition-opacity ${manageVideosMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ── Product options: Yes/No — always visible so the seller can switch
             between Yes and No at any time, not just before answering once. ──── */}
          <div className="border border-border-warm rounded-xl p-8 mb-6">
            <h2 className="text-[20px] font-[700] font-sans text-primary mb-1">Product options</h2>
            <p className="text-[14px] font-sans text-muted-text mb-4">
              Does this product come in multiple options, like different sizes, colors, or materials?<span className="text-error ml-0.5">*</span>
            </p>
            <div className="flex gap-4">
              <button type="button" disabled={pricingLocked} onClick={chooseYes}
                className={`w-[140px] h-11 rounded border text-[14px] font-[600] font-sans transition-colors disabled:opacity-50 ${hasOptions === 'yes' ? 'border-primary bg-primary text-white' : 'border-border-warm text-primary hover:border-primary'}`}>
                Yes
              </button>
              <button type="button" disabled={pricingLocked} onClick={chooseNo}
                className={`w-[140px] h-11 rounded border text-[14px] font-[600] font-sans transition-colors disabled:opacity-50 ${hasOptions === 'no' ? 'border-primary bg-primary text-white' : 'border-border-warm text-primary hover:border-primary'}`}>
                No
              </button>
            </div>
          </div>

          {/* ── Product options: table ────────────────────────────────────── */}
          {showOptionsTable && (
            <div className="border border-border-warm rounded-xl p-8 mb-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-[20px] font-[700] font-sans text-primary mb-1">Product options</h2>
                  <p className="text-[13px] font-sans text-muted-text max-w-lg">
                    Configure variants, pricing, and shipping in one place. One price applies to every order — no separate pricing by country.
                  </p>
                </div>
                {hasOptions === 'yes' && !pricingLocked && (
                  <button type="button" onClick={() => setOptionsModalOpen(true)}
                    className="h-9 px-3.5 rounded border border-border-warm text-[13px] font-[600] font-sans text-primary hover:border-primary transition-colors flex-shrink-0">
                    Manage options
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg border border-border-warm">
                <table className="w-full text-[13px] font-sans min-w-[1050px]">
                  <thead>
                    <tr className="bg-muted-bg/40 border-b border-border-warm">
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Photo</th>
                      {sizeValues.length > 0 && hasOptions === 'yes' && <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Size</th>}
                      {axisType && axisValues.length > 0 && hasOptions === 'yes' && <th className="text-left py-2.5 px-3 font-[600] text-muted-text">{axisType}</th>}
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">SKU</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Price (₹)*</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Inventory</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Weight</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Length</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Width</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Height</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Tariff code</th>
                      <th className="text-center py-2.5 px-3 font-[600] text-muted-text">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-warm">
                    {activeCombos.map((combo) => {
                      const vp = getVP(combo.key)
                      const colorAttr = combo.attributes.find((a) => a.name === 'Color')
                      const swatchUrl = colorAttr ? resolveSwatchDisplayUrl(colorSwatches[colorAttr.value]) : undefined
                      const swatchFocusDefault = { x: 50, y: 50, zoom: DEFAULT_SWATCH_ZOOM }
                      const swatchFocusPos = correctedSwatchFocus(colorAttr ? (swatchFocus[colorAttr.value] ?? swatchFocusDefault) : swatchFocusDefault)
                      const sizeAttr = combo.attributes.find((a) => a.name === 'Size')
                      const axisAttr = combo.attributes.find((a) => a.name === axisType)
                      return (
                        <tr key={combo.key}>
                          <td className="px-3 py-2">
                            {swatchUrl ? (
                              // The full, uncropped image — not the zoomed swatch crop (that
                              // lives in the Color column instead, right next to the color name).
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={cloudinaryFit(swatchUrl, 160)} alt="" className="w-9 h-9 rounded object-cover border border-border-warm" />
                            ) : (
                              <div className="w-9 h-9 rounded bg-muted-bg border border-border-warm" />
                            )}
                          </td>
                          {sizeValues.length > 0 && hasOptions === 'yes' && <td className="px-3 py-2 text-primary">{sizeAttr?.value ?? '—'}</td>}
                          {axisType && axisValues.length > 0 && hasOptions === 'yes' && (
                            <td className="px-3 py-2">
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                  {axisType === 'Color' && (
                                    swatchUrl ? (
                                      // The wrapping div's fixed size + overflow-hidden is load-bearing:
                                      // the img's own scale(zoom) transform balloons it well past 32px,
                                      // and this is what clips that back down to a small circle instead
                                      // of the zoomed image bleeding into neighboring cells.
                                      <div className="w-8 h-8 rounded-full overflow-hidden border border-border-warm flex-shrink-0">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={cloudinaryFit(swatchUrl, 160)} alt="" className="w-full h-full object-cover"
                                          style={{
                                            objectPosition: `${swatchFocusPos.x}% ${swatchFocusPos.y}%`,
                                            transform: `scale(${swatchFocusPos.zoom})`,
                                            transformOrigin: `${swatchFocusPos.x}% ${swatchFocusPos.y}%`,
                                          }} />
                                      </div>
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-muted-bg border border-border-warm flex-shrink-0" />
                                    )
                                  )}
                                  <span className="text-primary">{axisAttr?.value ?? '—'}</span>
                                </div>
                                {axisType === 'Color' && axisAttr && !pricingLocked && (
                                  <button type="button"
                                    onClick={() => { setSwatchInitialColor(axisAttr.value); setSwatchModalOpen(true) }}
                                    className="text-[11px] font-[500] text-accent underline hover:opacity-70 transition-opacity whitespace-nowrap self-start">
                                    Edit swatch
                                  </button>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-3 py-2">
                            <input type="text" value={vp.sku} disabled={pricingLocked}
                              onChange={(e) => setVPField(combo.key, 'sku', e.target.value)}
                              placeholder={autoSku(combo)} className={INPUT_CLS + ' h-9 w-[110px]'} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="relative w-[110px]">
                              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-text text-[13px]">₹</span>
                              <input type="number" min="0" step="0.01" value={vp.price} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'price', e.target.value)}
                                className={INPUT_CLS + ' h-9 pl-6'} />
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" value={vp.inventory} disabled={pricingLocked}
                              onChange={(e) => setVPField(combo.key, 'inventory', e.target.value)}
                              placeholder="units" className={INPUT_CLS + ' h-9 w-[90px]'} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex border border-border-warm rounded overflow-hidden w-[100px]">
                              <input type="number" min="0" step="0.01" value={vp.weight} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'weight', e.target.value)}
                                className="w-full h-9 px-2 text-[13px] font-sans text-primary outline-none disabled:opacity-50" />
                              <select value={vp.weightUnit} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'weightUnit', e.target.value)}
                                className="h-9 px-1 border-l border-border-warm bg-muted-bg/30 text-[12px] font-sans text-primary disabled:opacity-50">
                                <option value="kg">kg</option>
                                <option value="lb">lb</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex border border-border-warm rounded overflow-hidden w-[92px]">
                              <input type="number" min="0" value={vp.length} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'length', e.target.value)}
                                className="w-full h-9 px-2 text-[13px] font-sans text-primary outline-none disabled:opacity-50" />
                              <select value={vp.dimensionUnit} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'dimensionUnit', e.target.value)}
                                className="h-9 px-1 border-l border-border-warm bg-muted-bg/30 text-[12px] font-sans text-primary disabled:opacity-50">
                                <option value="cm">cm</option>
                                <option value="in">in</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex border border-border-warm rounded overflow-hidden w-[92px]">
                              <input type="number" min="0" value={vp.width} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'width', e.target.value)}
                                className="w-full h-9 px-2 text-[13px] font-sans text-primary outline-none disabled:opacity-50" />
                              <select value={vp.dimensionUnit} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'dimensionUnit', e.target.value)}
                                className="h-9 px-1 border-l border-border-warm bg-muted-bg/30 text-[12px] font-sans text-primary disabled:opacity-50">
                                <option value="cm">cm</option>
                                <option value="in">in</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex border border-border-warm rounded overflow-hidden w-[92px]">
                              <input type="number" min="0" value={vp.height} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'height', e.target.value)}
                                className="w-full h-9 px-2 text-[13px] font-sans text-primary outline-none disabled:opacity-50" />
                              <select value={vp.dimensionUnit} disabled={pricingLocked}
                                onChange={(e) => setVPField(combo.key, 'dimensionUnit', e.target.value)}
                                className="h-9 px-1 border-l border-border-warm bg-muted-bg/30 text-[12px] font-sans text-primary disabled:opacity-50">
                                <option value="cm">cm</option>
                                <option value="in">in</option>
                              </select>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={vp.tariffCode} disabled={pricingLocked}
                              onChange={(e) => setVPField(combo.key, 'tariffCode', e.target.value)}
                              placeholder="e.g. 5701.10" className={INPUT_CLS + ' h-9 w-[110px]'} />
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center justify-center gap-2.5">
                              <button type="button" disabled={pricingLocked} onClick={() => toggleVPStatus(combo.key)}
                                aria-label={vp.status === 'INACTIVE' ? `Show ${combo.label}` : `Hide ${combo.label}`}
                                title={vp.status === 'INACTIVE' ? 'Hidden — click to show' : 'Visible — click to hide'}
                                className={`transition-colors disabled:opacity-40 ${vp.status === 'INACTIVE' ? 'text-primary' : 'text-muted-text hover:text-primary'}`}>
                                {vp.status === 'INACTIVE' ? <EyeOff size={15} /> : <Eye size={15} />}
                              </button>
                              {hasOptions === 'yes' && activeCombos.length > 1 && (
                                <button type="button" disabled={pricingLocked} onClick={() => removeCombo(combo.key)}
                                  aria-label={`Delete ${combo.label}`} title="Delete this option"
                                  className="text-muted-text hover:text-red-600 transition-colors disabled:opacity-40">
                                  <Trash2 size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reserves space for the fixed bar below so it never covers the last section. */}
      <div className="h-24 max-lg:h-32" />

      {/* ── Fixed publish bar — pinned to the viewport bottom the whole time,
         not just once you've scrolled to the end, so Publish/Cancel/Draft are
         always reachable on a long form. Sits above the portal's own mobile
         bottom tab bar and to the right of the desktop sidebar. ────────────── */}
      <div className="fixed left-0 right-0 bottom-14 lg:left-[190px] lg:bottom-0 z-20 bg-bg border-t border-border-warm">
        <div className="max-w-[1100px] mx-auto px-8 max-lg:px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <span className="text-[13px] font-sans text-muted-text">
            Fields marked with <span className="text-primary">*</span> are required to publish product
          </span>
          <div className="flex items-center gap-5">
            {mode === 'seller' && (!product || product.approvalStatus === 'DRAFT') && (
              <button type="button" disabled={saving || savingDraft} onClick={handleSaveDraft}
                className="text-[13px] font-[500] font-sans text-primary underline hover:text-accent transition-colors disabled:opacity-50">
                {savingDraft ? 'Saving draft…' : 'Save as draft'}
              </button>
            )}
            {!isAdminMode && isRejected ? (
              <Button type="button" variant="accent" size="md" disabled={saving || savingDraft} onClick={handleResubmit}>
                {saving ? 'Resubmitting…' : 'Resubmit for Review'}
              </Button>
            ) : (
              <Button type="submit" variant="primary" size="lg" disabled={saving || savingDraft}>
                {saving ? 'Publishing…' : isEdit ? 'Save Changes' : 'Publish product'}
              </Button>
            )}
            <button type="button" onClick={() => router.push(backHref)}
              className="text-[13px] font-[500] font-sans text-primary underline hover:text-accent transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>

      {lightboxNode}

      {optionsModalOpen && (
        <ProductOptionsModal
          sizeValues={sizeValues}
          axisType={axisType}
          axisValues={axisValues}
          disabled={pricingLocked}
          onCancel={() => setOptionsModalOpen(false)}
          onSave={saveOptionsModal}
        />
      )}

      {swatchPromptOpen && (
        <ColorSwatchPromptModal
          onAddSwatches={() => { setSwatchPromptOpen(false); setSwatchModalOpen(true) }}
          onMaybeLater={() => { setSwatchPromptOpen(false); setOptionsSaved(true) }}
        />
      )}

      {swatchModalOpen && (
        <ColorSwatchModal
          colorValues={axisValues}
          images={existingImages}
          newImages={newImagePreviews.map((previewUrl, index) => ({ index, previewUrl }))}
          swatches={colorSwatches}
          focus={swatchFocus}
          onFocusChange={(color, pos) => setSwatchFocus((prev) => ({ ...prev, [color]: pos }))}
          initialColor={swatchInitialColor}
          onChange={setColorSwatch}
          onClose={() => { setSwatchModalOpen(false); setSwatchInitialColor(undefined); setOptionsSaved(true) }}
        />
      )}

      {publishModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/45" role="dialog" aria-modal="true">
          <div className="bg-surface rounded-xl p-9 max-w-md w-full text-center">
            <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Check size={26} />
            </div>
            <h2 className="text-[20px] font-[600] font-display text-primary mb-3">Submitted for review</h2>
            <p className="text-[14px] font-sans text-muted-text mb-7">
              Your product has been submitted to Solomon Bharat for review. We&apos;ll notify you once it&apos;s live.
            </p>
            <Button type="button" variant="primary" size="md" className="w-full" onClick={() => router.push(backHref)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </form>
  )
}
