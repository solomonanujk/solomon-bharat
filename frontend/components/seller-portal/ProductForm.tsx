'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import api from '@/lib/api'
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
import { PhotographyGuidelinesModal } from '@/components/seller-portal/PhotographyGuidelinesModal'
import { ApprovalStatusBadge } from '@/components/seller-portal/StatusBadges'
import { useImageLightbox } from '@/components/shared/ImageLightbox'
import { getApiError } from '@/lib/getApiError'
import { cloudinaryFill, cloudinaryFit } from '@/lib/cloudinaryImage'
import { ECO_MATERIALS, ECO_PACKAGING, ECO_PRODUCTION } from '@/lib/ecoAttributes'
import { INDIAN_PLACES } from '@/lib/indianPlaces'
import { TierTable } from '@/components/seller-portal/TierTable'
import {
  FLAT_KEY, blankTierRow, buildPricingPayload, cloneTierRows, evaluatePricing,
  hydrateTierRows, starterTierRows, tiersEqual, type PayloadTier, type PricingPayload, type TierField, type TierRow,
} from '@/components/seller-portal/productPricing'
import type { AdminProduct, DimensionUnit, MyProduct, VariantStatus } from '@/types'

const MIN_IMAGES = 2
const MAX_IMAGES = 10
const MAX_VIDEOS = 3
/** Per-video cap — mirrors MAX_VIDEO_FILE_SIZE_BYTES in backend/src/middleware/upload.ts. */
const MAX_VIDEO_MB = 100
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm']
/** Units a seller can pick for dimensions; `in` is stored as-is and shown as "inch" here. */
const DIMENSION_UNIT_OPTIONS: { value: DimensionUnit; label: string }[] = [
  { value: 'cm', label: 'cm' },
  { value: 'in', label: 'inch' },
  { value: 'm', label: 'm' },
]

const INPUT_CLS =
  'w-full h-10 px-3 rounded border border-border-warm bg-surface text-[14px] font-sans text-primary placeholder:text-muted-text/50 focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
const TEXTAREA_CLS = INPUT_CLS.replace('h-10', 'py-2.5') + ' resize-y'

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])), [[]])
}

interface VariantPricing {
  sku: string
  inventory: string
  weight: string
  weightUnit: 'kg' | 'lb'
  length: string
  width: string
  height: string
  dimensionUnit: DimensionUnit
  tariffCode: string
  status: VariantStatus
}
function defaultVP(): VariantPricing {
  return { sku: '', inventory: '', weight: '', weightUnit: 'kg', length: '', width: '', height: '', dimensionUnit: 'cm', tariffCode: '', status: 'ACTIVE' }
}
interface VariantCombo { key: string; label: string; attributes: { name: string; value: string }[] }

/** A star after a label, marking a field that must be filled in to publish. */
function RequiredStar() {
  return <span className="text-error ml-0.5" aria-hidden="true">*</span>
}

function Field({ id, label, required, hint, action, children }: {
  id?: string; label: string; required?: boolean; hint?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div id={id} className="scroll-mt-24">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-[14px] font-[600] font-sans text-primary">
          {label}{required && <RequiredStar />}
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
            <span key={v} className="inline-flex items-center gap-2 bg-forest text-white rounded-full pl-3.5 pr-1.5 py-1.5 text-[13px] font-sans">
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
  const m = dimensions.match(/^([\d.]+)\s*x\s*([\d.]+)\s*x\s*([\d.]+)\s*(cm|in|m)$/i)
  if (!m) return null
  return { length: m[1], width: m[2], height: m[3], unit: (m[4].toLowerCase() as DimensionUnit) }
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
  const tiers: Record<string, TierRow[]> = {}
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
    tiers[key] = hydrateTierRows(key, v.priceTiers)
    pricing[key] = {
      sku: v.sku ?? '',
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
  if (variants.length === 0 && product) {
    tiers[FLAT_KEY] = hydrateTierRows(FLAT_KEY, product.priceTiers, { moq: product.moq, sellerPrice: product.sellerPrice })
  }
  const dims = parseDimensions(product?.dimensions)
  const singlePricing: Record<string, VariantPricing> | null =
    variants.length === 0 && product
      ? {
          single: {
            sku: '', inventory: String(product.declaredStock),
            weight: product.weight ?? '', weightUnit: 'kg',
            length: dims?.length ?? '', width: dims?.width ?? '', height: dims?.height ?? '',
            dimensionUnit: dims?.unit ?? 'cm', tariffCode: product.tariffCode ?? '', status: 'ACTIVE',
          },
        }
      : null

  return {
    size: Array.from(size), axisType, axisValues: Array.from(axisValues),
    pricing: singlePricing ?? pricing, colorSwatches, hasOptions, optionsSaved: hasOptions !== '',
    tiers,
  }
}

export function ProductForm({ product, mode = 'seller' }: ProductFormProps) {
  const router = useRouter()
  const { data: tree = [] } = useCategoryTree()
  const isAdminMode = mode !== 'seller'
  const isAdminCreate = mode === 'admin-create'
  const isEdit = !!product

  const submitMutation = useSubmitProduct('Product submitted for review.')
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
  const [drafting, setDrafting] = useState(false)

  // AI writing help: drafts a description from the details already entered; the seller edits it.
  async function draftDescriptionWithAi() {
    if (!name.trim()) {
      toast.error('Enter the product name first.')
      return
    }
    setDrafting(true)
    try {
      const res = await api.post('/products/description-draft', {
        name: name.trim(),
        category: selectedCategoryPath || undefined,
        materials: materials.trim() || undefined,
        craftTechnique: craftTechnique.trim() || undefined,
        placeOfOrigin: placeOfOrigin.trim() || undefined,
        careInstructions: careInstructions.trim() || undefined,
        notes: description.trim() || undefined,
      })
      setDescription(String(res.data.data.description).slice(0, 1000))
      toast.success('Draft added. Review and edit it before saving.')
    } catch (err) {
      toast.error(getApiError(err, 'Could not draft a description. Try again.'))
    } finally {
      setDrafting(false)
    }
  }
  const [materials, setMaterials] = useState(product?.materials ?? '')

  // ── Additional details ─────────────────────────────────────────────────────
  const [placeOfOrigin, setPlaceOfOrigin] = useState(product?.placeOfOrigin ?? '')
  const [craftTechnique, setCraftTechnique] = useState(product?.craftTechnique ?? '')
  const [careInstructions, setCareInstructions] = useState(product?.careInstructions ?? '')
  // Samples: admins set them for curated products.
  const [offersSamples, setOffersSamples] = useState<'yes' | 'no' | ''>(
    product ? (product.offersSamples ? 'yes' : 'no') : '',
  )
  const [sampleMaxQty, setSampleMaxQty] = useState(product?.sampleMaxQty ? String(product.sampleMaxQty) : '')
  const [samplePrice, setSamplePrice] = useState(product?.samplePrice ? String(product.samplePrice) : '')
  const samplesRequired = false
  const [leadTime, setLeadTime] = useState(product?.leadTime ?? '')
  const [isMadeToOrder, setIsMadeToOrder] = useState<'yes' | 'no' | ''>(
    product ? (product.isMadeToOrder ? 'yes' : 'no') : '',
  )
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs local state from server data / browser storage once it is available
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs local state from server data / browser storage once it is available
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
    // The server rejects anything else anyway; catching it here gives a clear reason
    // before a long upload instead of a failed save afterwards.
    const all = Array.from(files)
    const wrongType = all.filter((f) => !ACCEPTED_VIDEO_TYPES.includes(f.type))
    const tooBig = all.filter((f) => ACCEPTED_VIDEO_TYPES.includes(f.type) && f.size > MAX_VIDEO_MB * 1024 * 1024)
    if (wrongType.length > 0) toast.error(`${wrongType.length} file${wrongType.length > 1 ? 's' : ''} skipped. Only MP4, MOV or WEBM videos are supported.`)
    if (tooBig.length > 0) toast.error(`${tooBig.length} video${tooBig.length > 1 ? 's are' : ' is'} over ${MAX_VIDEO_MB} MB. Trim or compress ${tooBig.length > 1 ? 'them' : 'it'} and try again.`)
    const accepted = all.filter((f) => !wrongType.includes(f) && !tooBig.includes(f))
    if (accepted.length === 0) return
    setNewVideos((prev) => [...prev, ...accepted.slice(0, room)])
  }
  function removeExistingVideo(id: string) {
    setExistingVideos((prev) => prev.filter((v) => v.id !== id))
    setRemoveVideoIds((prev) => [...prev, id])
  }
  function removeNewVideo(index: number) {
    setNewVideos((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Craft story ──────────────────────────────────────────────────────────
  const [howItIsMade, setHowItIsMade] = useState(product?.howItIsMade ?? '')
  const [artisanName, setArtisanName] = useState(product?.artisanName ?? '')
  const [existingCraftImageUrl, setExistingCraftImageUrl] = useState(product?.craftImageUrl ?? null)
  const [craftImage, setCraftImage] = useState<File | null>(null)
  const [craftImagePreview, setCraftImagePreview] = useState<string | null>(null)
  const [removeCraftImage, setRemoveCraftImage] = useState(false)
  const craftImageInputRef = useRef<HTMLInputElement>(null)
  // Same justified exception as the image/video-preview effects above.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs local state from server data / browser storage once it is available
    if (!craftImage) { setCraftImagePreview(null); return }
    const url = URL.createObjectURL(craftImage)
    setCraftImagePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [craftImage])
  function handleCraftImageFile(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, or WEBP images are supported (not HEIC/PDF/etc).')
      return
    }
    setCraftImage(file)
    setRemoveCraftImage(false)
  }
  function removeCraftImagePhoto() {
    setCraftImage(null)
    if (existingCraftImageUrl) setRemoveCraftImage(true)
    setExistingCraftImageUrl(null)
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
  // Volume-pricing ladders, keyed like variantPricing ('single' for a product with no options).
  // Same table for sellers and admins; only labels differ.
  const [tierRows, setTierRows] = useState<Record<string, TierRow[]>>(hydrated.tiers)
  const [showTierErrors, setShowTierErrors] = useState(false)
  const tierIdCounter = useRef(0)
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
  function getTiers(key: string): TierRow[] {
    const rows = tierRows[key]
    return rows && rows.length > 0 ? rows : starterTierRows(key)
  }
  function setTiers(key: string, update: (rows: TierRow[]) => TierRow[]) {
    setTierRows((p) => ({ ...p, [key]: update(p[key] && p[key].length > 0 ? p[key] : starterTierRows(key)) }))
  }
  function addTier(key: string) {
    tierIdCounter.current += 1
    const id = `${key}::n${tierIdCounter.current}`
    setTiers(key, (rows) => [...rows, blankTierRow(id)])
  }
  function removeTier(key: string, id: string) {
    setTiers(key, (rows) => rows.filter((r) => r.id !== id))
  }
  function updateTier(key: string, id: string, field: TierField, value: string) {
    setTiers(key, (rows) => rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }
  function applyTiersToAll(fromKey: string) {
    const source = getTiers(fromKey)
    setTierRows((p) => {
      const next = { ...p }
      for (const c of activeCombos) if (c.key !== fromKey) next[c.key] = cloneTierRows(source, c.key)
      return next
    })
    toast.success('Applied these tiers to every option.')
  }

  /** Admin-create also prices each tier for buyers and agents.  */
  const withAdminPricing = isAdminCreate
  const ladderKeys = activeCombos.map((c) => c.key)
  const pricingEval = evaluatePricing(
    ladderKeys.map((key) => ({ key, rows: getTiers(key) })),
    { strict: false, withAdminPricing },
  )
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

  const [guidelinesModalOpen, setGuidelinesModalOpen] = useState(false)

  // ── Publish confirmation ─────────────────────────────────────────────────────
  const [publishModalOpen, setPublishModalOpen] = useState(false)
  const savingDraft = saveDraftMutation.isPending
  const [resubmitting, setResubmitting] = useState(false)
  const saving = submitMutation.isPending || updateMutation.isPending || adminCreateMutation.isPending || resubmitMutation.isPending

  // ── Publish checklist ───────────────────────────────────────────────────────
  // One list drives both the publish validation (first unmet item = the error toast)
  // and the progress bar ("% complete · Next: …"). Each item knows which field to
  // scroll to. Items that do not apply (e.g. sample price when no samples) are left out.
  /** Made to order: no stock to declare, so inventory is hidden and not required. */
  const madeToOrder = isMadeToOrder === 'yes'
  /** Dimensions and HSN code are mandatory listing fields (BUSINESS_DECISIONS); required
   *  for new seller listings and drafts, not forced onto already-submitted products. */
  const requireListingDetails = mode === 'seller' && (!product || product.approvalStatus === 'DRAFT')
  const optionLabel = (c: VariantCombo) => (c.label === 'Default' ? 'this product' : c.label)
  /** Hidden options need no stock; the no-options single row always does (mirrors readyStockIssue server-side). */
  const needsInventory = (c: VariantCombo) => !madeToOrder && (usingSingleRow || getVP(c.key).status !== 'INACTIVE')
  const unweighted = activeCombos.find((c) => !(Number(getVP(c.key).weight) > 0))
  const undimensioned = activeCombos.find((c) => {
    const vp = getVP(c.key)
    return !(Number(vp.length) > 0 && Number(vp.width) > 0 && Number(vp.height) > 0)
  })
  const noHsn = activeCombos.find((c) => !getVP(c.key).tariffCode.trim())
  const uninventoried = activeCombos.find((c) => {
    if (!needsInventory(c)) return false
    const inv = Number(getVP(c.key).inventory)
    return !(Number.isInteger(inv) && inv >= 1)
  })
  const optionsReady = !!hasOptions && !(hasOptions === 'yes' && !optionsSaved) && activeCombos.length > 0

  type ChecklistItem = { key: string; anchor: string; done: boolean; next: string; error: string }
  const checklist: ChecklistItem[] = [
    ...(isAdminCreate && sellerMode === 'existing'
      ? [{ key: 'seller', anchor: 'pf-seller', done: !!selectedSellerId, next: 'Select a seller', error: 'Select a seller.' }]
      : []),
    { key: 'name', anchor: 'pf-name', done: !!name.trim(), next: 'Add a product name', error: 'Enter a product name.' },
    { key: 'category', anchor: 'pf-category', done: !!categoryId, next: 'Choose a product category', error: 'Select a product category.' },
    { key: 'description', anchor: 'pf-description', done: !!description.trim(), next: 'Write a description', error: 'Enter a description.' },
    { key: 'materials', anchor: 'pf-materials', done: !!materials.trim(), next: 'Add the materials', error: 'Enter the product materials.' },
    { key: 'region', anchor: 'pf-region', done: !!placeOfOrigin.trim(), next: 'Choose where it is made', error: 'Select where the product is made (region).' },
    { key: 'craft', anchor: 'pf-craft', done: !!craftTechnique.trim(), next: 'Add the craft technique', error: 'Enter the craft technique (e.g. block printing, hand weaving).' },
    { key: 'mto', anchor: 'pf-mto', done: !!isMadeToOrder, next: 'Choose made to order or ready stock', error: 'Choose whether this product is made to order or ready stock.' },
    { key: 'lead', anchor: 'pf-lead', done: !!leadTime.trim(), next: 'Add the lead time', error: 'Enter the lead time (e.g. 15-20 days).' },
    { key: 'care', anchor: 'pf-care', done: !!careInstructions.trim(), next: 'Add care instructions', error: 'Enter care instructions.' },
    ...(samplesRequired
      ? [{ key: 'samples', anchor: 'pf-samples', done: !!offersSamples, next: 'Say whether you offer samples', error: 'Choose whether you offer samples of this product.' }]
      : []),
    ...(offersSamples === 'yes'
      ? [
          { key: 'sampleQty', anchor: 'pf-sample-qty', done: Number(sampleMaxQty) >= 1 && Number.isInteger(Number(sampleMaxQty)), next: 'Set the maximum sample quantity', error: 'Enter the maximum sample quantity (a whole number).' },
          { key: 'samplePrice', anchor: 'pf-sample-price', done: Number(samplePrice) > 0, next: 'Set the sample price', error: 'Enter the price per sample unit.' },
        ]
      : []),
    {
      key: 'images', anchor: 'pf-images', done: totalImageCount >= MIN_IMAGES && totalImageCount <= MAX_IMAGES,
      next: totalImageCount > MAX_IMAGES ? `Remove photos (max ${MAX_IMAGES})` : `Add at least ${MIN_IMAGES} photos`,
      error: `Upload between ${MIN_IMAGES} and ${MAX_IMAGES} images (currently ${totalImageCount}).`,
    },
    {
      key: 'options', anchor: 'pf-options', done: optionsReady,
      next: !hasOptions ? 'Say whether it comes in options' : 'Finish adding product options',
      error: !hasOptions
        ? 'Select whether this product comes in multiple options.'
        : activeCombos.length === 0 ? 'Add at least one product option, or choose No.' : 'Finish adding product options, or choose No.',
    },
    { key: 'pricing', anchor: 'pf-pricing', done: optionsReady && !pricingEval.hasErrors, next: 'Set your volume pricing (MOQ and price)', error: 'Fix the highlighted price tiers.' },
    {
      key: 'weight', anchor: 'pf-variants', done: optionsReady && !unweighted,
      next: 'Add the weight', error: `Set a weight for "${unweighted ? optionLabel(unweighted) : 'this product'}".`,
    },
    ...(requireListingDetails
      ? [
          {
            key: 'dimensions', anchor: 'pf-variants', done: optionsReady && !undimensioned,
            next: 'Add the dimensions (L x W x H)', error: `Set the length, width and height for "${undimensioned ? optionLabel(undimensioned) : 'this product'}".`,
          },
          {
            key: 'hsn', anchor: 'pf-variants', done: optionsReady && !noHsn,
            next: 'Add the HSN code', error: `Set the HSN code for "${noHsn ? optionLabel(noHsn) : 'this product'}".`,
          },
        ]
      : []),
    ...(!madeToOrder
      ? [{
          key: 'inventory', anchor: 'pf-variants', done: optionsReady && !uninventoried,
          next: 'Add the stock quantity', error: `Set an inventory of at least 1 for "${uninventoried ? optionLabel(uninventoried) : 'this product'}" (ready stock).`,
        }]
      : []),
  ]
  const checklistDone = checklist.filter((i) => i.done).length
  const progressPct = Math.round((checklistDone / checklist.length) * 100)
  const nextItem = checklist.find((i) => !i.done)
  const remainingCount = checklist.length - checklistDone

  /** Scrolls a field into view and focuses its first control. Fields under the
   *  category gate are not rendered yet, so fall back to the category picker. */
  function scrollToField(anchor: string) {
    const el = document.getElementById(anchor) ?? document.getElementById('pf-category')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.querySelector<HTMLElement>('input:not([type=hidden]):not(.hidden), select, textarea, button')?.focus({ preventScroll: true })
  }

  function validate(): string | null {
    if (totalVideoCount > MAX_VIDEOS) return `You can have at most ${MAX_VIDEOS} videos.`
    const missing = nextItem
    if (missing) {
      if (missing.key === 'pricing') setShowTierErrors(true)
      scrollToField(missing.anchor)
      return missing.error
    }
    if (isAdminCreate && !activeCombos.some((c) => pricingEval.ladders[c.key]?.valid.some((t) => Number(t.adminPrice) > 0))) {
      setShowTierErrors(true)
      return 'Set a Buyer Price for at least one tier.'
    }
    return null
  }

  function computeBase(): { moq: number; sellerPrice: number; weight: number; pricing: PricingPayload | null } | null {
    const rows = activeCombos.map((c) => getVP(c.key))
    // Derived from the tiers: moq = lowest tier MOQ anywhere, sellerPrice = cheapest tier price.
    const pricing = buildPricingPayload(pricingEval, ladderKeys, usingSingleRow, withAdminPricing)
    if (!pricing) return null
    const weightsKg = rows
      .map((r) => (Number(r.weight) > 0 ? (r.weightUnit === 'lb' ? Number(r.weight) * 0.453592 : Number(r.weight)) : null))
      .filter((n): n is number => n !== null)
    if (weightsKg.length === 0) return null
    return { moq: pricing?.moq ?? 0, sellerPrice: pricing?.sellerPrice ?? 0, weight: weightsKg[0], pricing }
  }

  /** Declared Stock is derived from the table's own per-row Inventory — the flat
   *  (single-row) case sums to just that one row; the backend re-derives the same
   *  total server-side from variant inventory too (see deriveDeclaredStock), so this
   *  is really just keeping the client's own required-field value consistent with it. */
  function totalInventory(): number {
    // Made to order carries no stock; any numbers typed before switching are dropped.
    if (madeToOrder) return 0
    return activeCombos.reduce((sum, c) => sum + (Number(getVP(c.key).inventory) || 0), 0)
  }

  function buildVariantPayload(pricing: PricingPayload | null): SubmitVariantInput[] {
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
        priceTiers: pricing?.variantTiers[combo.key],
        inventory: !madeToOrder && vp.inventory ? Number(vp.inventory) : undefined,
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

  /** The flat (no-option) ladder to send. Options carry their own ladders, so the flat one is
   *  sent empty to clear a stale one. Two cases are deliberately not rewritten:
   *  - a legacy product with no stored tiers and an unchanged single price: sent empty, so the
   *    pricing-change comparison on an APPROVED product sees "no change" instead of a phantom tier;
   *  - an admin editing a product whose flat tiers are untouched: omitted, because the update
   *    endpoint replaces tiers wholesale and cannot carry the admin/agent prices. */
  function flatTiersForSave(pricing: PricingPayload | null): PayloadTier[] | undefined {
    if (!pricing) return undefined
    const tiers = pricing.priceTiers
    if (!usingSingleRow || !product) return tiers
    const stored = product.priceTiers ?? []
    if ((product.variants?.length ?? 0) === 0 && stored.length === 0) {
      const only = tiers[0]
      if (tiers.length === 1 && only.moq === product.moq && only.sellerPrice === Number(product.sellerPrice)) return []
    }
    if (mode === 'admin-edit' && stored.length > 0
      && tiersEqual(tiers, stored.map((t) => ({ moq: t.moq, sellerPrice: Number(t.sellerPrice) })))) return undefined
    return tiers
  }

  /** `resubmit` (rejected product, "Save & resubmit"): the edits are saved first and the
   *  resubmit is only sent once that save succeeded, so a failed save never resubmits. */
  async function handleSave(e: React.FormEvent, opts: { resubmit?: boolean } = {}) {
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
      moq: base.moq,
      sellerPrice: base.sellerPrice,
      priceTiers: flatTiersForSave(base.pricing),
      declaredStock: totalInventory(),
      variants: buildVariantPayload(base.pricing),
      placeOfOrigin: placeOfOrigin.trim() || undefined,
      craftTechnique: craftTechnique.trim() || undefined,
      careInstructions: careInstructions.trim() || undefined,
      offersSamples: offersSamples === 'yes',
      sampleMaxQty: offersSamples === 'yes' ? Number(sampleMaxQty) : undefined,
      samplePrice: offersSamples === 'yes' ? Number(samplePrice) : undefined,
      leadTime: leadTime.trim() || undefined,
      isMadeToOrder: isMadeToOrder === 'yes',
      howItIsMade: howItIsMade.trim() || undefined,
      artisanName: artisanName.trim() || undefined,
      craftImage: craftImage ?? undefined,
      ecoMaterials, ecoPackaging, ecoProduction,
      isBestseller,
      tariffCode: single ? (single.tariffCode.trim() || undefined) : undefined,
    }

    // The form has no UI for these, so they are only defaulted on create. An edit must
    // never send them: that would overwrite imported tags / previously set flags.
    const createOnlyDefaults = { tags: [] as string[], isHandmade: false, isGITagged: false }

    try {
      if (isEdit && product) {
        await updateMutation.mutateAsync({
          id: product.id,
          data: {
            ...(commonFields),
            // Publishing an existing draft (its only ever-false→true transition) —
            // a normal edit of a non-draft product ignores this field entirely.
            publish: product.approvalStatus === 'DRAFT',
            removeImageIds, images: newImages,
            removeVideoIds, videos: newVideos,
            removeCraftImage,
          },
        })
        if (opts.resubmit) await resubmitMutation.mutateAsync(product.id)
        router.push(backHref)
      } else if (isAdminCreate) {
        await adminCreateMutation.mutateAsync({
          ...commonFields,
          ...createOnlyDefaults,
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
          ...createOnlyDefaults,
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
      sellerPrice: base?.sellerPrice, moq: base?.moq, priceTiers: flatTiersForSave(base?.pricing ?? null),
      variants: base ? buildVariantPayload(base.pricing) : undefined,
      placeOfOrigin: placeOfOrigin.trim() || undefined,
      craftTechnique: craftTechnique.trim() || undefined,
      careInstructions: careInstructions.trim() || undefined,
      offersSamples: offersSamples === 'yes',
      sampleMaxQty: offersSamples === 'yes' ? Number(sampleMaxQty) : undefined,
      samplePrice: offersSamples === 'yes' ? Number(samplePrice) : undefined,
      leadTime: leadTime.trim() || undefined,
      isMadeToOrder: isMadeToOrder === 'yes',
      howItIsMade: howItIsMade.trim() || undefined,
      artisanName: artisanName.trim() || undefined,
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
            craftImage: craftImage ?? undefined,
            removeCraftImage,
          },
        })
      } else {
        const created = await saveDraftMutation.mutateAsync({ ...draftFields, categoryId })
        // The draft endpoint is JSON-only, so anything picked before the first save is
        // uploaded now through the regular update endpoint (same as an existing draft).
        if (newImages.length > 0 || newVideos.length > 0 || craftImage) {
          try {
            await sellerUpdateMutation.mutateAsync({
              id: created.id,
              data: { publish: false, images: newImages, videos: newVideos, craftImage: craftImage ?? undefined },
            })
          } catch (err) {
            toast.error(`Draft saved, but the photos/videos could not be uploaded: ${getApiError(err)}`)
          }
        }
        router.push(`/portal/products/${created.id}/edit`)
      }
    } catch (err) {
      toast.error(getApiError(err))
    }
  }

  const selectedCategoryPath = categoryId ? categoryPathLabel(tree, categoryId) : ''
  const priceHeader = isAdminMode ? 'Price per unit (₹)' : 'Your price (₹)'
  const pricingHint = isAdminMode
      ? 'What Solomon Bharat pays the seller per unit at each order quantity. Edit the MOQs, add more tiers, or fill in a price for each.'
      : 'Your price (₹) — what Solomon pays you per unit at each order quantity. Edit the MOQs, add more tiers, or fill in a price for each.'

  return (
    <form onSubmit={handleSave} noValidate className="max-w-[1100px]">
      {isEdit && (
        <div className="flex items-center gap-3 mb-6">
          <span className="text-[12px] font-[600] font-sans text-muted-text uppercase tracking-[0.05em]">Status</span>
          <ApprovalStatusBadge status={product!.approvalStatus} />
        </div>
      )}

      {isAdminCreate && (
        <div className="border border-border-warm rounded-xl p-5 sm:p-8 mb-6">
          <h2 id="pf-seller" className="text-[20px] font-[700] font-sans text-primary mb-1 scroll-mt-24">Seller<RequiredStar /></h2>
          <p className="text-[13px] font-sans text-muted-text mb-4">Attribute this product to a seller, or create it as house inventory.</p>
          <div className="flex flex-wrap gap-3 mb-4">
            <button type="button" onClick={() => setSellerMode('existing')}
              className={`choice-box-like h-10 px-4 rounded border text-[14px] font-[600] font-sans transition-colors ${sellerMode === 'existing' ? 'border-primary bg-forest text-white' : 'border-border-warm text-primary'}`}>
              Existing seller
            </button>
            <button type="button" onClick={() => setSellerMode('house')}
              className={`h-10 px-4 rounded border text-[14px] font-[600] font-sans transition-colors ${sellerMode === 'house' ? 'border-primary bg-forest text-white' : 'border-border-warm text-primary'}`}>
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
      <div className="border border-border-warm rounded-xl p-5 sm:p-8 mb-6">
        <div className="flex items-baseline justify-between gap-3 flex-wrap mb-5">
          <h2 className="text-[20px] font-[700] font-sans text-primary">Basic information</h2>
          <p className="text-[12px] font-sans text-muted-text">Fields marked <RequiredStar /> are required to publish</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
          <div>
            <p className="text-[14px] font-[600] font-sans text-primary">Product details</p>
            <p className="text-[13px] font-sans text-muted-text mb-3.5">Add a name and description to help retailers learn more about your product.</p>
            <Field id="pf-name" label="Name" required>
              <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))}
                placeholder="Give your product a clear, concise name." maxLength={60} className={INPUT_CLS} />
              <p className="text-right text-[12px] font-sans text-muted-text mt-1">{name.length}/60</p>
            </Field>
          </div>

          <div>
            <p className="text-[14px] font-[600] font-sans text-primary">Product category</p>
            <p className="text-[13px] font-sans text-muted-text mb-3.5">Provide additional information to help us categorize your products.</p>
            <Field id="pf-category" label="Product type" required>
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
          <div className="mt-7 grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
            <Field id="pf-description" label="Description" required>
              <textarea value={description} onChange={(e) => setDescription(e.target.value.slice(0, 1000))}
                rows={4} maxLength={1000}
                placeholder="Include information about details like materials, durability, use, and more."
                className={TEXTAREA_CLS} />
              <div className="flex items-center justify-between mt-1">
                <button type="button" onClick={draftDescriptionWithAi} disabled={drafting}
                  className="text-[13px] font-[600] font-sans text-forest underline underline-offset-4 disabled:opacity-50">
                  {drafting ? 'Drafting…' : 'Draft with AI'}
                </button>
                <p className="text-[12px] font-sans text-muted-text">{description.length}/1000</p>
              </div>
              {selectedCategoryPath && (
                <p className="text-[13px] font-sans text-primary mt-3">
                  This product will appear in:<br /><span className="font-[700]">{selectedCategoryPath}</span>
                </p>
              )}
            </Field>
            <Field id="pf-materials" label="Materials" required>
              <input type="text" value={materials} onChange={(e) => setMaterials(e.target.value)}
                placeholder="e.g. 100% cotton, brass hardware" className={INPUT_CLS} />
            </Field>
          </div>
        )}
      </div>

      {categoryId && (
        <>
          {/* ── Additional details ────────────────────────────────────────── */}
          <div className="border border-border-warm rounded-xl p-5 sm:p-8 mb-6">
            <h2 className="text-[20px] font-[700] font-sans text-primary mb-1">Additional details</h2>
            <p className="text-[13px] font-sans text-muted-text mb-5">Include additional details to help retailers make better buying decisions.</p>

            <Field id="pf-region" label="Made in (region)" required>
              <MadeInCombobox value={placeOfOrigin} onChange={setPlaceOfOrigin} />
            </Field>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <Field id="pf-craft" label="Craft technique" required>
                <input type="text" value={craftTechnique} maxLength={200}
                  onChange={(e) => setCraftTechnique(e.target.value)}
                  placeholder="e.g. Hand block printing, Dhokra casting" className={INPUT_CLS} />
              </Field>
              <Field id="pf-mto" label="Made to order or ready stock?" required
                hint={isMadeToOrder === 'yes' ? 'No stock quantity needed. Buyers see your lead time.' : isMadeToOrder === 'no' ? 'You will enter the stock quantity in Product options below.' : undefined}>
                <select value={isMadeToOrder} onChange={(e) => setIsMadeToOrder(e.target.value as 'yes' | 'no' | '')} className={INPUT_CLS}>
                  <option value="">Select…</option>
                  <option value="no">Ready stock</option>
                  <option value="yes">Made to order</option>
                </select>
              </Field>
              <Field id="pf-lead" label="Lead time" required>
                <input type="text" value={leadTime} maxLength={200}
                  onChange={(e) => setLeadTime(e.target.value)}
                  placeholder="e.g. 15-20 days" className={INPUT_CLS} />
              </Field>
              <Field id="pf-care" label="Care instructions" required>
                <input type="text" value={careInstructions} maxLength={2000}
                  onChange={(e) => setCareInstructions(e.target.value)}
                  placeholder="e.g. Dry clean only; wipe with a dry cloth" className={INPUT_CLS} />
              </Field>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
              <Field id="pf-samples" label={samplesRequired ? 'Do you offer samples?' : 'Offer samples?'} required={samplesRequired}>
                <select value={offersSamples} onChange={(e) => setOffersSamples(e.target.value as 'yes' | 'no' | '')} className={INPUT_CLS}>
                  <option value="">Select…</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </Field>
              {offersSamples === 'yes' && (
                <>
                  <Field id="pf-sample-qty" label="Max sample quantity" required>
                    <input type="number" min={1} step={1} value={sampleMaxQty} onChange={(e) => setSampleMaxQty(e.target.value)}
                      placeholder="e.g. 3" className={INPUT_CLS} />
                  </Field>
                  <Field id="pf-sample-price" label="Price per sample unit (₹)" required>
                    <input type="number" min={1} step="0.01" value={samplePrice} onChange={(e) => setSamplePrice(e.target.value)}
                      placeholder="e.g. 500" className={INPUT_CLS} />
                  </Field>
                </>
              )}
            </div>

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
          <div className="border border-border-warm rounded-xl p-5 sm:p-8 mb-6">
            <h2 className="text-[20px] font-[700] font-sans text-primary mb-5">Images &amp; videos</h2>

            <div id="pf-images" className="flex items-start justify-between gap-3 flex-wrap mb-4 scroll-mt-24">
              <div>
                <p className="text-[15px] font-[600] font-sans text-primary">Product images<RequiredStar /></p>
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
                <button type="button" onClick={() => setGuidelinesModalOpen(true)}
                  className="inline-block text-[12px] font-[500] font-sans text-primary underline hover:text-accent transition-colors">
                  Review photography guidelines
                </button>
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
                <p className="text-[13px] font-sans text-muted-text">Add up to {MAX_VIDEOS} videos to show your product in motion. MP4, MOV or WEBM, up to {MAX_VIDEO_MB} MB each. ({totalVideoCount}/{MAX_VIDEOS})</p>
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
          <div className="border border-border-warm rounded-xl p-5 sm:p-8 mb-6">
            <h2 id="pf-options" className="text-[20px] font-[700] font-sans text-primary mb-1 scroll-mt-24">Product options</h2>
            <p className="text-[14px] font-sans text-muted-text mb-4">
              Does this product come in multiple options, like different sizes, colors, or materials?<RequiredStar />
            </p>
            <div className="flex gap-3 sm:gap-4">
              <button type="button" disabled={pricingLocked} onClick={chooseYes}
                className={`flex-1 sm:flex-none sm:w-[140px] h-11 rounded border text-[14px] font-[600] font-sans transition-colors disabled:opacity-50 ${hasOptions === 'yes' ? 'border-primary bg-forest text-white' : 'border-border-warm text-primary hover:border-primary'}`}>
                Yes
              </button>
              <button type="button" disabled={pricingLocked} onClick={chooseNo}
                className={`flex-1 sm:flex-none sm:w-[140px] h-11 rounded border text-[14px] font-[600] font-sans transition-colors disabled:opacity-50 ${hasOptions === 'no' ? 'border-primary bg-forest text-white' : 'border-border-warm text-primary hover:border-primary'}`}>
                No
              </button>
            </div>
          </div>

          {/* ── Product options: table ────────────────────────────────────── */}
          {showOptionsTable && (
            <div className="border border-border-warm rounded-xl p-5 sm:p-8 mb-6">
              <div id="pf-variants" className="flex items-start justify-between gap-3 mb-4 scroll-mt-24">
                <div>
                  <h2 className="text-[20px] font-[700] font-sans text-primary mb-1">Product options</h2>
                  <p className="text-[13px] font-sans text-muted-text max-w-lg">
                    Configure variants, volume pricing, and shipping in one place. One price applies to every order — no separate pricing by country.
                  </p>
                </div>
                {hasOptions === 'yes' && !pricingLocked && (
                  <button type="button" onClick={() => setOptionsModalOpen(true)}
                    className="h-9 px-3.5 rounded border border-border-warm text-[13px] font-[600] font-sans text-primary hover:border-primary transition-colors flex-shrink-0">
                    Manage options
                  </button>
                )}
              </div>

              {madeToOrder && (
                <p className="text-[13px] font-sans text-muted-text mb-3">Made to order: no stock quantity needed, so the Inventory column is hidden.</p>
              )}
              <p className="text-[12px] font-sans text-muted-text mb-2 sm:hidden">Swipe the table sideways to see every column.</p>
              <div className="overflow-x-auto rounded-lg border border-border-warm">
                <table className="w-full text-[13px] font-sans min-w-[940px]">
                  <thead>
                    <tr className="bg-muted-bg/40 border-b border-border-warm">
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Photo</th>
                      {sizeValues.length > 0 && hasOptions === 'yes' && <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Size</th>}
                      {axisType && axisValues.length > 0 && hasOptions === 'yes' && <th className="text-left py-2.5 px-3 font-[600] text-muted-text">{axisType}</th>}
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">SKU</th>
                      {!madeToOrder && <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Inventory<RequiredStar /></th>}
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Weight<RequiredStar /></th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Length{requireListingDetails && <RequiredStar />}</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Width{requireListingDetails && <RequiredStar />}</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Height{requireListingDetails && <RequiredStar />}</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">Unit</th>
                      <th className="text-left py-2.5 px-3 font-[600] text-muted-text">HSN code{requireListingDetails && <RequiredStar />}</th>
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
                      // A row with no Color option has no swatch of its own (the "No options" single
                      // row, or Size-only options), so it shows the product's featured photo — the
                      // first image above. Color rows keep the placeholder until a swatch is set.
                      const featuredPhotoUrl = !colorAttr ? imageTiles[0]?.url : undefined
                      return (
                        <tr key={combo.key}>
                          <td className="px-3 py-2">
                            {swatchUrl ? (
                              // The full, uncropped image — not the zoomed swatch crop (that
                              // lives in the Color column instead, right next to the color name).
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={cloudinaryFit(swatchUrl, 160)} alt="" className="w-9 h-9 rounded object-cover border border-border-warm" />
                            ) : featuredPhotoUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={cloudinaryFill(featuredPhotoUrl, 160, 160)} alt="Featured product photo" className="w-9 h-9 rounded object-cover border border-border-warm" />
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
                          {!madeToOrder && (
                            <td className="px-3 py-2">
                              <input type="number" min={needsInventory(combo) ? 1 : 0} step={1} value={vp.inventory} disabled={pricingLocked}
                                aria-label={`Inventory for ${optionLabel(combo)}`}
                                onChange={(e) => setVPField(combo.key, 'inventory', e.target.value)}
                                placeholder="units" className={INPUT_CLS + ' h-9 w-[90px]'} />
                            </td>
                          )}
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
                            <input type="number" min="0" step="any" value={vp.length} disabled={pricingLocked}
                              aria-label={`Length for ${optionLabel(combo)}`}
                              onChange={(e) => setVPField(combo.key, 'length', e.target.value)}
                              className={INPUT_CLS + ' h-9 w-[76px] px-2'} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={vp.width} disabled={pricingLocked}
                              aria-label={`Width for ${optionLabel(combo)}`}
                              onChange={(e) => setVPField(combo.key, 'width', e.target.value)}
                              className={INPUT_CLS + ' h-9 w-[76px] px-2'} />
                          </td>
                          <td className="px-3 py-2">
                            <input type="number" min="0" step="any" value={vp.height} disabled={pricingLocked}
                              aria-label={`Height for ${optionLabel(combo)}`}
                              onChange={(e) => setVPField(combo.key, 'height', e.target.value)}
                              className={INPUT_CLS + ' h-9 w-[76px] px-2'} />
                          </td>
                          <td className="px-3 py-2">
                            <select value={vp.dimensionUnit} disabled={pricingLocked}
                              aria-label={`Dimension unit for ${optionLabel(combo)}`}
                              onChange={(e) => setVPField(combo.key, 'dimensionUnit', e.target.value)}
                              className={INPUT_CLS + ' h-9 w-[80px] px-2'}>
                              {DIMENSION_UNIT_OPTIONS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            <input type="text" value={vp.tariffCode} disabled={pricingLocked}
                              onChange={(e) => setVPField(combo.key, 'tariffCode', e.target.value)}
                              aria-label={`HSN code for ${optionLabel(combo)}`}
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
                                  className="text-muted-text hover:text-[#183D33] transition-colors disabled:opacity-40">
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

              {/* ── Volume pricing: the same tier table for every seller type. With options,
                 each option gets its own table (the Yes/No question above is the master toggle). ── */}
              <div id="pf-pricing" className="mt-6 border-t border-border-warm pt-6 scroll-mt-24">
                <h3 className="text-[16px] font-[700] font-sans text-ink mb-1">
                  Volume Pricing<RequiredStar />
                </h3>
                <p className="text-[13px] font-sans text-muted-text max-w-xl">{pricingHint}</p>

                <div className="mt-4 space-y-5">
                  {activeCombos.map((combo, idx) => (
                    <div key={combo.key} className={usingSingleRow ? '' : 'rounded-lg border border-line p-4'}>
                      {!usingSingleRow && (
                        <p className="text-[14px] font-[600] font-sans text-ink mb-3">{combo.label}</p>
                      )}
                      <TierTable
                        idPrefix={`tiers-${combo.key.replace(/[^a-zA-Z0-9]/g, '-')}`}
                        ariaLabel={usingSingleRow ? 'Volume pricing' : `Volume pricing for ${combo.label}`}
                        rows={getTiers(combo.key)}
                        evaluation={pricingEval.ladders[combo.key]}
                        priceHeader={priceHeader}
                        showAdminPricing={withAdminPricing}
                        showAllErrors={showTierErrors}
                        disabled={pricingLocked}
                        onAdd={() => addTier(combo.key)}
                        onRemove={(id) => removeTier(combo.key, id)}
                        onUpdate={(id, field, value) => updateTier(combo.key, id, field, value)}
                        onApplyToAll={!usingSingleRow && activeCombos.length > 1 && idx === 0 ? () => applyTiersToAll(combo.key) : undefined}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Craft story ───────────────────────────────────────────────── */}
          <div className="border border-border-warm rounded-xl p-5 sm:p-8 mb-6">
            <h2 className="text-[20px] font-[700] font-sans text-primary mb-1">Craft story</h2>
            <p className="text-[13px] font-sans text-muted-text mb-5">Recommended: tell buyers the story of the craft and the people behind it. Shown on the product page.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-5">
                <Field label="How it's made">
                  <textarea value={howItIsMade} onChange={(e) => setHowItIsMade(e.target.value.slice(0, 5000))}
                    rows={4} maxLength={5000}
                    placeholder="Describe the craft process, techniques, and materials behind this product."
                    className={TEXTAREA_CLS} />
                </Field>
                <Field label="Artisan name">
                  <input type="text" value={artisanName} onChange={(e) => setArtisanName(e.target.value.slice(0, 200))}
                    placeholder="e.g. Ramesh Kumar" className={INPUT_CLS} />
                </Field>
              </div>

              <div>
                <label className="text-[14px] font-[600] font-sans text-primary block mb-1.5">Craft photo</label>
                <input ref={craftImageInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                  onChange={(e) => { handleCraftImageFile(e.target.files); if (craftImageInputRef.current) craftImageInputRef.current.value = '' }} />
                {(craftImagePreview || existingCraftImageUrl) ? (
                  <div className="relative w-full max-w-[280px] aspect-[4/3] rounded-lg overflow-hidden border border-border-warm group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={cloudinaryFill((craftImagePreview ?? existingCraftImageUrl)!, 400, 300)} alt=""
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => openLightbox((craftImagePreview ?? existingCraftImageUrl)!)} />
                    <button type="button" onClick={removeCraftImagePhoto} aria-label="Remove craft photo"
                      className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button type="button" onClick={() => craftImageInputRef.current?.click()}
                    className="w-full max-w-[280px] aspect-[4/3] rounded-lg border border-dashed border-border-warm bg-muted-bg/30 flex flex-col items-center justify-center gap-2 text-muted-text hover:border-accent hover:text-primary transition-colors text-[13px] font-sans">
                    <Upload size={18} />Upload photo
                  </button>
                )}
                <p className="text-[12px] font-sans text-muted-text mt-2">A photo of the artisan or craft process — shown alongside the craft story on the product page.</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Reserves space for the fixed bar below so it never covers the last section. */}
      <div className="h-28 max-lg:h-44" />

      {/* ── Fixed publish bar — pinned to the viewport bottom the whole time,
         not just once you've scrolled to the end, so Publish/Cancel/Draft are
         always reachable on a long form. Sits above the portal's own mobile
         bottom tab bar and to the right of the desktop sidebar. ────────────── */}
      <div className="fixed left-0 right-0 bottom-14 lg:left-[190px] lg:bottom-0 z-20 bg-bg border-t border-border-warm">
        {/* Progress line across the top edge of the bar. */}
        <div className="h-1 bg-muted-bg" aria-hidden="true">
          <div className={`h-full transition-all duration-300 ${nextItem ? 'bg-accent' : 'bg-forest'}`} style={{ width: `${progressPct}%` }} />
        </div>
        <div className="max-w-[1100px] mx-auto px-8 max-lg:px-4 py-3 lg:py-4 flex items-center justify-between gap-x-4 gap-y-2.5 flex-wrap">
          {/* Progress: % complete + the next missing required item; tap to jump to it. */}
          <button type="button" disabled={!nextItem} onClick={() => nextItem && scrollToField(nextItem.anchor)}
            aria-label={nextItem ? `${progressPct}% complete. Next: ${nextItem.next}. Go to field.` : 'All required fields complete'}
            className="flex items-center gap-2.5 min-w-0 flex-1 basis-[220px] text-left rounded-lg -m-1 p-1 enabled:hover:bg-muted-bg/50 transition-colors">
            <span role="progressbar" aria-valuenow={progressPct} aria-valuemin={0} aria-valuemax={100}
              className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-[12px] font-[700] font-sans ${nextItem ? 'bg-muted-bg text-primary' : 'bg-forest text-white'}`}>
              {nextItem ? `${progressPct}%` : <Check size={16} />}
            </span>
            <span className="min-w-0">
              <span className="block text-[13px] font-[600] font-sans text-primary">
                {nextItem ? `${progressPct}% complete` : 'Ready to publish'}
              </span>
              <span className="block truncate text-[12px] font-sans text-muted-text">
                {nextItem
                  ? <>Next: <span className="text-accent underline underline-offset-2">{nextItem.next}</span>{remainingCount > 1 ? ` · ${remainingCount - 1} more` : ''}</>
                  : 'All required fields are filled in'}
              </span>
            </span>
          </button>
          <div className="flex items-center gap-x-5 gap-y-2 flex-wrap">
            {mode === 'seller' && (!product || product.approvalStatus === 'DRAFT') && (
              <button type="button" disabled={saving || savingDraft} onClick={handleSaveDraft}
                className="text-[13px] font-[500] font-sans text-primary underline hover:text-accent transition-colors disabled:opacity-50">
                {savingDraft ? 'Saving draft…' : 'Save as draft'}
              </button>
            )}
            {!isAdminMode && isRejected ? (
              <>
                <span className="hidden sm:inline text-[12px] font-sans text-muted-text max-w-[220px]">
                  &ldquo;Save changes&rdquo; keeps this product rejected until you resubmit it.
                </span>
                <Button type="submit" variant="secondary" size="lg" className="min-h-[44px]"
                  loading={saving && !resubmitting} disabled={saving || savingDraft}>
                  Save changes
                </Button>
                <Button type="button" variant="primary" size="lg" className="min-h-[44px]"
                  loading={saving && resubmitting} disabled={saving || savingDraft}
                  onClick={(e) => { setResubmitting(true); void handleSave(e, { resubmit: true }).finally(() => setResubmitting(false)) }}>
                  Save &amp; resubmit for review
                </Button>
              </>
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
            <div className="w-14 h-14 rounded-full bg-forest/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Check size={26} />
            </div>
            <h2 className="text-[20px] font-[600] font-display text-primary mb-3">{isAdminCreate ? 'Product created and published' : 'Submitted for review'}</h2>
            <p className="text-[14px] font-sans text-muted-text mb-7">
              {isAdminCreate
                  ? 'The product has been created and is now published in the catalogue.'
                  : 'Your product has been submitted to Solomon Bharat for review. We will notify you once it is live.'}
            </p>
            <Button type="button" variant="primary" size="md" className="w-full" onClick={() => router.push(backHref)}>
              Done
            </Button>
          </div>
        </div>
      )}

      {guidelinesModalOpen && (
        <PhotographyGuidelinesModal minImages={MIN_IMAGES} onClose={() => setGuidelinesModalOpen(false)} />
      )}
    </form>
  )
}
